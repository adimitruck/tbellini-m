'use client';
import type { ReactElement } from 'react';
import type { ArchiveEvent, Person } from '@/domain/archive';
import type { ArchiveService } from '@/domain/service';
import type { ArchiveSnapshot } from '@/domain/snapshot';
import { MEMBER_FALLBACK, PERSON_TEXT } from './labels';

export interface PersonDetailProps {
  person: Person;
  snapshot: ArchiveSnapshot;
  currentUserId: string;
  busy: boolean;
  onBack(): void;
  onEdit(): void;
  onOpenEvent(event: ArchiveEvent): void;
  run(action: (service: ArchiveService) => Promise<unknown>): void;
}

/** One person, opened on purpose: notes, whether a member is linked, tagged events and claim actions. */
export function PersonDetail(props: PersonDetailProps): ReactElement {
  const { person, snapshot, currentUserId, busy, onBack, onEdit, onOpenEvent, run } = props;
  const text = PERSON_TEXT;
  const isCreator = person.createdBy === currentUserId;
  const nameOf = (id: string): string =>
    snapshot.members.find((member): boolean => member.id === id)?.displayName ?? MEMBER_FALLBACK;
  const tags = snapshot.tags.filter((tag): boolean => tag.personId === person.id);
  const taggedIds = new Set(tags.map((tag): string => tag.eventId));
  const tagged = snapshot.events.filter((event): boolean => taggedIds.has(event.id));
  const claims = snapshot.claims.filter((claim): boolean => claim.personId === person.id);
  const myClaim = snapshot.claims.find((claim): boolean => claim.claimantId === currentUserId);
  const remove = (): void => {
    if (window.confirm(text.confirmDelete)) run((service) => service.deletePerson(person.id));
  };
  const claimControls = (): ReactElement | null => {
    if (person.memberId !== null) return null;
    if (!myClaim) {
      return (
        <button disabled={busy} onClick={(): void => run((s) => s.requestClaim(person.id))}>
          {text.thisIsMe}
        </button>
      );
    }
    if (myClaim.personId !== person.id) return <p className="small muted">{text.otherClaimPending}</p>;
    return (
      <>
        <p className="small muted" role="status">{text.claimPending}</p>
        <button disabled={busy} onClick={(): void => run((s) => s.cancelClaim(person.id, currentUserId))}>
          {text.withdraw}
        </button>
      </>
    );
  };
  return (
    <section className="event-detail" aria-label={person.displayName}>
      <button className="text-button" onClick={onBack}>{text.back}</button>
      <h1>{person.displayName}</h1>
      <p className="muted">{person.notes || text.noNotes}</p>
      <p className="small">
        {person.memberId ? `${text.linkedTo} ${nameOf(person.memberId)}` : text.noAccount}
      </p>
      {isCreator ? (
        <div className="actions">
          <button onClick={onEdit}>{text.edit}</button>
          <button disabled={busy} className="danger" onClick={remove}>{text.delete}</button>
        </div>
      ) : (
        <p className="small muted">{text.creatorOnly}</p>
      )}
      <div className="participants">
        <h2>{text.taggedEvents}</h2>
        {tagged.length ? (
          <ul>
            {tagged.map((event): ReactElement => (
              <li key={event.id}>
                <button className="text-button" onClick={(): void => onOpenEvent(event)}>{event.title}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{text.noTags}</p>
        )}
      </div>
      {person.memberId === null && (
        <div className="participants">
          <h2>{text.claimTitle}</h2>
          <p className="muted">{text.claimBody}</p>
          {claimControls()}
          {isCreator && claims.map((claim): ReactElement => (
            <div className="attendee" key={claim.claimantId}>
              <span>{nameOf(claim.claimantId)} {text.claims}</span>
              <button
                disabled={busy}
                className="primary"
                onClick={(): void => run((s) => s.confirmClaim(person.id, claim.claimantId))}
              >
                {text.confirm}
              </button>
              <button disabled={busy} onClick={(): void => run((s) => s.cancelClaim(person.id, claim.claimantId))}>
                {text.reject}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
