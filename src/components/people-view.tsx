'use client';
import type { ReactElement } from 'react';
import type { Person } from '@/domain/archive';
import type { ArchiveService } from '@/domain/service';
import type { ArchiveSnapshot } from '@/domain/snapshot';

export interface PeopleViewProps {
  snapshot: ArchiveSnapshot;
  currentUserId: string;
  busy: boolean;
  onEdit(person: Person): void;
  run(action: (service: ArchiveService) => Promise<unknown>): void;
}

/** Shared people: everyone reads them, only a person's creator edits or deletes. */
export function PeopleView({ snapshot, currentUserId, busy, onEdit, run }: PeopleViewProps): ReactElement {
  const remove = (person: Person): void => {
    if (window.confirm('Delete this person and their event tags?')) run((service) => service.deletePerson(person.id));
  };
  return (
    <div className="people-grid">
      {snapshot.people.map((person): ReactElement => (
        <article key={person.id} className="person-card">
          <div className="avatar">{person.displayName[0]}</div>
          <h2>{person.displayName}</h2>
          <p className="muted">{person.notes || 'No notes yet.'}</p>
          <p className="small">
            {snapshot.tags.filter((tag): boolean => tag.personId === person.id).length} tagged events
            {person.memberId ? ' · TBellini member' : ''}
          </p>
          {person.createdBy === currentUserId && (
            <div className="actions">
              <button onClick={(): void => onEdit(person)}>Edit</button>
              <button disabled={busy} className="danger" onClick={(): void => remove(person)}>Delete</button>
            </div>
          )}
        </article>
      ))}
      {!snapshot.people.length && (
        <div className="empty-state">
          <h2>No one recorded yet.</h2>
          <p>Record the people in your moments, with or without an account.</p>
        </div>
      )}
    </div>
  );
}
