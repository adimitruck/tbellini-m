begin;
create function public.valid_archive_timezone(zone text) returns boolean
language sql stable set search_path = '' as $$
 select exists(select 1 from pg_catalog.pg_timezone_names where name = zone);
$$;
create table public.events (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 200),
 description text check (char_length(description) <= 10000),
 starts_at timestamptz not null, ends_at timestamptz,
 timezone text not null default 'UTC' check (public.valid_archive_timezone(timezone)), location text check (char_length(location) <= 500),
 visibility text not null default 'private' check (visibility = 'private'),
 provenance text not null default 'manual' check (provenance = 'manual'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (id, owner_id), check (ends_at is null or ends_at >= starts_at)
);
create table public.people (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check (char_length(btrim(display_name)) between 1 and 200),
 notes text check (char_length(notes) <= 10000),
 visibility text not null default 'private' check (visibility = 'private'),
 provenance text not null default 'manual' check (provenance = 'manual'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (id, owner_id)
);
create table public.event_people (
 event_id uuid not null, person_id uuid not null,
 owner_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), primary key (event_id, person_id),
 foreign key (event_id, owner_id) references public.events(id, owner_id) on delete cascade,
 foreign key (person_id, owner_id) references public.people(id, owner_id) on delete cascade
);
create index events_owner_start_idx on public.events(owner_id, starts_at);
create index people_owner_name_idx on public.people(owner_id, display_name);
create index event_people_owner_idx on public.event_people(owner_id);
create index event_people_person_idx on public.event_people(person_id, owner_id);
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();
create trigger people_touch before update on public.people for each row execute function public.touch_updated_at();

-- Durable projection queue. The browser can never read or acknowledge this table.
create table public.graph_outbox (
 id bigint generated always as identity primary key,
 owner_id uuid not null,
 aggregate_type text not null check (aggregate_type in ('event','person','attendance')),
 aggregate_id text not null,
 operation text not null check (operation in ('upsert','delete')),
 payload jsonb not null,
 created_at timestamptz not null default now(), processed_at timestamptz
);
create index graph_outbox_pending_idx on public.graph_outbox(id) where processed_at is null;
create function public.enqueue_graph_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare row_data jsonb; entity_type text; entity_id text;
begin
 row_data := case when TG_OP = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
 entity_type := case TG_TABLE_NAME when 'events' then 'event' when 'people' then 'person' else 'attendance' end;
 entity_id := case when entity_type = 'attendance' then row_data->>'event_id' || ':' || (row_data->>'person_id') else row_data->>'id' end;
 insert into public.graph_outbox(owner_id, aggregate_type, aggregate_id, operation, payload)
 values ((row_data->>'owner_id')::uuid, entity_type, entity_id, case when TG_OP = 'DELETE' then 'delete' else 'upsert' end, row_data);
 return coalesce(new, old);
end;
$$;
create trigger events_graph after insert or update or delete on public.events for each row execute function public.enqueue_graph_change();
create trigger people_graph after insert or update or delete on public.people for each row execute function public.enqueue_graph_change();
create trigger attendance_graph after insert or update or delete on public.event_people for each row execute function public.enqueue_graph_change();
revoke all on function public.enqueue_graph_change() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

alter table public.events enable row level security;
alter table public.people enable row level security;
alter table public.event_people enable row level security;
alter table public.graph_outbox enable row level security;
revoke all on public.events, public.people, public.event_people, public.graph_outbox from anon, authenticated;
grant select, insert, update, delete on public.events, public.people, public.event_people to authenticated;
grant all on public.events, public.people, public.event_people, public.graph_outbox to service_role;
grant usage, select on sequence public.graph_outbox_id_seq to service_role;
create policy events_owner on public.events for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy people_owner on public.people for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy attendance_owner on public.event_people for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
commit;
