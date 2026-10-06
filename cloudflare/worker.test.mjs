import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
test('edge health is read-only and avoids caches or provider configuration disclosure', async () => { const response = await worker.fetch(new Request('https://edge.example/health')); assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store'); assert.deepEqual(await response.json(), { service: 'tbellini-m-edge', status: 'ok' }); });
test('unknown paths and health mutations are rejected', async () => { for (const request of [new Request('https://edge.example/private'), new Request('https://edge.example/health', { method: 'POST' })]) { const response = await worker.fetch(request); assert.equal(response.status, 404); } });
