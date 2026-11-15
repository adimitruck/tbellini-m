import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { ArchiveError } from '../src/domain/archive';
import type { ArchiveRepositories } from '../src/domain/ports';
import { createSupabaseRepositories } from '../src/infrastructure/supabase';
import { CREATOR_COLUMN, TABLES } from '../src/infrastructure/supabase-schema';
import { SAM, fakeDatabase, supabaseClientFor } from './support/adapters';
import { Failure } from './support/fake-database';

const NOW = '2026-10-06T12:00:00+00:00';
const eventRow = {
  id: 'event-one',
  [CREATOR_COLUMN.events]: 'other-user',
  title: 'Shared event',
  description: null,
  starts_at: NOW,
  ends_at: null,
  timezone: 'America/Chicago',
  location: null,
  provenance: 'manual',
  created_at: NOW,
  updated_at: NOW,
};

/** Repositories whose every request is answered by `reply`, to exercise how the adapter treats provider output. */
function cannedRepositories(reply: (url: URL) => { status?: number; body: unknown }): ArchiveRepositories {
  const transport: typeof fetch = async (input): Promise<Response> => {
    const { status = 200, body } = reply(new URL(String(input)));
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  const client = createClient('https://archive.example', 'test-publishable-key', {
    global: { fetch: transport },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return createSupabaseRepositories(client, 'current-user');
}

describe('Supabase response boundary', (): void => {
  it('maps database columns to the domain, naming every creator createdBy', async (): Promise<void> => {
    const repositories = cannedRepositories(() => ({ body: [eventRow] }));
    expect(await repositories.events.list()).toEqual([
      {
        id: 'event-one', createdBy: 'other-user', title: 'Shared event', description: '', startsAt: NOW, endsAt: null,
        timezone: 'America/Chicago', location: '', provenance: 'manual', createdAt: NOW, updatedAt: NOW,
      },
    ]);
  });

  it('reads later pages with a stable order and fails rather than returning an incomplete archive', async (): Promise<void> => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({ ...eventRow, id: `event-${index}` }));
    const offsets: string[] = [];
    const paged = cannedRepositories((url) => {
      offsets.push(`${url.searchParams.get('order')}@${url.searchParams.get('offset')}`);
      return { body: rows.slice(Number(url.searchParams.get('offset')), Number(url.searchParams.get('offset')) + 1000) };
    });
    expect(await paged.events.list()).toHaveLength(1001);
    expect(offsets).toEqual(['id.asc@0', 'id.asc@1000']);
    const failing = cannedRepositories((url) =>
      Number(url.searchParams.get('offset')) >= 1000
        ? { status: 500, body: { message: 'later page failed' } }
        : { body: rows.slice(0, 1000) },
    );
    await expect(failing.events.list()).rejects.toThrow('later page failed');
  });

  it('fails a non-advancing page instead of looping forever', async (): Promise<void> => {
    const stuck = cannedRepositories(() => ({ body: Array.from({ length: 1000 }, () => eventRow) }));
    await expect(stuck.events.list()).rejects.toThrow(ArchiveError);
  });

  it.each([
    ['an invalid timezone', { timezone: 'Invalid/Timezone' }],
    ['a missing title', { title: null }],
    ['an unexpected provenance', { provenance: 'imported' }],
    ['an end before the start', { ends_at: '2026-10-06T11:00:00+00:00' }],
  ])('rejects event rows with %s before presentation', async (_name, patch): Promise<void> => {
    const repositories = cannedRepositories(() => ({ body: [{ ...eventRow, ...patch }] }));
    await expect(repositories.events.list()).rejects.toThrow();
  });

  it('rejects malformed people, tags, RSVPs and profiles', async (): Promise<void> => {
    const bad = cannedRepositories(() => ({ body: [{ id: 1 }] }));
    await expect(bad.people.list()).rejects.toThrow();
    await expect(bad.tags.list()).rejects.toThrow();
    await expect(bad.rsvps.list()).rejects.toThrow();
    await expect(bad.members.list()).rejects.toThrow();
  });

  it('surfaces a rejected invitation code response', async (): Promise<void> => {
    const bad = cannedRepositories(() => ({ body: 'not a code' }));
    await expect(bad.invitations.generate(7)).rejects.toThrow();
  });
});

describe('Supabase write scoping', (): void => {
  it('scopes updates and deletes to the creator column of each table and reports zero-row changes', async (): Promise<void> => {
    const database = fakeDatabase();
    const repositories = createSupabaseRepositories(supabaseClientFor(database, SAM), SAM);
    const input = { title: 'T', description: '', startsAt: NOW, endsAt: null, timezone: 'UTC', location: '' };
    const event = await repositories.events.create(input);
    await repositories.events.update(event.id, input);
    await repositories.events.remove(event.id);
    const person = await repositories.people.create({ displayName: 'P', notes: '' });
    await repositories.people.update(person.id, { displayName: 'Q', notes: '' });
    await repositories.people.remove(person.id);
    const writes = database.requests.filter((request): boolean => request.method !== 'GET');
    const scoped = (table: string, column: string): boolean[] =>
      writes
        .filter((request): boolean => request.path.endsWith(`/${table}`) && request.method !== 'POST')
        .map((request): boolean => new URLSearchParams(request.search).get(column) === `eq.${SAM}`);
    expect(scoped(TABLES.events, CREATOR_COLUMN.events)).toEqual([true, true]);
    expect(scoped(TABLES.people, CREATOR_COLUMN.people)).toEqual([true, true]);
    await expect(repositories.events.update(event.id, input)).rejects.toThrow(ArchiveError);
    await expect(repositories.people.remove(person.id)).rejects.toThrow(ArchiveError);
  });

  it('surfaces provider failures instead of claiming success', async (): Promise<void> => {
    const database = fakeDatabase();
    const repositories = createSupabaseRepositories(supabaseClientFor(database, SAM), SAM);
    database.injected.set(`POST ${TABLES.events}`, new Failure(403, '42501', 'Denied by policy'));
    const input = { title: 'T', description: '', startsAt: NOW, endsAt: null, timezone: 'UTC', location: '' };
    await expect(repositories.events.create(input)).rejects.toThrow('Denied by policy');
  });

  it('creates records as the current member and never sends server-managed columns', async (): Promise<void> => {
    const database = fakeDatabase();
    const repositories = createSupabaseRepositories(supabaseClientFor(database, SAM), SAM);
    const person = await repositories.people.create({ displayName: 'P', notes: '' });
    expect(person).toMatchObject({ createdBy: SAM, memberId: null });
    const stored = database.tables[TABLES.people].find((row): boolean => row.id === person.id);
    expect(stored?.[CREATOR_COLUMN.people]).toBe(SAM);
  });
});
