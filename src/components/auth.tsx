'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import type { AuthPort } from '@/domain/ports';

export interface AuthProps {
  auth: AuthPort;
}

const CHECK_EMAIL = 'Check your email to confirm your account, then sign in.';

export function Auth({ auth }: AuthProps): ReactElement {
  const [signup, setSignup] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (name: string): string => String(data.get(name) ?? '');
    setBusy(true);
    setMessage('');
    try {
      const credentials = { email: field('email'), password: field('password') };
      if (signup) {
        const result = await auth.signUp({
          ...credentials,
          displayName: field('displayName'),
          inviteCode: field('inviteCode'),
        });
        if (result === 'confirmation-required') setMessage(CHECK_EMAIL);
      } else {
        await auth.signIn(credentials);
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card">
      <p className="eyebrow">THE TBELLINI GROUP</p>
      <h1>A place for our moments.</h1>
      <p className="muted">Sign up with an invite code to join TBellini. Share events and build your own calendar.</p>
      <form className="record-form" onSubmit={submit}>
        {signup && (
          <label>
            Display name
            <input name="displayName" autoComplete="name" maxLength={200} required />
          </label>
        )}
        {signup && (
          <label>
            Invite code
            <input
              name="inviteCode"
              autoComplete="off"
              maxLength={12}
              minLength={8}
              pattern="[A-Za-z0-9-]{8,12}"
              placeholder="ABCD-1234"
              required
            />
          </label>
        )}
        <label>
          Email
          <input type="email" name="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            minLength={8}
            autoComplete={signup ? 'new-password' : 'current-password'}
            required
          />
        </label>
        {message && <p role="status">{message}</p>}
        <button className="primary" disabled={busy}>
          {busy ? 'Working…' : signup ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <button
        className="text-button"
        onClick={(): void => {
          setSignup(!signup);
          setMessage('');
        }}
      >
        {signup ? 'Already have an account? Sign in' : 'New here? Create an account'}
      </button>
    </section>
  );
}
