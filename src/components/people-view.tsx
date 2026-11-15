'use client';
import type { ReactElement } from 'react';
import type { Person } from '@/domain/archive';
import type { ArchiveSnapshot } from '@/domain/snapshot';
import { PEOPLE_TEXT } from './labels';

export interface PeopleViewProps {
  snapshot: ArchiveSnapshot;
  onOpen(person: Person): void;
}

/** The shared list of people: names only. Notes, links and claims appear when a person is opened. */
export function PeopleView({ snapshot, onOpen }: PeopleViewProps): ReactElement {
  return (
    <div className="people-grid">
      {snapshot.people.map((person): ReactElement => (
        <button key={person.id} className="person-card" onClick={(): void => onOpen(person)}>
          <div className="avatar">{person.displayName[0]}</div>
          <h2>{person.displayName}</h2>
        </button>
      ))}
      {!snapshot.people.length && (
        <div className="empty-state">
          <h2>{PEOPLE_TEXT.emptyTitle}</h2>
          <p>{PEOPLE_TEXT.emptyBody}</p>
        </div>
      )}
    </div>
  );
}
