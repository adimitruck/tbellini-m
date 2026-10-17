import { z } from 'zod';
export const TBELLINI_COMMUNITY_ID = '00000000-0000-4000-8000-000000000001';
export interface UserProfile { id: string; displayName: string; createdAt: string; updatedAt: string }
export interface CommunityMembership { communityId: string; userId: string; createdAt: string }
export interface UserTag { eventId: string; userId: string; communityId: string; taggedBy: string; createdAt: string }
export type RsvpStatus = 'going' | 'interested';
export interface EventRsvp { eventId: string; userId: string; communityId: string; status: RsvpStatus; createdAt: string; updatedAt: string }
export interface CommunityRepository {
  members(): Promise<UserProfile[]>;
  memberships(): Promise<CommunityMembership[]>;
  tags(): Promise<UserTag[]>;
  rsvps(): Promise<EventRsvp[]>;
  tag(eventId: string, userId: string): Promise<void>;
  untag(eventId: string, userId: string): Promise<void>;
  respond(eventId: string, status: RsvpStatus | null): Promise<void>;
  updateProfile(displayName: string): Promise<UserProfile>;
  generateInvitation(expiresInDays: number): Promise<string>;
}
export const profileNameSchema = z.string().trim().min(1, 'Enter a display name.').max(200);
export const profileSchema = z.object({ id: z.string(), displayName: profileNameSchema, createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }) });
export const membershipSchema = z.object({ communityId: z.literal(TBELLINI_COMMUNITY_ID), userId: z.string(), createdAt: z.iso.datetime({ offset: true }) });
export const tagSchema = z.object({ eventId: z.string(), userId: z.string(), communityId: z.literal(TBELLINI_COMMUNITY_ID), taggedBy: z.string(), createdAt: z.iso.datetime({ offset: true }) });
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const inviteCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{8,12}$/, 'Enter the invite code you were given, such as ABCD-2345.');
export const inviteExpiryDaysSchema = z.number().int().min(1).max(30);
/** Demo-only generator; hosted codes come from the database create_invitation() RPC. */
export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const symbols = Array.from(bytes, (byte): string => INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length]);
  return `${symbols.slice(0, 4).join('')}-${symbols.slice(4).join('')}`;
}
export const rsvpStatusSchema = z.enum(['going', 'interested']);
export const rsvpSchema = z.object({ eventId: z.string(), userId: z.string(), communityId: z.literal(TBELLINI_COMMUNITY_ID), status: rsvpStatusSchema, createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }) });
