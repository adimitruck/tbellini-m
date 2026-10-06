'use client';
import type { ReactElement } from 'react';
import { type ArchiveEvent, type ArchiveService, type ArchiveSnapshot } from '@/domain/archive';
import type { RsvpStatus } from '@/domain/community';
import { formatEventTime } from '@/domain/time';
export interface EventDetailProps {
  event: ArchiveEvent; snapshot: ArchiveSnapshot; currentUserId: string; busy: boolean;
  onBack(): void; onEdit(): void; onRecordPerson(): void;
  run(action: (service: ArchiveService) => Promise<unknown>): void;
}
export function EventDetail({ event, snapshot, currentUserId, busy, onBack, onEdit, onRecordPerson, run }: EventDetailProps): ReactElement {
  const authored = event.ownerId === currentUserId;
  const currentRsvp = snapshot.rsvps.find((rsvp): boolean => rsvp.eventId === event.id && rsvp.userId === currentUserId)?.status ?? null;
  const tags = snapshot.tags.filter((tag): boolean => tag.eventId === event.id);
  const rsvps = snapshot.rsvps.filter((rsvp): boolean => rsvp.eventId === event.id);
  const memberName = (id: string): string => snapshot.members.find((member): boolean => member.id === id)?.displayName ?? 'TBellini member';
  const respond = (status: RsvpStatus | null): void => run((service): Promise<void> => service.respond(event.id, status));
  return <section className="event-detail">
    <button className="text-button" onClick={onBack}>← Back to events</button>
    <p className="eyebrow">TBELLINI COMMUNITY EVENT</p><h1>{event.title}</h1>
    <p className="detail-time">{formatEventTime(event.startsAt, event.timezone)}{event.endsAt && ` — ${formatEventTime(event.endsAt, event.timezone)}`}</p>
    <p className="muted">{event.timezone} · {event.location || 'No place recorded'}</p>
    <p className="small muted">Created by {memberName(event.ownerId)} · Shared with TBellini members</p>
    <p className="detail-notes">{event.description || 'No event notes yet.'}</p>
    {authored ? <div className="actions"><button onClick={onEdit}>Edit event</button><button className="danger" disabled={busy} onClick={(): void => { if (window.confirm('Delete this shared event for everyone?')) run((service): Promise<void> => service.deleteEvent(event.id)); }}>Delete event</button></div> : <p className="small muted">The event author can edit or delete this event.</p>}
    <div className="participants"><h2>Your RSVP</h2><p className="muted">Going or Interested adds this event to your personal calendar. You choose your own response.</p>
      <div className="actions rsvp-actions"><button disabled={busy} aria-pressed={currentRsvp === 'going'} className={currentRsvp === 'going' ? 'primary' : ''} onClick={(): void => respond('going')}>Going</button><button disabled={busy} aria-pressed={currentRsvp === 'interested'} className={currentRsvp === 'interested' ? 'primary' : ''} onClick={(): void => respond('interested')}>Interested</button><button disabled={busy || currentRsvp === null} onClick={(): void => respond(null)}>Clear RSVP</button></div>
      <p className="small" role="status">Your response: {currentRsvp === 'going' ? 'Going' : currentRsvp === 'interested' ? 'Interested' : 'No RSVP'}</p>
      <p className="muted small">{rsvps.length ? rsvps.map((rsvp): string => `${memberName(rsvp.userId)} · ${rsvp.status === 'going' ? 'Going' : 'Interested'}`).join(' / ') : 'No responses yet.'}</p>
    </div>
    <div className="participants"><h2>Tagged TBellini users</h2><p className="muted">Tags connect users to this event. A tag never sets an RSVP or adds an event to a personal calendar.</p>
      {authored ? snapshot.members.map((member): ReactElement => { const tagged = tags.some((tag): boolean => tag.userId === member.id); return <label className="attendee" key={member.id}><input type="checkbox" checked={tagged} disabled={busy} onChange={(): void => run((service): Promise<void> => tagged ? service.untagUser(event.id, member.id) : service.tagUser(event.id, member.id))} /><span>{member.displayName}{member.id === currentUserId ? ' (you)' : ''}</span></label>; }) : <p>{tags.length ? tags.map((tag): string => memberName(tag.userId)).join(', ') : 'No users tagged.'}</p>}
    </div>
    {authored && <div className="participants"><h2>Your private archive people</h2><p className="muted">Historical people records are separate from user accounts. These notes and links are visible only to you.</p>
      {!snapshot.people.length && <button onClick={onRecordPerson}>Record an archive person</button>}
      {snapshot.people.map((person): ReactElement => { const linked = snapshot.attendance.some((link): boolean => link.eventId === event.id && link.personId === person.id); return <label className="attendee" key={person.id}><input type="checkbox" checked={linked} disabled={busy} onChange={(): void => run((service): Promise<void> => linked ? service.removePerson(event.id, person.id) : service.addPerson(event.id, person.id))} /><span>{person.displayName}</span></label>; })}
    </div>}
  </section>;
}
