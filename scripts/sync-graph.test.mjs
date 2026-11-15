import test from 'node:test';
import assert from 'node:assert/strict';
import { projectGraphRow } from './project-graph.mjs';
import { AGGREGATE, EDGE, OPERATION, RETIRED_AGGREGATE_REASON, nodeKey } from './graph-schema.mjs';

function fakeDriver(count = 1) {
  const calls = [];
  return {
    calls,
    async executeQuery(query, params, options) {
      calls.push({ query, params, options });
      return { records: [{ get: () => ({ toNumber: () => count }) }] };
    },
  };
}
const row = (aggregate_type, aggregate_id, payload, operation = OPERATION.UPSERT) => ({
  id: 1, owner_id: 'owner-a', aggregate_type, aggregate_id, operation, payload,
});

test('node keys have one shared format with no owner or community scope', () => {
  assert.equal(nodeKey(AGGREGATE.EVENT, 'e1'), 'event:e1');
  assert.equal(nodeKey(AGGREGATE.PROFILE, 'u1'), 'profile:u1');
  assert.equal(nodeKey(AGGREGATE.PERSON, 'p1'), 'person:p1');
});

test('event upsert merges a shared Event node', async () => {
  const driver = fakeDriver();
  const outcome = await projectGraphRow(driver, 'neo4j', row('event', 'e1', { title: 'Dinner', updated_at: 't' }));
  assert.equal(outcome.status, 'projected');
  assert.match(driver.calls[0].query, /MERGE \(n:ArchiveEntity:Event \{key:\$key\}\)/);
  assert.deepEqual(driver.calls[0].params, { key: 'event:e1', id: 'e1', title: 'Dinner', updatedAt: 't' });
  assert.doesNotMatch(driver.calls[0].query, /ownerId|communityId/);
});

test('profile upsert uses display_name as title', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'neo4j', row('profile', 'u1', { id: 'u1', display_name: 'Ann' }));
  assert.match(driver.calls[0].query, /ArchiveEntity:Profile/);
  assert.equal(driver.calls[0].params.key, 'profile:u1');
  assert.equal(driver.calls[0].params.title, 'Ann');
});

test('person upsert without member_id clears any Profile-IS-Person link', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'neo4j', row('person', 'p1', { id: 'p1', name: 'Bob', member_id: null }));
  assert.match(driver.calls[0].query, /ArchiveEntity:Person/);
  assert.equal(driver.calls.length, 2);
  assert.match(driver.calls[1].query, new RegExp(`\\[r:${EDGE.IS}\\]`));
  assert.match(driver.calls[1].query, /DELETE r/);
});

test('person with member_id links Profile-IS-Person even if the profile node does not exist yet', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'neo4j', row('person', 'p1', { id: 'p1', name: 'Ann', member_id: 'u1' }));
  assert.equal(driver.calls.length, 3);
  const link = driver.calls[2];
  assert.match(link.query, /MERGE \(profile:ArchiveEntity:Profile \{key:\$profileKey\}\) MERGE \(profile\)-\[:IS\]->\(person\)/);
  assert.deepEqual(link.params, { personKey: 'person:p1', profileKey: 'profile:u1' });
});

test('tag upsert links Person to Event with TAGGED_IN and no ATTENDED or scoping', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'neo4j', row('tag', 'e1:p1', { event_id: 'e1', person_id: 'p1', tagged_by: 'u1' }));
  const [call] = driver.calls;
  assert.match(call.query, /MERGE \(a\)-\[r:TAGGED_IN\]->\(e\)/);
  assert.doesNotMatch(call.query, /ATTENDED|ownerId|communityId/);
  assert.deepEqual(call.params, { fromKey: 'person:p1', eventKey: 'event:e1', status: null });
});

test('tag delete removes only the edge', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'neo4j', row('tag', 'e1:p1', { event_id: 'e1', person_id: 'p1' }, 'delete'));
  assert.match(driver.calls[0].query, /DELETE r$/);
  assert.doesNotMatch(driver.calls[0].query, /DETACH/);
});

test('rsvp links Profile to Event with status', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'neo4j', row('rsvp', 'e1:u1', { event_id: 'e1', user_id: 'u1', status: 'going' }));
  assert.match(driver.calls[0].query, /\[r:RSVP\]/);
  assert.deepEqual(driver.calls[0].params, { fromKey: 'profile:u1', eventKey: 'event:e1', status: 'going' });
});

test('missing edge endpoint throws so the outbox row stays pending', async () => {
  const driver = fakeDriver(0);
  await assert.rejects(projectGraphRow(driver, 'neo4j', row('tag', 'e1:p1', { event_id: 'e1', person_id: 'p1' })), /Missing graph endpoint/);
});

test('node delete detaches by shared key', async () => {
  const driver = fakeDriver();
  await projectGraphRow(driver, 'neo4j', row('event', 'e1', { id: 'e1' }, 'delete'));
  assert.match(driver.calls[0].query, /DETACH DELETE n/);
  assert.equal(driver.calls[0].params.key, 'event:e1');
});

for (const type of Object.keys(RETIRED_AGGREGATE_REASON)) {
  test(`retired legacy type ${type} is skipped with a reason and never queries or throws`, async () => {
    const driver = fakeDriver();
    const outcome = await projectGraphRow(driver, 'neo4j', row(type, 'x', { event_id: 'e', person_id: 'p', user_id: 'u' }));
    assert.equal(outcome.status, 'skipped');
    assert.match(outcome.reason, /retired/);
    assert.equal(driver.calls.length, 0);
  });
}

test('unknown aggregate type is skipped, not thrown', async () => {
  const driver = fakeDriver();
  const outcome = await projectGraphRow(driver, 'neo4j', row('mystery', 'x', {}));
  assert.equal(outcome.status, 'skipped');
  assert.match(outcome.reason, /unknown aggregate type: mystery/);
});
