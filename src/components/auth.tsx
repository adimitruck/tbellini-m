'use client';
import { useState, type ReactElement, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { profileNameSchema } from '@/domain/community';

export interface AuthProps { client: SupabaseClient }

export function Auth({ client }: AuthProps): ReactElement {
  const [signup, setSignup] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setMessage('');

    try {
      const credentials = { email: String(data.get('email')), password: String(data.get('password')) };
      
      if (signup) {
        const inviteCode = String(data.get('inviteCode') ?? '').trim().toUpperCase();
        if (!inviteCode) throw new Error('Invite code is required.');
        
        const displayName = profileNameSchema.parse(String(data.get('displayName') ?? ''));
        
        const result = await client.auth.signUp({
          ...credentials,
          options: {
            data: {
              display_name: displayName,
              invite_code: inviteCode,
            }
          }
        });
        
        if (result.error) throw result.error;
        
        if (!result.data.session) {
          setMessage('Check your email to confirm your account, then sign in.');
        }
      } else {
        const result = await client.auth.signInWithPassword(credentials);
        if (result.error) throw result.error;
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card">
      <p className="eyebrow">THE TBELLINI COMMUNITY</p>
      <h1>A place for our moments.</h1>
      <p className="muted">Sign up to automatically join TBellini. Share events and build your own calendar.</p>
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
        onClick={(): void => { setSignup(!signup); setMessage(''); }}
      >
        {signup ? 'Already have an account? Sign in' : 'New here? Create an account'}
      </button>
    </section>
  );
}
