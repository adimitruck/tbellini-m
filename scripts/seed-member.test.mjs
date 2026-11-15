import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INVITE_CODE_PATTERN, SIGN_UP_METADATA } from '../src/domain/invite-code.ts';
import { seedMember, validateMember } from './seed-member-core.mjs';

const member = { name: ' Test Member ', email: 'member@example.test' };
const fixedNow = () => new Date('2026-01-01T00:00:00.000Z');

function fakeStore({ createError = null } = {}) {
  const log = [];
  return {
    log,
    insertInvitation: async (row) => { log.push(['insert', row]); },
    deleteInvitation: async (code) => { log.push(['delete', code]); },
    createUser: async (attributes) => { log.push(['create', attributes]); return { error: createError }; },
    sendPasswordReset: async (email, redirectTo) => { log.push(['reset', email, redirectTo]); },
  };
}

test('creates an invitation, then the user carrying its code, then sends the reset email', async () => {
  const store = fakeStore();
  const result = await seedMember(store, member, { redirectTo: 'https://app.example.test', now: fixedNow });
  assert.deepEqual(result, { status: 'created' });
  const [insert, create, reset] = store.log;
  assert.match(insert[1].code, INVITE_CODE_PATTERN);
  assert.equal(insert[1].expires_at, '2026-01-08T00:00:00.000Z');
  assert.equal(create[1].user_metadata[SIGN_UP_METADATA.inviteCode], insert[1].code);
  assert.equal(create[1].user_metadata[SIGN_UP_METADATA.displayName], 'Test Member');
  assert.equal(create[1].email_confirm, true);
  assert.deepEqual(reset, ['reset', 'member@example.test', 'https://app.example.test']);
});

test('an existing user is left unchanged and the spare invitation is removed', async () => {
  const store = fakeStore({ createError: { code: 'email_exists', message: 'registered' } });
  assert.deepEqual(await seedMember(store, member), { status: 'exists' });
  assert.deepEqual(store.log.map((entry) => entry[0]), ['insert', 'create', 'delete']);
  assert.equal(store.log[2][1], store.log[0][1].code);
});

test('another creation failure removes the invitation, sends no email and propagates', async () => {
  const store = fakeStore({ createError: { code: 'unexpected', message: 'boom' } });
  await assert.rejects(seedMember(store, member), /boom/);
  assert.deepEqual(store.log.map((entry) => entry[0]), ['insert', 'create', 'delete']);
});

test('rejects an invalid name or email before touching the store', async () => {
  const store = fakeStore();
  assert.throws(() => validateMember({ name: '  ', email: 'a@b.test' }), /name/);
  assert.throws(() => validateMember({ name: 'A', email: 'nope' }), /email/);
  await assert.rejects(seedMember(store, { name: '', email: 'a@b.test' }));
  assert.equal(store.log.length, 0);
});
