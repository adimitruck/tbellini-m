import { INVITE_EXPIRY_DAYS, generateInviteCode, isInviteCode } from '../src/domain/invite-code.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Normalise like the signup trigger (trim + upper) and reject codes the database would refuse. */
export function resolveInviteCode(requested, generate = generateInviteCode) {
  if (requested === undefined || requested === '') return generate();
  const code = requested.trim().toUpperCase();
  if (!isInviteCode(code)) throw new Error('Invite code must be 8-12 characters of A-Z, 0-9 or hyphen.');
  return code;
}

export function resolveExpiryDays(requested) {
  if (requested === undefined || requested === '') return INVITE_EXPIRY_DAYS.default;
  const days = Number(requested);
  if (!Number.isInteger(days) || days < INVITE_EXPIRY_DAYS.min || days > INVITE_EXPIRY_DAYS.max) {
    throw new Error(`Expiry must be a whole number of days from ${INVITE_EXPIRY_DAYS.min} to ${INVITE_EXPIRY_DAYS.max}.`);
  }
  return days;
}

/** Insert one unused invitation through the injected store and return its code and expiry. */
export async function seedInvite(store, { code, expiryDays, now = () => new Date(), generate } = {}) {
  const resolvedCode = resolveInviteCode(code, generate);
  const expiresAt = new Date(now().getTime() + resolveExpiryDays(expiryDays) * DAY_MS).toISOString();
  await store.insert({ code: resolvedCode, expires_at: expiresAt });
  return { code: resolvedCode, expiresAt };
}
