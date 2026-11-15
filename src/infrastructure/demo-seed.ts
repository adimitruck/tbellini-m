import type { ArchiveEvent, Person } from '@/domain/archive';
import type { ArchiveSnapshot } from '@/domain/snapshot';

export const DEMO_USERS = ['demo-sam-user', 'demo-alex-user'] as const;
const [SAM, ALEX] = DEMO_USERS;
const SEED_TIME = '2026-10-01T12:00:00.000Z';
const CHICAGO = 'America/Chicago';

const record = { createdAt: SEED_TIME, updatedAt: SEED_TIME, provenance: 'manual' } as const;

const events: ArchiveEvent[] = [
  {
    ...record,
    id: 'demo-dinner',
    createdBy: SAM,
    title: 'A table for old friends',
    description: 'An evening to catch up, cook something good, and remember where we left off.',
    startsAt: '2026-10-09T23:30:00.000Z',
    endsAt: '2026-10-10T02:00:00.000Z',
    timezone: CHICAGO,
    location: 'At home',
  },
  {
    ...record,
    id: 'demo-walk',
    createdBy: ALEX,
    title: 'Sunday by the lake',
    description: 'Coffee, a long walk, and a little space to breathe.',
    startsAt: '2026-10-11T15:00:00.000Z',
    endsAt: null,
    timezone: CHICAGO,
    location: 'The lakefront',
  },
  {
    ...record,
    id: 'demo-music',
    createdBy: SAM,
    title: 'Live music, late night',
    description: 'Keep the setlist here after the show.',
    startsAt: '2026-10-17T01:00:00.000Z',
    endsAt: null,
    timezone: CHICAGO,
    location: 'Neighborhood venue',
  },
];

const people: Person[] = [
  { ...record, id: 'demo-sam', createdBy: SAM, memberId: SAM, displayName: 'Sam Rivera', notes: '' },
  { ...record, id: 'demo-alex', createdBy: ALEX, memberId: ALEX, displayName: 'Alex Chen', notes: '' },
  {
    ...record,
    id: 'demo-nonna',
    createdBy: SAM,
    memberId: null,
    displayName: 'Nonna Bellini',
    notes: 'Has no account yet; anyone can tag her.',
  },
];

export function seedArchive(): ArchiveSnapshot {
  return {
    events: structuredClone(events),
    people: structuredClone(people),
    tags: [
      { eventId: 'demo-dinner', personId: 'demo-sam', taggedBy: SAM, createdAt: SEED_TIME },
      { eventId: 'demo-dinner', personId: 'demo-alex', taggedBy: SAM, createdAt: SEED_TIME },
      { eventId: 'demo-dinner', personId: 'demo-nonna', taggedBy: SAM, createdAt: SEED_TIME },
    ],
    claims: [],
    members: [
      { id: SAM, displayName: 'Sam Rivera', createdAt: SEED_TIME, updatedAt: SEED_TIME },
      { id: ALEX, displayName: 'Alex Chen', createdAt: SEED_TIME, updatedAt: SEED_TIME },
    ],
    rsvps: [{ eventId: 'demo-walk', userId: SAM, status: 'interested', createdAt: SEED_TIME, updatedAt: SEED_TIME }],
  };
}
