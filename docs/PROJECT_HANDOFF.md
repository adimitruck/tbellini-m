# Project handoff — October 6, 2026

## Goal and current product decision

Build a usable M0 Events & Calendar skeleton that future models can extend with limited supervision. Hosting/providers: Vercel, Supabase Postgres/Auth, Neo4j, Cloudflare, and GitHub Actions where needed. The user's explicit correction makes M0 one TBellini community: every registered account joins automatically; members share events/calendar, authors tag registered users, and each user chooses Going/Interested/Clear for their own calendar. Members can see each other's RSVP state. Private archive people remain separate from registered accounts.

Preserve archive-first M0 priority and capability → user-story roadmap. There is no anonymous event access, multi-community UI, social feed, or authorization to alter Linear outside tbellini-m. Registration is invite-only (single-use, expiring codes; see migration 4 below). Existing private events become community visible through the forward migration; private people/notes/links stay private. Read the latest correction in `PROJECT_MEMORY.md` before interpreting older source-transcript wording.

## Read next and document ownership

| Document | What it owns |
| --- | --- |
| [AGENTS.md](../AGENTS.md), [PROJECT_MEMORY.md](../PROJECT_MEMORY.md) | Project constraints and product decisions; required first reads |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Current responsibilities, boundaries, data/privacy and graph consistency |
| [RUNBOOK.md](RUNBOOK.md) | Exact local/hosted setup, secrets, deployment opt-ins, recovery procedures |
| [ROADMAP.md](ROADMAP.md) | M0 acceptance and preserved M1–M5 capability branches |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Small-slice execution, testing, migration and handoff discipline |
| [VALIDATION.md](VALIDATION.md) | Checks actually executed, coverage gaps and dependency findings |
| [Original transcript](conversations/2026-10-06-plan-product-features.md) | Immutable historical planning import; not an implementation specification |

## Repository state at handoff

The working branch was `feature/base-tbellini-site`; latest existing commit was `c321a04` (`Merge pull request #1 from adimitruck/adimitruck-init`). The app/infrastructure/docs changes were uncommitted and largely untracked at this snapshot; no commit, PR or deployment is claimed. Run `git status --short` and `git log -5 --oneline` before continuing because this is a snapshot, not live branch state. Original `index.html` / `web.css` are preserved historical static-site files; Next.js uses `src/app` and `src/app/globals.css`.

Dependencies are pinned in `package.json` / `package-lock.json`. Initial verified stack: Next.js 16.3.8, React 19.3.0, TypeScript 5.9.3, Supabase JS 2.117.2 / SSR 0.12.7, Neo4j driver 6.2.0, Zod 4.3.6 and Vitest 4.1.11. Recheck these files after any dependency work. Provider projects/credentials/DNS are not provisioned by the repo. The local demo server was left running during browser work; confirm its state rather than assuming a port is free. Temporary Supabase validation containers were stopped.

## Source map and contracts

| Paths | Responsibility / extension contract |
| --- | --- |
| `src/domain/archive.ts` | `ArchiveRecord`, `ArchiveEvent`, private `Person`, `Attendance`, generic `Repository<T,Input>`, `ArchiveRepositories`, `ArchiveSnapshot`, `ArchiveService`, `eventSchema`, `personSchema`, `personalEvents` |
| `src/domain/community.ts` | `TBELLINI_COMMUNITY_ID`, `UserProfile`, `CommunityMembership`, `UserTag`, `EventRsvp`, `RsvpStatus`, `CommunityRepository` and validation schemas |
| `src/domain/time.ts` | `eventDay`, `localDateTime`, `toInstant`, `formInstant`, `formatEventTime`; recorded-zone grouping, historical offsets, rejection of new DST gaps/repeats and preservation of unchanged original instants |
| `src/domain/ports.ts` | Future `MediaStorage` and `GraphProjection` interfaces; contracts only, not integrated services |
| `src/infrastructure/demo.ts`, `demo-store.ts` | Generic owner-aware demo repositories, snapshot validation, sample state, migration/reset |
| `src/infrastructure/supabase.ts`, `supabase-community.ts` | Browser Supabase adapters, row decoding, member reads/author writes/self-RSVP writes |
| `src/infrastructure/read-all.ts` | Stable-order scoped 1,000-row pagination; full in-memory datasets, not consistent transaction snapshots |
| `src/lib/archive-config.ts`, `latest-request.ts` | UI/health config readiness and suppression of stale async results/errors across sessions |
| `src/components/archive-app.tsx` | Composition/provider choice, browser auth lifecycle, member switching, snapshot/mutation state and latest-request guards |
| `src/components/event-detail.tsx`, `community-views.tsx` | Event author controls, own RSVP, registered-user tags, private links, event list/member profile editing |
| `src/components/calendar.tsx`, `forms.tsx`, `auth.tsx` | Calendar and validated forms; password signup (display name + invite code)/sign-in |
| `src/app/page.tsx`, `layout.tsx`, `globals.css`, `error.tsx` | App entry, metadata/theme and route error recovery; preserve existing warm palette |
| `src/app/api/health/route.ts` | Shared configuration readiness: 200 configured / 503 missing or invalid config; no provider requests |
| `scripts/sync-graph.mjs`, `replay-outbox.mjs`, `project-graph.mjs`, `neo4j/constraints.cypher` | Service-role ordered replay, idempotent Cypher projection and unique entity key |
| `cloudflare/worker.js`, `worker.test.mjs`, `wrangler.jsonc` | Optional `tbellini-m-edge` worker: GET `/health`, otherwise 404 |
| `.github/workflows/{ci,graph-sync,cloudflare}.yml` | Validation and separately gated manual graph/worker operations |
| `tests/{archive,community,runtime,supabase,storage-time}.test.ts`, `scripts/*.test.mjs`, `cloudflare/worker.test.mjs` | Domain/demo/time/race/config/SDK-transport tests plus graph query/replay/edge-handler checks |

`ArchiveEvent` carries immutable author `ownerId`, `communityId`, community visibility and manual provenance. Private `Person` carries owner and private visibility. Event times are ISO instants with optional end, plus original IANA timezone; free-text location is not a persistent Place entity. `ArchiveSnapshot` includes shared events/members/memberships/tags/RSVPs and only the current user's private people/attendance. `ArchiveService` validates writes and author permissions, while database policies enforce the same rules independently.

## UI and demo behavior

Views: Community events, Community calendar, My calendar, TBellini users, My archive people. Details show community event context, its author, tags and RSVP roster. Event descriptions/notes, dates and location are shared with members; archive-person notes remain private. Authors edit/delete/tag and link their private archive people; other members can only inspect and set their own RSVP. Tags and authorship do not populate My calendar. TBellini users includes own display-name editing. My archive people supports private person creation/edit/removal.

Demo storage is `tbellini.community.v2`; Sam/Alex selector changes the simulated current member while keeping a common browser dataset. If v2 is absent, valid `tbellini.archive.v1` records migrate automatically: all legacy events become Sam-authored community events, private people/attendance remain Sam's, and no tags/RSVPs are invented. The v1 key is preserved for recovery. Storage validates reference/ID integrity before writes and surfaces corruption/write failures without replacing saved data. Reset intentionally overwrites v2 with sample records, including a sample tag and RSVP. There is no demo-to-Supabase import. Demo owner filtering demonstrates behavior; localStorage is readable by anyone controlling that browser and is not a hosted security boundary.

The Supabase UI is browser-only email/password auth. Confirmation-required signup tells the user to confirm email and sign in. No OAuth/magic-link callback, SSR protected routes, server session proxy, realtime subscriptions or graph-backed screens are implemented. Other users' changes appear after snapshot reload/local actions, not automatically through realtime.

## Database and policy map

Apply migrations in order and keep applied files immutable:

1. `supabase/migrations/20261006000000_archive.sql`: original private archive tables, length/time/timezone checks, RLS, timestamps and transactional outbox.
2. `20261006000001_graph_lock.sql`: service-only non-expiring singleton replay mutex with token-owned acquire/release RPCs.
3. `20261006000002_community.sql`: forward fixed community/profile/membership/signup/backfill, community events, user tags/RSVPs, immutable identities, new queue types and endpoint-first migration snapshot.
4. `20261006000003_invitations.sql`: invite-only signup. `invitations` table (RLS, no client grants), signup trigger that atomically consumes a code, and member-only `create_invitation(expires_in_days 1–30)` RPC.

| Tables | Current access and guarantees |
| --- | --- |
| `communities`, `memberships` | Fixed UUID `00000000-0000-4000-8000-000000000001`; members read; client writes denied |
| `profiles` | Auth-user identity; members read; user updates own `display_name` only; valid signup name or neutral fallback, never copied email |
| `events` | Members read/create; creator is `owner_id`; member-author alone updates/deletes; identity/author/community immutable |
| `event_user_tags` | Members read; event author inserts/manages; composite event/community + membership FKs; no implicit RSVP |
| `event_rsvps` | Members read; current user alone inserts/updates/deletes own Going/Interested row; keys immutable |
| `people`, `event_people` | Owner-only private archive; attendance composite FKs require event author and person owner to match |
| `invitations` | RLS enabled with no browser grants; members call `create_invitation`; signup trigger records `used_at`/`used_by`; codes are single-use |
| `graph_outbox`, `graph_sync_lock` | RLS enabled with no browser grants/policies; service-role runner only |

Signup membership always uses the fixed community; untrusted metadata never chooses a role or group. Postgres is authoritative. Anonymous browser roles cannot read archive/community data. Never expose the service-role key through `NEXT_PUBLIC_*` or UI modules.

## Graph replay and recovery

Outbox rows contain immutable payload snapshots, `aggregate_type`, `aggregate_id`, owner, operation and acknowledgement time. Types are event/person/attendance/profile/user_tag/rsvp. Triggers enqueue in the write transaction, including delete tombstones. Runner acquires the global mutex, installs the unique `ArchiveEntity.key` constraint, reads pending rows ordered by ID in batches of 100, projects each, then acknowledges that exact pending ID. Driver close and own-token release are attempted independently, preserving the primary error if cleanup also fails. Graph success plus failed acknowledgement safely replays; missing endpoints fail visibly. No scheduling or production daemon is enabled.

Keys: community events `communityId:event:eventId`; registered profiles `communityId:profile:userId`; private people `ownerId:person:personId`; legacy event rows retain `ownerId:event:eventId` until conversion. Nodes are `ArchiveEntity:Event`, `:Profile`, `:Person`. Registered connections use `TAGGED_IN` and `RSVP`; private historical links use `ATTENDED` with owner/private visibility. Titles and RSVP state are projected; email, descriptions and private notes are excluded. A future graph API must separately authorize private relationships during community traversal.

The migration keeps older queue rows and appends profile/event/attendance snapshots. New projector removes a legacy private event node when converting its key, then snapshot ordering restores private attendance against the shared event. Do not resume an old runner during migration. Stop graph writers before recovery/rebuild; inspect the lock and clear it only after confirming no runner is active. The lock has no automatic expiry; a crash needs deliberate operator recovery. See `RUNBOOK.md` for lock SQL and full history replay; retaining outbox history is required for that rebuild approach.

## Commands and evidence

```sh
npm ci
cp .env.example .env.local
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npx --yes supabase@2.119.0 start
npx --yes supabase@2.119.0 db reset --local
npx --yes supabase@2.119.0 test db
npx --yes supabase@2.119.0 stop
node --env-file=.env.local scripts/sync-graph.mjs
```

Use the runbook for exact environment ownership and provider setup. Local `db reset` destroys local records. A production build can succeed without mode configuration; the running production UI then reports an error. Configure mode explicitly before deployment. Public environment values are embedded at build time; changing Vercel settings requires a new build. The graph command is an administrative runner requiring its separate service-role/Neo4j credentials, not a user-facing traversal API or a requirement for demo UI. `.env.local` is ignored; document variable names/placeholders rather than copying actual credential values into handoffs.

Last confirmed audit checks: 41 domain/demo/time/runtime/SDK-transport/storage tests, 18 projection/replay/worker tests, 40 local Postgres assertions, clean lint/types and optimized build passed. Forward migration was also applied to the old schema with synthetic account/event/person/attendance fixtures and preserved data/pending legacy rows. Demo browser smoke tests covered preserved v1 events, author tagging, shared member visibility, absent nonauthor edit controls and own RSVP-driven My calendar. Read `VALIDATION.md` for updated counts from any later audit; these figures are a dated snapshot, not complete code coverage.

## Audit corrections to preserve

The deeper audit added historical second-offset conversion and original-instant preservation during text-only edits, validated corrupt-storage/write-failure recovery, and introduced shared configuration readiness (health 503 for invalid/unconfigured state), a latest-request guard against stale session results/errors and mutation completion, authenticated load-error retry/sign-out, mobile-visible sign-out, complete paginated SDK reads, and runner cleanup that cannot skip unlock because driver close failed. The expanded unit suites passed their first run; further targeted regressions/live local checks are in progress. Consult final `VALIDATION.md` counts for the final repeat. Do not revert these fixes to the earlier skeleton's simpler behavior. Pagination assumes the checked-in 1,000-row API cap and stable authorization-scoped ordering; it is not an atomic snapshot across concurrent writes.

## Warnings and unverified work

No Vercel, hosted Supabase, Neo4j or Cloudflare deployment/account setup occurred; GitHub-hosted workflows were not executed here. Hosted signup/email/session behavior, browser RLS integration, real Neo4j connectivity/Cypher/replay failure recovery, worker deployment, DNS/TLS, backups and production monitoring remain unverified. Unit/SQL/manual demo checks do not prove every line/function, full accessibility, performance, complete timezone history, realtime consistency or complete browser regression.

Dependency review found zero production vulnerabilities and five high development-tool transitive findings through `eslint-config-next` / `micromatch` / `braces`; re-run audit before release and resolve with a compatible upstream update. Do not suppress constraints to make checks pass. Postgres timezone names and JavaScript Intl support can differ for historical aliases; returned-row validation reports unsupported values. Secrets/build/CLI caches are ignored; avoid committing `.env.local` or runtime credentials. No requested code/infra change is automatically permission to provision or deploy new external services.

## Next scoped tasks

1. Complete hosted staging M0 verification using two confirmed Supabase accounts; exercise event/tag/RSVP/private-record controls through the actual SDK and browser. Configure Vercel preview only with intended operator authorization.
2. Add automated browser regressions for auth transitions, forms, calendars, member switching, profile edits and error recovery; review keyboard/mobile/accessibility behavior. Target components/adapters in the source map rather than rewriting the app.
3. Verify actual Neo4j projection/retry/delete/rebuild in staging; extend runner orchestration coverage against real providers as needed, then choose explicit reconciliation/monitoring before enabling schedules.
4. Resolve development dependency advisories compatibly; validate lockfile/install/CI again. (`ci.yml` push filter now targets the default branch `site-code`.)
5. Establish backups, queue/lock monitoring, release/rollback practices and operational ownership. Only after M0 acceptance begin M1 places/event enrichment via new cohesive contracts/modules; R2/media starts in M2.
