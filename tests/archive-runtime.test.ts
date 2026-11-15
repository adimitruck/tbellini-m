import { describe, expect, it } from 'vitest';
import { ArchiveError } from '../src/domain/archive';
import { requireCreator, requireRsvpTarget, requireTaggable } from '../src/domain/rules';
import { DemoAuth } from '../src/infrastructure/demo';
import { SupabaseAuth } from '../src/infrastructure/supabase';
import { CONFIG_MESSAGES } from '../src/lib/archive-config';
import { createArchiveRuntime } from '../src/lib/archive-runtime';
import { memoryStorage } from './support/adapters';
import { seedArchive } from '../src/infrastructure/demo-seed';

describe('composition root', (): void => {
  it('builds demo auth and repositories from local configuration', async (): Promise<void> => {
    const runtime = createArchiveRuntime({ nodeEnv: 'development' }, memoryStorage());
    expect(runtime.auth).toBeInstanceOf(DemoAuth);
    expect(runtime.demo?.users.length).toBeGreaterThan(0);
    const userId = await runtime.auth.currentUserId();
    expect(runtime.repositoriesFor(userId ?? '').currentUserId).toBe(userId);
  });

  it('builds Supabase auth and no demo controls from a configured project', (): void => {
    const runtime = createArchiveRuntime(
      { mode: 'supabase', supabaseUrl: 'https://archive.example', supabaseKey: 'publishable' },
      memoryStorage(),
    );
    expect(runtime.auth).toBeInstanceOf(SupabaseAuth);
    expect(runtime.demo).toBeNull();
    expect(runtime.repositoriesFor('someone').currentUserId).toBe('someone');
  });

  it.each([
    ['production without a mode', { nodeEnv: 'production' }, CONFIG_MESSAGES.unsetMode],
    ['supabase without a key', { mode: 'supabase', supabaseUrl: 'https://archive.example' }, CONFIG_MESSAGES.missingSupabase],
    ['supabase with a bad URL', { mode: 'supabase', supabaseUrl: 'ftp://x', supabaseKey: 'k' }, CONFIG_MESSAGES.invalidUrl],
  ])('refuses to start for %s', (_name, input, message): void => {
    expect(() => createArchiveRuntime(input, memoryStorage())).toThrow(new ArchiveError(message));
  });
});

describe('shared rules', (): void => {
  const { events, people } = seedArchive();
  const [event] = events;
  const [person] = people;

  it('lets only the creator pass the creator rule, never a record without a creator', (): void => {
    expect(() => requireCreator(event, event.createdBy)).not.toThrow();
    expect(() => requireCreator(event, 'someone-else')).toThrow(ArchiveError);
    expect(() => requireCreator({ createdBy: null }, 'anyone')).toThrow(ArchiveError);
  });

  it('requires the event creator, an existing event and an existing person to tag', (): void => {
    expect(() => requireTaggable(event, person, event.createdBy)).not.toThrow();
    expect(() => requireTaggable(event, person, 'someone-else')).toThrow(ArchiveError);
    expect(() => requireTaggable(undefined, person, event.createdBy)).toThrow(ArchiveError);
    expect(() => requireTaggable(event, null, event.createdBy)).toThrow(ArchiveError);
  });

  it('requires only an existing event to RSVP', (): void => {
    expect(() => requireRsvpTarget(event)).not.toThrow();
    expect(() => requireRsvpTarget(null)).toThrow(ArchiveError);
  });
});
