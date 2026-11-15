import { z } from 'zod';
import { eventInputSchema, personInputSchema, tagKey, type EventPersonTag, type Person } from '@/domain/archive';
import { profileSchema, rsvpSchema } from '@/domain/members';
import { idSchema, isoTimestamp } from '@/domain/primitives';
import type { ArchiveSnapshot } from '@/domain/snapshot';
import { DEMO_USERS, seedArchive } from './demo-seed';

/** Storage keys of every demo format, newest first. The migration chain upgrades older keys to the current one. */
export const DEMO_STORAGE_KEY = 'tbellini.community.v3';
export const LEGACY_V2_KEY = 'tbellini.community.v2';
export const LEGACY_V1_KEY = 'tbellini.archive.v1';

const legacyRecord = z.object({
  id: idSchema,
  ownerId: idSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  provenance: z.literal('manual'),
});
const legacyAttendance = z.object({
  eventId: idSchema,
  personId: idSchema,
  ownerId: idSchema,
  createdAt: isoTimestamp,
});

/** v1: one private owner, no members. */
const v1Schema = z.object({
  events: z.array(eventInputSchema.and(legacyRecord)),
  people: z.array(personInputSchema.and(legacyRecord)),
  attendance: z.array(legacyAttendance),
});

/** v2: one community, member tags and private attendance links. */
const v2Schema = z.object({
  events: z.array(eventInputSchema.and(legacyRecord)),
  people: z.array(personInputSchema.and(legacyRecord)),
  attendance: z.array(legacyAttendance),
  members: z.array(profileSchema),
  tags: z.array(z.object({ eventId: idSchema, userId: idSchema, taggedBy: idSchema, createdAt: isoTimestamp })),
  rsvps: z.array(rsvpSchema), // communityId is dropped by parsing
});

const memberPersonId = (userId: string): string => `person-of-${userId}`;

/** Every member is a Person, as the database trigger ensures. */
function memberPersons(members: ArchiveSnapshot['members']): Person[] {
  return members.map((member): Person => ({
    id: memberPersonId(member.id),
    createdBy: member.id,
    memberId: member.id,
    displayName: member.displayName,
    notes: '',
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    provenance: 'manual',
  }));
}

function uniqueTags(tags: EventPersonTag[]): EventPersonTag[] {
  return [...new Map(tags.map((tag): [string, EventPersonTag] => [tagKey(tag), tag])).values()];
}

/** v2 to v3: drop community fields, tag Persons instead of members and attendance links. */
export function migrateV2(raw: unknown): ArchiveSnapshot {
  const old = v2Schema.parse(raw);
  const strip = <T extends { ownerId: string }>(record: T): Omit<T, 'ownerId'> & { createdBy: string } => {
    const { ownerId, ...rest } = record;
    return { ...rest, createdBy: ownerId };
  };
  const people: Person[] = [
    ...old.people.map((person): Person => ({ ...strip(person), memberId: null })),
    ...memberPersons(old.members),
  ];
  const attendanceTags = old.attendance.map(
    (link): EventPersonTag => ({
      eventId: link.eventId,
      personId: link.personId,
      taggedBy: link.ownerId,
      createdAt: link.createdAt,
    }),
  );
  const memberTags = old.tags.map(
    (tag): EventPersonTag => ({
      eventId: tag.eventId,
      personId: memberPersonId(tag.userId),
      taggedBy: tag.taggedBy,
      createdAt: tag.createdAt,
    }),
  );
  return {
    events: old.events.map(strip),
    people,
    tags: uniqueTags([...attendanceTags, ...memberTags]),
    members: old.members,
    rsvps: old.rsvps,
  };
}

/** v1 to v3: the single private owner becomes the first demo member. */
export function migrateV1(raw: unknown): ArchiveSnapshot {
  const old = v1Schema.parse(raw);
  const owner = DEMO_USERS[0];
  const { members } = seedArchive();
  const claim = <T extends { ownerId: string }>(record: T): T => ({ ...record, ownerId: owner });
  return migrateV2({
    events: old.events.map(claim),
    people: old.people.map(claim),
    attendance: old.attendance.map(claim),
    members,
    tags: [],
    rsvps: [],
  });
}
