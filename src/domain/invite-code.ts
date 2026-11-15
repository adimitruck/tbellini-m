/**
 * Invite-code format, shared by the domain schema and the seed script. Keep this file free of
 * imports and of non-erasable TypeScript syntax: Node loads it directly via type stripping.
 * The database check constraint on public.invitations.code mirrors INVITE_CODE_PATTERN.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_PATTERN = /^[A-Z0-9-]{8,12}$/;
/** HTML pattern attribute (browsers compile it with the v flag, so the hyphen is escaped). */
export const INVITE_CODE_INPUT_PATTERN = '[A-Za-z0-9\\-]{8,12}';

export const INVITE_EXPIRY_DAYS = { min: 1, max: 30, default: 7 } as const;

export function isInviteCode(value: string): boolean {
  return INVITE_CODE_PATTERN.test(value);
}

/** Demo and seed generator; member-created hosted codes come from the create_invitation() RPC. */
export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const symbols = Array.from(bytes, (byte): string => INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length]);
  return `${symbols.slice(0, 4).join('')}-${symbols.slice(4).join('')}`;
}

/** Sign-up metadata keys read by the join_tbellini() trigger; shared by the app and the seed scripts. */
export const SIGN_UP_METADATA = { displayName: 'display_name', inviteCode: 'invite_code' } as const;
