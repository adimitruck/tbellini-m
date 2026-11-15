'use client';
import { useState, type CSSProperties, type ReactElement } from 'react';
import type { Person } from '@/domain/archive';
import { INVITE_TEXT } from './labels';

export interface InvitePanelProps {
  /** Persons no member is linked to yet; an invitation may name one so the friend becomes that Person. */
  unlinked: readonly Person[];
  onGenerate(personId: string | null): Promise<string>;
}

const PANEL: CSSProperties = { margin: '2rem 0', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e5e5' };

/** Creates a single-use invitation code, optionally naming the Person the invited friend already is. */
export function InvitePanel({ unlinked, onGenerate }: InvitePanelProps): ReactElement {
  const [personId, setPersonId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const text = INVITE_TEXT;
  async function generate(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      setCode(await onGenerate(personId || null));
      setCopied(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.failed);
    } finally {
      setBusy(false);
    }
  }
  const copy = (): void => {
    navigator.clipboard.writeText(code).then((): void => setCopied(true), (): void => setError(text.copyFailed));
  };
  return (
    <div style={PANEL}>
      <h2>{text.title}</h2>
      <p className="muted">{text.body}</p>
      <label>
        {text.forPerson}
        <select value={personId} disabled={busy} onChange={(e): void => setPersonId(e.target.value)}>
          <option value="">{text.anyone}</option>
          {unlinked.map((person): ReactElement => (
            <option key={person.id} value={person.id}>{person.displayName}</option>
          ))}
        </select>
      </label>
      <button className="primary" onClick={(): void => void generate()} disabled={busy} type="button">
        {busy ? text.generating : text.generate}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
      {code && (
        <div>
          <p>{text.share}</p>
          <input type="text" readOnly aria-label={text.codeLabel} value={code} />
          <button onClick={copy} type="button">{copied ? text.copied : text.copy}</button>
        </div>
      )}
    </div>
  );
}
