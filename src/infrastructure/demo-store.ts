import { z } from 'zod';
import { ArchiveError, eventSchema, personSchema, type ArchiveSnapshot } from '@/domain/archive';
import { membershipSchema, profileSchema, rsvpSchema, tagSchema, TBELLINI_COMMUNITY_ID } from '@/domain/community';
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const DEMO_STORAGE_KEY = 'tbellini.community.v2';
export const DEMO_USERS = ['demo-sam-user', 'demo-alex-user'] as const;
const metadata = z.object({ id: z.string(), ownerId: z.string(), createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }), provenance: z.literal('manual') });
const eventRecord = eventSchema.and(metadata.extend({ visibility: z.literal('community'), communityId: z.literal(TBELLINI_COMMUNITY_ID) }));
const personRecord = personSchema.and(metadata.extend({ visibility: z.literal('private') }));
const attendanceRecord = z.object({ eventId: z.string(), personId: z.string(), ownerId: z.string(), createdAt: z.iso.datetime({ offset: true }) });
const snapshotSchema = z.object({ events: z.array(eventRecord), people: z.array(personRecord), attendance: z.array(attendanceRecord), members: z.array(profileSchema), memberships: z.array(membershipSchema), tags: z.array(tagSchema), rsvps: z.array(rsvpSchema) });
export function seedArchive(): ArchiveSnapshot {
  const now = '2026-10-01T12:00:00.000Z';
  const base = { ownerId: DEMO_USERS[0], createdAt: now, updatedAt: now, visibility: 'community' as const, provenance: 'manual' as const, communityId: TBELLINI_COMMUNITY_ID };
  return { events: [
    { ...base, id: 'demo-dinner', title: 'A table for old friends', description: 'An evening to catch up, cook something good, and remember where we left off.', startsAt: '2026-10-09T23:30:00.000Z', endsAt: '2026-10-10T02:00:00.000Z', timezone: 'America/Chicago', location: 'At home' },
    { ...base, ownerId: DEMO_USERS[1], id: 'demo-walk', title: 'Sunday by the lake', description: 'Coffee, a long walk, and a little space to breathe.', startsAt: '2026-10-11T15:00:00.000Z', endsAt: null, timezone: 'America/Chicago', location: 'The lakefront' },
    { ...base, id: 'demo-music', title: 'Live music, late night', description: 'Keep the setlist here after the show.', startsAt: '2026-10-17T01:00:00.000Z', endsAt: null, timezone: 'America/Chicago', location: 'Neighborhood venue' },
  ], people: [{ ...base, visibility: 'private', id: 'demo-sam', displayName: 'Sam Rivera (archive person)', notes: 'A historical person record, distinct from a user account.' }, { ...base, visibility: 'private', id: 'demo-alex', displayName: 'Alex Chen (archive person)', notes: 'A historical person record.' }], attendance: [{ eventId: 'demo-dinner', personId: 'demo-sam', ownerId: DEMO_USERS[0], createdAt: now }], members: [{ id: DEMO_USERS[0], displayName: 'Sam Rivera', createdAt: now, updatedAt: now }, { id: DEMO_USERS[1], displayName: 'Alex Chen', createdAt: now, updatedAt: now }], memberships: DEMO_USERS.map((userId) => ({ userId, communityId: TBELLINI_COMMUNITY_ID, createdAt: now })), tags: [{ eventId: 'demo-dinner', userId: DEMO_USERS[1], taggedBy: DEMO_USERS[0], communityId: TBELLINI_COMMUNITY_ID, createdAt: now }], rsvps: [{ eventId: 'demo-walk', userId: DEMO_USERS[0], communityId: TBELLINI_COMMUNITY_ID, status: 'interested', createdAt: now, updatedAt: now }] };
}
function migrateLegacy(raw: string): ArchiveSnapshot {
  // Decode every old field before migration; preserve the original key for recovery.
  const oldMetadata = metadata.extend({ ownerId: z.literal('demo-owner'), visibility: z.literal('private') });
  const parsed = z.object({ events: z.array(eventSchema.and(oldMetadata)), people: z.array(personSchema.and(oldMetadata)), attendance: z.array(attendanceRecord.extend({ ownerId: z.literal('demo-owner') })) }).parse(JSON.parse(raw));
  const seed = seedArchive();
  return { ...seed, events: parsed.events.map((event) => ({ ...event, ownerId: DEMO_USERS[0], visibility: 'community', communityId: TBELLINI_COMMUNITY_ID })), people: parsed.people.map((person) => ({ ...person, ownerId: DEMO_USERS[0] })), attendance: parsed.attendance.map((link) => ({ ...link, ownerId: DEMO_USERS[0] })), tags: [], rsvps: [] };
}
function decodeSnapshot(input: unknown): ArchiveSnapshot {
  const parsed = snapshotSchema.parse(input);
  const memberIds = new Set(parsed.members.map((member): string => member.id));
  const isMember = (id: string): boolean => memberIds.has(id) && parsed.memberships.some((membership): boolean => membership.userId === id);
  if (parsed.events.some((event): boolean => !isMember(event.ownerId)) || parsed.people.some((person): boolean => !isMember(person.ownerId)) || parsed.memberships.some((membership): boolean => !memberIds.has(membership.userId))) throw new Error('Unknown owner');
  if (parsed.attendance.some((link): boolean => !parsed.events.some((event): boolean => event.id === link.eventId && event.ownerId === link.ownerId) || !parsed.people.some((person): boolean => person.id === link.personId && person.ownerId === link.ownerId))) throw new Error('Broken attendance');
  if (parsed.tags.some((tag): boolean => !isMember(tag.userId) || !parsed.events.some((event): boolean => event.id === tag.eventId && event.ownerId === tag.taggedBy))) throw new Error('Broken tag');
  if (parsed.rsvps.some((rsvp): boolean => !isMember(rsvp.userId) || !parsed.events.some((event): boolean => event.id === rsvp.eventId))) throw new Error('Broken RSVP');
  const unique = (keys: string[]): boolean => new Set(keys).size === keys.length;
  if (!unique(parsed.events.map((record): string => record.id)) || !unique(parsed.people.map((record): string => record.id)) || !unique(parsed.members.map((record): string => record.id)) || !unique(parsed.memberships.map((record): string => record.userId)) || !unique(parsed.attendance.map((record): string => `${record.eventId}:${record.personId}`)) || !unique(parsed.tags.map((record): string => `${record.eventId}:${record.userId}`)) || !unique(parsed.rsvps.map((record): string => `${record.eventId}:${record.userId}`))) throw new Error('Duplicate archive identity');
  return parsed;
}
export class DemoStore {
  constructor(private readonly storage: StoragePort) {}
  read(): ArchiveSnapshot {
    let raw = this.storage.getItem(DEMO_STORAGE_KEY);
    if (raw === null) { try { const legacy = this.storage.getItem('tbellini.archive.v1'); const initial = legacy ? migrateLegacy(legacy) : seedArchive(); this.write(initial); raw = JSON.stringify(initial); } catch { throw new ArchiveError('Saved demo data could not be read. Reset the demo to restore sample records.'); } }
    try {
      return decodeSnapshot(JSON.parse(raw));
    } catch { throw new ArchiveError('Saved demo data could not be read. Reset the demo to restore sample records.'); }
  }
  write(snapshot: ArchiveSnapshot): void { this.storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(decodeSnapshot(snapshot))); }
  reset(): void { this.write(seedArchive()); }
}
