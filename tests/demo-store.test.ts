import { describe, expect, it } from 'vitest';
import { ArchiveError } from '../src/domain/archive';
import { ARCHIVE_MESSAGES } from '../src/domain/rules';
import { assertSnapshotIntegrity } from '../src/domain/snapshot';
import {
  createDemoRepositories,
  DEMO_STORAGE_KEY,
  DEMO_USERS,
  resetDemoStorage,
  seedArchive,
} from '../src/infrastructure/demo';
import { LEGACY_V1_KEY, LEGACY_V2_KEY } from '../src/infrastructure/demo-migration';
import { DemoStore } from '../src/infrastructure/demo-store';
import { memoryStorage } from './support/adapters';

const [SAM, ALEX] = DEMO_USERS;
const T = '2026-10-01T12:00:00.000Z';
const eventFields = { title: 'Dinner', description: '', startsAt: T, endsAt: null, timezone: 'America/Chicago', location: '' };
const metadata = { createdAt: T, updatedAt: T, provenance: 'manual' };
const member = (id: string, displayName: string): object => ({ id, displayName, createdAt: T, updatedAt: T });

const v2 = {
  events: [{ ...eventFields, ...metadata, id: 'e1', ownerId: SAM, visibility: 'community', communityId: 'c' }],
  people: [{ displayName: 'Grandpa', notes: 'Old friend', ...metadata, id: 'p1', ownerId: SAM, visibility: 'private' }],
  attendance: [{ eventId: 'e1', personId: 'p1', ownerId: SAM, createdAt: T }],
  members: [member(SAM, 'Sam Rivera'), member(ALEX, 'Alex Chen')],
  memberships: [{ communityId: 'c', userId: SAM, createdAt: T }],
  tags: [{ eventId: 'e1', userId: ALEX, communityId: 'c', taggedBy: SAM, createdAt: T }],
  rsvps: [{ eventId: 'e1', userId: ALEX, communityId: 'c', status: 'going', createdAt: T, updatedAt: T }],
};
const v1 = {
  events: [{ ...eventFields, ...metadata, id: 'e1', ownerId: 'demo-owner', visibility: 'private' }],
  people: [{ displayName: 'Grandpa', notes: '', ...metadata, id: 'p1', ownerId: 'demo-owner', visibility: 'private' }],
  attendance: [{ eventId: 'e1', personId: 'p1', ownerId: 'demo-owner', createdAt: T }],
};

describe('demo snapshot v3', (): void => {
  it('seeds a valid snapshot where every member is a Person', (): void => {
    const seed = seedArchive();
    expect(() => assertSnapshotIntegrity(seed)).not.toThrow();
    expect(seed.members.every((m): boolean => seed.people.some((p): boolean => p.memberId === m.id))).toBe(true);
  });

  it('migrates stored v2 data: creators kept, community dropped, tags retargeted at Persons', (): void => {
    const disk = memoryStorage({ [LEGACY_V2_KEY]: JSON.stringify(v2) });
    const data = new DemoStore(disk).read();
    expect(data.events).toEqual([{ ...eventFields, ...metadata, id: 'e1', createdBy: SAM }]);
    const grandpa = data.people.find((p): boolean => p.id === 'p1');
    expect(grandpa).toMatchObject({ createdBy: SAM, memberId: null, displayName: 'Grandpa' });
    const alexPerson = data.people.find((p): boolean => p.memberId === ALEX);
    expect(alexPerson).toMatchObject({ createdBy: ALEX, displayName: 'Alex Chen' });
    expect(data.tags.map((tag): string => `${tag.eventId}:${tag.personId}:${tag.taggedBy}`).sort()).toEqual(
      [`e1:p1:${SAM}`, `e1:${alexPerson?.id}:${SAM}`].sort(),
    );
    expect(data.rsvps).toEqual([{ eventId: 'e1', userId: ALEX, status: 'going', createdAt: T, updatedAt: T }]);
    expect(JSON.parse(disk.data.get(DEMO_STORAGE_KEY) ?? 'null')).toEqual(data);
    expect(disk.data.get(LEGACY_V2_KEY)).toBe(JSON.stringify(v2));
  });

  it('migrates v1 data to the first demo member without inventing RSVPs', (): void => {
    const data = new DemoStore(memoryStorage({ [LEGACY_V1_KEY]: JSON.stringify(v1) })).read();
    expect(data.events[0]).toMatchObject({ id: 'e1', createdBy: SAM });
    expect(data.people.find((p): boolean => p.id === 'p1')).toMatchObject({ createdBy: SAM, memberId: null });
    expect(data.tags).toEqual([{ eventId: 'e1', personId: 'p1', taggedBy: SAM, createdAt: T }]);
    expect(data.rsvps).toEqual([]);
  });

  it('prefers stored v3 data over older formats', (): void => {
    const disk = memoryStorage({ [LEGACY_V2_KEY]: JSON.stringify(v2) });
    resetDemoStorage(disk);
    expect(new DemoStore(disk).read().events.map((e): string => e.id)).toContain('demo-dinner');
  });

  it('does not write a migrated snapshot when the old data is invalid', (): void => {
    const disk = memoryStorage({ [LEGACY_V2_KEY]: JSON.stringify({ ...v2, tags: [{ ...v2.tags[0], eventId: 'missing' }] }) });
    expect(() => new DemoStore(disk).read()).toThrow(ARCHIVE_MESSAGES.unreadable);
    expect(disk.data.has(DEMO_STORAGE_KEY)).toBe(false);
  });

  it('rejects corrupted saved data and recovers by resetting without reading it', (): void => {
    const disk = memoryStorage({ [DEMO_STORAGE_KEY]: '{not json' });
    expect(() => new DemoStore(disk).read()).toThrow(ArchiveError);
    resetDemoStorage(disk);
    expect(new DemoStore(disk).read().members).toHaveLength(2);
  });

  it('propagates storage write failures instead of claiming the event persisted', async (): Promise<void> => {
    const disk = memoryStorage();
    resetDemoStorage(disk);
    const failing = { getItem: disk.getItem, setItem: (): void => { throw new Error('quota exceeded'); } };
    const repositories = createDemoRepositories(failing, SAM);
    await expect(repositories.events.create(eventFields)).rejects.toThrow('quota exceeded');
  });

  it.each([
    ['an event by an unknown creator', (s: ReturnType<typeof seedArchive>): void => void (s.events[0].createdBy = 'ghost')],
    ['a tag of a missing person', (s: ReturnType<typeof seedArchive>): void => void (s.tags[0].personId = 'ghost')],
    ['a tag not made by the event creator', (s: ReturnType<typeof seedArchive>): void => void (s.tags[0].taggedBy = ALEX)],
    ['an RSVP to a missing event', (s: ReturnType<typeof seedArchive>): void => void (s.rsvps[0].eventId = 'ghost')],
    ['a duplicate event id', (s: ReturnType<typeof seedArchive>): void => void s.events.push({ ...s.events[0] })],
    [
      'two Persons for one member',
      (s: ReturnType<typeof seedArchive>): void => void s.people.push({ ...s.people[0], id: 'twin' }),
    ],
  ])('rejects %s', (_name, corrupt): void => {
    const snapshot = seedArchive();
    corrupt(snapshot);
    expect(() => assertSnapshotIntegrity(snapshot)).toThrow();
  });
});
