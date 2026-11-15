'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import type { Person } from '@/domain/archive';
import { PICKER_TEXT } from './labels';

export interface PersonPickerProps {
  people: readonly Person[];
  tagged: ReadonlySet<string>;
  currentUserId: string;
  busy: boolean;
  onToggle(personId: string): void;
  /** Creates a shared Person with this name and tags it on the event. */
  onAddNew(displayName: string): void;
}

/** Tags existing people on an event, or adds a new shared Person inline and tags it. */
export function PersonPicker(props: PersonPickerProps): ReactElement {
  const { people, tagged, currentUserId, busy, onToggle, onAddNew } = props;
  const [name, setName] = useState('');
  const text = PICKER_TEXT;
  const submit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddNew(name);
    setName('');
  };
  return (
    <>
      {people.map((person): ReactElement => (
        <label className="attendee" key={person.id}>
          <input
            type="checkbox"
            checked={tagged.has(person.id)}
            disabled={busy}
            onChange={(): void => onToggle(person.id)}
          />
          <span>{person.displayName}{person.memberId === currentUserId ? text.you : ''}</span>
        </label>
      ))}
      <form className="inline-form" onSubmit={submit}>
        <label>
          {text.addLabel}
          <input
            value={name}
            maxLength={200}
            placeholder={text.addHint}
            onChange={(e): void => setName(e.target.value)}
          />
        </label>
        <button disabled={busy || !name.trim()}>{text.addButton}</button>
      </form>
    </>
  );
}
