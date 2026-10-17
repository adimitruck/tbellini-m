# Architecture

## Product and system boundaries

The product is an archive-first app, beginning with one authenticated TBellini community and Events & Calendar. Every registered account automatically joins; anonymous visitors cannot read community data. Supabase Postgres is the source of truth. Neo4j stores derived connections; graph availability must never block an event edit. Vercel runs the Next.js app. Cloudflare's worker is a reserved service boundary with a health endpoint; R2/media, queues and other Cloudflare integrations belong to later capabilities, not the M0 write path.

The application separates domain entities/validation, generic repository contracts, community- and owner-scoped archive operations, infrastructure implementations, and presentation. Shared entity metadata uses explicit interfaces and composition; introduce inheritance only when behavior is actually substitutable. Do not add a base class just to share a property. Inject repositories into services; choose provider implementations at the composition boundary. Demo and authenticated Supabase adapters must implement the same behavior.

## Current source boundaries

- `src/domain/archive.ts`: shared records, generic repositories, `ArchiveService`, validation and `personalEvents`.
- `src/domain/community.ts`: fixed community UUID, profile/membership/tag/RSVP contracts and decoders.
- `src/domain/time.ts`: recorded-zone display/calendar grouping and wall-time conversion, including historical second-level offsets. New ambiguous/skipped DST wall times are rejected; `formInstant` preserves an unchanged original instant during text-only edits, including seconds and repeated-hour identity.
- `src/infrastructure/demo.ts` and `demo-store.ts`: owner-aware repository implementations, shared browser snapshot and v1 migration.
- `src/infrastructure/supabase.ts` and `supabase-community.ts`: browser SDK adapters, scoped reads/writes and returned-row validation.
- `src/components/archive-app.tsx`: provider composition, latest-request session guards, authenticated load recovery and UI state. Event/detail/calendar/forms/member views are presentation modules.
- `src/lib/archive-config.ts` and `latest-request.ts`: shared UI/health configuration checks and session-safe asynchronous result/error guards.
- `src/infrastructure/read-all.ts`: stable-order, authorization-scoped paginated reads beyond the default 1,000-row cap.
- `src/domain/ports.ts`: `MediaStorage` and `GraphProjection` extension contracts only. They are not wired live services; the graph runner currently owns its SDK orchestration.

The app uses browser-side email/password Supabase auth. Registration is invite-only: signup collects a display name and an invite code, and the database signup trigger atomically consumes an unused, unexpired code before creating the profile and membership. Members create codes through the `create_invitation` RPC. Confirmation-required users confirm email then sign in. There is no implemented OAuth/PKCE callback, SSR archive reader, server session proxy, realtime subscription, polling, or graph-backed UI. Auth changes reload the snapshot; successful mutations reload it for the current session. Another browser's changes need a reload or local action to appear.

## Data model

| Table | Responsibility | Ownership |
| --- | --- | --- |
| `communities` / `memberships` | Fixed TBellini community and automatic registered-account enrollment | Signup trigger and service only; no client membership writes |
| `profiles` | Registered members' display names, separate from private archive people | Members read; user edits own name |
| `events` | Shared community event context and date/time | `owner_id` is immutable author; members read/create, author alone edits/deletes |
| `event_user_tags` | Author tags registered users in an event | Member reads; author manages; does not imply an RSVP |
| `event_rsvps` | Community-visible Going/Interested state feeding My Calendar | Member reads; user alone sets/clears own state |
| `people` | Basic display name and private notes | Independent owner record; not an app account |
| `event_people` | Attendance association | Composite foreign keys require both endpoints to have the same owner |
| `invitations` | Single-use signup codes with creator, expiry and consumer | RLS with no client grants; members create via `create_invitation()` RPC; signup trigger consumes |
| `graph_outbox` | Transactional ordered projection changes/tombstones | Service-role access only |
| `graph_sync_lock` | Exclusive replay mutex | Service-role RPC only |

Events and people share UUID IDs, author/owner, timestamps and manual provenance. Event visibility is community: title, description/notes, dates, timezone and location are visible to every authenticated TBellini member. Archive people and their notes/links remain private. Identity and event author/community cannot be reassigned. The community migration backfills all existing accounts and makes existing events community visible; it preserves private people/notes and attendance. SQL enforces nonempty names, date order, owner association and RLS; boundary validation additionally validates IANA timezone and length limits. Store instants as `timestamptz`, preserving the original timezone for display. Future approximate dates require a new explicit model, not a fake timestamp.

Authenticated clients use a publishable Supabase key and user session. RLS is enabled on every public table. Browser roles have no outbox, mutex or invitations table access; invite codes are generated in Postgres from `gen_random_uuid()` randomness. The sync script alone uses a service-role secret; do not place it in client bundles or application component imports. Neo4j keys are `communityId:event:id` for shared events, `communityId:profile:id` for registered profiles, and `ownerId:person:id` for private people.

## Graph consistency

Database triggers enqueue changes in the same transaction as archive writes, including cascading deletes. `scripts/sync-graph.mjs` injects queue/driver adapters into `scripts/replay-outbox.mjs`, which acquires a non-expiring database mutex, installs the unique entity-key constraint, drains pending changes by queue ID, executes parameterized idempotent Cypher, then acknowledges only that record. A failed projection stays pending. A successful graph write followed by a failed acknowledgement safely replays. Missing association endpoints fail visibly instead of silently discarding a relationship. Cleanup attempts driver close and owned-token release independently; aggregated cleanup failures retain the original replay error. An acknowledgement must confirm the exact pending record, so missing acknowledgements fail visibly.

Neo4j nodes are `ArchiveEntity:Event`, `ArchiveEntity:Profile` and private `ArchiveEntity:Person`. Registered profiles connect through separate `TAGGED_IN` and `RSVP` relationships; RSVP status is stored on the relationship. Private archive attendance uses `ATTENDED` with owner and private visibility, even when its event is shared. Only IDs, scope, visibility, display title, update timestamp and RSVP state are projected; email and private notes/descriptions stay out of Neo4j. Deleting a node detaches its relationships. This first implementation is a manually operated batch projector, not a continuously scheduled ingestion service. Crash recovery and rebuild are documented in the runbook. Never query the graph directly from an untrusted browser; a future graph reader must enforce community membership and separately enforce owner scope for every private node/relationship before serving results. Never expose private attendance through an unrestricted community event traversal. The projector understands older private outbox rows; migration snapshot changes event keys, removes legacy nodes, and requeues private relationships after endpoints.

## Extension rules

Add a capability through a domain contract, service use case, infrastructure adapter and user-facing flow. Keep provider SDKs at infrastructure boundaries. A place/media/memory feature should reuse existing IDs and associations while adding cohesive modules; do not make the event repository responsible for the whole archive. Keep secrets, graph orchestration and object storage authorization on the server or worker. Add outbox types with matching replay behavior and tests in the same change.

## Demo and presentation behavior

One local snapshot at `tbellini.community.v2` simulates Sam and Alex with a member selector. This is behavior demonstration, not a security boundary: anyone with browser storage access can inspect all demo records. Provider reads hide private people/attendance by selected owner; hosted privacy relies on Auth/RLS instead. If v2 is absent, a valid `tbellini.archive.v1` snapshot is converted to community events authored by Sam, with private people/attendance retained and no invented tags/RSVPs. The v1 key remains for recovery. Snapshot decoding validates references and unique IDs before writing; corrupt v2/legacy records and failed storage writes surface errors rather than being overwritten with samples. Reset deliberately replaces v2 with sample records.

Views are Community events, Community calendar, My calendar, TBellini users, and My archive people. Event details expose community-visible user tags/RSVPs plus author-only corrections and private archive links. Tags and event authorship do not add an event to My calendar; only the current member's Going/Interested response does. No later archive capability is implemented by these views. Graph access is an administrative projection runner only; no user-facing traversal API is present.

Paginated reads use 1,000-row ranges and stable unique ordering with authorization scope on every page. This matches the checked-in Supabase API max_rows=1000 setting. They load the full current dataset into memory and are not transactionally consistent across pages/tables; concurrent insert/delete can shift offset pages. Future large archives need explicit filtered/cursor query contracts, not just a larger cap.
