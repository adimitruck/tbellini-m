import { describe, expect, it, vi } from 'vitest';
import { ArchiveError } from '../src/domain/archive';
import type { AuthPort, Credentials } from '../src/domain/ports';
import { DemoAuth, DEMO_USERS } from '../src/infrastructure/demo';
import { DemoStore } from '../src/infrastructure/demo-store';
import { SupabaseAuth, SUPABASE_AUTH_MESSAGES } from '../src/infrastructure/supabase-auth';
import { blankDemoStorage } from './support/adapters';
import { FakeAuth, VALID_INVITE } from './support/fake-auth';

interface AuthFixture {
  name: string;
  auth: AuthPort;
  known: Credentials & { userId: string };
  wrong: Credentials;
}

function demoAuth(): AuthFixture {
  const auth = new DemoAuth(new DemoStore(blankDemoStorage()));
  return {
    name: 'demo auth',
    auth,
    known: { email: DEMO_USERS[1], password: '', userId: DEMO_USERS[1] },
    wrong: { email: 'nobody', password: '' },
  };
}

function supabaseAuth(): AuthFixture {
  const api = new FakeAuth();
  api.addAccount('alex@example.com', 'alex-id', 'correct horse');
  return {
    name: 'supabase auth (fake server)',
    auth: new SupabaseAuth(api),
    known: { email: 'alex@example.com', password: 'correct horse', userId: 'alex-id' },
    wrong: { email: 'alex@example.com', password: 'wrong' },
  };
}

describe.each([demoAuth, supabaseAuth])('AuthPort contract', (make): void => {
  const { name } = make();
  describe(name, (): void => {
    it('signs in a known account and rejects bad credentials without changing who is signed in', async (): Promise<void> => {
      const { auth, known, wrong } = make();
      await expect(auth.signIn(wrong)).rejects.toBeInstanceOf(ArchiveError);
      await auth.signIn(known);
      expect(await auth.currentUserId()).toBe(known.userId);
      await expect(auth.signIn(wrong)).rejects.toBeInstanceOf(ArchiveError);
      expect(await auth.currentUserId()).toBe(known.userId);
    });

    it('signs out', async (): Promise<void> => {
      const { auth, known } = make();
      await auth.signIn(known);
      await auth.signOut();
      expect(await auth.currentUserId()).toBeNull();
    });

    it('reports each change of member once and stops after unsubscribing', async (): Promise<void> => {
      const { auth, known } = make();
      const seen: (string | null)[] = [];
      const unsubscribe = auth.subscribe((userId): void => void seen.push(userId));
      await vi.waitFor((): void => expect(seen.length).toBeGreaterThan(0));
      await auth.signIn(known);
      await vi.waitFor((): void => expect(seen.at(-1)).toBe(known.userId));
      await auth.signOut();
      await vi.waitFor((): void => expect(seen.at(-1)).toBeNull());
      seen.forEach((userId, index): void => expect(userId).not.toBe(index ? seen[index - 1] : Symbol('first')));
      unsubscribe();
      const count = seen.length;
      await auth.signIn(known);
      await new Promise((resolve): void => void setTimeout(resolve, 20));
      expect(seen).toHaveLength(count);
    });

    it('does not create an account from an invalid invite code', async (): Promise<void> => {
      const { auth } = make();
      const signUp = auth.signUp({
        email: 'new@example.com',
        password: 'long enough',
        displayName: 'New',
        inviteCode: 'BAD-CODE1',
      });
      await expect(signUp).rejects.toBeInstanceOf(ArchiveError);
    });
  });
});

describe('supabase sign-up', (): void => {
  const input = {
    email: 'new@example.com',
    password: 'long enough',
    displayName: '  New Member ',
    inviteCode: ` ${VALID_INVITE.toLowerCase()} `,
  };

  it('sends the normalized display name and invite code and asks for email confirmation', async (): Promise<void> => {
    const api = new FakeAuth();
    expect(await new SupabaseAuth(api).signUp(input)).toBe('confirmation-required');
    expect(api.signUps).toEqual([{ display_name: 'New Member', invite_code: VALID_INVITE }]);
  });

  it('sends the caller origin as emailRedirectTo and omits it when absent', async (): Promise<void> => {
    const api = new FakeAuth();
    const auth = new SupabaseAuth(api);
    await auth.signUp({ ...input, redirectTo: 'https://preview-abc.vercel.app' });
    await auth.signUp(input);
    expect(api.redirects).toEqual(['https://preview-abc.vercel.app', undefined]);
  });

  it('rejects a redirect that is not a URL before calling Auth', async (): Promise<void> => {
    const api = new FakeAuth();
    await expect(new SupabaseAuth(api).signUp({ ...input, redirectTo: 'not a url' })).rejects.toBeInstanceOf(ArchiveError);
    expect(api.signUps).toHaveLength(0);
  });

  it('reports a session when the project confirms emails automatically', async (): Promise<void> => {
    const api = new FakeAuth();
    api.autoConfirm = true;
    expect(await new SupabaseAuth(api).signUp(input)).toBe('signed-in');
  });

  it('explains a rejected invite instead of a generic database error', async (): Promise<void> => {
    const rejected = new SupabaseAuth(new FakeAuth()).signUp({ ...input, inviteCode: 'ZZZZ-9999' });
    await expect(rejected).rejects.toThrow(SUPABASE_AUTH_MESSAGES.inviteRejected);
  });

  it.each([
    ['malformed invite code', { inviteCode: 'no' }],
    ['blank display name', { displayName: '  ' }],
    ['short password', { password: 'short' }],
  ])('rejects a %s before calling Auth', async (_name, override): Promise<void> => {
    const api = new FakeAuth();
    await expect(new SupabaseAuth(api).signUp({ ...input, ...override })).rejects.toBeInstanceOf(ArchiveError);
    expect(api.signUps).toHaveLength(0);
  });

  it('demo accounts cannot be created', async (): Promise<void> => {
    const demo = new DemoAuth(new DemoStore(blankDemoStorage()));
    await expect(demo.signUp()).rejects.toBeInstanceOf(ArchiveError);
  });
});
