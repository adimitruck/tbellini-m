begin;
create extension if not exists pgtap with schema extensions;
select plan(15);
insert into public.invitations(code,expires_at) values('TEST-AAAA',now()+interval '1 day'),('TEST-BBBB',now()+interval '1 day');
insert into auth.users(id,raw_user_meta_data) values ('11111111-1111-4111-8111-111111111111','{"invite_code":"TEST-AAAA"}'), ('22222222-2222-4222-8222-222222222222','{"invite_code":"TEST-BBBB"}');
insert into public.events(id,owner_id,title,starts_at,ends_at) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Shared event',now(),now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Other event',now(),now());
insert into public.people(id,created_by,display_name) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','My person'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','Other person');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select is((select count(*) from public.events),2::bigint,'signed-in members see all events');
select is((select count(*) from public.people),4::bigint,'members see all people: one automatic Person per member plus two created');
select throws_ok($$insert into public.events(owner_id,title,starts_at,ends_at) values ('22222222-2222-4222-8222-222222222222','Forgery',now(),now())$$,'42501',null,'cannot impersonate owner');
select throws_ok($$insert into public.event_person_tags(event_id,person_id,tagged_by) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111')$$,'42501',null,'cannot tag on an event someone else created');
select throws_ok($$select * from public.graph_outbox$$,'42501',null,'outbox inaccessible to user');
select throws_ok($$select public.acquire_graph_sync_lock(gen_random_uuid())$$,'42501',null,'sync lock inaccessible to user');
select throws_ok($$insert into public.events(owner_id,title,starts_at,timezone) values ('11111111-1111-4111-8111-111111111111','Bad zone',now(),'Invalid/Zone')$$,'23514',null,'invalid timezone rejected at database boundary');
select lives_ok($$insert into public.event_person_tags(event_id,person_id,tagged_by) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111')$$,'creator tags any shared Person on own event');
reset role;
select is((select count(*) from public.graph_outbox where aggregate_type in ('event','person','tag')),7::bigint,'archive writes enqueue durable projections');
select ok(public.acquire_graph_sync_lock('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),'first runner acquires mutex');
select ok(not public.acquire_graph_sync_lock('ffffffff-ffff-4fff-8fff-ffffffffffff'),'overlapping runner rejected');
select public.release_graph_sync_lock('ffffffff-ffff-4fff-8fff-ffffffffffff');
select is((select count(*) from public.graph_sync_lock),1::bigint,'wrong token cannot unlock');
select public.release_graph_sync_lock('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
select is((select count(*) from public.graph_sync_lock),0::bigint,'own token releases lock');
set local role anon;
select throws_ok($$select * from public.events$$,'42501',null,'anonymous archive read blocked');
select throws_ok($$select * from public.graph_outbox$$,'42501',null,'anonymous outbox read blocked');
reset role;
select * from finish();
rollback;
