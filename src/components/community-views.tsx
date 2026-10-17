'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import { type ArchiveEvent, type ArchiveSnapshot } from '@/domain/archive';
import { formatEventTime } from '@/domain/time';
export interface EventListProps { snapshot: ArchiveSnapshot; currentUserId: string; onSelect(event: ArchiveEvent): void }
export function EventList({ snapshot, currentUserId, onSelect }: EventListProps): ReactElement {
  return <><div className="list-meta"><span>{snapshot.events.length} shared community events</span><span>Ordered by event date</span></div><div className="event-list">
    {snapshot.events.map((event): ReactElement => {
      const author = snapshot.members.find((member): boolean => member.id === event.ownerId)?.displayName ?? 'TBellini member';
      const rsvp = snapshot.rsvps.find((response): boolean => response.eventId === event.id && response.userId === currentUserId)?.status;
      const tagged = snapshot.tags.some((tag): boolean => tag.eventId === event.id && tag.userId === currentUserId);
      return <button key={event.id} className="event-card" onClick={(): void => onSelect(event)}><div className="date-tile"><span>{new Intl.DateTimeFormat('en-US', { timeZone: event.timezone, month: 'short' }).format(new Date(event.startsAt))}</span><strong>{new Intl.DateTimeFormat('en-US', { timeZone: event.timezone, day: 'numeric' }).format(new Date(event.startsAt))}</strong></div><div className="event-summary"><h2>{event.title}</h2><p>{formatEventTime(event.startsAt, event.timezone)} · {event.location || 'Place not recorded'}</p><span>By {author}{rsvp ? ` · You’re ${rsvp === 'going' ? 'Going' : 'Interested'}` : ' · No RSVP'}{tagged ? ' · You’re tagged' : ''}</span></div><span className="card-arrow" aria-hidden="true">↗</span></button>;
    })}
    {!snapshot.events.length && <div className="empty-state"><h2>The next moment starts here.</h2><p>Create the first event for the TBellini community.</p></div>}
  </div><div className="archive-note"><span aria-hidden="true">✳</span><p>One community, many moments.<br /><span>Choose Going or Interested to build your own calendar.</span></p></div></>;
}
export interface MembersProps { snapshot: ArchiveSnapshot; currentUserId: string; onSaveProfile(displayName: string): Promise<void>; onGenerateInvitation(): Promise<string> }
export function Members({ snapshot, currentUserId, onSaveProfile, onGenerateInvitation }: MembersProps): ReactElement {
  const current = snapshot.members.find((member): boolean => member.id === currentUserId);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> { e.preventDefault(); setBusy(true); setError(''); const data = new FormData(e.currentTarget); try { await onSaveProfile(String(data.get('displayName') ?? '')); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save your profile.'); } finally { setBusy(false); } }
  async function generateCode(): Promise<void> {
    setInviteBusy(true);
    setError('');
    try {
      const code = await onGenerateInvitation();
      setNewCode(code);
      setCopied(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to generate invitation code.');
    } finally {
      setInviteBusy(false);
    }
  }
  return <><form className="profile-form" onSubmit={submit}><label>Your display name<input key={currentUserId} name="displayName" defaultValue={current?.displayName} required maxLength={200} /></label><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save your name'}</button>{error && <p className="error" role="alert">{error}</p>}</form>
  <div style={{ margin: '2rem 0', padding: '1.5rem', background: 'var(--card-bg, #f9f9f9)', borderRadius: '8px', border: '1px solid var(--border-color, #e5e5e5)' }}>
    <h2>Invite New Members</h2>
    <p className="muted">Generate an invitation code to share with friends so they can join TBellini.</p>
    <button className="primary" onClick={generateCode} disabled={inviteBusy} type="button">
      {inviteBusy ? 'Generating…' : 'Generate Invite Code'}
    </button>
    {newCode && (
      <div style={{ marginTop: '1rem' }}>
        <p>Share this single-use code with your friend. It expires in 7 days.</p>
        <input type="text" readOnly aria-label="Invitation code" value={newCode} style={{ padding: '0.5rem', fontSize: '1rem', width: '200px', marginRight: '0.5rem' }} />
        <button onClick={(): void => { navigator.clipboard.writeText(newCode).then((): void => setCopied(true), (): void => setError('Copy failed. Select the code and copy it manually.')); }} type="button">{copied ? 'Copied' : 'Copy'}</button>
      </div>
    )}
  </div>
  <p className="muted">Every signed-up user is automatically a member of the TBellini community. User accounts are separate from your private archive people.</p><div className="people-grid">{snapshot.members.map((member): ReactElement => <article className="person-card" key={member.id}><div className="avatar">{member.displayName[0]}</div><h2>{member.displayName}{member.id === currentUserId ? ' (you)' : ''}</h2><p className="small muted">TBellini member</p><p className="small">{snapshot.events.filter((event): boolean => event.ownerId === member.id).length} events created</p></article>)}</div></>;
}
