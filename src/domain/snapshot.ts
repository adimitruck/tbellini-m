import { z } from 'zod';
import {
  archiveEventSchema,
  personClaimSchema,
  personSchema,
  tagKey,
  tagSchema,
  type ArchiveEvent,
  type EventPersonTag,
  type Person,
} from './archive';
import { profileSchema, rsvpSchema } from './members';

/** Everything a signed-in member can read. Version 3 of the stored demo format. */
export const snapshotSchema = z.object({
  events: z.array(archiveEventSchema),
  people: z.array(personSchema),
  tags: z.array(tagSchema),
  members: z.array(profileSchema),
  rsvps: z.array(rsvpSchema),
  /** Pending claims; absent in demo data stored before claims existed. */
  claims: z.array(personClaimSchema).default([]),
});
export type ArchiveSnapshot = z.infer<typeof snapshotSchema>;

export function emptySnapshot(): ArchiveSnapshot {
  return { events: [], people: [], tags: [], members: [], rsvps: [], claims: [] };
}

/** Personal attendance intent is explicit and independent of tagging or authorship. */
export function personalEvents(snapshot: ArchiveSnapshot, userId: string): ArchiveEvent[] {
  const mine = snapshot.rsvps.filter((rsvp): boolean => rsvp.userId === userId);
  const ids = new Set(mine.map((rsvp): string => rsvp.eventId));
  return snapshot.events.filter((event): boolean => ids.has(event.id));
}

/** The Person a member is, if one is linked; every member has one once signed up. */
export function personOfMember(snapshot: ArchiveSnapshot, userId: string): Person | undefined {
  return snapshot.people.find((person): boolean => person.memberId === userId);
}

function isUnique(keys: string[]): boolean {
  return new Set(keys).size === keys.length;
}

/** Referential and identity rules the database enforces with keys and policies; throws on the first violation. */
export function assertSnapshotIntegrity(snapshot: ArchiveSnapshot): void {
  const memberIds = new Set(snapshot.members.map((member): string => member.id));
  const eventsById = new Map(snapshot.events.map((event): [string, ArchiveEvent] => [event.id, event]));
  const personIds = new Set(snapshot.people.map((person): string => person.id));
  const known = (id: string | null): boolean => id === null || memberIds.has(id);
  if (snapshot.events.some((event): boolean => !memberIds.has(event.createdBy))) throw new Error('Unknown creator');
  if (snapshot.people.some((person): boolean => !known(person.createdBy) || !known(person.memberId))) {
    throw new Error('Unknown person creator or member');
  }
  const brokenTag = (tag: EventPersonTag): boolean =>
    !personIds.has(tag.personId) || eventsById.get(tag.eventId)?.createdBy !== tag.taggedBy;
  if (snapshot.tags.some(brokenTag)) {
    throw new Error('Broken tag');
  }
  if (snapshot.rsvps.some((rsvp): boolean => !memberIds.has(rsvp.userId) || !eventsById.has(rsvp.eventId))) {
    throw new Error('Broken RSVP');
  }
  const claimable = new Set(snapshot.people.filter((p): boolean => p.memberId === null).map((p): string => p.id));
  if (snapshot.claims.some((claim): boolean => !claimable.has(claim.personId) || !memberIds.has(claim.claimantId))) {
    throw new Error('Broken claim');
  }
  const linked = snapshot.people.flatMap((person): string[] => (person.memberId ? [person.memberId] : []));
  const identities = [
    snapshot.events.map((record): string => record.id),
    snapshot.people.map((record): string => record.id),
    snapshot.members.map((record): string => record.id),
    snapshot.tags.map(tagKey),
    snapshot.rsvps.map((record): string => `${record.eventId}:${record.userId}`),
    linked,
    snapshot.claims.map((claim): string => claim.claimantId),
  ];
  if (!identities.every(isUnique)) throw new Error('Duplicate archive identity');
}
