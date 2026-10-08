begin;

create table public.invitations (
  code text primary key check (code ~ '^[a-zA-Z0-9-]{8,12}$'),
  expires_at timestamptz not null,
  used_at timestamptz
);

create or replace function public.join_tbellini() returns trigger language plpgsql security definer set search_path = '' as 42672
declare
  invite_code text;
begin
  invite_code := new.raw_user_meta_data->>'invite_code';
  
  if not exists (
    select 1 from public.invitations 
    where code = invite_code 
    and used_at is null 
    and expires_at > now()
  ) then
    raise exception 'Invalid or expired invite code.' using errcode = '23514';
  end if;

  update public.invitations set used_at = now() where code = invite_code;

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
42672;

grant select, update on public.invitations to service_role;
-- authenticated users don't need access to invitations table.
-- The trigger handles validation and updates during the signup process.

commit;
