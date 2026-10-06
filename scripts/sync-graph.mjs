import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import neo4j from 'neo4j-driver';
import { projectGraphRow } from './project-graph.mjs';
import { replayOutbox } from './replay-outbox.mjs';
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};
const db = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const driver = neo4j.driver(required('NEO4J_URI'), neo4j.auth.basic(required('NEO4J_USERNAME'), required('NEO4J_PASSWORD')));
const database = process.env.NEO4J_DATABASE || 'neo4j';
const assertSuccess = (result) => { if (result.error) throw new Error(result.error.message); return result.data; };
const processed = await replayOutbox({
  async acquire(token) { return assertSuccess(await db.rpc('acquire_graph_sync_lock', { lock_token: token })) === true; },
  async release(token) { assertSuccess(await db.rpc('release_graph_sync_lock', { lock_token: token })); },
  async pending() { return assertSuccess(await db.from('graph_outbox').select('*').is('processed_at', null).order('id').limit(100)); },
  async acknowledge(id) {
    // The exact projected record must be pending. Missing acknowledgements fail the replay.
    assertSuccess(await db.from('graph_outbox').update({ processed_at: new Date().toISOString() }).eq('id', id).is('processed_at', null).select('id').single());
  },
}, {
  async connect() { await driver.verifyConnectivity(); },
  async initialize() {
    const constraints = await readFile(new URL('../neo4j/constraints.cypher', import.meta.url), 'utf8');
    for (const statement of constraints.split(';').map((part) => part.trim()).filter(Boolean)) await driver.executeQuery(statement, {}, { database });
  },
  async project(row) { await projectGraphRow(driver, database, row); },
  async close() { await driver.close(); },
}, randomUUID());
console.info(`Projected ${processed} archive changes.`);
