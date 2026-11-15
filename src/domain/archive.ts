import { z } from 'zod';
import { idSchema, isoTimestamp } from './primitives';

export { ArchiveError } from './primitives';

const timezoneSchema = z.string().refine((value: string): boolean => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Use a valid IANA timezone, such as America/Chicago.');

/** Every record carries its creator, who alone may edit or delete it. */
const recordFields = {
  id: idSchema,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
  provenance: z.literal('manual'),
};

const eventFields = z.object({
  title: z.string().trim().min(1, 'Give this event a title.').max(200),
  description: z.string().trim().max(10000),
  startsAt: isoTimestamp,
  endsAt: isoTimestamp.nullable(),
  timezone: timezoneSchema,
  location: z.string().trim().max(500),
});
const endsAfterStart = (event: { startsAt: string; endsAt: string | null }): boolean =>
  !event.endsAt || Date.parse(event.endsAt) >= Date.parse(event.startsAt);
const END_BEFORE_START = { message: 'The end must be at or after the start.', path: ['endsAt'] };

export const eventInputSchema = eventFields.refine(endsAfterStart, END_BEFORE_START);
export type EventInput = z.infer<typeof eventInputSchema>;
export const archiveEventSchema = eventFields
  .extend({ ...recordFields, createdBy: idSchema })
  .refine(endsAfterStart, END_BEFORE_START);
export type ArchiveEvent = z.infer<typeof archiveEventSchema>;

const personFields = z.object({
  displayName: z.string().trim().min(1, 'Enter a name.').max(200),
  notes: z.string().trim().max(10000),
});
export const personInputSchema = personFields;
export type PersonInput = z.infer<typeof personInputSchema>;
/**
 * A Person is shared by the whole group. memberId names the member the Person is, when one has claimed it;
 * createdBy is null once the creator's account is gone.
 */
export const personSchema = personFields.extend({
  ...recordFields,
  createdBy: idSchema.nullable(),
  memberId: idSchema.nullable(),
});
export type Person = z.infer<typeof personSchema>;

/** A tag points an event at a Person. It never implies an RSVP. */
export const tagSchema = z.object({
  eventId: idSchema,
  personId: idSchema,
  taggedBy: idSchema,
  createdAt: isoTimestamp,
});
export type EventPersonTag = z.infer<typeof tagSchema>;

export const tagKey = (tag: { eventId: string; personId: string }): string => `${tag.eventId}:${tag.personId}`;
