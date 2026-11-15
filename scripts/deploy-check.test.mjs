import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkHealth } from './deploy-check-core.mjs';
import { CONTRACT } from './hosted-config.mjs';

const noSleep = async () => {};

test('passes on the first 200 and targets SITE_URL plus the health path', async () => {
  const urls = [];
  const result = await checkHealth('https://app.example.test/', { fetchImpl: async (u) => { urls.push(u); return { status: 200 }; }, sleep: noSleep });
  assert.deepEqual(urls, ['https://app.example.test/api/health']);
  assert.equal(result.attempt, 1);
});

test('retries a warming deployment and then succeeds', async () => {
  const statuses = [503, 502, 200];
  const result = await checkHealth('https://app.example.test', { fetchImpl: async () => ({ status: statuses.shift() }), sleep: noSleep });
  assert.equal(result.attempt, 3);
});

test('fails with the last status after the attempts are used up', async () => {
  await assert.rejects(
    checkHealth('https://app.example.test', { fetchImpl: async () => ({ status: 500 }), attempts: 2, sleep: noSleep }),
    /HTTP 500/,
  );
});

test('every name deploy.yml reads from vars or secrets exists in the shared contract', () => {
  const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const used = [...workflow.matchAll(/\b(?:vars|secrets)\.([A-Z0-9_]+)/g)].map((m) => m[1]);
  assert.ok(used.length > 0);
  const known = new Set(CONTRACT.map((entry) => entry.name));
  for (const name of used) assert.ok(known.has(name), `${name} is not in scripts/hosted-config.mjs`);
  for (const entry of CONTRACT.filter((e) => e.kind === 'secret')) {
    assert.ok(!workflow.includes(`vars.${entry.name}`), `${entry.name} is a secret and must use secrets.`);
  }
});
