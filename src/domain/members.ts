import { z } from 'zod';
import { idSchema, isoTimestamp } from './primitives';
import { INVITE_CODE_PATTERN, INVITE_EXPIRY_DAYS } from './invite-code';

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

export { INVITE_CODE_ALPHABET, generateInviteCode } from './invite-code';
export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(INVITE_CODE_PATTERN, 'Enter the invite code you were given, such as ABCD-2345.');
export const inviteExpiryDaysSchema = z.number().int().min(INVITE_EXPIRY_DAYS.min).max(INVITE_EXPIRY_DAYS.max);
export const DEFAULT_INVITE_EXPIRY_DAYS = INVITE_EXPIRY_DAYS.default;

export const signUpSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.'),
  password: z.string().min(8, 'Use at least 8 characters for your password.'),
  displayName: profileNameSchema,
  inviteCode: inviteCodeSchema,
  /** Where the confirmation email link returns to (the page's own origin); the Site URL applies when absent. */
  redirectTo: z.url().optional(),
});
