import { describe, expect, it } from 'vitest';
import { ArchiveService, personalEvents, type EventInput } from '../src/domain/archive';
import { createDemoRepositories, DEMO_USERS, DEMO_STORAGE_KEY, seedArchive, type StoragePort } from '../src/infrastructure/demo';
function storage(): StoragePort { const map = new Map<string, string>(); return { getItem: (key): string | null => map.get(key) ?? null, setItem: (key, value): void => { map.set(key, value); } }; }
const input: EventInput = { title: 'Community moment', description: 'Shared notes', startsAt: '2026-10-06T23:00:00.000Z', endsAt: null, timezone: 'America/Chicago', location: '' };
function services(disk: StoragePort): [ArchiveService, ArchiveService] { return [new ArchiveService(createDemoRepositories(disk, DEMO_USERS[0])), new ArchiveService(createDemoRepositories(disk, DEMO_USERS[1]))]; }
describe('TBellini community', (): void => {
  it('shares created events across users but requires the author to edit/delete', async (): Promise<void> => {
    const [sam, alex] = services(storage()); const created = await sam.saveEvent(input);
    expect((await alex.snapshot()).events.find((event): boolean => event.id === created.id)?.description).toBe('Shared notes');
    await expect(alex.saveEvent({ ...input, title: 'Hijacked' }, created.id)).rejects.toThrow('author');
    await expect(alex.deleteEvent(created.id)).rejects.toThrow('author');
    await sam.saveEvent({ ...input, title: 'Corrected' }, created.id);
    expect((await alex.snapshot()).events.find((event): boolean => event.id === created.id)?.title).toBe('Corrected');
    await sam.deleteEvent(created.id); expect((await alex.snapshot()).events.some((event): boolean => event.id === created.id)).toBe(false);
  });
  it('enforces author restrictions in repositories as well as the service', async (): Promise<void> => {
    const disk = storage(); const sam = createDemoRepositories(disk, DEMO_USERS[0]); const alex = createDemoRepositories(disk, DEMO_USERS[1]); const created = await sam.events.create(input);
    expect(await alex.events.get(created.id)).not.toBeNull(); await expect(alex.events.update(created.id, input)).rejects.toThrow('author'); await expect(alex.events.remove(created.id)).rejects.toThrow('author'); await expect(alex.community.tag(created.id, DEMO_USERS[1])).rejects.toThrow('author');
  });
  it('keeps tagging independent from RSVP and from personal calendars', async (): Promise<void> => {
    const [sam, alex] = services(storage()); const created = await sam.saveEvent(input);
    await sam.tagUser(created.id, DEMO_USERS[1]); await sam.tagUser(created.id, DEMO_USERS[1]);
    const snapshot = await alex.snapshot(); expect(snapshot.tags.filter((tag): boolean => tag.eventId === created.id)).toHaveLength(1);
    expect(snapshot.rsvps.some((rsvp): boolean => rsvp.eventId === created.id)).toBe(false);
    expect(personalEvents(snapshot, DEMO_USERS[1]).some((event): boolean => event.id === created.id)).toBe(false);
    expect(personalEvents(await sam.snapshot(), DEMO_USERS[0]).some((event): boolean => event.id === created.id)).toBe(false);
    await expect(alex.tagUser(created.id, DEMO_USERS[0])).rejects.toThrow('author'); await expect(sam.tagUser(created.id, 'not-a-member')).rejects.toThrow('member');
  });
  it('uses only the current user’s own going/interested response for a personal calendar', async (): Promise<void> => {
    const [sam, alex] = services(storage()); const created = await sam.saveEvent(input);
    await alex.respond(created.id, 'going'); expect(personalEvents(await alex.snapshot(), DEMO_USERS[1]).some((event): boolean => event.id === created.id)).toBe(true);
    expect(personalEvents(await sam.snapshot(), DEMO_USERS[0]).some((event): boolean => event.id === created.id)).toBe(false);
    await sam.respond(created.id, 'interested'); await alex.respond(created.id, 'interested');
    const rsvps = (await sam.snapshot()).rsvps.filter((rsvp): boolean => rsvp.eventId === created.id); expect(rsvps).toHaveLength(2); expect(rsvps.every((rsvp): boolean => rsvp.status === 'interested')).toBe(true);
    await alex.respond(created.id, null); expect(personalEvents(await alex.snapshot(), DEMO_USERS[1]).some((event): boolean => event.id === created.id)).toBe(false);
    expect(personalEvents(await sam.snapshot(), DEMO_USERS[0]).some((event): boolean => event.id === created.id)).toBe(true);
  });
  it('withholds private people and links when users switch, preserving shared events', async (): Promise<void> => {
    const disk = storage(); const [sam, alex] = services(disk); const created = await sam.saveEvent(input); const privatePerson = await sam.savePerson({ displayName: 'Private note person', notes: 'Private history' }); await sam.addPerson(created.id, privatePerson.id);
    const other = await alex.snapshot(); expect(other.events.some((event): boolean => event.id === created.id)).toBe(true); expect(other.people.some((person): boolean => person.id === privatePerson.id)).toBe(false); expect(other.attendance.some((link): boolean => link.personId === privatePerson.id)).toBe(false);
    await expect(alex.savePerson({ displayName: 'Hijacked', notes: '' }, privatePerson.id)).rejects.toThrow();
    await expect(alex.addPerson(created.id, privatePerson.id)).rejects.toThrow('author');
    expect((await new ArchiveService(createDemoRepositories(disk, DEMO_USERS[0])).snapshot()).people.find((person): boolean => person.id === privatePerson.id)?.notes).toBe('Private history');
  });
  it('updates only the current profile without changing another member', async (): Promise<void> => { const [sam, alex] = services(storage()); await sam.saveProfile('Sam Updated'); const snapshot = await alex.snapshot(); expect(snapshot.members.find((member): boolean => member.id === DEMO_USERS[0])?.displayName).toBe('Sam Updated'); expect(snapshot.members.find((member): boolean => member.id === DEMO_USERS[1])?.displayName).toBe('Alex Chen'); await expect(sam.saveProfile(' ')).rejects.toThrow(); });
  it('cascades event deletion to user tags and responses', async (): Promise<void> => { const [sam, alex] = services(storage()); const created = await sam.saveEvent(input); await sam.tagUser(created.id, DEMO_USERS[1]); await alex.respond(created.id, 'going'); await sam.deleteEvent(created.id); const snapshot = await alex.snapshot(); expect(snapshot.tags.some((tag): boolean => tag.eventId === created.id)).toBe(false); expect(snapshot.rsvps.some((rsvp): boolean => rsvp.eventId === created.id)).toBe(false); });
  it('migrates old demo records without losing moments or inventing responses', async (): Promise<void> => {
    const disk = storage(); const seed = seedArchive(); const legacy = { events: seed.events.map((event) => ({ ...event, title: 'Preserved legacy title', ownerId: 'demo-owner', visibility: 'private' })), people: seed.people.map((person) => ({ ...person, ownerId: 'demo-owner' })), attendance: seed.attendance.map((link) => ({ ...link, ownerId: 'demo-owner' })) };
    const raw = JSON.stringify(legacy); disk.setItem('tbellini.archive.v1', raw); const [sam, alex] = services(disk); const snapshot = await sam.snapshot(); expect(snapshot.events[0].title).toBe('Preserved legacy title'); expect(snapshot.events[0].startsAt).toBe(seed.events[0].startsAt); expect(snapshot.events.every((event): boolean => event.ownerId === DEMO_USERS[0] && event.visibility === 'community')).toBe(true); expect(snapshot.tags).toHaveLength(0); expect(snapshot.rsvps).toHaveLength(0); expect((await alex.snapshot()).events).toHaveLength(seed.events.length); expect((await alex.snapshot()).people).toHaveLength(0); expect(disk.getItem('tbellini.archive.v1')).toBe(raw); expect(disk.getItem(DEMO_STORAGE_KEY)).not.toBeNull();
  });
});
