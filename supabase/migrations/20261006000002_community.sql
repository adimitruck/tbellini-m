begin;
create table public.communities(id uuid primary key, name text not null);
insert into public.communities values ('00000000-0000-4000-8000-000000000001','TBellini');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(char_length(btrim(display_name)) between 1 and 200),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.memberships (
 community_id uuid not null references public.communities(id),
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(community_id,user_id)
);
create function public.join_tbellini() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,case when char_length(btrim(coalesce(new.raw_user_meta_data->>'display_name',''))) between 1 and 200 then btrim(new.raw_user_meta_data->>'display_name') else 'Member ' || left(new.id::text,8) end);
 insert into public.memberships(community_id,user_id) values('00000000-0000-4000-8000-000000000001',new.id);
 return new;
end;
$$;
create trigger auth_join_tbellini after insert on auth.users for each row execute function public.join_tbellini();
insert into public.profiles(id,display_name) select id,case when char_length(btrim(coalesce(raw_user_meta_data->>'display_name',''))) between 1 and 200 then btrim(raw_user_meta_data->>'display_name') else 'Member ' || left(id::text,8) end from auth.users;
insert into public.memberships(community_id,user_id) select '00000000-0000-4000-8000-000000000001',id from public.profiles;
create function public.is_community_member(community uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.memberships where community_id=community and user_id=(select auth.uid()));
$$;
alter table public.events add column community_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.communities(id);
alter table public.events drop constraint events_visibility_check;
alter table public.events alter column visibility set default 'community';
alter table public.events add constraint events_community_author_fk foreign key(community_id,owner_id) references public.memberships(community_id,user_id);
alter table public.events add constraint events_id_community_key unique(id,community_id);
update public.events set visibility='community';
alter table public.events add constraint events_visibility_check check(visibility='community');
create index events_community_start_idx on public.events(community_id,starts_at);
create function public.prevent_event_transfer() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.id <> old.id or new.owner_id <> old.owner_id or new.community_id <> old.community_id then
  raise exception 'Event identity, author and community are immutable' using errcode='23514';
 end if;
 return new;
end;
$$;
create trigger events_no_transfer before update on public.events for each row execute function public.prevent_event_transfer();
create function public.prevent_profile_transfer() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.id <> old.id then raise exception 'Profile identity is immutable' using errcode='23514'; end if;
 return new;
end;
$$;
create trigger profiles_no_transfer before update on public.profiles for each row execute function public.prevent_profile_transfer();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create table public.event_user_tags (
 event_id uuid not null, user_id uuid not null, community_id uuid not null default '00000000-0000-4000-8000-000000000001',
 tagged_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 primary key(event_id,user_id),
 foreign key(event_id,community_id) references public.events(id,community_id) on delete cascade,
 foreign key(community_id,user_id) references public.memberships(community_id,user_id) on delete cascade,
 foreign key(community_id,tagged_by) references public.memberships(community_id,user_id)
);
create table public.event_rsvps (
 event_id uuid not null, user_id uuid not null, community_id uuid not null default '00000000-0000-4000-8000-000000000001',
 status text not null check(status in ('going','interested')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(event_id,user_id),
 foreign key(event_id,community_id) references public.events(id,community_id) on delete cascade,
 foreign key(community_id,user_id) references public.memberships(community_id,user_id) on delete cascade
);
create function public.prevent_connection_transfer() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.event_id <> old.event_id or new.user_id <> old.user_id or new.community_id <> old.community_id then
  raise exception 'Connection identity is immutable' using errcode='23514';
 end if;
 if TG_TABLE_NAME='event_user_tags' and to_jsonb(new)->>'tagged_by' <> to_jsonb(old)->>'tagged_by' then
  raise exception 'Tag author is immutable' using errcode='23514';
 end if;
 return new;
end;
$$;
create trigger tags_no_transfer before update on public.event_user_tags for each row execute function public.prevent_connection_transfer();
create trigger rsvps_no_transfer before update on public.event_rsvps for each row execute function public.prevent_connection_transfer();
create trigger rsvps_touch before update on public.event_rsvps for each row execute function public.touch_updated_at();
create index tags_community_idx on public.event_user_tags(community_id,user_id);
create index rsvps_community_user_idx on public.event_rsvps(community_id,user_id,status);

alter table public.communities enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.event_user_tags enable row level security;
alter table public.event_rsvps enable row level security;
revoke all on public.communities,public.profiles,public.memberships,public.event_user_tags,public.event_rsvps from public,anon,authenticated;
grant select on public.communities,public.profiles,public.memberships to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant select,insert,update,delete on public.event_user_tags,public.event_rsvps to authenticated;
grant all on public.communities,public.profiles,public.memberships,public.event_user_tags,public.event_rsvps to service_role;
create policy communities_member_read on public.communities for select to authenticated using(public.is_community_member(id));
create policy profiles_member_read on public.profiles for select to authenticated using(public.is_community_member('00000000-0000-4000-8000-000000000001'));
create policy profiles_own_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy memberships_member_read on public.memberships for select to authenticated using(public.is_community_member(community_id));
drop policy events_owner on public.events;
create policy events_member_read on public.events for select to authenticated using(public.is_community_member(community_id));
create policy events_member_create on public.events for insert to authenticated with check(owner_id=(select auth.uid()) and public.is_community_member(community_id));
create policy events_author_update on public.events for update to authenticated using(owner_id=(select auth.uid()) and public.is_community_member(community_id)) with check(owner_id=(select auth.uid()) and public.is_community_member(community_id));
create policy events_author_delete on public.events for delete to authenticated using(owner_id=(select auth.uid()) and public.is_community_member(community_id));
create policy tags_member_read on public.event_user_tags for select to authenticated using(public.is_community_member(community_id));
create policy tags_author_insert on public.event_user_tags for insert to authenticated with check(tagged_by=(select auth.uid()) and public.is_community_member(community_id) and exists(select 1 from public.events e where e.id=event_id and e.community_id=event_user_tags.community_id and e.owner_id=(select auth.uid())));
create policy tags_author_update on public.event_user_tags for update to authenticated using(tagged_by=(select auth.uid()) and public.is_community_member(community_id)) with check(tagged_by=(select auth.uid()) and public.is_community_member(community_id));
create policy tags_author_delete on public.event_user_tags for delete to authenticated using(tagged_by=(select auth.uid()) and public.is_community_member(community_id));
create policy rsvps_member_read on public.event_rsvps for select to authenticated using(public.is_community_member(community_id));
create policy rsvps_own_insert on public.event_rsvps for insert to authenticated with check(user_id=(select auth.uid()) and public.is_community_member(community_id));
create policy rsvps_own_update on public.event_rsvps for update to authenticated using(user_id=(select auth.uid()) and public.is_community_member(community_id)) with check(user_id=(select auth.uid()) and public.is_community_member(community_id));
create policy rsvps_own_delete on public.event_rsvps for delete to authenticated using(user_id=(select auth.uid()) and public.is_community_member(community_id));

alter table public.graph_outbox drop constraint graph_outbox_aggregate_type_check;
alter table public.graph_outbox add constraint graph_outbox_aggregate_type_check check(aggregate_type in ('event','person','attendance','profile','user_tag','rsvp'));
create or replace function public.enqueue_graph_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb; entity_type text; entity_id text; record_owner uuid;
begin
 row_data := case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 entity_type := case TG_TABLE_NAME when 'events' then 'event' when 'people' then 'person' when 'profiles' then 'profile' when 'event_user_tags' then 'user_tag' when 'event_rsvps' then 'rsvp' else 'attendance' end;
 entity_id := case when entity_type in ('attendance','user_tag','rsvp') then row_data->>'event_id' || ':' || coalesce(row_data->>'person_id',row_data->>'user_id') else row_data->>'id' end;
 record_owner := coalesce(row_data->>'owner_id',row_data->>'user_id',row_data->>'id')::uuid;
 if entity_type='attendance' then
  row_data := row_data || jsonb_build_object('community_id','00000000-0000-4000-8000-000000000001');
 end if;
 insert into public.graph_outbox(owner_id,aggregate_type,aggregate_id,operation,payload)
 values(record_owner,entity_type,entity_id,case when TG_OP='DELETE' then 'delete' else 'upsert' end,row_data);
 return coalesce(new,old);
end;
$$;
create trigger profiles_graph after insert or update or delete on public.profiles for each row execute function public.enqueue_graph_change();
create trigger user_tags_graph after insert or update or delete on public.event_user_tags for each row execute function public.enqueue_graph_change();
create trigger rsvps_graph after insert or update or delete on public.event_rsvps for each row execute function public.enqueue_graph_change();
-- Snapshot requeue after earlier legacy rows: creates all endpoints before relationships.
insert into public.graph_outbox(owner_id,aggregate_type,aggregate_id,operation,payload)
 select id,'profile',id::text,'upsert',to_jsonb(p) from public.profiles p;
insert into public.graph_outbox(owner_id,aggregate_type,aggregate_id,operation,payload)
 select owner_id,'event',id::text,'upsert',to_jsonb(e) from public.events e;
insert into public.graph_outbox(owner_id,aggregate_type,aggregate_id,operation,payload)
 select owner_id,'attendance',event_id::text||':'||person_id::text,'upsert',to_jsonb(a)||jsonb_build_object('community_id','00000000-0000-4000-8000-000000000001') from public.event_people a;
revoke all on function public.join_tbellini(),public.prevent_event_transfer(),public.prevent_profile_transfer(),public.prevent_connection_transfer() from public,anon,authenticated;
revoke all on function public.is_community_member(uuid) from public,anon;
grant execute on function public.is_community_member(uuid) to authenticated,service_role;
commit;
