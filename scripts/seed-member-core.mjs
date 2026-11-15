import { INVITE_EXPIRY_DAYS, SIGN_UP_METADATA, generateInviteCode } from '../src/domain/invite-code.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const NAME_MAX = 200; // matches the join_tbellini() display_name rule
const EMAIL_EXISTS = 'email_exists';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateMember({ name, email }) {
  const displayName = String(name ?? '').trim();
  const address = String(email ?? '').trim();
  if (displayName.length < 1 || displayName.length > NAME_MAX) throw new Error(`Member name must be 1-${NAME_MAX} characters.`);
  if (!EMAIL_PATTERN.test(address)) throw new Error('Member email is not a valid address.');
  return { displayName, email: address };
}

/**
 * Create the first member through the invite-only gate (spike 2.0: the signup trigger also guards admin
 * createUser, so an invitation is inserted first and its code travels in user_metadata). An existing user
 * is left unchanged. The invitation of a failed or duplicate attempt is removed again.
 * The store is injected: insertInvitation, deleteInvitation, createUser, sendPasswordReset.
 */
export async function seedMember(store, member, { redirectTo, now = () => new Date(), generate = generateInviteCode } = {}) {
  const { displayName, email } = validateMember(member);
  const code = generate();
  const expires_at = new Date(now().getTime() + INVITE_EXPIRY_DAYS.default * DAY_MS).toISOString();
  await store.insertInvitation({ code, expires_at });
  const created = await store.createUser({
    email,
    email_confirm: true,
    user_metadata: { [SIGN_UP_METADATA.displayName]: displayName, [SIGN_UP_METADATA.inviteCode]: code },
  });
  if (created.error) {
    await store.deleteInvitation(code);
    if (created.error.code === EMAIL_EXISTS) return { status: 'exists' };
    throw new Error(`Member creation failed: ${created.error.message}`);
  }
  await store.sendPasswordReset(email, redirectTo);
  return { status: 'created' };
}
