import type { ArchiveEvent, EventInput, EventPersonTag, Person, PersonInput } from './archive';
import type { EventRsvp, RsvpStatus, UserProfile } from './members';

/** Storage for creator-owned records. Only the creator may update or remove a record. */
export interface Repository<T, Input> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(input: Input): Promise<T>;
  update(id: string, input: Input): Promise<T>;
  remove(id: string): Promise<void>;
}

/** Only an event's creator may tag; tagging is idempotent and never writes an RSVP. */
export interface TagRepository {
  list(): Promise<EventPersonTag[]>;
  add(eventId: string, personId: string): Promise<void>;
  remove(eventId: string, personId: string): Promise<void>;
}

/** A member writes only their own RSVP; null clears it. */
export interface RsvpRepository {
  list(): Promise<EventRsvp[]>;
  respond(eventId: string, status: RsvpStatus | null): Promise<void>;
}

export interface MemberRepository {
  list(): Promise<UserProfile[]>;
  updateProfile(displayName: string): Promise<UserProfile>;
}

export interface InvitationRepository {
  generate(expiresInDays: number): Promise<string>;
}

export interface ArchiveRepositories {
  currentUserId: string;
  events: Repository<ArchiveEvent, EventInput>;
  people: Repository<Person, PersonInput>;
  tags: TagRepository;
  rsvps: RsvpRepository;
  members: MemberRepository;
  invitations: InvitationRepository;
}

/** Builds the repositories that act for one signed-in member. */
export type RepositoryFactory = (userId: string) => ArchiveRepositories;

export interface Credentials {
  email: string;
  password: string;
}
export interface SignUpInput extends Credentials {
  displayName: string;
  inviteCode: string;
}
export type SignUpResult = 'signed-in' | 'confirmation-required';

/** Receives the signed-in member's id, or null when nobody is signed in. */
export type AuthListener = (userId: string | null) => void;

/** Who is signed in. Implementations validate credentials; the domain only knows member ids. */
export interface AuthPort {
  currentUserId(): Promise<string | null>;
  /** Calls the listener with the current member soon after subscribing, then on every change of member. */
  subscribe(listener: AuthListener): () => void;
  signIn(credentials: Credentials): Promise<void>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signOut(): Promise<void>;
}

/** Controls that exist only in the browser-stored demo. */
export interface DemoControls {
  /** Member ids that signIn accepts as the email address. */
  users: readonly string[];
  reset(): void;
}
