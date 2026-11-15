import {
  ArchiveError,
  eventInputSchema,
  personInputSchema,
  type ArchiveEvent,
  type EventInput,
  type Person,
  type PersonInput,
} from './archive';
import {
  DEFAULT_INVITE_EXPIRY_DAYS,
  inviteExpiryDaysSchema,
  profileNameSchema,
  rsvpStatusSchema,
  type RsvpStatus,
  type UserProfile,
} from './members';
import type { ArchiveRepositories } from './ports';
import {
  ARCHIVE_MESSAGES,
  requireClaimParty,
  requireConfirmable,
  requireCreator,
  requireFound,
  requireRsvpTarget,
  requireTaggable,
  requireUnlinked,
} from './rules';
import type { ArchiveSnapshot } from './snapshot';

const byStart = (a: ArchiveEvent, b: ArchiveEvent): number => Date.parse(a.startsAt) - Date.parse(b.startsAt);
const byName = (a: { displayName: string }, b: { displayName: string }): number =>
  a.displayName.localeCompare(b.displayName);

/** Coordinates archive rules independently of storage and presentation. */
export class ArchiveService {
  constructor(private readonly repositories: ArchiveRepositories) {}

  get currentUserId(): string {
    return this.repositories.currentUserId;
  }

  async snapshot(): Promise<ArchiveSnapshot> {
    const repositories = this.repositories;
    const [events, people, tags, members, rsvps, claims] = await Promise.all([
      repositories.events.list(),
      repositories.people.list(),
      repositories.tags.list(),
      repositories.members.list(),
      repositories.rsvps.list(),
      repositories.claims.list(),
    ]);
    if (!members.some((member): boolean => member.id === this.currentUserId)) {
      throw new ArchiveError(ARCHIVE_MESSAGES.profileNotReady);
    }
    return {
      events: events.sort(byStart),
      people: people.sort(byName),
      tags,
      members: members.sort(byName),
      rsvps,
      claims,
    };
  }

  private async ownEvent(id: string): Promise<ArchiveEvent> {
    const event = requireFound(await this.repositories.events.get(id), ARCHIVE_MESSAGES.eventMissing);
    requireCreator(event, this.currentUserId);
    return event;
  }

  private async ownPerson(id: string): Promise<Person> {
    const person = requireFound(await this.repositories.people.get(id), ARCHIVE_MESSAGES.personMissing);
    requireCreator(person, this.currentUserId);
    return person;
  }

  async saveEvent(input: EventInput, id?: string): Promise<ArchiveEvent> {
    const valid = eventInputSchema.parse(input);
    if (!id) return this.repositories.events.create(valid);
    await this.ownEvent(id);
    return this.repositories.events.update(id, valid);
  }

  async savePerson(input: PersonInput, id?: string): Promise<Person> {
    const valid = personInputSchema.parse(input);
    if (!id) return this.repositories.people.create(valid);
    await this.ownPerson(id);
    return this.repositories.people.update(id, valid);
  }

  async deleteEvent(id: string): Promise<void> {
    await this.ownEvent(id);
    await this.repositories.events.remove(id);
  }

  async deletePerson(id: string): Promise<void> {
    await this.ownPerson(id);
    await this.repositories.people.remove(id);
  }

  async tagPerson(eventId: string, personId: string): Promise<void> {
    const { events, people, tags } = this.repositories;
    requireTaggable(await events.get(eventId), await people.get(personId), this.currentUserId);
    await tags.add(eventId, personId);
  }

  async untagPerson(eventId: string, personId: string): Promise<void> {
    await this.ownEvent(eventId);
    await this.repositories.tags.remove(eventId, personId);
  }

  async respond(eventId: string, status: RsvpStatus | null): Promise<void> {
    requireRsvpTarget(await this.repositories.events.get(eventId));
    await this.repositories.rsvps.respond(eventId, rsvpStatusSchema.nullable().parse(status));
  }

  async saveProfile(displayName: string): Promise<UserProfile> {
    return this.repositories.members.updateProfile(profileNameSchema.parse(displayName));
  }

  /** Invites a friend; naming an unlinked Person makes the friend become that Person on sign-up. */
  async generateInvitation(
    expiresInDays: number = DEFAULT_INVITE_EXPIRY_DAYS,
    personId: string | null = null,
  ): Promise<string> {
    const days = inviteExpiryDaysSchema.parse(expiresInDays);
    if (personId !== null) requireUnlinked(await this.repositories.people.get(personId));
    return this.repositories.invitations.generate(days, personId);
  }

  /** Creates a shared Person and tags it on the event the member created, in one step. */
  async addPersonToEvent(eventId: string, input: PersonInput): Promise<Person> {
    await this.ownEvent(eventId);
    const person = await this.savePerson(input);
    await this.repositories.tags.add(eventId, person.id);
    return person;
  }

  async requestClaim(personId: string): Promise<void> {
    const { people, claims } = this.repositories;
    requireUnlinked(await people.get(personId));
    const pending = await claims.list();
    if (pending.some((claim): boolean => claim.claimantId === this.currentUserId)) {
      throw new ArchiveError(ARCHIVE_MESSAGES.claimExists);
    }
    await claims.request(personId);
  }

  async cancelClaim(personId: string, claimantId: string): Promise<void> {
    requireClaimParty(await this.repositories.people.get(personId), claimantId, this.currentUserId);
    await this.repositories.claims.cancel(personId, claimantId);
  }

  async confirmClaim(personId: string, claimantId: string): Promise<void> {
    const { people, claims } = this.repositories;
    requireConfirmable(await people.get(personId), await claims.list(), claimantId, this.currentUserId);
    await claims.confirm(personId, claimantId);
  }
}
