import { z } from 'zod';
import { idSchema, isoTimestamp } from './primitives';

/** A profile means "can log in". Every signed-in member reads every profile. */
export const profileNameSchema = z.string().trim().min(1, 'Enter a display name.').max(200);
export const profileSchema = z.object({
  id: idSchema,
  displayName: profileNameSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});
export type UserProfile = z.infer<typeof profileSchema>;

/** An RSVP is self-only and independent of tagging or authorship. */
export const RSVP_STATUSES = ['going', 'interested'] as const;
export const rsvpStatusSchema = z.enum(RSVP_STATUSES);
export type RsvpStatus = z.infer<typeof rsvpStatusSchema>;
export const rsvpSchema = z.object({
  eventId: idSchema,
  userId: idSchema,
  status: rsvpStatusSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
});
export type EventRsvp = z.infer<typeof rsvpSchema>;

export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{8,12}$/, 'Enter the invite code you were given, such as ABCD-2345.');
export const inviteExpiryDaysSchema = z.number().int().min(1).max(30);
export const DEFAULT_INVITE_EXPIRY_DAYS = 7;

export const signUpSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.'),
  password: z.string().min(8, 'Use at least 8 characters for your password.'),
  displayName: profileNameSchema,
  inviteCode: inviteCodeSchema,
});

/** Demo-only generator; hosted codes come from the database create_invitation() RPC. */
export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const symbols = Array.from(bytes, (byte): string => INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length]);
  return `${symbols.slice(0, 4).join('')}-${symbols.slice(4).join('')}`;
}
