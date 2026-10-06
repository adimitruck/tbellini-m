'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import type { ArchiveEvent, EventInput, Person, PersonInput } from '@/domain/archive';
import { localDateTime, formInstant } from '@/domain/time';
export interface EventFormProps { event?: ArchiveEvent; onSave(input: EventInput): Promise<void>; onCancel(): void }
export function EventForm({ event, onSave, onCancel }: EventFormProps): ReactElement {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const zone = event?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault(); setBusy(true); setError(''); const data = new FormData(e.currentTarget);
    const read = (key: string): string => String(data.get(key) ?? '');
    try {
      const timezone = read('timezone');
      const startsAt = formInstant(read('startsAt'), timezone, event ? { instant: event.startsAt, timezone: event.timezone } : undefined);
      const endsAt = read('endsAt') ? formInstant(read('endsAt'), timezone, event?.endsAt ? { instant: event.endsAt, timezone: event.timezone } : undefined) : null;
      await onSave({ title: read('title'), description: read('description'), location: read('location'), timezone, startsAt, endsAt });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save this event.'); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="record-form"><p className="eyebrow">SHARED WITH THE TBELLINI COMMUNITY</p><h2>{event ? 'Correct this event' : 'Create an event'}</h2>
    <label>Title<input name="title" defaultValue={event?.title} required maxLength={200} autoFocus placeholder="What happened, or what’s coming up?" /></label>
    <div className="form-grid"><label>Starts<input type="datetime-local" name="startsAt" defaultValue={event ? localDateTime(event.startsAt, zone) : ''} required /></label><label>Ends · optional<input type="datetime-local" name="endsAt" defaultValue={event?.endsAt ? localDateTime(event.endsAt, zone) : ''} /></label></div>
    <label>Timezone<input name="timezone" defaultValue={zone} required placeholder="America/Chicago" /></label><p className="muted small">Times are recorded in this timezone. Repeated or skipped daylight saving times require a different time.</p>
    <label>Place · optional<input name="location" defaultValue={event?.location} maxLength={500} placeholder="A venue, a city, or a familiar place" /></label>
    <label>Notes · optional<textarea name="description" rows={4} defaultValue={event?.description} maxLength={10000} placeholder="Event details visible to every TBellini member" /></label>
    {error && <p role="alert" className="error">{error}</p>}<div className="actions"><button disabled={busy} className="primary">{busy ? 'Saving…' : 'Save event'}</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}
export interface PersonFormProps { person?: Person; onSave(input: PersonInput): Promise<void>; onCancel(): void }
export function PersonForm({ person, onSave, onCancel }: PersonFormProps): ReactElement {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> { e.preventDefault(); setBusy(true); const data = new FormData(e.currentTarget); try { await onSave({ displayName: String(data.get('name') ?? ''), notes: String(data.get('notes') ?? '') }); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save.'); } finally { setBusy(false); } }
  return <form className="record-form" onSubmit={submit}><p className="eyebrow">YOUR PRIVATE ARCHIVE PEOPLE</p><h2>{person ? 'Edit person' : 'Record an archive person'}</h2><label>Name<input name="name" defaultValue={person?.displayName} maxLength={200} required autoFocus /></label><label>Notes<textarea rows={4} name="notes" maxLength={10000} defaultValue={person?.notes} /></label>{error && <p role="alert" className="error">{error}</p>}<div className="actions"><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save person'}</button><button type="button" onClick={onCancel}>Cancel</button></div></form>;
}
