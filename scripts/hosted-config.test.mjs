import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTRACT, GITHUB_REPOSITORY, HEALTH_PATH, isSecret, missingNames, namesFor, normaliseSiteUrl } from './hosted-config.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('contract names are unique and secrets are classified', () => {
  const names = CONTRACT.map((entry) => entry.name);
  assert.equal(new Set(names).size, names.length);
  for (const secret of ['SMTP_PASS', 'SUPABASE_SERVICE_ROLE_KEY', 'VERCEL_TOKEN', 'SUPABASE_ACCESS_TOKEN']) assert.ok(isSecret(secret));
  assert.ok(!isSecret('SITE_URL'));
  assert.ok(namesFor('seed-member').includes('SEED_MEMBER_EMAIL'));
});

test('missingNames reports names only and treats blanks as missing', () => {
  assert.deepEqual(missingNames({ A: ' ', B: 'x' }, ['A', 'B', 'C']), ['A', 'C']);
});

test('normaliseSiteUrl accepts an https origin and localhost http only', () => {
  assert.equal(normaliseSiteUrl('https://a.example.test/'), 'https://a.example.test');
  assert.equal(normaliseSiteUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.throws(() => normaliseSiteUrl('http://a.example.test'));
  assert.throws(() => normaliseSiteUrl('nope'));
});

test('the justfile and the health route agree with the shared constants', () => {
  assert.match(read('../justfile'), new RegExp(`github_repo := "${GITHUB_REPOSITORY}"`));
  assert.match(read('../justfile'), new RegExp(`health_path := "${HEALTH_PATH}"`));
});
