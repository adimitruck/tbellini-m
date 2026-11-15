'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import type { ArchiveEvent, EventInput, Person, PersonInput } from '@/domain/archive';
import { formInstant, localDateTime } from '@/domain/time';
import { EVENT_FORM_TEXT, PERSON_FORM_TEXT } from './labels';

const messageOf = (cause: unknown, fallback: string): string => (cause instanceof Error ? cause.message : fallback);

export interface EventFormProps {
  event?: ArchiveEvent;
  onSave(input: EventInput): Promise<void>;
  onCancel(): void;
}

export function EventForm({ event, onSave, onCancel }: EventFormProps): ReactElement {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const zone = event?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const text = EVENT_FORM_TEXT;
  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    const read = (key: string): string => String(data.get(key) ?? '');
    try {
      const timezone = read('timezone');
      const previousStart = event ? { instant: event.startsAt, timezone: event.timezone } : undefined;
      const previousEnd = event?.endsAt ? { instant: event.endsAt, timezone: event.timezone } : undefined;
      const startsAt = formInstant(read('startsAt'), timezone, previousStart);
      const endsAt = read('endsAt') ? formInstant(read('endsAt'), timezone, previousEnd) : null;
      await onSave({
        title: read('title'),
        description: read('description'),
        location: read('location'),
        timezone,
        startsAt,
        endsAt,
      });
    } catch (cause) {
      setError(messageOf(cause, text.saveFailed));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="record-form">
      <p className="eyebrow">{text.eyebrow}</p>
      <h2>{event ? text.editTitle : text.createTitle}</h2>
      <label>
        {text.title}
        <input
          name="title"
          defaultValue={event?.title}
          required
          maxLength={200}
          autoFocus
          placeholder={text.titleHint}
        />
      </label>
      <div className="form-grid">
        <label>
          {text.starts}
          <input
            type="datetime-local"
            name="startsAt"
            defaultValue={event ? localDateTime(event.startsAt, zone) : ''}
            required
          />
        </label>
        <label>
          {text.ends}
          <input
            type="datetime-local"
            name="endsAt"
            defaultValue={event?.endsAt ? localDateTime(event.endsAt, zone) : ''}
          />
        </label>
      </div>
      <label>
        {text.timezone}
        <input name="timezone" defaultValue={zone} required placeholder="America/Chicago" />
      </label>
      <p className="muted small">{text.timezoneHint}</p>
      <label>
        {text.place}
        <input name="location" defaultValue={event?.location} maxLength={500} placeholder={text.placeHint} />
      </label>
      <label>
        {text.notes}
        <textarea
          name="description"
          rows={4}
          defaultValue={event?.description}
          maxLength={10000}
          placeholder={text.notesHint}
        />
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions">
        <button disabled={busy} className="primary">{busy ? text.saving : text.save}</button>
        <button type="button" onClick={onCancel}>{text.cancel}</button>
      </div>
    </form>
  );
}

export interface PersonFormProps {
  person?: Person;
  onSave(input: PersonInput): Promise<void>;
  onCancel(): void;
}

export function PersonForm({ person, onSave, onCancel }: PersonFormProps): ReactElement {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const text = PERSON_FORM_TEXT;
  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      await onSave({ displayName: String(data.get('name') ?? ''), notes: String(data.get('notes') ?? '') });
    } catch (cause) {
      setError(messageOf(cause, text.saveFailed));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="record-form" onSubmit={submit}>
      <p className="eyebrow">{text.eyebrow}</p>
      <h2>{person ? text.editTitle : text.createTitle}</h2>
      <label>
        {text.name}
        <input name="name" defaultValue={person?.displayName} maxLength={200} required autoFocus />
      </label>
      <label>
        {text.notes}
        <textarea rows={4} name="notes" maxLength={10000} defaultValue={person?.notes} />
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions">
        <button className="primary" disabled={busy}>{busy ? text.saving : text.save}</button>
        <button type="button" onClick={onCancel}>{text.cancel}</button>
      </div>
    </form>
  );
}
