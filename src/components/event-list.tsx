'use client';
import type { ReactElement } from 'react';
import type { ArchiveEvent } from '@/domain/archive';
import { personOfMember, type ArchiveSnapshot } from '@/domain/snapshot';
import { formatEventTime } from '@/domain/time';
import { EVENT_LIST_TEXT, MEMBER_FALLBACK, RSVP_LABELS } from './labels';

export interface EventListProps {
  snapshot: ArchiveSnapshot;
  currentUserId: string;
  onSelect(event: ArchiveEvent): void;
}

const dateTile = (event: ArchiveEvent, part: 'month' | 'day'): string =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: event.timezone,
    ...(part === 'month' ? { month: 'short' } : { day: 'numeric' }),
  }).format(new Date(event.startsAt));

/** The shared feed. It states only what concerns the signed-in member; others' details stay behind their page. */
export function EventList({ snapshot, currentUserId, onSelect }: EventListProps): ReactElement {
  const text = EVENT_LIST_TEXT;
  const myPersonId = personOfMember(snapshot, currentUserId)?.id;
  const card = (event: ArchiveEvent): ReactElement => {
    const author = snapshot.members.find((member): boolean => member.id === event.createdBy)?.displayName;
    const rsvp = snapshot.rsvps.find((r): boolean => r.eventId === event.id && r.userId === currentUserId)?.status;
    const tagged = snapshot.tags.some((tag): boolean => tag.eventId === event.id && tag.personId === myPersonId);
    return (
      <button key={event.id} className="event-card" onClick={(): void => onSelect(event)}>
        <div className="date-tile">
          <span>{dateTile(event, 'month')}</span>
          <strong>{dateTile(event, 'day')}</strong>
        </div>
        <div className="event-summary">
          <h2>{event.title}</h2>
          <p>{formatEventTime(event.startsAt, event.timezone)} · {event.location || text.noPlace}</p>
          <span>
            {text.by} {author ?? MEMBER_FALLBACK}
            {rsvp ? ` · ${text.yourRsvp} ${RSVP_LABELS[rsvp]}` : ` · ${text.noRsvp}`}
            {tagged ? ` · ${text.youAreTagged}` : ''}
          </span>
        </div>
        <span className="card-arrow" aria-hidden="true">↗</span>
      </button>
    );
  };
  return (
    <>
      <div className="list-meta">
        <span>{text.count(snapshot.events.length)}</span>
        <span>{text.ordered}</span>
      </div>
      <div className="event-list">
        {snapshot.events.map(card)}
        {!snapshot.events.length && (
          <div className="empty-state">
            <h2>{text.emptyTitle}</h2>
            <p>{text.emptyBody}</p>
          </div>
        )}
      </div>
      <div className="archive-note">
        <span aria-hidden="true">✳</span>
        <p>{text.noteTitle}<br /><span>{text.noteBody}</span></p>
      </div>
    </>
  );
}
