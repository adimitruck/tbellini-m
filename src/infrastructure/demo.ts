import {
  ArchiveError,
  eventInputSchema,
  personInputSchema,
  tagKey,
  type ArchiveEvent,
  type EventInput,
  type EventPersonTag,
  type Person,
  type PersonInput,
} from '@/domain/archive';
import { generateInviteCode, profileNameSchema, type EventRsvp, type RsvpStatus, type UserProfile } from '@/domain/members';
import type {
  ArchiveRepositories,
  InvitationRepository,
  MemberRepository,
  Repository,
  RsvpRepository,
  TagRepository,
} from '@/domain/ports';
import {
  ARCHIVE_MESSAGES,
  requireCreator,
  requireFound,
  requireRsvpTarget,
  requireTaggable,
} from '@/domain/rules';
import type { ArchiveSnapshot } from '@/domain/snapshot';
import { DEMO_USERS } from './demo-seed';
import { DemoStore, type StoragePort } from './demo-store';

export { DEMO_USERS, seedArchive } from './demo-seed';
export { DEMO_STORAGE_KEY } from './demo-migration';
export { DemoAuth } from './demo-auth';
export type { StoragePort } from './demo-store';

interface RecordMeta {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  provenance: 'manual';
}
interface Stored {
  id: string;
  createdBy: string | null;
  createdAt: string;
}

/** Shared by events and people: everyone reads, only the creator writes. */
abstract class DemoRecords<T extends Stored, Input> implements Repository<T, Input> {
  constructor(
    protected readonly store: DemoStore,
    protected readonly userId: string,
  ) {}
  protected abstract records(snapshot: ArchiveSnapshot): T[];
  protected abstract replace(snapshot: ArchiveSnapshot, records: T[]): void;
  protected abstract build(input: Input, meta: RecordMeta, previous: T | null): T;
  /** Removes everything that points at the removed record. */
  protected abstract cascade(snapshot: ArchiveSnapshot, id: string): void;

  async list(): Promise<T[]> {
    return this.records(this.store.read());
  }

  async get(id: string): Promise<T | null> {
    return this.records(this.store.read()).find((record): boolean => record.id === id) ?? null;
  }

  private async owned(id: string): Promise<T> {
    const record = requireFound(await this.get(id), ARCHIVE_MESSAGES.recordMissing);
    requireCreator(record, this.userId);
    return record;
  }

  async create(input: Input): Promise<T> {
    const now = new Date().toISOString();
    const meta: RecordMeta = {
      id: crypto.randomUUID(),
      createdBy: this.userId,
      createdAt: now,
      updatedAt: now,
      provenance: 'manual',
    };
    const item = this.build(input, meta, null);
    const data = this.store.read();
    this.records(data).push(item);
    this.store.write(data);
    return item;
  }

  async update(id: string, input: Input): Promise<T> {
    const previous = await this.owned(id);
    const meta: RecordMeta = {
      id,
      createdBy: this.userId,
      createdAt: previous.createdAt,
      updatedAt: new Date().toISOString(),
      provenance: 'manual',
    };
    const item = this.build(input, meta, previous);
    const data = this.store.read();
    this.replace(data, this.records(data).map((record): T => (record.id === id ? item : record)));
    this.store.write(data);
    return item;
  }

  async remove(id: string): Promise<void> {
    await this.owned(id);
    const data = this.store.read();
    this.replace(data, this.records(data).filter((record): boolean => record.id !== id));
    this.cascade(data, id);
    this.store.write(data);
  }
}

class DemoEvents extends DemoRecords<ArchiveEvent, EventInput> {
  protected records(snapshot: ArchiveSnapshot): ArchiveEvent[] {
    return snapshot.events;
  }
  protected replace(snapshot: ArchiveSnapshot, records: ArchiveEvent[]): void {
    snapshot.events = records;
  }
  protected build(input: EventInput, meta: RecordMeta): ArchiveEvent {
    return { ...meta, ...eventInputSchema.parse(input) };
  }
  protected cascade(snapshot: ArchiveSnapshot, id: string): void {
    snapshot.tags = snapshot.tags.filter((tag): boolean => tag.eventId !== id);
    snapshot.rsvps = snapshot.rsvps.filter((rsvp): boolean => rsvp.eventId !== id);
  }
}

class DemoPeople extends DemoRecords<Person, PersonInput> {
  protected records(snapshot: ArchiveSnapshot): Person[] {
    return snapshot.people;
  }
  protected replace(snapshot: ArchiveSnapshot, records: Person[]): void {
    snapshot.people = records;
  }
  protected build(input: PersonInput, meta: RecordMeta, previous: Person | null): Person {
    return { ...meta, memberId: previous?.memberId ?? null, ...personInputSchema.parse(input) };
  }
  protected cascade(snapshot: ArchiveSnapshot, id: string): void {
    snapshot.tags = snapshot.tags.filter((tag): boolean => tag.personId !== id);
  }
}

class DemoTags implements TagRepository {
  constructor(
    private readonly store: DemoStore,
    private readonly userId: string,
  ) {}

  async list(): Promise<EventPersonTag[]> {
    return this.store.read().tags;
  }

  async add(eventId: string, personId: string): Promise<void> {
    const data = this.store.read();
    requireTaggable(
      data.events.find((event): boolean => event.id === eventId),
      data.people.find((person): boolean => person.id === personId),
      this.userId,
    );
    if (data.tags.some((tag): boolean => tagKey(tag) === tagKey({ eventId, personId }))) return;
    data.tags.push({ eventId, personId, taggedBy: this.userId, createdAt: new Date().toISOString() });
    this.store.write(data);
  }

  async remove(eventId: string, personId: string): Promise<void> {
    const data = this.store.read();
    const event = requireFound(data.events.find((item): boolean => item.id === eventId), ARCHIVE_MESSAGES.eventMissing);
    requireCreator(event, this.userId);
    data.tags = data.tags.filter((tag): boolean => tagKey(tag) !== tagKey({ eventId, personId }));
    this.store.write(data);
  }
}

class DemoRsvps implements RsvpRepository {
  constructor(
    private readonly store: DemoStore,
    private readonly userId: string,
  ) {}

  async list(): Promise<EventRsvp[]> {
    return this.store.read().rsvps;
  }

  async respond(eventId: string, status: RsvpStatus | null): Promise<void> {
    const data = this.store.read();
    requireRsvpTarget(data.events.find((event): boolean => event.id === eventId));
    const isMine = (rsvp: EventRsvp): boolean => rsvp.eventId === eventId && rsvp.userId === this.userId;
    const previous = data.rsvps.find(isMine);
    data.rsvps = data.rsvps.filter((rsvp): boolean => !isMine(rsvp));
    if (status) {
      const now = new Date().toISOString();
      data.rsvps.push({ eventId, userId: this.userId, status, createdAt: previous?.createdAt ?? now, updatedAt: now });
    }
    this.store.write(data);
  }
}

class DemoMembers implements MemberRepository {
  constructor(
    private readonly store: DemoStore,
    private readonly userId: string,
  ) {}

  async list(): Promise<UserProfile[]> {
    return this.store.read().members;
  }

  async updateProfile(displayName: string): Promise<UserProfile> {
    const data = this.store.read();
    const profile = requireFound(
      data.members.find((member): boolean => member.id === this.userId),
      ARCHIVE_MESSAGES.profileNotReady,
    );
    profile.displayName = profileNameSchema.parse(displayName);
    profile.updatedAt = new Date().toISOString();
    this.store.write(data);
    return profile;
  }
}

class DemoInvitations implements InvitationRepository {
  async generate(): Promise<string> {
    return generateInviteCode();
  }
}

export function resetDemoStorage(storage: StoragePort): void {
  new DemoStore(storage).reset();
}

/** Builds the demo repositories that act for one demo member. */
export function createDemoRepositories(
  storage: StoragePort,
  userId: string = DEMO_USERS[0],
): ArchiveRepositories {
  const store = new DemoStore(storage);
  if (!store.read().members.some((member): boolean => member.id === userId)) {
    throw new ArchiveError(ARCHIVE_MESSAGES.profileNotReady);
  }
  return {
    currentUserId: userId,
    events: new DemoEvents(store, userId),
    people: new DemoPeople(store, userId),
    tags: new DemoTags(store, userId),
    rsvps: new DemoRsvps(store, userId),
    members: new DemoMembers(store, userId),
    invitations: new DemoInvitations(),
  };
}
