import { ArchiveError } from '@/domain/archive';
import { signUpSchema } from '@/domain/members';
import type { AuthListener, AuthPort, Credentials, SignUpInput, SignUpResult } from '@/domain/ports';
import { parseOrThrow } from '@/domain/primitives';
import { SESSION_MISSING_ERROR, SIGN_UP_METADATA, SIGN_UP_REJECTED_MARKER } from './supabase-schema';

export const SUPABASE_AUTH_MESSAGES = {
  inviteRejected: 'That invite code is invalid, expired, or already used.',
  failed: 'Authentication failed.',
} as const;

interface AuthFailure {
  name: string;
  message: string;
}

/** The part of SupabaseClient['auth'] this adapter uses; the real client satisfies it structurally. */
export interface SupabaseAuthApi {
  getUser(): Promise<{ data: { user: { id: string } | null }; error: AuthFailure | null }>;
  signInWithPassword(credentials: Credentials): Promise<{ error: AuthFailure | null }>;
  signUp(input: {
    email: string;
    password: string;
    options: { data: Record<string, string>; emailRedirectTo?: string };
  }): Promise<{ data: { session: object | null }; error: AuthFailure | null }>;
  signOut(): Promise<{ error: AuthFailure | null }>;
  onAuthStateChange(callback: () => void): { data: { subscription: { unsubscribe(): void } } };
}

/** Supabase Auth behind the domain AuthPort. The server validates the user on every change of session. */
export class SupabaseAuth implements AuthPort {
  constructor(private readonly auth: SupabaseAuthApi) {}

  async currentUserId(): Promise<string | null> {
    const { data, error } = await this.auth.getUser();
    if (error && error.name !== SESSION_MISSING_ERROR) throw new ArchiveError(error.message);
    return data.user?.id ?? null;
  }

  subscribe(listener: AuthListener): () => void {
    let active = true;
    let last: string | null | undefined;
    const publish = async (): Promise<void> => {
      try {
        const userId = await this.currentUserId();
        if (!active || userId === last) return;
        last = userId;
        listener(userId);
      } catch {
        // A failed validation leaves the previous state; the next session change retries.
      }
    };
    // Auth callbacks must not call back into Auth synchronously, so validation runs on the next tick.
    const { data } = this.auth.onAuthStateChange((): void => {
      setTimeout((): void => void publish(), 0);
    });
    return (): void => {
      active = false;
      data.subscription.unsubscribe();
    };
  }

  async signIn(credentials: Credentials): Promise<void> {
    const { error } = await this.auth.signInWithPassword(credentials);
    if (error) throw new ArchiveError(error.message);
  }

  async signUp(input: SignUpInput): Promise<SignUpResult> {
    const valid = parseOrThrow(signUpSchema, input);
    const { data, error } = await this.auth.signUp({
      email: valid.email,
      password: valid.password,
      options: {
        data: {
          [SIGN_UP_METADATA.displayName]: valid.displayName,
          [SIGN_UP_METADATA.inviteCode]: valid.inviteCode,
        },
        ...(valid.redirectTo ? { emailRedirectTo: valid.redirectTo } : {}),
      },
    });
    if (error) {
      const rejected = error.message.includes(SIGN_UP_REJECTED_MARKER);
      throw new ArchiveError(rejected ? SUPABASE_AUTH_MESSAGES.inviteRejected : error.message);
    }
    return data.session ? 'signed-in' : 'confirmation-required';
  }

  async signOut(): Promise<void> {
    const { error } = await this.auth.signOut();
    if (error) throw new ArchiveError(error.message);
  }
}
