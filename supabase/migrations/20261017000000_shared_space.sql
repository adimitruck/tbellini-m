begin;

-- Phase 1 step a: one shared space. There is no community or membership. A profile means "can log in",
-- every signed-in user with a profile reads everything, and only a record's creator edits or deletes it.
-- Forward-only: earlier migrations stay untouched.

-- "Signed-in user with a profile" check used by every policy below.
create function public.has_profile() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()));
$$;
revoke all on function public.has_profile() from public, anon;
grant execute on function public.has_profile() to authenticated, service_role;

-- Outbox: allow the new aggregate. Retired types stay allowed so unprocessed legacy rows remain valid;
-- step c (graph) retires them. The trigger function no longer knows about communities.
alter table public.graph_outbox drop constraint graph_outbox_aggregate_type_check;
alter table public.graph_outbox add constraint graph_outbox_aggregate_type_check
  check (aggregate_type in ('event','person','attendance','profile','user_tag','rsvp','tag'));
create or replace function public.enqueue_graph_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb; entity_type text; entity_id text; record_owner uuid;
begin
 row_data := case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 entity_type := case TG_TABLE_NAME when 'events' then 'event' when 'people' then 'person' when 'profiles' then 'profile' when 'event_person_tags' then 'tag' else 'rsvp' end;
 entity_id := case when entity_type in ('tag','rsvp') then row_data->>'event_id' || ':' || coalesce(row_data->>'person_id',row_data->>'user_id') else row_data->>'id' end;
 record_owner := coalesce(row_data->>'owner_id',row_data->>'created_by',row_data->>'tagged_by',row_data->>'user_id',row_data->>'id')::uuid;
 insert into public.graph_outbox(owner_id,aggregate_type,aggregate_id,operation,payload)
 values(record_owner,entity_type,entity_id,case when TG_OP='DELETE' then 'delete' else 'upsert' end,row_data);
 return coalesce(new,old);
end;
$$;

-- Drop every policy that depends on is_community_member or on per-owner people.
drop policy communities_member_read on public.communities;
drop policy profiles_member_read on public.profiles;
drop policy memberships_member_read on public.memberships;
drop policy events_member_read on public.events;
drop policy events_member_create on public.events;
drop policy events_author_update on public.events;
drop policy events_author_delete on public.events;
drop policy tags_member_read on public.event_user_tags;
drop policy tags_author_insert on public.event_user_tags;
drop policy tags_author_update on public.event_user_tags;
drop policy tags_author_delete on public.event_user_tags;
drop policy rsvps_member_read on public.event_rsvps;
drop policy rsvps_own_insert on public.event_rsvps;
drop policy rsvps_own_update on public.event_rsvps;
drop policy rsvps_own_delete on public.event_rsvps;
drop policy people_owner on public.people;
drop policy attendance_owner on public.event_people;

-- people becomes the shared Person: createdBy (creator, edits and deletes) and memberId (the member it is, if any).
alter table public.people add column created_by uuid references public.profiles(id) on delete set null;
alter table public.people add column member_id uuid unique references public.profiles(id) on delete set null;
update public.people set created_by = owner_id;
-- cascade also drops unique(id, owner_id), people_owner_name_idx and the (person_id, owner_id) foreign key of event_people
alter table public.people drop column owner_id cascade;
alter table public.people drop column visibility;
create index people_name_idx on public.people(display_name);

create function public.prevent_person_transfer() returns trigger language plpgsql set search_path = '' as $$
begin
 -- The creator may only become null (profile deleted); it can never be reassigned.
 if new.id <> old.id or (new.created_by is distinct from old.created_by and new.created_by is not null) then
  raise exception 'Person identity and creator are immutable' using errcode='23514';
 end if;
 return new;
end;
$$;
create trigger people_no_transfer before update on public.people for each row execute function public.prevent_person_transfer();

-- Every member automatically gets a Person row (Open question 2, default: yes). To change the default, replace the body of this
-- function (for example with "return;") and the signup trigger and backfill below stop creating Person rows.
create function public.ensure_member_person(member uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 insert into public.people(display_name, created_by, member_id)
 select display_name, id, id from public.profiles where id = member
 on conflict (member_id) do nothing;
end;
$$;
revoke all on function public.ensure_member_person(uuid) from public, anon, authenticated;
grant execute on function public.ensure_member_person(uuid) to service_role;
select public.ensure_member_person(id) from public.profiles;

-- Tags point at a Person. They replace event_people (private person links) and event_user_tags (member tags);
-- a tag never implies an RSVP.
create table public.event_person_tags (
 event_id uuid not null references public.events(id) on delete cascade,
 person_id uuid not null references public.people(id) on delete cascade,
 tagged_by uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (event_id, person_id)
);
create index event_person_tags_person_idx on public.event_person_tags(person_id);
create index event_person_tags_tagged_by_idx on public.event_person_tags(tagged_by);
create trigger tags_graph after insert or update or delete on public.event_person_tags for each row execute function public.enqueue_graph_change();
insert into public.event_person_tags(event_id, person_id, tagged_by, created_at)
 select event_id, person_id, owner_id, created_at from public.event_people
 on conflict do nothing;
insert into public.event_person_tags(event_id, person_id, tagged_by, created_at)
 select t.event_id, p.id, t.tagged_by, t.created_at from public.event_user_tags t join public.people p on p.member_id = t.user_id
 on conflict do nothing;
drop table public.event_people;
drop table public.event_user_tags;

-- RSVPs: self-only, no community.
alter table public.event_rsvps drop column community_id; -- also drops both community foreign keys
alter table public.event_rsvps add constraint event_rsvps_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.event_rsvps add constraint event_rsvps_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
drop index if exists public.rsvps_community_user_idx;
create index rsvps_user_status_idx on public.event_rsvps(user_id, status);
create or replace function public.prevent_connection_transfer() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.event_id <> old.event_id or new.user_id <> old.user_id then
  raise exception 'Connection identity is immutable' using errcode='23514';
 end if;
 return new;
end;
$$;

-- Events: drop community and visibility.
alter table public.events drop constraint events_community_author_fk;
alter table public.events drop column community_id; -- also drops events_id_community_key and events_community_start_idx
alter table public.events drop column visibility;
create or replace function public.prevent_event_transfer() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.id <> old.id or new.owner_id <> old.owner_id then
  raise exception 'Event identity and creator are immutable' using errcode='23514';
 end if;
 return new;
end;
$$;

-- Invitations may name a Person (claiming path 1). Signup links that Person to the new member.
alter table public.invitations add column person_id uuid references public.people(id) on delete set null;

create or replace function public.join_tbellini() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  invite_code text := upper(btrim(coalesce(new.raw_user_meta_data->>'invite_code', '')));
  invited_person uuid;
begin
  -- Single atomic claim: a concurrent signup with the same code finds used_at already set.
  update public.invitations set used_at = now(), used_by = new.id
  where code = invite_code and used_at is null and expires_at > now()
  returning person_id into invited_person;
  if not found then
    raise exception 'Invalid or expired invite code.' using errcode = '23514';
  end if;

  insert into public.profiles(id, display_name)
  values(new.id, case
    when char_length(btrim(coalesce(new.raw_user_meta_data->>'display_name',''))) between 1 and 200
    then btrim(new.raw_user_meta_data->>'display_name')
    else 'Member ' || left(new.id::text,8)
  end);

  -- Link the Person the invite names; otherwise (or if it was linked meanwhile) the member gets a Person of their own.
  if invited_person is not null then
    update public.people set member_id = new.id where id = invited_person and member_id is null;
  end if;
  if invited_person is null or not found then
    perform public.ensure_member_person(new.id);
  end if;

  return new;
end;
$$;

drop function public.create_invitation(integer);
create function public.create_invitation(expires_in_days integer default 7, for_person uuid default null) returns text language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_bytes bytea;
  result text;
  byte_index integer;
begin
  if not public.has_profile() then
    raise exception 'Only TBellini members can create invitations.' using errcode = '42501';
  end if;
  if expires_in_days is null or expires_in_days not between 1 and 30 then
    raise exception 'Invitations expire within 1 to 30 days.' using errcode = '22023';
  end if;
  if for_person is not null and not exists (select 1 from public.people where id = for_person and member_id is null) then
    raise exception 'The invited person must exist and not already be a member.' using errcode = '22023';
  end if;
  loop
    random_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    result := '';
    foreach byte_index in array array[0,1,2,3,4,5,7,9] loop
      if char_length(result) = 4 then result := result || '-'; end if;
      result := result || substr(alphabet, get_byte(random_bytes, byte_index) % 32 + 1, 1);
    end loop;
    begin
      insert into public.invitations(code, created_by, expires_at, person_id)
      values(result, (select auth.uid()), now() + make_interval(days => expires_in_days), for_person);
      return result;
    exception when unique_violation then
      null; -- Retry on the rare collision.
    end;
  end loop;
end;
$$;
revoke all on function public.create_invitation(integer, uuid) from public, anon, authenticated;
grant execute on function public.create_invitation(integer, uuid) to authenticated;

-- Claiming path 2 (schema support only): a member asks "this is me"; the Person's creator confirms.
create table public.person_claims (
 person_id uuid not null references public.people(id) on delete cascade,
 claimant_id uuid not null unique references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (person_id, claimant_id)
);
create function public.confirm_person_claim(claimed_person uuid, claimant uuid) returns void language plpgsql security definer set search_path = '' as $$
declare own_person uuid;
begin
 if not exists (select 1 from public.people where id = claimed_person and created_by = (select auth.uid()) and member_id is null) then
  raise exception 'Only the creator of an unlinked person can confirm a claim.' using errcode = '42501';
 end if;
 if not exists (select 1 from public.person_claims where person_id = claimed_person and claimant_id = claimant) then
  raise exception 'No such claim.' using errcode = '22023';
 end if;
 -- Merge the claimant's automatic Person into the claimed one, then link.
 select id into own_person from public.people where member_id = claimant;
 if own_person is not null then
  insert into public.event_person_tags(event_id, person_id, tagged_by, created_at)
   select event_id, claimed_person, tagged_by, created_at from public.event_person_tags where person_id = own_person
   on conflict do nothing;
  delete from public.people where id = own_person;
 end if;
 update public.people set member_id = claimant where id = claimed_person;
 delete from public.person_claims where claimant_id = claimant;
end;
$$;
revoke all on function public.confirm_person_claim(uuid, uuid) from public, anon;
grant execute on function public.confirm_person_claim(uuid, uuid) to authenticated, service_role;

-- Remove the community model.
drop table public.memberships;
drop table public.communities;
drop function public.is_community_member(uuid);

-- Grants. Clients never set member_id or provenance, and never change people's creator.
revoke all on public.people, public.event_person_tags, public.person_claims from public, anon, authenticated;
grant select, delete on public.people to authenticated;
grant insert (display_name, notes, created_by) on public.people to authenticated;
grant update (display_name, notes) on public.people to authenticated;
grant select, insert, delete on public.event_person_tags to authenticated;
grant select, insert, delete on public.person_claims to authenticated;
grant all on public.event_person_tags, public.person_claims to service_role;
alter table public.event_person_tags enable row level security;
alter table public.person_claims enable row level security;

-- RLS: a signed-in user with a profile reads everything; only the creator writes.
create policy profiles_read on public.profiles for select to authenticated using (public.has_profile());
create policy events_read on public.events for select to authenticated using (public.has_profile());
create policy events_create on public.events for insert to authenticated with check (owner_id = (select auth.uid()) and public.has_profile());
create policy events_creator_update on public.events for update to authenticated using (owner_id = (select auth.uid()) and public.has_profile()) with check (owner_id = (select auth.uid()) and public.has_profile());
create policy events_creator_delete on public.events for delete to authenticated using (owner_id = (select auth.uid()) and public.has_profile());
create policy people_read on public.people for select to authenticated using (public.has_profile());
create policy people_create on public.people for insert to authenticated with check (created_by = (select auth.uid()) and public.has_profile());
create policy people_creator_update on public.people for update to authenticated using (created_by = (select auth.uid()) and public.has_profile()) with check (created_by = (select auth.uid()) and public.has_profile());
create policy people_creator_delete on public.people for delete to authenticated using (created_by = (select auth.uid()) and public.has_profile());
create policy tags_read on public.event_person_tags for select to authenticated using (public.has_profile());
create policy tags_creator_insert on public.event_person_tags for insert to authenticated with check (tagged_by = (select auth.uid()) and public.has_profile() and exists (select 1 from public.events e where e.id = event_id and e.owner_id = (select auth.uid())));
create policy tags_creator_delete on public.event_person_tags for delete to authenticated using (tagged_by = (select auth.uid()) and public.has_profile());
create policy rsvps_read on public.event_rsvps for select to authenticated using (public.has_profile());
create policy rsvps_own_insert on public.event_rsvps for insert to authenticated with check (user_id = (select auth.uid()) and public.has_profile());
create policy rsvps_own_update on public.event_rsvps for update to authenticated using (user_id = (select auth.uid()) and public.has_profile()) with check (user_id = (select auth.uid()) and public.has_profile());
create policy rsvps_own_delete on public.event_rsvps for delete to authenticated using (user_id = (select auth.uid()) and public.has_profile());
create policy claims_read on public.person_claims for select to authenticated using (public.has_profile());
create policy claims_own_insert on public.person_claims for insert to authenticated with check (claimant_id = (select auth.uid()) and public.has_profile() and exists (select 1 from public.people p where p.id = person_id and p.member_id is null));
create policy claims_withdraw_or_reject on public.person_claims for delete to authenticated using (claimant_id = (select auth.uid()) or exists (select 1 from public.people p where p.id = person_id and p.created_by = (select auth.uid())));

revoke all on function public.prevent_person_transfer() from public, anon, authenticated;
commit;
