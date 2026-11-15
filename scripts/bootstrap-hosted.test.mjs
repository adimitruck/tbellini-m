import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBootstrap, runBootstrap } from './bootstrap-hosted-core.mjs';
import { HOSTED_ENVIRONMENTS } from './hosted-config.mjs';

const env = {
  SUPABASE_REGION: 'us-east-2',
  SUPABASE_ORGANIZATION_ID: 'org-1',
  SUPABASE_ACCESS_TOKEN: 'tok-supabase-secret',
  SUPABASE_DB_PASSWORD: 'db-password-secret',
  VERCEL_TOKEN: 'tok-vercel-secret',
  VERCEL_ORG_ID: 'team-1',
};

function fakeClients({ existing = false } = {}) {
  const calls = [];
  const note = (name) => async (...args) => { calls.push([name, ...args]); };
  return {
    calls,
    supabase: {
      findProject: async () => (existing ? { ref: 'abcdefghijklmnopqrst' } : null),
      createProject: async (spec) => { calls.push(['sb.create', spec]); return { ref: 'abcdefghijklmnopqrst' }; },
      publishableKey: async () => 'sb_publishable_key',
    },
    vercel: {
      findProject: async () => (existing ? { id: 'prj_1' } : null),
      createProject: async (spec) => { calls.push(['vc.create', spec]); return { id: 'prj_1' }; },
      upsertEnv: note('vc.env'),
    },
    github: { setVariable: note('gh.var'), setSecret: note('gh.secret') },
  };
}

test('dry run lists the plan, calls no client and prints no values', async () => {
  const lines = [];
  const clients = fakeClients();
  assert.deepEqual(await runBootstrap(env, clients, { log: (l) => lines.push(l) }), { applied: false });
  assert.equal(clients.calls.length, 0);
  const text = lines.join('\n');
  assert.match(text, /Would: Supabase/);
  for (const secret of ['tok-supabase-secret', 'db-password-secret', 'tok-vercel-secret']) assert.ok(!text.includes(secret));
  assert.equal(planBootstrap().length, 3 + HOSTED_ENVIRONMENTS.length);
});

test('apply creates both projects, then sets Vercel and GitHub values', async () => {
  const clients = fakeClients();
  const lines = [];
  await runBootstrap(env, clients, { apply: true, log: (l) => lines.push(l) });
  const kinds = clients.calls.map((c) => c[0]);
  assert.deepEqual(kinds.slice(0, 2), ['sb.create', 'vc.create']);
  assert.equal(kinds.filter((k) => k === 'vc.env').length, 3);
  assert.equal(kinds.filter((k) => k === 'gh.secret').length, HOSTED_ENVIRONMENTS.length);
  assert.deepEqual(clients.calls[0][1], { name: 'tbellini-m', organization_id: 'org-1', db_pass: 'db-password-secret', region: 'us-east-2' });
  const urlCall = clients.calls.find((c) => c[0] === 'vc.env' && c[2].key === 'NEXT_PUBLIC_SUPABASE_URL');
  assert.equal(urlCall[2].value, 'https://abcdefghijklmnopqrst.supabase.co');
  assert.ok(!lines.join('\n').includes('sb_publishable_key'));
});

test('is idempotent: existing projects are reused, never recreated', async () => {
  const clients = fakeClients({ existing: true });
  await runBootstrap(env, clients, { apply: true, log: () => {} });
  assert.ok(!clients.calls.some((c) => c[0] === 'sb.create' || c[0] === 'vc.create'));
});

test('refuses to run when names are missing, listing names only', async () => {
  await assert.rejects(runBootstrap({ SUPABASE_REGION: 'us-east-2' }, fakeClients(), { apply: true }), /SUPABASE_ACCESS_TOKEN/);
});
