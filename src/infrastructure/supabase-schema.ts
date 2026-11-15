import { z } from 'zod';
import {
  archiveEventSchema,
  eventInputSchema,
  personClaimSchema,
  personInputSchema,
  personSchema,
  tagSchema,
  type ArchiveEvent,
  type EventInput,
  type EventPersonTag,
  type Person,
  type PersonClaim,
  type PersonInput,
} from '@/domain/archive';
import { profileSchema, rsvpSchema, type EventRsvp, type UserProfile } from '@/domain/members';
import { isoTimestamp } from '@/domain/primitives';

/**
 * The only place that names database tables, columns and functions
 * (supabase/migrations/20261017000000_shared_space.sql).
 * The database calls the creator of an event owner_id and the creator of a person created_by; the domain calls both
 * createdBy, and CREATOR_COLUMN is where the two vocabularies meet.
 */
export const TABLES = {
  events: 'events',
  people: 'people',
  tags: 'event_person_tags',
  rsvps: 'event_rsvps',
  profiles: 'profiles',
  claims: 'person_claims',
} as const;
export const CREATOR_COLUMN = { events: 'owner_id', people: 'created_by' } as const;
export { SIGN_UP_METADATA } from '@/domain/invite-code';
/** Auth relays the trigger's rejection as a generic database error on some versions. */
export const SIGN_UP_REJECTED_MARKER = 'Database error saving new user';
export const SESSION_MISSING_ERROR = 'AuthSessionMissingError';

/** Columns the adapter filters, orders or writes by name. */
export const COLUMNS = {
  id: 'id',
  eventId: 'event_id',
  personId: 'person_id',
  taggedBy: 'tagged_by',
  userId: 'user_id',
  status: 'status',
  displayName: 'display_name',
  claimantId: 'claimant_id',
} as const;
export const RPC = {
  createInvitation: { name: 'create_invitation', expiresInDays: 'expires_in_days', forPerson: 'for_person' },
  confirmClaim: { name: 'confirm_person_claim', person: 'claimed_person', claimant: 'claimant' },
} as const;

const timestamps = { created_at: isoTimestamp, updated_at: isoTimestamp };
const eventRow = z.object({
  id: z.string(),
  [CREATOR_COLUMN.events]: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  starts_at: isoTimestamp,
  ends_at: isoTimestamp.nullable(),
  timezone: z.string(),
  location: z.string().nullable(),
  provenance: z.literal('manual'),
  ...timestamps,
});
const personRow = z.object({
  id: z.string(),
  [CREATOR_COLUMN.people]: z.string().nullable(),
  member_id: z.string().nullable(),
  display_name: z.string(),
  notes: z.string().nullable(),
  provenance: z.literal('manual'),
  ...timestamps,
});
const tagRow = z.object({
  event_id: z.string(),
  person_id: z.string(),
  tagged_by: z.string(),
  created_at: isoTimestamp,
});
const rsvpRow = z.object({
  event_id: z.string(),
  user_id: z.string(),
  status: z.string(),
  ...timestamps,
});
const claimRow = z.object({ person_id: z.string(), claimant_id: z.string(), created_at: isoTimestamp });
const profileRow =z.object({ id: z.string(), display_name: z.string(), ...timestamps });

export type DbValue = string | null;
export type DbRecord = Record<string, DbValue>;

export function decodeEvent(input: unknown): ArchiveEvent {
  const row = eventRow.parse(input);
  return archiveEventSchema.parse({
    id: row.id,
    createdBy: row[CREATOR_COLUMN.events],
    title: row.title,
    description: row.description ?? '',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    location: row.location ?? '',
    provenance: row.provenance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function encodeEvent(input: EventInput): DbRecord {
  const event = eventInputSchema.parse(input);
  return {
    title: event.title,
    description: event.description,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    timezone: event.timezone,
    location: event.location,
  };
}

export function decodePerson(input: unknown): Person {
  const row = personRow.parse(input);
  return personSchema.parse({
    id: row.id,
    createdBy: row[CREATOR_COLUMN.people],
    memberId: row.member_id,
    displayName: row.display_name,
    notes: row.notes ?? '',
    provenance: row.provenance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function encodePerson(input: PersonInput): DbRecord {
  const person = personInputSchema.parse(input);
  return { display_name: person.displayName, notes: person.notes };
}

export function decodeTag(input: unknown): EventPersonTag {
  const row = tagRow.parse(input);
  return tagSchema.parse({
    eventId: row.event_id,
    personId: row.person_id,
    taggedBy: row.tagged_by,
    createdAt: row.created_at,
  });
}

export function decodeClaim(input: unknown): PersonClaim {
  const row = claimRow.parse(input);
  return personClaimSchema.parse({ personId: row.person_id, claimantId: row.claimant_id, createdAt: row.created_at });
}

export function decodeRsvp(input: unknown): EventRsvp {
  const row = rsvpRow.parse(input);
  return rsvpSchema.parse({
    eventId: row.event_id,
    userId: row.user_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function decodeProfile(input: unknown): UserProfile {
  const row = profileRow.parse(input);
  return profileSchema.parse({
    id: row.id,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
