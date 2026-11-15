import { describe, expect, it } from 'vitest';
import { ArchiveError, type EventInput } from '../src/domain/archive';
import { personalEvents } from '../src/domain/snapshot';
import { ArchiveService } from '../src/domain/service';
import { ALEX, FIXTURES, SAM, type RepositoryFixture } from './support/adapters';

/**
 * One behavioral contract, run against every adapter. Anything an adapter does differently from the others is a bug
 * in the adapter, because the domain rules (creator-only edits, shared people, tags without RSVPs, self-only RSVPs)
 * are the same in demo and hosted mode.
 */
const event: EventInput = {
  title: 'Supper club',
  description: 'Bring a dish.',
  startsAt: '2026-11-20T00:00:00.000Z',
  endsAt: '2026-11-20T03:00:00.000Z',
  timezone: 'America/Chicago',
  location: 'Sam’s place',
};
const person = { displayName: 'Nonna Bellini', notes: 'Has no account.' };

describe.each(FIXTURES)('adapter contract', (makeFixture): void => {
  const setup = (): { fixture: RepositoryFixture; sam: ArchiveService; alex: ArchiveService } => {
    const fixture = makeFixture();
    return {
      fixture,
      sam: new ArchiveService(fixture.repositoriesFor(SAM)),
      alex: new ArchiveService(fixture.repositoriesFor(ALEX)),
    };
  };
  const label = makeFixture().name;

  describe(label, (): void => {
    it('starts with every member as a Person and nothing else', async (): Promise<void> => {
      const { sam } = setup();
      const snapshot = await sam.snapshot();
      expect(snapshot.members.map((member): string => member.displayName)).toEqual(['Alex Chen', 'Sam Rivera']);
      expect(snapshot.people.map((p): string | null => p.memberId).sort()).toEqual([ALEX, SAM].sort());
      expect([snapshot.events, snapshot.tags, snapshot.rsvps].map((list): number => list.length)).toEqual([0, 0, 0]);
    });

    it('refuses a user who has no profile', async (): Promise<void> => {
      const { fixture } = setup();
      await expect(
        (async (): Promise<unknown> => new ArchiveService(fixture.repositoriesFor('ghost')).snapshot())(),
      ).rejects.toBeInstanceOf(ArchiveError);
    });

    it('shares an event with every member and records its creator', async (): Promise<void> => {
      const { sam, alex } = setup();
      const created = await sam.saveEvent(event);
      expect(created.createdBy).toBe(SAM);
      const seen = (await alex.snapshot()).events;
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({ id: created.id, createdBy: SAM, title: 'Supper club', timezone: 'America/Chicago' });
      expect(Date.parse(seen[0].startsAt)).toBe(Date.parse(event.startsAt));
      expect(Date.parse(seen[0].endsAt ?? '')).toBe(Date.parse(event.endsAt ?? ''));
    });

    it('rejects invalid events before they reach storage', async (): Promise<void> => {
      const { sam } = setup();
      await expect(sam.saveEvent({ ...event, title: '   ' })).rejects.toThrow();
      await expect(sam.saveEvent({ ...event, timezone: 'Mars/Base' })).rejects.toThrow();
      await expect(sam.saveEvent({ ...event, endsAt: '2026-11-19T00:00:00.000Z' })).rejects.toThrow();
      expect((await sam.snapshot()).events).toHaveLength(0);
    });

    it('lets only the creator update or delete an event, in the service and in the repository', async (): Promise<void> => {
      const { fixture, sam, alex } = setup();
      const created = await sam.saveEvent(event);
      await expect(alex.saveEvent({ ...event, title: 'Hijacked' }, created.id)).rejects.toBeInstanceOf(ArchiveError);
      await expect(alex.deleteEvent(created.id)).rejects.toBeInstanceOf(ArchiveError);
      const direct = fixture.repositoriesFor(ALEX).events;
      await expect(direct.update(created.id, { ...event, title: 'Hijacked' })).rejects.toBeInstanceOf(ArchiveError);
      await expect(direct.remove(created.id)).rejects.toBeInstanceOf(ArchiveError);
      expect((await sam.snapshot()).events[0].title).toBe('Supper club');
      await sam.saveEvent({ ...event, title: 'Renamed' }, created.id);
      expect((await alex.snapshot()).events[0].title).toBe('Renamed');
      await sam.deleteEvent(created.id);
      expect((await alex.snapshot()).events).toHaveLength(0);
    });

    it('shares people with everyone but lets only their creator edit or delete them', async (): Promise<void> => {
      const { fixture, sam, alex } = setup();
      const created = await sam.savePerson(person);
      expect(created).toMatchObject({ createdBy: SAM, memberId: null, displayName: 'Nonna Bellini' });
      expect((await alex.snapshot()).people.map((p): string => p.id)).toContain(created.id);
      await expect(alex.savePerson({ ...person, notes: 'Mine now' }, created.id)).rejects.toBeInstanceOf(ArchiveError);
      await expect(fixture.repositoriesFor(ALEX).people.remove(created.id)).rejects.toBeInstanceOf(ArchiveError);
      const updated = await sam.savePerson({ ...person, notes: 'Updated' }, created.id);
      expect(updated).toMatchObject({ id: created.id, notes: 'Updated', memberId: null });
      await sam.deletePerson(created.id);
      expect((await alex.snapshot()).people.map((p): string => p.id)).not.toContain(created.id);
    });

    it('tags a Person on an event idempotently, only for the event creator, without any RSVP', async (): Promise<void> => {
      const { fixture, sam, alex } = setup();
      const created = await sam.saveEvent(event);
      const nonna = await sam.savePerson(person);
      await sam.tagPerson(created.id, nonna.id);
      await sam.tagPerson(created.id, nonna.id);
      const afterTag = await alex.snapshot();
      expect(afterTag.tags).toHaveLength(1);
      expect(afterTag.tags[0]).toMatchObject({ eventId: created.id, personId: nonna.id, taggedBy: SAM });
      expect(afterTag.rsvps).toHaveLength(0);
      await expect(alex.tagPerson(created.id, nonna.id)).rejects.toBeInstanceOf(ArchiveError);
      await expect(fixture.repositoriesFor(ALEX).tags.add(created.id, nonna.id)).rejects.toBeInstanceOf(ArchiveError);
      await expect(alex.untagPerson(created.id, nonna.id)).rejects.toBeInstanceOf(ArchiveError);
      await expect(sam.tagPerson(created.id, 'no-such-person')).rejects.toBeInstanceOf(ArchiveError);
      await expect(sam.tagPerson('no-such-event', nonna.id)).rejects.toBeInstanceOf(ArchiveError);
      await sam.untagPerson(created.id, nonna.id);
      expect((await sam.snapshot()).tags).toHaveLength(0);
    });

    it('tags a member through the Person that member is', async (): Promise<void> => {
      const { sam, alex } = setup();
      const created = await sam.saveEvent(event);
      const alexPerson = (await sam.snapshot()).people.find((p): boolean => p.memberId === ALEX);
      expect(alexPerson).toBeDefined();
      await sam.tagPerson(created.id, alexPerson?.id ?? '');
      const snapshot = await alex.snapshot();
      expect(snapshot.tags.map((tag): string => tag.personId)).toEqual([alexPerson?.id]);
      expect(personalEvents(snapshot, ALEX)).toHaveLength(0);
    });

    it('keeps RSVPs self-only: set, replace, clear, and a personal calendar built only from them', async (): Promise<void> => {
      const { sam, alex } = setup();
      const created = await sam.saveEvent(event);
      await alex.respond(created.id, 'interested');
      await alex.respond(created.id, 'going');
      let snapshot = await sam.snapshot();
      expect(snapshot.rsvps).toHaveLength(1);
      expect(snapshot.rsvps[0]).toMatchObject({ eventId: created.id, userId: ALEX, status: 'going' });
      expect(personalEvents(snapshot, SAM)).toHaveLength(0);
      expect(personalEvents(snapshot, ALEX).map((e): string => e.id)).toEqual([created.id]);
      await sam.respond(created.id, 'interested');
      await alex.respond(created.id, null);
      snapshot = await alex.snapshot();
      expect(snapshot.rsvps.map((rsvp): string => rsvp.userId)).toEqual([SAM]);
    });

    it('rejects an RSVP to a missing event or with an invalid status', async (): Promise<void> => {
      const { sam } = setup();
      await expect(sam.respond('no-such-event', 'going')).rejects.toBeInstanceOf(ArchiveError);
      const created = await sam.saveEvent(event);
      await expect(sam.respond(created.id, 'maybe' as never)).rejects.toThrow();
      expect((await sam.snapshot()).rsvps).toHaveLength(0);
    });

    it('removes tags and RSVPs with their event, and tags with their Person', async (): Promise<void> => {
      const { sam, alex } = setup();
      const first = await sam.saveEvent(event);
      const second = await sam.saveEvent({ ...event, title: 'Second' });
      const nonna = await sam.savePerson(person);
      await sam.tagPerson(first.id, nonna.id);
      await sam.tagPerson(second.id, nonna.id);
      await alex.respond(first.id, 'going');
      await sam.deleteEvent(first.id);
      let snapshot = await sam.snapshot();
      expect(snapshot.tags.map((tag): string => tag.eventId)).toEqual([second.id]);
      expect(snapshot.rsvps).toHaveLength(0);
      await sam.deletePerson(nonna.id);
      snapshot = await sam.snapshot();
      expect(snapshot.tags).toHaveLength(0);
      expect(snapshot.events.map((e): string => e.id)).toEqual([second.id]);
    });

    it('renames only the signed-in member', async (): Promise<void> => {
      const { sam, alex } = setup();
      const renamed = await sam.saveProfile('  Samantha  ');
      expect(renamed).toMatchObject({ id: SAM, displayName: 'Samantha' });
      const names = (await alex.snapshot()).members.map((member): string => member.displayName);
      expect(names).toEqual(['Alex Chen', 'Samantha']);
      await expect(sam.saveProfile('   ')).rejects.toThrow();
    });

    it('issues well-formed invitation codes and rejects invalid expiry', async (): Promise<void> => {
      const { sam } = setup();
      expect(await sam.generateInvitation(7)).toMatch(/^[A-Z0-9-]{8,12}$/);
      await expect(sam.generateInvitation(0)).rejects.toThrow();
      await expect(sam.generateInvitation(31)).rejects.toThrow();
    });

    it('orders events by instant and people and members by name', async (): Promise<void> => {
      const { sam } = setup();
      await sam.saveEvent({ ...event, title: 'Later', startsAt: '2026-12-01T12:00:00.000Z', endsAt: null });
      await sam.saveEvent({ ...event, title: 'Earlier', startsAt: '2026-11-01T12:00:00.000Z', endsAt: null });
      await sam.savePerson({ displayName: 'Aunt Zed', notes: '' });
      const snapshot = await sam.snapshot();
      expect(snapshot.events.map((e): string => e.title)).toEqual(['Earlier', 'Later']);
      expect(snapshot.people.map((p): string => p.displayName)).toEqual(['Alex Chen', 'Aunt Zed', 'Sam Rivera']);
    });
  });
});
