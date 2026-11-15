import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayOutbox } from './replay-outbox.mjs';
function fixtures() {
  const calls = [];
  const pending = [{ id: 1 }, { id: 2 }];
  const queue = {
    async acquire(token) { calls.push(`acquire:${token}`); return true; },
    async release(token) { calls.push(`release:${token}`); },
    async pending() { calls.push('pending'); return [...pending]; },
    async acknowledge(id) { calls.push(`ack:${id}`); pending.splice(pending.findIndex((row) => row.id === id), 1); },
  };
  const graph = {
    async connect() { calls.push('connect'); }, async initialize() { calls.push('initialize'); },
    async project(row) { calls.push(`project:${row.id}`); }, async close() { calls.push('close'); },
  };
  return { queue, graph, calls, pending };
}
test('exclusive replay projects in order before acknowledging exact IDs', async () => { const f = fixtures(); assert.equal(await replayOutbox(f.queue, f.graph, 'token'), 2); assert.deepEqual(f.calls, ['acquire:token', 'connect', 'initialize', 'pending', 'project:1', 'ack:1', 'project:2', 'ack:2', 'pending', 'close', 'release:token']); });
test('a failed projection leaves the record pending and prevents later records', async () => { const f = fixtures(); f.graph.project = async (row) => { f.calls.push(`project:${row.id}`); throw new Error('Projection unavailable'); }; await assert.rejects(replayOutbox(f.queue, f.graph, 'token'), /Projection unavailable/); assert.deepEqual(f.pending, [{ id: 1 }, { id: 2 }]); assert.ok(!f.calls.some((call) => call.startsWith('ack:'))); assert.deepEqual(f.calls.slice(-2), ['close', 'release:token']); });
test('failed acknowledgement stops replay and supports retry of the projected record', async () => { const f = fixtures(); f.queue.acknowledge = async () => { throw new Error('Postgres unavailable'); }; await assert.rejects(replayOutbox(f.queue, f.graph, 'token'), /Postgres unavailable/); assert.ok(!f.calls.includes('project:2')); assert.deepEqual(f.pending, [{ id: 1 }, { id: 2 }]); });
test('another lock owner prevents graph initialization and is never released', async () => { const f = fixtures(); f.queue.acquire = async () => false; await assert.rejects(replayOutbox(f.queue, f.graph, 'token'), /already locked/); assert.deepEqual(f.calls, ['close']); });
test('driver close failure still releases this replay’s lock', async () => { const f = fixtures(); f.graph.close = async () => { f.calls.push('close'); throw new Error('Close failed'); }; await assert.rejects(replayOutbox(f.queue, f.graph, 'token'), (error) => error instanceof AggregateError && error.errors[0].message === 'Close failed'); assert.equal(f.calls.at(-1), 'release:token'); });
test('projection error remains the cause when driver close and unlock also fail', async () => { const f = fixtures(); const primary = new Error('Projection failed'); f.graph.project = async () => { throw primary; }; f.graph.close = async () => { throw new Error('Close failed'); }; f.queue.release = async () => { throw new Error('Unlock failed'); }; await assert.rejects(replayOutbox(f.queue, f.graph, 'token'), (error) => error instanceof AggregateError && error.cause === primary && error.errors.map((item) => item.message).join(',') === 'Projection failed,Close failed,Unlock failed'); });
test('connection failure releases the lock without reading the queue', async () => { const f = fixtures(); f.graph.connect = async () => { throw new Error('Connection failed'); }; await assert.rejects(replayOutbox(f.queue, f.graph, 'token'), /Connection failed/); assert.ok(!f.calls.includes('pending')); assert.equal(f.calls.at(-1), 'release:token'); });
