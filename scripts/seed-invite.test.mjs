import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INVITE_CODE_PATTERN } from '../src/domain/invite-code.ts';
import { resolveExpiryDays, resolveInviteCode, seedInvite } from './seed-invite-core.mjs';

const fixedNow = () => new Date('2026-01-01T00:00:00.000Z');

test('generates a code matching the shared format and inserts it once', async () => {
  const rows = [];
  const result = await seedInvite({ insert: async (row) => { rows.push(row); } }, { now: fixedNow });
  assert.match(result.code, INVITE_CODE_PATTERN);
  assert.deepEqual(rows, [{ code: result.code, expires_at: '2026-01-08T00:00:00.000Z' }]);
});

test('normalises a supplied code and honours the expiry', async () => {
  const rows = [];
  const result = await seedInvite({ insert: async (row) => { rows.push(row); } }, { code: ' abcd-2345 ', expiryDays: '30', now: fixedNow });
  assert.equal(result.code, 'ABCD-2345');
  assert.equal(rows[0].expires_at, '2026-01-31T00:00:00.000Z');
});

test('rejects codes and expiries the database would refuse before inserting', async () => {
  for (const bad of ['short', 'ABCD_2345', 'ABCDEFGHJKLMN']) assert.throws(() => resolveInviteCode(bad), /Invite code/);
  for (const bad of ['0', '31', '1.5', 'x']) assert.throws(() => resolveExpiryDays(bad), /Expiry/);
  let inserted = false;
  await assert.rejects(seedInvite({ insert: async () => { inserted = true; } }, { code: 'no' }));
  assert.equal(inserted, false);
});

test('propagates a store failure', async () => {
  await assert.rejects(seedInvite({ insert: async () => { throw new Error('boom'); } }), /boom/);
});
