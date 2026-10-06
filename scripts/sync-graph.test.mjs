import test from 'node:test';
import assert from 'node:assert/strict';
import { projectGraphRow } from './project-graph.mjs';

function fakeDriver(count = 1) {
  const calls = [];
  return {
    calls,
    async executeQuery(query, params, config) {
      calls.push({ query, params, config });
      return { records: [{ get: () => ({ toNumber: () => count }) }] };
    },
  };
}
const base = { owner_id: 'owner-a', aggregate_id: 'event-a', aggregate_type: 'event', operation: 'upsert', payload: { id: 'event-a', title: 'Private title', updated_at: '2026-10-06' } };

test('entity upsert uses a tenant key and parameterized private title', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'archive', base);
  await projectGraphRow(driver, 'archive', base);
  assert.match(driver.calls[0].query, /MERGE/);
  assert.equal(driver.calls[0].params.key, 'owner-a:event:event-a');
  assert.equal(driver.calls[0].params.title, 'Private title');
  assert.equal(driver.calls[0].config.database, 'archive');
  assert.deepEqual(driver.calls[0], driver.calls[1]);
  assert.ok(!driver.calls[0].query.includes('Private title'));
});
test('delete detaches relationships and enforces owner', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'archive', { ...base, operation: 'delete' });
  assert.match(driver.calls[0].query, /ownerId:\$ownerId.*DETACH DELETE/);
  assert.equal(driver.calls[0].params.ownerId, 'owner-a');
});
test('attendance merges owner-scoped endpoints and fails missing endpoints', async () => {
  const row = { ...base, aggregate_type: 'attendance', aggregate_id: 'event-a:person-a', payload: { event_id: 'event-a', person_id: 'person-a' } };
  const driver = fakeDriver();
  await projectGraphRow(driver, 'archive', row);
  assert.equal(driver.calls[0].params.personKey, 'owner-a:person:person-a');
  assert.equal(driver.calls[0].params.eventKey, 'owner-a:event:event-a');
  assert.match(driver.calls[0].query, /MERGE \(p\)-\[r:ATTENDED\]/);
  await assert.rejects(projectGraphRow(fakeDriver(0), 'archive', row), /Missing graph endpoint/);
});
test('attendance deletion is retryable and tenant scoped', async () => {
  const driver = fakeDriver(0);
  await projectGraphRow(driver, 'archive', { ...base, aggregate_type: 'attendance', operation: 'delete', payload: { event_id: 'event-a', person_id: 'person-a' } });
  assert.match(driver.calls[0].query, /ownerId:\$ownerId.*DELETE r/);
});

test('community event conversion removes legacy key and projects shared identity', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'archive', { ...base, payload: { ...base.payload, community_id: 'community-a' } });
  assert.match(driver.calls[0].query, /DETACH DELETE legacy/);
  assert.equal(driver.calls[0].params.legacyKey, 'owner-a:event:event-a');
  assert.equal(driver.calls[1].params.key, 'community-a:event:event-a');
  assert.equal(driver.calls[1].params.visibility, 'community');
});
test('registered profile uses community identity separate from private person', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'archive', { ...base, aggregate_type: 'profile', payload: { id: 'owner-a', display_name: 'Member', updated_at: '2026-10-06' } });
  assert.match(driver.calls[0].query, /ArchiveEntity:Profile/);
  assert.equal(driver.calls[0].params.key, '00000000-0000-4000-8000-000000000001:profile:owner-a');
});
test('RSVP status updates one distinct community relationship', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'archive', { ...base, aggregate_type: 'rsvp', payload: { community_id: 'community-a', event_id: 'event-a', user_id: 'owner-a', status: 'interested' } });
  assert.match(driver.calls[0].query, /r:RSVP/);
  assert.equal(driver.calls[0].params.status, 'interested');
  assert.equal(driver.calls[0].params.visibility, 'community');
});
test('private archive attendance stays private when event is community scoped', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'archive', { ...base, aggregate_type: 'attendance', payload: { community_id: 'community-a', event_id: 'event-a', person_id: 'person-a' } });
  assert.equal(driver.calls[0].params.visibility, 'private');
  assert.equal(driver.calls[0].params.personKey, 'owner-a:person:person-a');
  assert.equal(driver.calls[0].params.eventKey, 'community-a:event:event-a');
});
test('registered-user tag remains distinct from RSVP and private attendance', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'archive', { ...base, aggregate_type: 'user_tag', payload: { community_id: 'community-a', event_id: 'event-a', user_id: 'owner-a' } });
  assert.match(driver.calls[0].query, /r:TAGGED_IN/);
  assert.equal(driver.calls[0].params.status, null);
  assert.equal(driver.calls[0].params.personKey, 'community-a:profile:owner-a');
});
