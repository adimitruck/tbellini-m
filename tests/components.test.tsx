import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Person } from '../src/domain/archive';
import { ArchiveService } from '../src/domain/service';
import type { ArchiveSnapshot } from '../src/domain/snapshot';
import { EventDetail } from '../src/components/event-detail';
import { EventList } from '../src/components/event-list';
import { InvitePanel } from '../src/components/invite-panel';
import * as labels from '../src/components/labels';
import { Members } from '../src/components/members-view';
import { PeopleView } from '../src/components/people-view';
import { PersonDetail } from '../src/components/person-detail';
import { ALEX, SAM, demoFixture } from './support/adapters';

const noop = (): void => undefined;
const EVENT = {
  title: 'Supper club',
  description: '',
  startsAt: '2026-11-20T00:00:00.000Z',
  endsAt: null,
  timezone: 'America/Chicago',
  location: '',
};

interface World {
  sam: ArchiveService;
  alex: ArchiveService;
  eventId: string;
  nonna: Person;
}

/** The two demo members, one event by Sam and an unlinked Person Sam added, all through the demo adapter. */
async function world(): Promise<World> {
  const fixture = demoFixture();
  const sam = new ArchiveService(fixture.repositoriesFor(SAM));
  const alex = new ArchiveService(fixture.repositoriesFor(ALEX));
  const event = await sam.saveEvent(EVENT);
  const nonna = await sam.savePerson({ displayName: 'Nonna Bellini', notes: 'Secret recipe keeper.' });
  return { sam, alex, eventId: event.id, nonna };
}

const html = (element: ReactElement): string => renderToStaticMarkup(element);

function personDetail(snapshot: ArchiveSnapshot, person: Person, userId: string): string {
  return html(
    <PersonDetail
      person={person}
      snapshot={snapshot}
      currentUserId={userId}
      busy={false}
      onBack={noop}
      onEdit={noop}
      onOpenEvent={noop}
      run={noop}
    />,
  );
}

describe('navigation labels', (): void => {
  it('names the three views Events, Calendar and Members from the single labels module', (): void => {
    const nav = (view: labels.View): string => labels.VIEW_LABELS[view].nav;
    expect([nav('events'), nav('calendar'), nav('members')]).toEqual(['Events', 'Calendar', 'Members']);
    expect(labels.VIEWS.map(nav)).toEqual(['Events', 'Calendar', 'My calendar', 'People', 'Members']);
  });

  it('keeps private and community wording out of every label', (): void => {
    const everything = JSON.stringify(labels, (_key, value: unknown) =>
      typeof value === 'function' ? String(value(2)) : value,
    );
    expect(everything).not.toMatch(/private|communit|archive people/i);
  });
});

describe('People page', (): void => {
  it('lists shared people by name only, without notes or member details', async (): Promise<void> => {
    const { alex } = await world();
    const markup = html(<PeopleView snapshot={await alex.snapshot()} onOpen={noop} />);
    expect(markup).toContain('Nonna Bellini');
    expect(markup).toContain('Sam Rivera');
    expect(markup).not.toContain('Secret recipe keeper.');
    expect(markup).not.toMatch(/member|tagged|account/i);
  });

  it('shows edit and delete only to the creator, and the details only once opened', async (): Promise<void> => {
    const { sam, alex, nonna } = await world();
    const asCreator = personDetail(await sam.snapshot(), nonna, SAM);
    const asOther = personDetail(await alex.snapshot(), nonna, ALEX);
    expect(asCreator).toContain('Secret recipe keeper.');
    expect(asCreator).toContain('Edit person');
    expect(asOther).toContain('Secret recipe keeper.');
    expect(asOther).not.toContain('Edit person');
    expect(asOther).toContain(labels.PERSON_TEXT.creatorOnly);
  });
});

describe('claiming', (): void => {
  it('offers This is me, then shows the pending request to the claimant and the creator', async (): Promise<void> => {
    const { sam, alex, nonna } = await world();
    expect(personDetail(await alex.snapshot(), nonna, ALEX)).toContain('This is me');
    await alex.requestClaim(nonna.id);
    const claimant = personDetail(await alex.snapshot(), nonna, ALEX);
    expect(claimant).not.toContain('This is me');
    expect(claimant).toContain(labels.PERSON_TEXT.withdraw);
    const creator = personDetail(await sam.snapshot(), nonna, SAM);
    expect(creator).toContain('Alex Chen');
    expect(creator).toContain('Confirm');
    expect(creator).toContain('Reject');
  });

  it('shows a linked member and no claim controls once the creator confirms', async (): Promise<void> => {
    const { sam, alex, nonna } = await world();
    await alex.requestClaim(nonna.id);
    await sam.confirmClaim(nonna.id, ALEX);
    const snapshot = await sam.snapshot();
    const linked = snapshot.people.find((person): boolean => person.id === nonna.id) ?? nonna;
    const markup = personDetail(snapshot, linked, SAM);
    expect(markup).toContain('Linked to member Alex Chen');
    expect(markup).not.toContain('This is me');
    expect(markup).not.toContain('Confirm');
  });

  it('lets the invitation name an unlinked person and no linked one', async (): Promise<void> => {
    const { sam } = await world();
    const snapshot = await sam.snapshot();
    const unlinked = snapshot.people.filter((person): boolean => person.memberId === null);
    const markup = html(<InvitePanel unlinked={unlinked} onGenerate={vi.fn()} />);
    expect(markup).toContain('Nonna Bellini');
    expect(markup).not.toContain('Alex Chen');
    expect(markup).toContain(labels.INVITE_TEXT.anyone);
  });
});

describe('event detail person picker', (): void => {
  const detail = (snapshot: ArchiveSnapshot, eventId: string, userId: string): string =>
    html(
      <EventDetail
        event={snapshot.events.find((event): boolean => event.id === eventId) ?? snapshot.events[0]}
        snapshot={snapshot}
        currentUserId={userId}
        busy={false}
        onBack={noop}
        onEdit={noop}
        run={noop}
      />,
    );

  it('gives the creator existing people and an inline add-new-person form', async (): Promise<void> => {
    const { sam, eventId } = await world();
    const markup = detail(await sam.snapshot(), eventId, SAM);
    expect(markup).toContain('Nonna Bellini');
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain(labels.PICKER_TEXT.addButton);
    expect(markup).not.toMatch(/private|communit/i);
  });

  it('shows a person added inline as tagged, and gives other members no picker', async (): Promise<void> => {
    const { sam, alex, eventId } = await world();
    const added = await sam.addPersonToEvent(eventId, { displayName: 'Zia Rosa', notes: '' });
    const asCreator = detail(await sam.snapshot(), eventId, SAM);
    expect(asCreator).toMatch(new RegExp(`checked=""[^>]*/><span>Zia Rosa`));
    expect(added.createdBy).toBe(SAM);
    const asOther = detail(await alex.snapshot(), eventId, ALEX);
    expect(asOther).toContain('Zia Rosa');
    expect(asOther).not.toContain('type="checkbox"');
    expect(asOther).not.toContain(labels.PICKER_TEXT.addButton);
  });
});

describe('member information is pulled, not pushed', (): void => {
  it('keeps other members’ RSVPs, tags and counts out of the feed and the member list', async (): Promise<void> => {
    const { sam, alex, eventId } = await world();
    await sam.respond(eventId, 'going');
    await sam.tagPerson(eventId, (await sam.snapshot()).people.find((p): boolean => p.memberId === SAM)?.id ?? '');
    const snapshot = await alex.snapshot();
    const feed = html(<EventList snapshot={snapshot} currentUserId={ALEX} onSelect={noop} />);
    expect(feed).toContain('No RSVP');
    expect(feed).not.toContain('You’re');
    const members = html(
      <Members snapshot={snapshot} currentUserId={ALEX} onSaveProfile={vi.fn()} onGenerateInvitation={vi.fn()} />,
    );
    expect(members).toContain('Sam Rivera');
    expect(members).not.toMatch(/events created/);
  });
});
