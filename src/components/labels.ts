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
export const VIEWS: readonly View[] = ['events', 'calendar', 'personal', 'members', 'people'];

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
  members: {
    symbol: '◎',
    nav: 'Members',
    eyebrow: SHARED,
    title: 'Members',
    description: 'One shared group for everyone who signs up.',
    create: null,
  },
  people: {
    symbol: '◇',
    nav: 'People',
    eyebrow: 'EVERYONE WE REMEMBER',
    title: 'People',
    description: 'Members and friends without accounts. Anyone can be tagged on an event.',
    create: 'Record person',
  },
};
