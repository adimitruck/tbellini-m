// The single source of truth for hosted (preview/production) configuration: variable names, kinds,
// which script needs which, and the Auth settings derived from them. Values are never stored here.

export const HOSTED_ENVIRONMENTS = ['preview', 'production'];
export const GITHUB_REPOSITORY = 'adimitruck/tbellini-m';
export const PROJECT_NAME = 'tbellini-m';
export const HEALTH_PATH = '/api/health';
export const AUTH_PASSWORD_MIN_LENGTH = 8;
export const SUPABASE_API = 'https://api.supabase.com';
export const VERCEL_API = 'https://api.vercel.com';

const SMTP = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_ADMIN_EMAIL', 'SMTP_SENDER_NAME'];

/** Every hosted name. `kind` secret values are never printed. `uses` lists the scripts that require it. */
export const CONTRACT = [
  { name: 'SITE_URL', kind: 'var', uses: ['configure-auth', 'seed-member', 'deploy-check'] },
  { name: 'DEPLOY_ENABLED', kind: 'var', uses: [], optional: true },
  { name: 'EXTRA_REDIRECT_URLS', kind: 'var', uses: [], optional: true },
  { name: 'SUPABASE_REGION', kind: 'var', uses: ['bootstrap'] },
  ...SMTP.map((name) => ({ name, kind: name === 'SMTP_PASS' ? 'secret' : 'var', uses: ['configure-auth'] })),
  { name: 'SEED_MEMBER_EMAIL', kind: 'var', uses: ['seed-member'] },
  { name: 'SEED_MEMBER_NAME', kind: 'var', uses: ['seed-member'] },
  { name: 'NEXT_PUBLIC_ARCHIVE_MODE', kind: 'var', uses: [], optional: true },
  { name: 'NEXT_PUBLIC_SUPABASE_URL', kind: 'var', uses: ['seed-member'] },
  { name: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', kind: 'var', uses: [], optional: true },
  { name: 'SUPABASE_PROJECT_REF', kind: 'secret', uses: ['configure-auth', 'db'] },
  { name: 'SUPABASE_ACCESS_TOKEN', kind: 'secret', uses: ['bootstrap', 'configure-auth', 'db'] },
  { name: 'SUPABASE_DB_PASSWORD', kind: 'secret', uses: ['bootstrap', 'db'] },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', kind: 'secret', uses: ['seed-member'] },
  { name: 'SUPABASE_ORGANIZATION_ID', kind: 'var', uses: ['bootstrap'] },
  { name: 'VERCEL_TOKEN', kind: 'secret', uses: ['bootstrap'] },
  { name: 'VERCEL_ORG_ID', kind: 'secret', uses: ['bootstrap'] },
  { name: 'VERCEL_PROJECT_ID', kind: 'secret', uses: [], optional: true },
];

export const namesFor = (script) => CONTRACT.filter((entry) => entry.uses.includes(script) && !entry.optional).map((entry) => entry.name);
export const isSecret = (name) => CONTRACT.some((entry) => entry.name === name && entry.kind === 'secret');

/** Names (never values) that are unset or blank. */
export function missingNames(env, names) {
  return names.filter((name) => !String(env[name] ?? '').trim());
}

/** Return the trimmed values for the names or throw one error that lists every missing name. */
export function requireEnv(env, names) {
  const missing = missingNames(env, names);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  return Object.fromEntries(names.map((name) => [name, String(env[name]).trim()]));
}

/** SITE_URL must be an origin: https, or http on localhost. A trailing slash is dropped. */
export function normaliseSiteUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SITE_URL must be an absolute URL.');
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('SITE_URL must use https.');
  if (url.pathname !== '/' || url.search || url.hash) throw new Error('SITE_URL must be an origin without a path.');
  return url.origin;
}

/** SITE_URL first, then EXTRA_REDIRECT_URLS (comma-separated), without duplicates or blanks. */
export function redirectAllowList(env) {
  const extra = String(env.EXTRA_REDIRECT_URLS ?? '').split(',').map((entry) => entry.trim());
  return [...new Set([normaliseSiteUrl(String(env.SITE_URL ?? '').trim()), ...extra].filter(Boolean))];
}

export const AUTH_SECRET_FIELDS = ['smtp_pass'];

/** Management API auth-config body derived from the environment. Field names are UNCONFIRMED (plan 2.0 item 2). */
export function authSettings(env) {
  const v = requireEnv(env, namesFor('configure-auth').filter((name) => name !== 'SUPABASE_PROJECT_REF' && name !== 'SUPABASE_ACCESS_TOKEN'));
  const port = Number(v.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT must be a port number.');
  return {
    site_url: normaliseSiteUrl(v.SITE_URL),
    uri_allow_list: redirectAllowList(env).join(','),
    external_email_enabled: true,
    mailer_autoconfirm: false,
    disable_signup: false,
    password_min_length: AUTH_PASSWORD_MIN_LENGTH,
    smtp_host: v.SMTP_HOST,
    smtp_port: String(port),
    smtp_user: v.SMTP_USER,
    smtp_pass: v.SMTP_PASS,
    smtp_admin_email: v.SMTP_ADMIN_EMAIL,
    smtp_sender_name: v.SMTP_SENDER_NAME,
  };
}
