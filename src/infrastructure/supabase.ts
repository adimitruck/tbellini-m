import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ArchiveError, eventSchema, personSchema, type ArchiveEvent, type ArchiveRecord, type ArchiveRepositories, type Attendance, type EventInput, type Person, type PersonInput, type Repository } from '@/domain/archive';
import { TBELLINI_COMMUNITY_ID } from '@/domain/community';
import { readAll } from './read-all';
import { createCommunityRepository } from './supabase-community';
export function createArchiveClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ArchiveError('Supabase mode requires a URL and publishable key.');
  return createBrowserClient(url, key);
}
const rowBase = z.object({ id: z.string(), owner_id: z.string(), created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }) });
const eventRow = rowBase.extend({ community_id: z.literal(TBELLINI_COMMUNITY_ID), visibility: z.literal('community'), title: z.string(), description: z.string().nullable(), starts_at: z.string(), ends_at: z.string().nullable(), timezone: z.string(), location: z.string().nullable() });
const personRow = rowBase.extend({ visibility: z.literal('private'), display_name: z.string(), notes: z.string().nullable() });
const attendanceRow = z.object({ event_id: z.string(), person_id: z.string(), owner_id: z.string(), created_at: z.iso.datetime({ offset: true }) });
function base(row: z.infer<typeof rowBase>): ArchiveRecord { return { id: row.id, ownerId: row.owner_id, createdAt: row.created_at, updatedAt: row.updated_at, visibility: 'private', provenance: 'manual' }; }
function decodeEvent(input: unknown): ArchiveEvent { const row = eventRow.parse(input); return { ...base(row), visibility: 'community', communityId: row.community_id, ...eventSchema.parse({ title: row.title, description: row.description ?? '', startsAt: row.starts_at, endsAt: row.ends_at, timezone: row.timezone, location: row.location ?? '' }) }; }
function decodePerson(input: unknown): Person { const row = personRow.parse(input); return { ...base(row), visibility: 'private', ...personSchema.parse({ displayName: row.display_name, notes: row.notes ?? '' }) }; }
class SupabaseRepository<T extends ArchiveRecord, Input> implements Repository<T, Input> {
  constructor(private readonly client: SupabaseClient, private readonly owner: string, private readonly table: 'events' | 'people', private readonly decode: (row: unknown) => T, private readonly encode: (input: Input) => Record<string, string | null>) {}
  private readable() { return this.table === 'events' ? this.client.from(this.table).select('*').eq('community_id', TBELLINI_COMMUNITY_ID) : this.client.from(this.table).select('*').eq('owner_id', this.owner); }
  async list(): Promise<T[]> { return (await readAll((from, to) => this.readable().order('id').range(from, to))).map(this.decode); }
  async get(id: string): Promise<T | null> { const { data, error } = await this.readable().eq('id', id).maybeSingle(); if (error) throw new ArchiveError(error.message); return data ? this.decode(data) : null; }
  async create(input: Input): Promise<T> { const { data, error } = await this.client.from(this.table).insert({ ...this.encode(input), owner_id: this.owner, ...(this.table === 'events' ? { community_id: TBELLINI_COMMUNITY_ID, visibility: 'community' } : {}) }).select('*').single(); if (error) throw new ArchiveError(error.message); return this.decode(data); }
  async update(id: string, input: Input): Promise<T> { const { data, error } = await this.client.from(this.table).update(this.encode(input)).eq('owner_id', this.owner).eq('id', id).select('*').single(); if (error) throw new ArchiveError(error.message); return this.decode(data); }
  async remove(id: string): Promise<void> { const { data, error } = await this.client.from(this.table).delete().eq('owner_id', this.owner).eq('id', id).select('id'); if (error) throw new ArchiveError(error.message); if (!data?.length) throw new ArchiveError('This record no longer exists or you are not its author.'); }
}
export function createSupabaseRepositories(client: SupabaseClient, owner: string): ArchiveRepositories {
  return {
    currentUserId: owner,
    events: new SupabaseRepository<ArchiveEvent, EventInput>(client, owner, 'events', decodeEvent, (input): Record<string, string | null> => ({ title: input.title, description: input.description, starts_at: input.startsAt, ends_at: input.endsAt, timezone: input.timezone, location: input.location })),
    people: new SupabaseRepository<Person, PersonInput>(client, owner, 'people', decodePerson, (input): Record<string, string | null> => ({ display_name: input.displayName, notes: input.notes })),
    attendance: {
      async list(): Promise<Attendance[]> { const data = await readAll((from, to) => client.from('event_people').select('*').eq('owner_id', owner).order('event_id').order('person_id').range(from, to)); return z.array(attendanceRow).parse(data).map((row): Attendance => ({ eventId: row.event_id, personId: row.person_id, ownerId: row.owner_id, createdAt: row.created_at })); },
      async add(eventId: string, personId: string): Promise<void> { const { error } = await client.from('event_people').upsert({ event_id: eventId, person_id: personId, owner_id: owner }, { onConflict: 'event_id,person_id', ignoreDuplicates: true }); if (error) throw new ArchiveError(error.message); },
      async remove(eventId: string, personId: string): Promise<void> { const { error } = await client.from('event_people').delete().eq('owner_id', owner).eq('event_id', eventId).eq('person_id', personId); if (error) throw new ArchiveError(error.message); },
    }, community: createCommunityRepository(client, owner),
  };
}
