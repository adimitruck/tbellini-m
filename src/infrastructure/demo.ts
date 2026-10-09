import { ArchiveError, eventSchema, personSchema, type ArchiveEvent, type ArchiveRecord, type ArchiveRepositories, type ArchiveSnapshot, type Attendance, type EventInput, type Person, type PersonInput, type Repository } from '@/domain/archive';
import { profileNameSchema, rsvpStatusSchema, TBELLINI_COMMUNITY_ID, type CommunityMembership, type EventRsvp, type RsvpStatus, type UserProfile, type UserTag } from '@/domain/community';
import { DemoStore, DEMO_USERS, type StoragePort } from './demo-store';
export { seedArchive, DEMO_USERS, DEMO_STORAGE_KEY, type StoragePort } from './demo-store';
class DemoRepository<T extends ArchiveRecord, Input> implements Repository<T, Input> {
  constructor(private readonly store: DemoStore, private readonly owner: string, private readonly collection: 'events' | 'people', private readonly records: (snapshot: ArchiveSnapshot) => T[], private readonly assemble: (input: Input, base: ArchiveRecord) => T) {}
  async list(): Promise<T[]> { return this.records(this.store.read()).filter((record): boolean => this.collection === 'events' || record.ownerId === this.owner); }
  async get(id: string): Promise<T | null> { return (await this.list()).find((item): boolean => item.id === id) ?? null; }
  private async owned(id: string): Promise<T> { const record = await this.get(id); if (!record) throw new ArchiveError('This record no longer exists.'); if (record.ownerId !== this.owner) throw new ArchiveError('Only the author can change this record.'); return record; }
  async create(input: Input): Promise<T> {
    const now = new Date().toISOString();
    const item = this.assemble(input, { id: crypto.randomUUID(), ownerId: this.owner, createdAt: now, updatedAt: now, visibility: this.collection === 'events' ? 'community' : 'private', provenance: 'manual' });
    const data = this.store.read(); this.records(data).push(item); this.store.write(data); return item;
  }
  async update(id: string, input: Input): Promise<T> {
    const previous = await this.owned(id);
    const item = this.assemble(input, { ...previous, updatedAt: new Date().toISOString() });
    const data = this.store.read(); const records = this.records(data);
    records[records.findIndex((record): boolean => record.id === id)] = item; this.store.write(data); return item;
  }
  async remove(id: string): Promise<void> {
    await this.owned(id); const data = this.store.read();
    if (this.collection === 'events') { data.events = data.events.filter((item): boolean => item.id !== id); data.attendance = data.attendance.filter((item): boolean => item.eventId !== id); data.tags = data.tags.filter((tag): boolean => tag.eventId !== id); data.rsvps = data.rsvps.filter((rsvp): boolean => rsvp.eventId !== id); }
    else { data.people = data.people.filter((item): boolean => item.id !== id); data.attendance = data.attendance.filter((item): boolean => item.personId !== id); }
    this.store.write(data);
  }
}
export function resetDemoStorage(storage: StoragePort): void { new DemoStore(storage).reset(); }
export function createDemoRepositories(storage: StoragePort, userId: string = DEMO_USERS[0]): ArchiveRepositories & { reset(): void } {
  const store = new DemoStore(storage);
  const requireMember = (data: ArchiveSnapshot, id: string): void => { if (!data.memberships.some((membership): boolean => membership.userId === id)) throw new ArchiveError('TBellini membership is required.'); };
  const requireEvent = (data: ArchiveSnapshot, id: string, authored = false): ArchiveEvent => { const event = data.events.find((item): boolean => item.id === id); if (!event) throw new ArchiveError('Event not found.'); if (authored && event.ownerId !== userId) throw new ArchiveError('Only the event author can change this event.'); return event; };
  requireMember(store.read(), userId);
  return {
    currentUserId: userId,
    events: new DemoRepository<ArchiveEvent, EventInput>(store, userId, 'events', (snapshot): ArchiveEvent[] => snapshot.events, (input, base): ArchiveEvent => ({ ...base, visibility: 'community', communityId: TBELLINI_COMMUNITY_ID, ...eventSchema.parse(input) })),
    people: new DemoRepository<Person, PersonInput>(store, userId, 'people', (snapshot): Person[] => snapshot.people, (input, base): Person => ({ ...base, visibility: 'private', ...personSchema.parse(input) })),
    attendance: {
      async list(): Promise<Attendance[]> { return store.read().attendance.filter((link): boolean => link.ownerId === userId); },
      async add(eventId: string, personId: string): Promise<void> {
        const data = store.read(); requireEvent(data, eventId, true);
        if (!data.people.some((person): boolean => person.id === personId && person.ownerId === userId)) throw new ArchiveError('Person not found.');
        if (!data.attendance.some((link): boolean => link.eventId === eventId && link.personId === personId)) { data.attendance.push({ eventId, personId, ownerId: userId, createdAt: new Date().toISOString() }); store.write(data); }
      },
      async remove(eventId: string, personId: string): Promise<void> { const data = store.read(); requireEvent(data, eventId, true); data.attendance = data.attendance.filter((link): boolean => !(link.eventId === eventId && link.personId === personId && link.ownerId === userId)); store.write(data); },
    },
    community: {
      async members(): Promise<UserProfile[]> { return store.read().members; },
      async memberships(): Promise<CommunityMembership[]> { return store.read().memberships; },
      async tags(): Promise<UserTag[]> { return store.read().tags; },
      async rsvps(): Promise<EventRsvp[]> { return store.read().rsvps; },
      async tag(eventId: string, targetUserId: string): Promise<void> { const data = store.read(); requireEvent(data, eventId, true); requireMember(data, targetUserId); if (!data.tags.some((tag): boolean => tag.eventId === eventId && tag.userId === targetUserId)) { data.tags.push({ eventId, userId: targetUserId, communityId: TBELLINI_COMMUNITY_ID, taggedBy: userId, createdAt: new Date().toISOString() }); store.write(data); } },
      async untag(eventId: string, targetUserId: string): Promise<void> { const data = store.read(); requireEvent(data, eventId, true); data.tags = data.tags.filter((tag): boolean => !(tag.eventId === eventId && tag.userId === targetUserId)); store.write(data); },
      async respond(eventId: string, status: RsvpStatus | null): Promise<void> {
        status = rsvpStatusSchema.nullable().parse(status);
        const data = store.read(); requireEvent(data, eventId); requireMember(data, userId);
        const previous = data.rsvps.find((rsvp): boolean => rsvp.eventId === eventId && rsvp.userId === userId);
        data.rsvps = data.rsvps.filter((rsvp): boolean => !(rsvp.eventId === eventId && rsvp.userId === userId));
        if (status) { const now = new Date().toISOString(); data.rsvps.push({ eventId, userId, communityId: TBELLINI_COMMUNITY_ID, status, createdAt: previous?.createdAt ?? now, updatedAt: now }); } store.write(data);
      },
      async updateProfile(displayName: string): Promise<UserProfile> { const data = store.read(); const profile = data.members.find((member): boolean => member.id === userId); if (!profile) throw new ArchiveError('Member not found.'); profile.displayName = profileNameSchema.parse(displayName); profile.updatedAt = new Date().toISOString(); store.write(data); return profile; },
      async generateInvitation(): Promise<string> { return 'DEMO-INVITE'; },
    }, reset(): void { store.reset(); },
  };
}
