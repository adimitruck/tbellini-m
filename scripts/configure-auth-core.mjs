import { AUTH_SECRET_FIELDS } from './hosted-config.mjs';

const REDACTED = '<redacted>';
const SMTP_PREFIX = 'smtp_';

const show = (field, value) => (AUTH_SECRET_FIELDS.includes(field) ? REDACTED : value);

/**
 * Compare desired settings with the current ones. Secret fields are never returned by the API, so they
 * are sent only when another SMTP field changes. Every reported value is redacted when secret.
 */
export function diffAuthSettings(current, desired) {
  const changes = Object.keys(desired)
    .filter((field) => !AUTH_SECRET_FIELDS.includes(field) && String(current[field] ?? '') !== String(desired[field]))
    .map((field) => ({ field, from: current[field] ?? null, to: desired[field] }));
  const resendSecrets = changes.some((change) => change.field.startsWith(SMTP_PREFIX));
  const body = Object.fromEntries(changes.map((change) => [change.field, change.to]));
  if (resendSecrets) for (const field of AUTH_SECRET_FIELDS) if (field in desired) body[field] = desired[field];
  const lines = [...changes.map((change) => `${change.field}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)}`)];
  if (resendSecrets) lines.push(...AUTH_SECRET_FIELDS.map((field) => `${field}: ${show(field, '')} (sent with the SMTP change)`));
  return { changed: changes.length > 0, body, lines };
}

/** Read the current config, print the diff and, only when `apply` is true and something differs, PATCH it. */
export async function configureAuth(api, desired, { apply = false, log = console.info } = {}) {
  const current = await api.get();
  const diff = diffAuthSettings(current, desired);
  if (!diff.changed) {
    log('Auth configuration already matches; nothing to change.');
    return { applied: false, changed: false };
  }
  diff.lines.forEach((line) => log(line));
  if (!apply) {
    log('Dry run: nothing written. Re-run with --apply to write.');
    return { applied: false, changed: true };
  }
  await api.patch(diff.body);
  log('Auth configuration updated.');
  return { applied: true, changed: true };
}
