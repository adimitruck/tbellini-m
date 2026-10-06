begin;
-- Non-expiring mutex prevents overlapping replays. A crashed process needs operator recovery.
create table public.graph_sync_lock (
 singleton boolean primary key default true check (singleton), token uuid not null,
 acquired_at timestamptz not null default now()
);
alter table public.graph_sync_lock enable row level security;
revoke all on public.graph_sync_lock from public, anon, authenticated;
grant all on public.graph_sync_lock to service_role;
create function public.acquire_graph_sync_lock(lock_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.graph_sync_lock(singleton, token) values(true, lock_token) on conflict do nothing;
 return found;
end;
$$;
create function public.release_graph_sync_lock(lock_token uuid) returns void
language sql security definer set search_path = '' as $$
 delete from public.graph_sync_lock where token = lock_token;
$$;
revoke all on function public.acquire_graph_sync_lock(uuid), public.release_graph_sync_lock(uuid) from public, anon, authenticated;
grant execute on function public.acquire_graph_sync_lock(uuid), public.release_graph_sync_lock(uuid) to service_role;
commit;
