import { ArchiveError, type ArchiveEvent, type Person } from './archive';

/** Messages for rule violations; adapters and the service reuse these so members see one wording. */
export const ARCHIVE_MESSAGES = {
  eventMissing: 'This event no longer exists.',
  personMissing: 'Choose an existing person.',
  recordMissing: 'This record no longer exists.',
  notCreator: 'Only the creator can change this record.',
  missingOrNotCreator: 'This record no longer exists or you are not its creator.',
  profileNotReady: 'Your TBellini profile is not ready. Apply the database migrations before using this app.',
  unreadable: 'Saved demo data could not be read. Reset the demo to restore sample records.',
} as const;

export function requireFound<T>(record: T | null | undefined, message: string): T {
  if (record === null || record === undefined) throw new ArchiveError(message);
  return record;
}

/** Creator-only edits: the one authorization rule for events and people. */
export function requireCreator(record: { createdBy: string | null }, userId: string): void {
  if (record.createdBy !== userId) throw new ArchiveError(ARCHIVE_MESSAGES.notCreator);
}

/** Only an event's creator may tag it, and only with an existing Person. */
export function requireTaggable(
  event: ArchiveEvent | null | undefined,
  person: Person | null | undefined,
  userId: string,
): void {
  requireCreator(requireFound(event, ARCHIVE_MESSAGES.eventMissing), userId);
  requireFound(person, ARCHIVE_MESSAGES.personMissing);
}

/** Anyone may RSVP to an existing event; the response is always their own. */
export function requireRsvpTarget(event: ArchiveEvent | null | undefined): void {
  requireFound(event, ARCHIVE_MESSAGES.eventMissing);
}
