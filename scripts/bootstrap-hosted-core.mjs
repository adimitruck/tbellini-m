import { GITHUB_REPOSITORY, HOSTED_ENVIRONMENTS, PROJECT_NAME, namesFor, requireEnv } from './hosted-config.mjs';

const ARCHIVE_MODE = 'supabase';
const BROWSER_VARS = ['NEXT_PUBLIC_ARCHIVE_MODE', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];

/** What a run would do, as plain descriptions: names only, never values. No external call is made. */
export function planBootstrap() {
  return [
    `Supabase: find or create project "${PROJECT_NAME}" in SUPABASE_REGION`,
    `Vercel: find or create project "${PROJECT_NAME}" linked to ${GITHUB_REPOSITORY}`,
    `Vercel: upsert ${BROWSER_VARS.join(', ')} for production and preview`,
    ...HOSTED_ENVIRONMENTS.map((name) => `GitHub environment "${name}": set SUPABASE_PROJECT_REF (secret) and NEXT_PUBLIC_SUPABASE_URL (variable)`),
  ];
}

/**
 * Idempotent bootstrap through injected clients:
 *   supabase: findProject(name), createProject(spec), publishableKey(ref)
 *   vercel:   findProject(name), createProject(spec), upsertEnv(projectId, entry)
 *   github:   setVariable(environment, name, value), setSecret(environment, name, value)
 * Dry run (the default) logs the plan and calls no client. Endpoint behavior is UNCONFIRMED (plan 2.0 items 2 and 5).
 */
export async function runBootstrap(env, clients, { apply = false, log = console.info } = {}) {
  const values = requireEnv(env, namesFor('bootstrap'));
  const plan = planBootstrap();
  if (!apply) {
    plan.forEach((line) => log(`Would: ${line}`));
    log('Dry run: nothing created or written. Re-run with --apply to run.');
    return { applied: false };
  }
  const { supabase, vercel, github } = clients;

  let project = await supabase.findProject(PROJECT_NAME);
  if (!project) {
    project = await supabase.createProject({
      name: PROJECT_NAME,
      organization_id: values.SUPABASE_ORGANIZATION_ID,
      db_pass: values.SUPABASE_DB_PASSWORD,
      region: values.SUPABASE_REGION,
    });
  }
  const supabaseUrl = `https://${project.ref}.supabase.co`;
  log(`Supabase project ready (${project.ref}).`);

  const site =
    (await vercel.findProject(PROJECT_NAME)) ?? (await vercel.createProject({ name: PROJECT_NAME, gitRepository: GITHUB_REPOSITORY }));
  log(`Vercel project ready (${site.id}).`);

  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || (await supabase.publishableKey(project.ref));
  const browser = {
    NEXT_PUBLIC_ARCHIVE_MODE: ARCHIVE_MODE,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable,
  };
  for (const [key, value] of Object.entries(browser)) {
    await vercel.upsertEnv(site.id, { key, value, target: ['production', 'preview'] });
    log(`Vercel env ${key} set.`);
  }
  for (const environment of HOSTED_ENVIRONMENTS) {
    await github.setSecret(environment, 'SUPABASE_PROJECT_REF', project.ref);
    await github.setVariable(environment, 'NEXT_PUBLIC_SUPABASE_URL', supabaseUrl);
    log(`GitHub environment ${environment} updated.`);
  }
  return { applied: true };
}
