import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureAuth, diffAuthSettings } from './configure-auth-core.mjs';
import { authSettings, redirectAllowList } from './hosted-config.mjs';

const env = {
  SITE_URL: 'https://app-team.vercel.app/',
  EXTRA_REDIRECT_URLS: ' https://*-team.vercel.app/** , https://app-team.vercel.app ,',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_USER: 'mailer',
  SMTP_PASS: 'super-secret-pass',
  SMTP_ADMIN_EMAIL: 'admin@example.test',
  SMTP_SENDER_NAME: 'TBellini',
};

const fakeApi = (current) => {
  const calls = [];
  return { calls, get: async () => current, patch: async (body) => { calls.push(body); } };
};

test('derives settings from the environment with a deduplicated allow-list', () => {
  assert.deepEqual(redirectAllowList(env), ['https://app-team.vercel.app', 'https://*-team.vercel.app/**']);
  const settings = authSettings(env);
  assert.equal(settings.site_url, 'https://app-team.vercel.app');
  assert.equal(settings.uri_allow_list, 'https://app-team.vercel.app,https://*-team.vercel.app/**');
  assert.equal(settings.disable_signup, false);
  assert.equal(settings.mailer_autoconfirm, false);
});

test('lists every missing name and rejects a bad SITE_URL or SMTP port', () => {
  assert.throws(() => authSettings({}), /SITE_URL.*SMTP_HOST/);
  assert.throws(() => authSettings({ ...env, SITE_URL: 'http://example.com' }), /https/);
  assert.throws(() => authSettings({ ...env, SITE_URL: 'https://example.com/path' }), /origin/);
  assert.throws(() => authSettings({ ...env, SMTP_PORT: 'x' }), /SMTP_PORT/);
});

test('dry run prints a redacted diff and writes nothing', async () => {
  const api = fakeApi({});
  const lines = [];
  const result = await configureAuth(api, authSettings(env), { log: (line) => lines.push(line) });
  assert.deepEqual(result, { applied: false, changed: true });
  assert.equal(api.calls.length, 0);
  assert.ok(lines.some((line) => line.startsWith('site_url:')));
  assert.ok(!lines.join('\n').includes('super-secret-pass'));
});

test('apply sends only changed fields plus the secret when SMTP changed', async () => {
  const desired = authSettings(env);
  const rest = { ...desired };
  delete rest.smtp_pass;
  const api = fakeApi({ ...rest, site_url: 'https://old.example.test', smtp_host: 'old.example.test' });
  await configureAuth(api, desired, { apply: true, log: () => {} });
  assert.deepEqual(api.calls, [{ site_url: desired.site_url, smtp_host: desired.smtp_host, smtp_pass: desired.smtp_pass }]);
});

test('is idempotent: a matching config produces no write', async () => {
  const desired = authSettings(env);
  const api = fakeApi({ ...desired, smtp_port: 587 });
  const result = await configureAuth(api, desired, { apply: true, log: () => {} });
  assert.deepEqual(result, { applied: false, changed: false });
  assert.equal(api.calls.length, 0);
  assert.equal(diffAuthSettings({ ...desired }, desired).changed, false);
});
