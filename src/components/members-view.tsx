'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import type { UserProfile } from '@/domain/members';
import type { ArchiveSnapshot } from '@/domain/snapshot';
import { formatEventTime } from '@/domain/time';
import { InvitePanel } from './invite-panel';
import { MEMBERS_TEXT } from './labels';

export interface MembersProps {
  snapshot: ArchiveSnapshot;
  currentUserId: string;
  onSaveProfile(displayName: string): Promise<void>;
  onGenerateInvitation(personId: string | null): Promise<string>;
}

/** What one member has made; shown only after that member is opened, never pushed into a feed. */
function MemberDetail({ member, snapshot, onClose }: {
  member: UserProfile;
  snapshot: ArchiveSnapshot;
  onClose(): void;
}): ReactElement {
  const text = MEMBERS_TEXT;
  const created = snapshot.events.filter((event): boolean => event.createdBy === member.id);
  return (
    <section className="event-detail" aria-label={member.displayName}>
      <button className="text-button" onClick={onClose}>{text.back}</button>
      <h2>{member.displayName}</h2>
      <p className="small">{text.eventsCreated(created.length)}</p>
      <ul>
        {created.map((event): ReactElement => (
          <li key={event.id}>{event.title} · {formatEventTime(event.startsAt, event.timezone)}</li>
        ))}
      </ul>
    </section>
  );
}

export function Members({ snapshot, currentUserId, onSaveProfile, onGenerateInvitation }: MembersProps): ReactElement {
  const current = snapshot.members.find((member): boolean => member.id === currentUserId);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const text = MEMBERS_TEXT;
  const open = snapshot.members.find((member): boolean => member.id === openId);
  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    try {
      await onSaveProfile(String(data.get('displayName') ?? ''));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.saveFailed);
    } finally {
      setBusy(false);
    }
  }
  if (open) return <MemberDetail member={open} snapshot={snapshot} onClose={(): void => setOpenId(null)} />;
  return (
    <>
      <form className="profile-form" onSubmit={submit}>
        <label>
          {text.yourName}
          <input key={currentUserId} name="displayName" defaultValue={current?.displayName} required maxLength={200} />
        </label>
        <button className="primary" disabled={busy}>{busy ? text.saving : text.save}</button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
      <InvitePanel
        unlinked={snapshot.people.filter((person): boolean => person.memberId === null)}
        onGenerate={onGenerateInvitation}
      />
      <p className="muted">{text.intro}</p>
      <div className="people-grid">
        {snapshot.members.map((member): ReactElement => (
          <button key={member.id} className="person-card" onClick={(): void => setOpenId(member.id)}>
            <div className="avatar">{member.displayName[0]}</div>
            <h2>{member.displayName}{member.id === currentUserId ? text.you : ''}</h2>
          </button>
        ))}
      </div>
    </>
  );
}
