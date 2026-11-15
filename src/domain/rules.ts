import { ArchiveError, type ArchiveEvent, type Person, type PersonClaim } from './archive';

/** Messages for rule violations; adapters and the service reuse these so members see one wording. */
export const ARCHIVE_MESSAGES = {
  eventMissing: 'This event no longer exists.',
  personMissing: 'Choose an existing person.',
  recordMissing: 'This record no longer exists.',
  notCreator: 'Only the creator can change this record.',
  missingOrNotCreator: 'This record no longer exists or you are not its creator.',
  profileNotReady: 'Your TBellini profile is not ready. Apply the database migrations before using this app.',
  personLinked: 'This person is already linked to a member.',
  claimMissing: 'No such claim.',
  claimExists: 'You already asked to be a person. Withdraw that request first.',
  notClaimParty: 'Only the claimant or the person’s creator can withdraw a claim.',
  unreadable:'Saved demo data could not be read. Reset the demo to restore sample records.',
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

/** A Person can be named by an invitation or claimed only while no member is linked to it. */
export function requireUnlinked(person: Person | null | undefined): Person {
  const found = requireFound(person, ARCHIVE_MESSAGES.personMissing);
  if (found.memberId !== null) throw new ArchiveError(ARCHIVE_MESSAGES.personLinked);
  return found;
}

/** Only the Person's creator confirms, and only a claim that exists. */
export function requireConfirmable(
  person: Person | null | undefined,
  claims: readonly PersonClaim[],
  claimantId: string,
  userId: string,
): Person {
  const found = requireUnlinked(person);
  requireCreator(found, userId);
  const pending = claims.find((claim): boolean => claim.claimantId === claimantId && claim.personId === found.id);
  requireFound(pending, ARCHIVE_MESSAGES.claimMissing);
  return found;
}

/** A claimant withdraws their own claim; the Person's creator rejects one. */
export function requireClaimParty(person: Person | null | undefined, claimantId: string, userId: string): void {
  const found = requireFound(person, ARCHIVE_MESSAGES.personMissing);
  if (claimantId !== userId && found.createdBy !== userId) throw new ArchiveError(ARCHIVE_MESSAGES.notClaimParty);
}

/** Anyone may RSVP to an existing event; the response is always their own. */
export function requireRsvpTarget(event: ArchiveEvent | null | undefined): void {
  requireFound(event, ARCHIVE_MESSAGES.eventMissing);
}
