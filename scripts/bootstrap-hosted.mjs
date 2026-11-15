import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runBootstrap } from './bootstrap-hosted-core.mjs';
import { GITHUB_REPOSITORY, SUPABASE_API, VERCEL_API } from './hosted-config.mjs';

// Dry run by default; pass --apply to create and write. Tokens come from the environment and are never printed.
// Endpoint shapes below are UNCONFIRMED (plan 2.0 items 2 and 5) and are exercised only by an approved run.
const run = promisify(execFile);
const apply = process.argv.includes('--apply');

async function request(base, token, path, { method = 'GET', body, query = '' } = {}) {
  const response = await fetch(`${base}${path}${query}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${path} failed with HTTP ${response.status}.`);
  return response.status === 204 ? null : response.json();
}

function buildClients(env) {
  const sb = (path, options) => request(SUPABASE_API, env.SUPABASE_ACCESS_TOKEN, path, options);
  const vc = (path, options) => request(VERCEL_API, env.VERCEL_TOKEN, path, { ...options, query: `?teamId=${encodeURIComponent(env.VERCEL_ORG_ID)}${options?.query ?? ''}` });
  const gh = (args, input) => run('gh', ['--repo', GITHUB_REPOSITORY, ...args], { input });
  return {
    supabase: {
      findProject: async (name) => (await sb('/v1/projects')).find((p) => p.name === name) ?? null,
      createProject: (spec) => sb('/v1/projects', { method: 'POST', body: spec }),
      publishableKey: async (ref) => (await sb(`/v1/projects/${ref}/api-keys`)).find((k) => k.type === 'publishable')?.api_key,
    },
    vercel: {
      findProject: async (name) => vc(`/v9/projects/${encodeURIComponent(name)}`).catch(() => null),
      createProject: (spec) => vc('/v11/projects', { method: 'POST', body: { name: spec.name, gitRepository: { type: 'github', repo: spec.gitRepository } } }),
      upsertEnv: (id, entry) => vc(`/v10/projects/${id}/env`, { method: 'POST', query: '&upsert=true', body: { ...entry, type: 'plain' } }),
    },
    github: {
      setVariable: (environment, name, value) => gh(['variable', 'set', name, '--env', environment, '--body', value]),
      setSecret: (environment, name, value) => gh(['secret', 'set', name, '--env', environment, '--body', value]),
    },
  };
}

await runBootstrap(process.env, apply ? buildClients(process.env) : undefined, { apply });
