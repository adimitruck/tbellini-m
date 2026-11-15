'use client';
import type { ReactElement } from 'react';
import type { ArchiveEvent } from '@/domain/archive';
import type { RsvpStatus } from '@/domain/members';
import type { ArchiveService } from '@/domain/service';
import type { ArchiveSnapshot } from '@/domain/snapshot';
import { formatEventTime } from '@/domain/time';

export interface EventDetailProps {
  event: ArchiveEvent;
  snapshot: ArchiveSnapshot;
  currentUserId: string;
  busy: boolean;
  onBack(): void;
  onEdit(): void;
  onRecordPerson(): void;
  run(action: (service: ArchiveService) => Promise<unknown>): void;
}

const RSVP_LABELS: Record<RsvpStatus, string> = { going: 'Going', interested: 'Interested' };

export function EventDetail({
  event,
  snapshot,
  currentUserId,
  busy,
  onBack,
  onEdit,
  onRecordPerson,
  run,
}: EventDetailProps): ReactElement {
  const authored = event.createdBy === currentUserId;
  const rsvps = snapshot.rsvps.filter((rsvp): boolean => rsvp.eventId === event.id);
  const currentRsvp = rsvps.find((rsvp): boolean => rsvp.userId === currentUserId)?.status ?? null;
  const tagged = new Set(snapshot.tags.filter((tag): boolean => tag.eventId === event.id).map((tag) => tag.personId));
  const memberName = (id: string): string =>
    snapshot.members.find((member): boolean => member.id === id)?.displayName ?? 'TBellini member';
  const respond = (status: RsvpStatus | null): void => run((service): Promise<void> => service.respond(event.id, status));
  const toggleTag = (personId: string): void =>
    run((service): Promise<void> =>
      tagged.has(personId) ? service.untagPerson(event.id, personId) : service.tagPerson(event.id, personId),
    );
  const deleteEvent = (): void => {
    if (window.confirm('Delete this shared event for everyone?')) run((service) => service.deleteEvent(event.id));
  };
  const rsvpButton = (status: RsvpStatus): ReactElement => (
    <button
      disabled={busy}
      aria-pressed={currentRsvp === status}
      className={currentRsvp === status ? 'primary' : ''}
      onClick={(): void => respond(status)}
    >
      {RSVP_LABELS[status]}
    </button>
  );
  return (
    <section className="event-detail">
      <button className="text-button" onClick={onBack}>← Back to events</button>
      <p className="eyebrow">TBELLINI EVENT</p>
      <h1>{event.title}</h1>
      <p className="detail-time">
        {formatEventTime(event.startsAt, event.timezone)}
        {event.endsAt && ` — ${formatEventTime(event.endsAt, event.timezone)}`}
      </p>
      <p className="muted">{event.timezone} · {event.location || 'No place recorded'}</p>
      <p className="small muted">Created by {memberName(event.createdBy)} · Shared with TBellini members</p>
      <p className="detail-notes">{event.description || 'No event notes yet.'}</p>
      {authored ? (
        <div className="actions">
          <button onClick={onEdit}>Edit event</button>
          <button className="danger" disabled={busy} onClick={deleteEvent}>Delete event</button>
        </div>
      ) : (
        <p className="small muted">The event creator can edit or delete this event.</p>
      )}
      <div className="participants">
        <h2>Your RSVP</h2>
        <p className="muted">
          Going or Interested adds this event to your personal calendar. You choose your own response.
        </p>
        <div className="actions rsvp-actions">
          {rsvpButton('going')}
          {rsvpButton('interested')}
          <button disabled={busy || currentRsvp === null} onClick={(): void => respond(null)}>Clear RSVP</button>
        </div>
        <p className="small" role="status">Your response: {currentRsvp ? RSVP_LABELS[currentRsvp] : 'No RSVP'}</p>
        <p className="muted small">
          {rsvps.length
            ? rsvps.map((rsvp): string => `${memberName(rsvp.userId)} · ${RSVP_LABELS[rsvp.status]}`).join(' / ')
            : 'No responses yet.'}
        </p>
      </div>
      <div className="participants">
        <h2>Tagged people</h2>
        <p className="muted">Tags connect people to this event. A tag never sets an RSVP.</p>
        {authored ? (
          <>
            {!snapshot.people.length && <button onClick={onRecordPerson}>Record a person</button>}
            {snapshot.people.map((person): ReactElement => (
              <label className="attendee" key={person.id}>
                <input
                  type="checkbox"
                  checked={tagged.has(person.id)}
                  disabled={busy}
                  onChange={(): void => toggleTag(person.id)}
                />
                <span>{person.displayName}{person.memberId === currentUserId ? ' (you)' : ''}</span>
              </label>
            ))}
          </>
        ) : (
          <p>
            {tagged.size
              ? snapshot.people.filter((person): boolean => tagged.has(person.id)).map((p) => p.displayName).join(', ')
              : 'No one tagged.'}
          </p>
        )}
      </div>
    </section>
  );
}
