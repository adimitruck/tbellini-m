'use client';
import type { ReactElement } from 'react';
import type { ArchiveEvent } from '@/domain/archive';
import type { RsvpStatus } from '@/domain/members';
import type { ArchiveService } from '@/domain/service';
import type { ArchiveSnapshot } from '@/domain/snapshot';
import { formatEventTime } from '@/domain/time';
import { EVENT_DETAIL_TEXT, MEMBER_FALLBACK, RSVP_LABELS } from './labels';
import { PersonPicker } from './person-picker';

export interface EventDetailProps {
  event: ArchiveEvent;
  snapshot: ArchiveSnapshot;
  currentUserId: string;
  busy: boolean;
  onBack(): void;
  onEdit(): void;
  run(action: (service: ArchiveService) => Promise<unknown>): void;
}

export function EventDetail(props: EventDetailProps): ReactElement {
  const { event, snapshot, currentUserId, busy, onBack, onEdit, run } = props;
  const text = EVENT_DETAIL_TEXT;
  const authored = event.createdBy === currentUserId;
  const rsvps = snapshot.rsvps.filter((rsvp): boolean => rsvp.eventId === event.id);
  const currentRsvp = rsvps.find((rsvp): boolean => rsvp.userId === currentUserId)?.status ?? null;
  const tagged = new Set(snapshot.tags.filter((tag): boolean => tag.eventId === event.id).map((tag) => tag.personId));
  const memberName = (id: string): string =>
    snapshot.members.find((member): boolean => member.id === id)?.displayName ?? MEMBER_FALLBACK;
  const respond = (status: RsvpStatus | null): void =>
    run((service): Promise<void> => service.respond(event.id, status));
  const addNew = (displayName: string): void =>
    run((service) => service.addPersonToEvent(event.id, { displayName, notes: '' }));
  const toggleTag = (personId: string): void =>
    run((service): Promise<void> =>
      tagged.has(personId) ? service.untagPerson(event.id, personId) : service.tagPerson(event.id, personId),
    );
  const deleteEvent = (): void => {
    if (window.confirm(text.confirmDelete)) run((service) => service.deleteEvent(event.id));
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
      <button className="text-button" onClick={onBack}>{text.back}</button>
      <p className="eyebrow">{text.eyebrow}</p>
      <h1>{event.title}</h1>
      <p className="detail-time">
        {formatEventTime(event.startsAt, event.timezone)}
        {event.endsAt && ` — ${formatEventTime(event.endsAt, event.timezone)}`}
      </p>
      <p className="muted">{event.timezone} · {event.location || text.noPlace}</p>
      <p className="small muted">{text.createdBy} {memberName(event.createdBy)}</p>
      <p className="detail-notes">{event.description || text.noNotes}</p>
      {authored ? (
        <div className="actions">
          <button onClick={onEdit}>{text.edit}</button>
          <button className="danger" disabled={busy} onClick={deleteEvent}>{text.delete}</button>
        </div>
      ) : (
        <p className="small muted">{text.creatorOnly}</p>
      )}
      <div className="participants">
        <h2>{text.rsvpTitle}</h2>
        <p className="muted">{text.rsvpBody}</p>
        <div className="actions rsvp-actions">
          {rsvpButton('going')}
          {rsvpButton('interested')}
          <button disabled={busy || currentRsvp === null} onClick={(): void => respond(null)}>{text.clearRsvp}</button>
        </div>
        <p className="small" role="status">
          {text.yourResponse} {currentRsvp ? RSVP_LABELS[currentRsvp] : text.noRsvp}
        </p>
        <p className="muted small">
          {rsvps.length
            ? rsvps.map((rsvp): string => `${memberName(rsvp.userId)} · ${RSVP_LABELS[rsvp.status]}`).join(' / ')
            : text.noResponses}
        </p>
      </div>
      <div className="participants">
        <h2>{text.tagsTitle}</h2>
        <p className="muted">{text.tagsBody}</p>
        {authored ? (
          <PersonPicker
            people={snapshot.people}
            tagged={tagged}
            currentUserId={currentUserId}
            busy={busy}
            onToggle={toggleTag}
            onAddNew={addNew}
          />
        ) : (
          <p>
            {tagged.size
              ? snapshot.people.filter((person): boolean => tagged.has(person.id)).map((p) => p.displayName).join(', ')
              : text.noTags}
          </p>
        )}
      </div>
    </section>
  );
}
