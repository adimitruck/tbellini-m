begin;

-- Invite-only registration. Codes are created by members through create_invitation()
-- and consumed exactly once by the signup trigger; clients never read or write the table.
create table public.invitations (
  code text primary key check (code ~ '^[A-Z0-9-]{8,12}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  check (expires_at > created_at),
  check ((used_at is null) = (used_by is null))
);
alter table public.invitations enable row level security;
revoke all on public.invitations from public, anon, authenticated;
grant all on public.invitations to service_role;

create or replace function public.join_tbellini() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  invite_code text := upper(btrim(coalesce(new.raw_user_meta_data->>'invite_code', '')));
begin
  -- Single atomic claim: a concurrent signup with the same code finds used_at already set.
  update public.invitations set used_at = now(), used_by = new.id
  where code = invite_code and used_at is null and expires_at > now();
  if not found then
    raise exception 'Invalid or expired invite code.' using errcode = '23514';
  end if;

  insert into public.profiles(id, display_name)
  values(new.id, case
    when char_length(btrim(coalesce(new.raw_user_meta_data->>'display_name',''))) between 1 and 200
    then btrim(new.raw_user_meta_data->>'display_name')
    else 'Member ' || left(new.id::text,8)
  end);

  insert into public.memberships(community_id, user_id)
  values('00000000-0000-4000-8000-000000000001', new.id);

  return new;
end;
$$;

-- Members create codes server side from a cryptographically secure source (gen_random_uuid).
-- Alphabet has 32 symbols, so byte % 32 is unbiased. UUID bytes 6 and 8 carry version/variant
-- bits and are skipped.
create function public.create_invitation(expires_in_days integer default 7) returns text language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_bytes bytea;
  result text;
  byte_index integer;
begin
  -- A profile means "registered account"; avoid coupling invites to community memberships.
  if not exists (select 1 from public.profiles where id = (select auth.uid())) then
    raise exception 'Only TBellini members can create invitations.' using errcode = '42501';
  end if;
  if expires_in_days is null or expires_in_days not between 1 and 30 then
    raise exception 'Invitations expire within 1 to 30 days.' using errcode = '22023';
  end if;
  loop
    random_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    result := '';
    foreach byte_index in array array[0,1,2,3,4,5,7,9] loop
      if char_length(result) = 4 then result := result || '-'; end if;
      result := result || substr(alphabet, get_byte(random_bytes, byte_index) % 32 + 1, 1);
    end loop;
    begin
      insert into public.invitations(code, created_by, expires_at)
      values(result, (select auth.uid()), now() + make_interval(days => expires_in_days));
      return result;
    exception when unique_violation then
      null; -- Retry on the rare collision.
    end;
  end loop;
end;
$$;

revoke all on function public.join_tbellini(), public.create_invitation(integer) from public, anon, authenticated;
grant execute on function public.create_invitation(integer) to authenticated;

commit;
