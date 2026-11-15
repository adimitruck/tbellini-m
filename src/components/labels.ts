/** The one module that holds the words members read. Components import these; none repeats a string inline. */
import type { RsvpStatus } from '@/domain/members';

export type View = 'events' | 'calendar' | 'personal' | 'people' | 'members';

export interface ViewLabels {
  symbol: string;
  nav: string;
  eyebrow: string;
  title: string;
  description: string;
  /** Label of the create button; null when the view creates nothing. */
  create: string | null;
}

/** Navigation order and every label of the top-level views. */
export const VIEWS: readonly View[] = ['events', 'calendar', 'personal', 'people', 'members'];

const SHARED = 'THE TBELLINI GROUP';
const SHARED_DESCRIPTION = 'Shared events from every member, all in one place.';

export const VIEW_LABELS: Record<View, ViewLabels> = {
  events: {
    symbol: '◈',
    nav: 'Events',
    eyebrow: SHARED,
    title: 'Events',
    description: SHARED_DESCRIPTION,
    create: 'Create event',
  },
  calendar: {
    symbol: '▦',
    nav: 'Calendar',
    eyebrow: SHARED,
    title: 'Calendar',
    description: SHARED_DESCRIPTION,
    create: 'Create event',
  },
  personal: {
    symbol: '◷',
    nav: 'My calendar',
    eyebrow: 'YOUR GOING & INTERESTED EVENTS',
    title: 'My calendar',
    description: 'Only events you marked Going or Interested. Tags never add events here.',
    create: 'Create event',
  },
  people: {
    symbol: '◇',
    nav: 'People',
    eyebrow: SHARED,
    title: 'People',
    description: 'Everyone in the group, with or without an account. Open a person to see more.',
    create: 'Add person',
  },
  members: {
    symbol: '◎',
    nav: 'Members',
    eyebrow: SHARED,
    title: 'Members',
    description: 'Everyone who signed up. Open a member to see what they have made.',
    create: null,
  },
};

export const MEMBER_FALLBACK = 'TBellini member';
export const RSVP_LABELS: Record<RsvpStatus, string> = { going: 'Going', interested: 'Interested' };

export const CALENDAR_TEXT = {
  monthly: 'Monthly calendar',
  previous: 'Previous month',
  next: 'Next month',
  today: 'Today',
  hint: 'Each event appears on its recorded local date.',
} as const;

export const EVENT_FORM_TEXT = {
  eyebrow: 'SHARED WITH THE GROUP',
  editTitle: 'Correct this event',
  createTitle: 'Create an event',
  title: 'Title',
  titleHint: 'What happened, or what’s coming up?',
  starts: 'Starts',
  ends: 'Ends · optional',
  timezone: 'Timezone',
  timezoneHint:
    'Times are recorded in this timezone. Repeated or skipped daylight saving times require a different time.',
  place: 'Place · optional',
  placeHint: 'A venue, a city, or a familiar place',
  notes: 'Notes · optional',
  notesHint: 'Event details visible to every member',
  saving: 'Saving…',
  save: 'Save event',
  cancel: 'Cancel',
  saveFailed: 'Unable to save this event.',
} as const;

export const PERSON_FORM_TEXT = {
  eyebrow: 'SHARED PEOPLE',
  editTitle: 'Edit person',
  createTitle: 'Add a person',
  name: 'Name',
  notes: 'Notes',
  saving: 'Saving…',
  save: 'Save person',
  cancel: 'Cancel',
  saveFailed: 'Unable to save.',
} as const;

export const EVENT_LIST_TEXT = {
  count: (n: number): string => `${n} shared events`,
  ordered: 'Ordered by event date',
  noPlace: 'Place not recorded',
  by: 'By',
  yourRsvp: 'You’re',
  noRsvp: 'No RSVP',
  youAreTagged: 'You’re tagged',
  emptyTitle: 'The next moment starts here.',
  emptyBody: 'Create the first event for the group.',
  noteTitle: 'One group, many moments.',
  noteBody: 'Choose Going or Interested to build your own calendar.',
} as const;

export const EVENT_DETAIL_TEXT = {
  confirmDelete: 'Delete this shared event for everyone?',
  back: '← Back to events',
  eyebrow: 'TBELLINI EVENT',
  noPlace: 'No place recorded',
  createdBy: 'Created by',
  noNotes: 'No event notes yet.',
  edit: 'Edit event',
  delete: 'Delete event',
  creatorOnly: 'The event creator can edit or delete this event.',
  rsvpTitle: 'Your RSVP',
  rsvpBody: 'Going or Interested adds this event to your personal calendar. You choose your own response.',
  clearRsvp: 'Clear RSVP',
  yourResponse: 'Your response:',
  noRsvp: 'No RSVP',
  noResponses: 'No responses yet.',
  tagsTitle: 'Tagged people',
  tagsBody: 'Tags connect people to this event. A tag never sets an RSVP.',
  noTags: 'No one tagged.',
} as const;

export const PICKER_TEXT = {
  you: ' (you)',
  addLabel: 'Not listed? Add a new person',
  addHint: 'Name of the person',
  addButton: 'Add and tag',
} as const;

export const PEOPLE_TEXT = {
  emptyTitle: 'No one here yet.',
  emptyBody: 'Add the people in your moments, with or without an account.',
} as const;

export const PERSON_TEXT = {
  back: '← Back to people',
  confirmDelete: 'Delete this person and their event tags?',
  noNotes: 'No notes yet.',
  linkedTo: 'Linked to member',
  noAccount: 'No account yet.',
  edit: 'Edit person',
  delete: 'Delete person',
  creatorOnly: 'The person’s creator can edit or delete them.',
  taggedEvents: 'Tagged events',
  noTags: 'Not tagged on any event.',
  claimTitle: 'Is this you?',
  claimBody: 'If you are this person, ask. Whoever added them confirms, and their tags become yours.',
  thisIsMe: 'This is me',
  claimPending: 'Your request is waiting for the creator to confirm.',
  otherClaimPending: 'You already asked to be another person.',
  withdraw: 'Withdraw request',
  claims: 'says this is them',
  confirm: 'Confirm',
  reject: 'Reject',
} as const;

export const INVITE_TEXT = {
  title: 'Invite new members',
  body: 'Generate an invitation code to share with a friend so they can join TBellini.',
  forPerson: 'Invite as',
  anyone: 'A new person',
  generate: 'Generate Invite Code',
  generating: 'Generating…',
  share: 'Share this single-use code with your friend. It expires in 7 days.',
  codeLabel: 'Invitation code',
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Copy failed. Select the code and copy it manually.',
  failed: 'Unable to generate invitation code.',
} as const;

export const MEMBERS_TEXT = {
  back: '← Back to members',
  eventsCreated: (n: number): string => `${n} events created`,
  yourName: 'Your display name',
  save: 'Save your name',
  saving: 'Saving…',
  saveFailed: 'Unable to save your profile.',
  intro: 'Everyone who signs up joins the same group.',
  you: ' (you)',
} as const;
