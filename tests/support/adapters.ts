import { createClient } from '@supabase/supabase-js';
import type { RepositoryFactory } from '../../src/domain/ports';
import {
  createDemoRepositories,
  DEMO_STORAGE_KEY,
  DEMO_USERS,
  seedArchive,
  type StoragePort,
} from '../../src/infrastructure/demo';
import { createSupabaseRepositories } from '../../src/infrastructure/supabase';
import { FakeDatabase } from './fake-database';

export const [SAM, ALEX] = DEMO_USERS;

/** One backend under test: the same two members, no events, and a way to act as either. */
export interface RepositoryFixture {
  name: string;
  repositoriesFor: RepositoryFactory;
}

export function memoryStorage(initial: Record<string, string> = {}): StoragePort & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    data,
    getItem: (key): string | null => data.get(key) ?? null,
    setItem: (key, value): void => void data.set(key, value),
  };
}

/** The demo seed without its sample events: just the two members and the Person each one is. */
export function blankDemoStorage(): StoragePort & { data: Map<string, string> } {
  const seed = seedArchive();
  const memberPeople = seed.people.filter((person): boolean => person.memberId !== null);
  const blank = { ...seed, events: [], tags: [], rsvps: [], people: memberPeople };
  return memoryStorage({ [DEMO_STORAGE_KEY]: JSON.stringify(blank) });
}

export function demoFixture(): RepositoryFixture {
  const storage = blankDemoStorage();
  return { name: 'demo adapter', repositoriesFor: (userId) => createDemoRepositories(storage, userId) };
}

export function supabaseClientFor(database: FakeDatabase, userId: string): ReturnType<typeof createClient> {
  return createClient('https://archive.example', 'test-publishable-key', {
    global: { fetch: database.fetchAs(userId) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function fakeDatabase(): FakeDatabase {
  const database = new FakeDatabase();
  database.addMember(SAM, 'Sam Rivera');
  database.addMember(ALEX, 'Alex Chen');
  return database;
}

export function supabaseFixture(database: FakeDatabase = fakeDatabase()): RepositoryFixture {
  return {
    name: 'supabase adapter (fake database)',
    repositoriesFor: (userId) => createSupabaseRepositories(supabaseClientFor(database, userId), userId),
  };
}

export const FIXTURES: readonly (() => RepositoryFixture)[] = [demoFixture, (): RepositoryFixture => supabaseFixture()];
