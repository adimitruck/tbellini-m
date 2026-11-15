import { ArchiveError } from '@/domain/archive';
import type { AuthListener, AuthPort, Credentials, DemoControls, SignUpResult } from '@/domain/ports';
import { DEMO_USERS } from './demo-seed';
import type { DemoStore } from './demo-store';

export const DEMO_MESSAGES = {
  unknownUser: 'Choose one of the demo members.',
  noSignUp: 'The demo has no accounts to create. Choose a demo member instead.',
} as const;

/**
 * Demo sign-in: the email is a demo member id and the password is ignored, because demo data lives in
 * this browser and protects nothing. Starts signed in as the first demo member.
 */
export class DemoAuth implements AuthPort, DemoControls {
  readonly users: readonly string[] = DEMO_USERS;
  private userId: string | null = DEMO_USERS[0];
  private readonly listeners = new Set<AuthListener>();

  constructor(private readonly store: DemoStore) {}

  async currentUserId(): Promise<string | null> {
    return this.userId;
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    let active = true;
    queueMicrotask((): void => {
      if (active) listener(this.userId);
    });
    return (): void => {
      active = false;
      this.listeners.delete(listener);
    };
  }

  async signIn(credentials: Credentials): Promise<void> {
    if (!this.store.read().members.some((member): boolean => member.id === credentials.email)) {
      throw new ArchiveError(DEMO_MESSAGES.unknownUser);
    }
    this.change(credentials.email);
  }

  async signUp(): Promise<SignUpResult> {
    throw new ArchiveError(DEMO_MESSAGES.noSignUp);
  }

  async signOut(): Promise<void> {
    this.change(null);
  }

  reset(): void {
    this.store.reset();
  }

  private change(userId: string | null): void {
    if (userId === this.userId) return;
    this.userId = userId;
    this.listeners.forEach((listener): void => listener(userId));
  }
}
