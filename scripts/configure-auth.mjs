import { configureAuth } from './configure-auth-core.mjs';
import { SUPABASE_API, authSettings, requireEnv } from './hosted-config.mjs';

// Dry run by default. Pass --apply to write. Secrets are read from the environment and never printed.
const { SUPABASE_PROJECT_REF: ref, SUPABASE_ACCESS_TOKEN: token } = requireEnv(process.env, ['SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN']);
const url = `${SUPABASE_API}/v1/projects/${encodeURIComponent(ref)}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function call(method, body) {
  const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`Management API ${method} auth config failed with HTTP ${response.status}.`);
  return response.json();
}

const api = { get: () => call('GET'), patch: (body) => call('PATCH', body) };
await configureAuth(api, authSettings(process.env), { apply: process.argv.includes('--apply') });
