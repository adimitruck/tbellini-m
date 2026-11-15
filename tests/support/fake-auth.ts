import type { SupabaseAuthApi } from '../../src/infrastructure/supabase-auth';
import { SESSION_MISSING_ERROR, SIGN_UP_METADATA, SIGN_UP_REJECTED_MARKER } from '../../src/infrastructure/supabase-schema';

export const VALID_INVITE = 'ABCD-2345';

interface Account {
  id: string;
  password: string;
}

/** An in-memory Auth server: password accounts, invite-gated signup, one session, change notifications. */
export class FakeAuth implements SupabaseAuthApi {
  readonly accounts = new Map<string, Account>();
  readonly signUps: Record<string, string>[] = [];
  /** The emailRedirectTo of each signup, undefined when none was sent. */
  readonly redirects: (string | undefined)[] = [];
  /** When true a successful signup returns a session; otherwise the email must be confirmed first. */
  autoConfirm = false;
  private session: string | null = null;
  private readonly callbacks = new Set<() => void>();

  addAccount(email: string, id: string, password: string): void {
    this.accounts.set(email, { id, password });
  }

  async getUser(): Promise<{ data: { user: { id: string } | null }; error: { name: string; message: string } | null }> {
    if (!this.session) {
      return { data: { user: null }, error: { name: SESSION_MISSING_ERROR, message: 'Auth session missing!' } };
    }
    return { data: { user: { id: this.session } }, error: null };
  }

  async signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ error: { name: string; message: string } | null }> {
    const account = this.accounts.get(credentials.email);
    if (account?.password !== credentials.password) {
      return { error: { name: 'AuthApiError', message: 'Invalid login credentials' } };
    }
    this.change(account.id);
    return { error: null };
  }

  async signUp(input: {
    email: string;
    password: string;
    options: { data: Record<string, string>; emailRedirectTo?: string };
  }): Promise<{
    data: { session: object | null };
    error: { name: string; message: string } | null;
  }> {
    this.signUps.push(input.options.data);
    this.redirects.push(input.options.emailRedirectTo);
    if (input.options.data[SIGN_UP_METADATA.inviteCode] !== VALID_INVITE) {
      return { data: { session: null }, error: { name: 'AuthApiError', message: SIGN_UP_REJECTED_MARKER } };
    }
    const id = `user-${this.accounts.size + 1}`;
    this.accounts.set(input.email, { id, password: input.password });
    if (this.autoConfirm) this.change(id);
    return { data: { session: this.autoConfirm ? {} : null }, error: null };
  }

  async signOut(): Promise<{ error: { name: string; message: string } | null }> {
    this.change(null);
    return { error: null };
  }

  onAuthStateChange(callback: () => void): { data: { subscription: { unsubscribe(): void } } } {
    this.callbacks.add(callback);
    queueMicrotask(callback); // like INITIAL_SESSION
    return { data: { subscription: { unsubscribe: (): void => void this.callbacks.delete(callback) } } };
  }

  private change(userId: string | null): void {
    this.session = userId;
    this.callbacks.forEach((callback): void => callback());
  }
}
