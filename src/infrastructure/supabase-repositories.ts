import type { SupabaseClient } from '@supabase/supabase-js';
import { ArchiveError, type ArchiveEvent, type EventInput, type Person, type PersonInput } from '@/domain/archive';
import { inviteCodeSchema, rsvpStatusSchema, type RsvpStatus } from '@/domain/members';
import type { ArchiveRepositories, Repository } from '@/domain/ports';
import { ARCHIVE_MESSAGES } from '@/domain/rules';
import { readAll } from './read-all';
import {
  COLUMNS,
  CREATOR_COLUMN,
  RPC,
  TABLES,
  decodeEvent,
  decodePerson,
  decodeProfile,
  decodeRsvp,
  decodeTag,
  encodeEvent,
  encodePerson,
  type DbRecord,
} from './supabase-schema';

interface Failure {
  message: string;
}
function check(error: Failure | null): void {
  if (error) throw new ArchiveError(error.message);
}

interface RecordBinding<T, Input> {
  table: typeof TABLES.events | typeof TABLES.people;
  creatorColumn: string;
  decode(row: unknown): T;
  encode(input: Input): DbRecord;
}

/** Creator-scoped writes: the creator filter mirrors the row-level security policy, so a stranger changes zero rows. */
class SupabaseRecords<T, Input> implements Repository<T, Input> {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
    private readonly binding: RecordBinding<T, Input>,
  ) {}

  private get table() {
    return this.client.from(this.binding.table);
  }

  async list(): Promise<T[]> {
    const rows = await readAll((from, to) => this.table.select('*').order(COLUMNS.id).range(from, to));
    return rows.map((row): T => this.binding.decode(row));
  }

  async get(id: string): Promise<T | null> {
    const { data, error } = await this.table.select('*').eq(COLUMNS.id, id).maybeSingle();
    check(error);
    return data ? this.binding.decode(data) : null;
  }

  async create(input: Input): Promise<T> {
    const row = { ...this.binding.encode(input), [this.binding.creatorColumn]: this.userId };
    const { data, error } = await this.table.insert(row).select('*').single();
    check(error);
    return this.binding.decode(data);
  }

  async update(id: string, input: Input): Promise<T> {
    const { data, error } = await this.table
      .update(this.binding.encode(input))
      .eq(this.binding.creatorColumn, this.userId)
      .eq(COLUMNS.id, id)
      .select('*')
      .maybeSingle();
    check(error);
    if (!data) throw new ArchiveError(ARCHIVE_MESSAGES.missingOrNotCreator);
    return this.binding.decode(data);
  }

  async remove(id: string): Promise<void> {
    const { data, error } = await this.table
      .delete()
      .eq(this.binding.creatorColumn, this.userId)
      .eq(COLUMNS.id, id)
      .select(COLUMNS.id);
    check(error);
    if (!data?.length) throw new ArchiveError(ARCHIVE_MESSAGES.missingOrNotCreator);
  }
}

const eventBinding: RecordBinding<ArchiveEvent, EventInput> = {
  table: TABLES.events,
  creatorColumn: CREATOR_COLUMN.events,
  decode: decodeEvent,
  encode: encodeEvent,
};
const personBinding: RecordBinding<Person, PersonInput> = {
  table: TABLES.people,
  creatorColumn: CREATOR_COLUMN.people,
  decode: decodePerson,
  encode: encodePerson,
};

/** Builds the Supabase repositories that act for one signed-in member. */
export function createSupabaseRepositories(client: SupabaseClient, userId: string): ArchiveRepositories {
  return {
    currentUserId: userId,
    events: new SupabaseRecords(client, userId, eventBinding),
    people: new SupabaseRecords(client, userId, personBinding),
    tags: {
      async list() {
        const rows = await readAll((from, to) =>
          client
            .from(TABLES.tags)
            .select('*')
            .order(COLUMNS.eventId)
            .order(COLUMNS.personId)
            .range(from, to),
        );
        return rows.map(decodeTag);
      },
      async add(eventId: string, personId: string): Promise<void> {
        const row = { [COLUMNS.eventId]: eventId, [COLUMNS.personId]: personId, [COLUMNS.taggedBy]: userId };
        const { error } = await client
          .from(TABLES.tags)
          .upsert(row, { onConflict: `${COLUMNS.eventId},${COLUMNS.personId}`, ignoreDuplicates: true });
        check(error);
      },
      async remove(eventId: string, personId: string): Promise<void> {
        const { error } = await client
          .from(TABLES.tags)
          .delete()
          .eq(COLUMNS.eventId, eventId)
          .eq(COLUMNS.personId, personId)
          .eq(COLUMNS.taggedBy, userId);
        check(error);
      },
    },
    rsvps: {
      async list() {
        const rows = await readAll((from, to) =>
          client
            .from(TABLES.rsvps)
            .select('*')
            .order(COLUMNS.eventId)
            .order(COLUMNS.userId)
            .range(from, to),
        );
        return rows.map(decodeRsvp);
      },
      async respond(eventId: string, status: RsvpStatus | null): Promise<void> {
        const mine = { [COLUMNS.eventId]: eventId, [COLUMNS.userId]: userId };
        const result = status
          ? await client
              .from(TABLES.rsvps)
              .upsert(
                { ...mine, [COLUMNS.status]: rsvpStatusSchema.parse(status) },
                { onConflict: `${COLUMNS.eventId},${COLUMNS.userId}` },
              )
          : await client.from(TABLES.rsvps).delete().match(mine);
        check(result.error);
      },
    },
    members: {
      async list() {
        // Profiles are shared with every member by RLS; page instead of building huge IN lists.
        const rows = await readAll((from, to) =>
          client.from(TABLES.profiles).select('*').order(COLUMNS.id).range(from, to),
        );
        return rows.map(decodeProfile);
      },
      async updateProfile(displayName: string) {
        const { data, error } = await client
          .from(TABLES.profiles)
          .update({ [COLUMNS.displayName]: displayName })
          .eq(COLUMNS.id, userId)
          .select('*')
          .single();
        check(error);
        return decodeProfile(data);
      },
    },
    invitations: {
      async generate(expiresInDays: number): Promise<string> {
        // Codes are generated and stored by the database so the browser never touches the invitations table.
        const { name, expiresInDays: argument } = RPC.createInvitation;
        const { data, error } = await client.rpc(name, { [argument]: expiresInDays });
        check(error);
        return inviteCodeSchema.parse(data);
      },
    },
  };
}
