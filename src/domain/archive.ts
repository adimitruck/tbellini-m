import { z } from 'zod';
import { inviteExpiryDaysSchema, profileNameSchema, rsvpStatusSchema, type CommunityRepository, type CommunityMembership, type EventRsvp, type RsvpStatus, type UserProfile, type UserTag } from './community';

export interface ArchiveRecord {
  id: string; ownerId: string; createdAt: string; updatedAt: string;
  visibility: 'private' | 'community'; provenance: 'manual';
}
export interface EventInput { title: string; description: string; startsAt: string; endsAt: string | null; timezone: string; location: string }
export interface PersonInput { displayName: string; notes: string }
export interface ArchiveEvent extends ArchiveRecord, EventInput { communityId: string; visibility: 'community' }
export interface Person extends ArchiveRecord, PersonInput { visibility: 'private' }
export interface Attendance { eventId: string; personId: string; ownerId: string; createdAt: string }
export interface Repository<T extends ArchiveRecord, Input> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(input: Input): Promise<T>;
  update(id: string, input: Input): Promise<T>;
  remove(id: string): Promise<void>;
}
export interface AttendanceRepository {
  list(): Promise<Attendance[]>;
  add(eventId: string, personId: string): Promise<void>;
  remove(eventId: string, personId: string): Promise<void>;
}
export interface ArchiveRepositories {
  events: Repository<ArchiveEvent, EventInput>;
  people: Repository<Person, PersonInput>;
  attendance: AttendanceRepository;
  community: CommunityRepository;
  currentUserId: string;
}
export interface ArchiveSnapshot { events: ArchiveEvent[]; people: Person[]; attendance: Attendance[]; members: UserProfile[]; memberships: CommunityMembership[]; tags: UserTag[]; rsvps: EventRsvp[] }
export function emptySnapshot(): ArchiveSnapshot { return { events: [], people: [], attendance: [], members: [], memberships: [], tags: [], rsvps: [] }; }
/** Personal attendance intent is explicit and independent of tagging or authorship. */
export function personalEvents(snapshot: ArchiveSnapshot, userId: string): ArchiveEvent[] {
  const ids = new Set(snapshot.rsvps.filter((rsvp): boolean => rsvp.userId === userId && (rsvp.status === 'going' || rsvp.status === 'interested')).map((rsvp): string => rsvp.eventId));
  return snapshot.events.filter((event): boolean => ids.has(event.id));
}
export class ArchiveError extends Error { constructor(message: string) { super(message); this.name = 'ArchiveError'; } }
const timezoneSchema = z.string().refine((value: string): boolean => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Use a valid IANA timezone, such as America/Chicago.');
export const eventSchema = z.object({
  title: z.string().trim().min(1, 'Give this event a title.').max(200),
  description: z.string().trim().max(10000),
  startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }).nullable(),
  timezone: timezoneSchema, location: z.string().trim().max(500),
}).refine((event): boolean => !event.endsAt || Date.parse(event.endsAt) >= Date.parse(event.startsAt), { message: 'The end must be at or after the start.', path: ['endsAt'] });
export const personSchema = z.object({ displayName: z.string().trim().min(1, 'Enter a name.').max(200), notes: z.string().trim().max(10000) });

/** Coordinates archive rules independently of storage and presentation. */
export class ArchiveService {
  constructor(private readonly repositories: ArchiveRepositories) {}
  get currentUserId(): string { return this.repositories.currentUserId; }
  async snapshot(): Promise<ArchiveSnapshot> {
    const community = this.repositories.community;
    const [events, people, attendance, members, memberships, tags, rsvps] = await Promise.all([this.repositories.events.list(), this.repositories.people.list(), this.repositories.attendance.list(), community.members(), community.memberships(), community.tags(), community.rsvps()]);
    if (!memberships.some((membership): boolean => membership.userId === this.currentUserId) || !members.some((member): boolean => member.id === this.currentUserId)) throw new ArchiveError('Your TBellini membership is not ready. Apply the community migration before using this app.');
    return { events: events.sort((a, b): number => Date.parse(a.startsAt) - Date.parse(b.startsAt)), people: people.sort((a, b): number => a.displayName.localeCompare(b.displayName)), attendance, members: members.sort((a, b): number => a.displayName.localeCompare(b.displayName)), memberships, tags, rsvps };
  }
  private async authoredEvent(id: string): Promise<ArchiveEvent> {
    const event = await this.repositories.events.get(id);
    if (!event) throw new ArchiveError('This event no longer exists.');
    if (event.ownerId !== this.currentUserId) throw new ArchiveError('Only the event author can change this event.');
    return event;
  }
  async saveEvent(input: EventInput, id?: string): Promise<ArchiveEvent> {
    const valid = eventSchema.parse(input);
    if (id) await this.authoredEvent(id);
    return id ? this.repositories.events.update(id, valid) : this.repositories.events.create(valid);
  }
  async savePerson(input: PersonInput, id?: string): Promise<Person> {
    const valid = personSchema.parse(input);
    return id ? this.repositories.people.update(id, valid) : this.repositories.people.create(valid);
  }
  async addPerson(eventId: string, personId: string): Promise<void> {
    await this.authoredEvent(eventId);
    const [event, person] = await Promise.all([this.repositories.events.get(eventId), this.repositories.people.get(personId)]);
    if (!event || !person) throw new ArchiveError('Choose an existing event and person from your archive.');
    await this.repositories.attendance.add(eventId, personId);
  }
  async removePerson(eventId: string, personId: string): Promise<void> { await this.authoredEvent(eventId); await this.repositories.attendance.remove(eventId, personId); }
  async deleteEvent(id: string): Promise<void> { await this.authoredEvent(id); await this.repositories.events.remove(id); }
  async deletePerson(id: string): Promise<void> { await this.repositories.people.remove(id); }
  async tagUser(eventId: string, userId: string): Promise<void> {
    await this.authoredEvent(eventId);
    if (!(await this.repositories.community.members()).some((profile): boolean => profile.id === userId)) throw new ArchiveError('Choose a TBellini member.');
    await this.repositories.community.tag(eventId, userId);
  }
  async untagUser(eventId: string, userId: string): Promise<void> { await this.authoredEvent(eventId); await this.repositories.community.untag(eventId, userId); }
  async respond(eventId: string, status: RsvpStatus | null): Promise<void> {
    if (!await this.repositories.events.get(eventId)) throw new ArchiveError('This event no longer exists.');
    await this.repositories.community.respond(eventId, rsvpStatusSchema.nullable().parse(status));
  }
  async saveProfile(displayName: string): Promise<UserProfile> { return this.repositories.community.updateProfile(profileNameSchema.parse(displayName)); }
  async generateInvitation(expiresInDays: number = 7): Promise<string> { return this.repositories.community.generateInvitation(inviteExpiryDaysSchema.parse(expiresInDays)); }
}
