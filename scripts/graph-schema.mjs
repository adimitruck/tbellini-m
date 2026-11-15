/** Single source of truth for graph vocabulary: outbox aggregate types, node labels, key format, edges. */

export const AGGREGATE = Object.freeze({
  EVENT: 'event', PERSON: 'person', PROFILE: 'profile', TAG: 'tag', RSVP: 'rsvp',
});

/** Legacy outbox types still allowed by the database check; never projected. */
export const RETIRED_AGGREGATE_REASON = Object.freeze({
  attendance: 'retired: private ATTENDED links were replaced by shared tag rows',
  user_tag: 'retired: profile tags were replaced by shared tag rows',
});

export const OPERATION = Object.freeze({ UPSERT: 'upsert', DELETE: 'delete' });

export const BASE_LABEL = 'ArchiveEntity';

/** Node aggregates: label per aggregate type. */
export const NODE_LABEL = Object.freeze({
  [AGGREGATE.EVENT]: 'Event', [AGGREGATE.PERSON]: 'Person', [AGGREGATE.PROFILE]: 'Profile',
});

export const EDGE = Object.freeze({ TAGGED_IN: 'TAGGED_IN', RSVP: 'RSVP', IS: 'IS' });

/** Node key, e.g. `event:123`. One shared space, so no owner or community prefix. */
export const nodeKey = (aggregateType, id) => `${aggregateType}:${id}`;

/** Edge aggregates: composite aggregate_id is `<event_id>:<other_id>` (see enqueue_graph_change). */
export const EDGE_AGGREGATE = Object.freeze({
  [AGGREGATE.TAG]: { edge: EDGE.TAGGED_IN, from: AGGREGATE.PERSON, fromField: 'person_id' },
  [AGGREGATE.RSVP]: { edge: EDGE.RSVP, from: AGGREGATE.PROFILE, fromField: 'user_id' },
});
