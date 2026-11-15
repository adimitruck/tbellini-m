# Project handoff — updated November 14, 2026

## Goal and current product decision

Build a usable M0 Events & Calendar app that future models can extend with limited supervision. Hosting/providers: Vercel, Supabase Postgres/Auth, Neo4j, Cloudflare, and GitHub Actions where needed.

The product is one shared space for one group (user decision of October 17, 2026). There is no community or membership entity and no private archive data: a profile means "can log in", every signed-in member reads everything, and only a record's creator edits or deletes it. People without accounts are shared Person records; a member can claim an unlinked Person and the Person's creator confirms. Event tags point at Persons and never imply an RSVP. Each member sets only their own Going/Interested RSVP and sees everyone's. Signup is invite-only: any member creates single-use, expiring codes (no admin role).

Preserve archive-first M0 priority and capability → user-story roadmap. There is no anonymous event access, social feed, or authorization to alter Linear outside tbellini-m. The October 6 community/private-people model in the source transcript and older migrations is historical; `PROJECT_MEMORY.md` records the current decision.

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

Work lives on branch `feature/shared-space-db`. The shared-space steps are committed: `021331b` (database migration and pgTAP), `f44eeb4` (justfile), `b358f28` (domain, adapters, composition root, `AuthPort`), `5c28c8f` (graph projector), `70c4c90` (first-invite seed script and Supabase health ping), `1efc757` (People page, person picker, claim flow). The next steps (local browser run, merge into `feature/base-tbellini-site`, approved provisioning) are in `plans/STATUS.md`; the stable plan is `plans/mvp-go-live.md`. Run `git status --short` and `git log -8 --oneline` before continuing because this is a snapshot, not live branch state. Original `index.html` / `web.css` are preserved historical static-site files; Next.js uses `src/app` and `src/app/globals.css`.

Dependencies are pinned in `package.json` / `package-lock.json`. Initial verified stack: Next.js 16.3.8, React 19.3.0, TypeScript 5.9.3, Supabase JS 2.117.2 / SSR 0.12.7, Neo4j driver 6.2.0, Zod 4.3.6 and Vitest 4.1.11. Recheck these files after any dependency work. Provider projects/credentials/DNS are not provisioned by the repo. The local demo server was left running during browser work; confirm its state rather than assuming a port is free. Temporary Supabase validation containers were stopped.

## Source map and contracts

| Paths | Responsibility / extension contract |
| --- | --- |
| `src/domain/archive.ts`, `members.ts`, `rules.ts`, `snapshot.ts`, `primitives.ts` | Entities and zod schemas (event, Person, tag, claim, profile, RSVP, sign-up), the shared guards (`rules.ts`, reused by both adapters), `ArchiveSnapshot` |
| `src/domain/service.ts` | `ArchiveService`: validates writes and creator permissions over the repository ports |
| `src/domain/ports.ts` | Repository ports, `AuthPort`, `RepositoryFactory`, `DemoControls` |
| `src/domain/time.ts`, `invite-code.ts` | Event-time helpers (recorded-zone grouping, historical offsets, rejection of nonexistent local times) and the invite-code format shared with the seed script |
| `src/infrastructure/demo*.ts` | Demo repositories, auth, claims, sample data, snapshot v3 validation and the v1/v2 migration chain |
| `src/infrastructure/supabase*.ts`, `read-all.ts` | Browser Supabase repositories and auth, row schemas (`CREATOR_COLUMN` maps `owner_id`/`created_by` to `createdBy`), stable-order 1,000-row pagination (full in-memory datasets, not consistent transaction snapshots) |
| `src/lib/archive-config.ts`, `archive-runtime.ts`, `health.ts`, `latest-request.ts` | Configuration readiness, the composition root (`createArchiveRuntime`), the health report and Supabase probe, suppression of stale async results |
| `src/app/archive-root.tsx`, `src/components/*` | Client entry; app shell, session hook, event/calendar/people/members views, person picker, invite panel, forms, auth; all view text in `labels.ts` |
| `src/app/page.tsx`, `layout.tsx`, `globals.css`, `error.tsx` | App entry, metadata/theme and route error recovery; preserve existing warm palette |
| `src/app/api/health/route.ts` | Readiness: 200 configured, 503 missing/invalid config or unreachable Supabase; no secrets |
| `scripts/sync-graph.mjs`, `replay-outbox.mjs`, `project-graph.mjs`, `graph-schema.mjs`, `neo4j/constraints.cypher` | Service-role ordered replay, idempotent Cypher projection, graph vocabulary and unique entity key |
| `scripts/seed-invite.mjs`, `seed-invite-core.mjs` | First-invite seeding with the service role (`just seed-invite confirm=hosted`) |
| `justfile` | Task runner for setup, run, checks, local database and hosted operations |
| `cloudflare/worker.js`, `worker.test.mjs`, `wrangler.jsonc` | Optional `tbellini-m-edge` worker: GET `/health`, otherwise 404 |
| `.github/workflows/{ci,graph-sync,cloudflare}.yml` | Validation and separately gated manual graph/worker operations |
| `tests/*.test.ts`, `scripts/*.test.mjs`, `cloudflare/worker.test.mjs` | Domain, demo, runtime, auth, components, health, SDK-boundary and adapter-contract tests (the contract runs against demo and a fake PostgREST), plus graph, replay, seed and edge-handler checks |

`ArchiveEvent` carries an immutable creator (`createdBy`), manual provenance, ISO-instant times with optional end and an original IANA timezone; free-text location is not a persistent Place entity. `Person` has a creator that may become null if the creator's profile is deleted, and an optional linked member. `ArchiveSnapshot` holds all events, people, tags, claims, profiles and RSVPs. `ArchiveService` validates writes and creator permissions, while database policies enforce the same rules independently.

## UI and demo behavior

Views, in navigation order: Events, Calendar, My calendar, People, Members (`src/components/labels.ts`). Event details show the creator, tagged people and RSVP roster. Creators edit/delete events and tag people through a person picker; other members inspect and set their own RSVP. The People view lists shared Persons; opening one (on purpose) shows notes, whether a member is linked, tagged events and claim actions. A member can request to claim an unlinked Person, cancel their request, and the Person's creator confirms or rejects. The Members view lists members and hosts the invite panel (`ArchiveService` and both adapters support display-name edits, but no component calls them) (optionally naming the Person the invitee will become). Tags and creatorship do not populate My calendar; only the member's own RSVPs do.

Demo storage is `tbellini.community.v3`; two seeded members (Sam and Alex) are switched with the demo member selector in the app header, sharing one browser dataset. Valid `tbellini.community.v2` or `tbellini.archive.v1` data migrates automatically when the newer key is absent, and the older keys are preserved for recovery. Storage validates reference/ID integrity before writes and surfaces corruption/write failures without replacing saved data. Reset overwrites the v3 key with sample records. There is no demo-to-Supabase import. Demo mode demonstrates behavior; localStorage is readable by anyone with the browser profile.

The Supabase UI is browser-only email/password auth through `AuthPort`. Confirmation-required signup tells the user to confirm email and sign in. No OAuth/magic-link callback, SSR protected routes, server session proxy, realtime subscriptions or graph-backed screens are implemented. Other users' changes appear after snapshot reload/local actions, not automatically through realtime.

## Database and policy map

Apply migrations in order and keep applied files immutable. `20261017000000_shared_space.sql` is the current model; the earlier files show the superseded one.

1. `20261006000000_archive.sql`: original archive tables, checks, RLS, timestamps and transactional outbox.
2. `20261006000001_graph_lock.sql`: service-only non-expiring singleton replay mutex with token-owned acquire/release RPCs.
3. `20261006000002_community.sql`: the superseded community/membership model, profiles, signup trigger, user tags and RSVPs.
4. `20261006000003_invitations.sql`: invite-only signup, `invitations` table (RLS, no client grants) and atomic code consumption.
5. `20261017000000_shared_space.sql`: forward migration to one shared space (drops communities, memberships, `event_people`, `event_user_tags`; adds shared Persons, `event_person_tags`, `person_claims`, claim functions, `create_invitation(expires_in_days, for_person)`).

| Tables | Current access and guarantees |
| --- | --- |
| `profiles` | Auth-user identity; signed-in profile holders read; user updates own `display_name` only; never copied email |
| `events` | Profile holders read/create; creator is `owner_id`; creator alone updates/deletes; identity/creator immutable |
| `people` | Profile holders read; creator (`created_by`) inserts/updates/deletes, clients write only `display_name` and `notes`; `member_id` (unique) is never client-writable |
| `event_person_tags` | Profile holders read; the event's creator inserts and the tagger deletes; no implicit RSVP |
| `event_rsvps` | Profile holders read; current user alone inserts/updates/deletes own Going/Interested row; keys immutable |
| `person_claims` | Profile holders read; a member inserts their own claim on an unlinked Person; claimant or the Person's creator deletes; confirmation through `confirm_person_claim` |
| `invitations` | RLS enabled with no browser grants; members call `create_invitation`; signup trigger records `used_at`/`used_by`; codes are single-use |
| `graph_outbox`, `graph_sync_lock` | RLS enabled with no browser grants/policies; service-role runner only |

Details and line references are in `docs/ARCHITECTURE.md`. Untrusted signup metadata chooses only the display name and invite code. Postgres is authoritative. Anonymous browser roles read nothing. Never expose the service-role key through `NEXT_PUBLIC_*` or UI modules.

## Graph replay and recovery

Outbox rows contain immutable payload snapshots, `aggregate_type`, `aggregate_id`, operation and acknowledgement time. Types in use are event/person/profile/tag/rsvp; `attendance` and `user_tag` are retired (still allowed by the database check, skipped by the projector with a logged reason). Triggers enqueue in the write transaction, including delete tombstones. The runner acquires the global mutex, installs the unique `ArchiveEntity.key` constraint, reads pending rows ordered by ID in batches of 100, projects each, then acknowledges and releases.

Keys (`scripts/graph-schema.mjs`): `event:<id>`, `person:<id>`, `profile:<id>`, with no owner or community prefix. Nodes are `ArchiveEntity:Event`, `:Person`, `:Profile`. Edges: `TAGGED_IN` (Person to Event), `RSVP` (Profile to Event) and `IS` (Profile to its Person). Because keys changed, a graph built by the earlier projector must be wiped and fully replayed (`docs/RUNBOOK.md`). Stop graph writers before recovery/rebuild; inspect the lock and clear it only after confirming no runner is active. The lock has no auto-expiry.

## Commands and evidence

```sh
just setup
just dev            # demo mode
just check          # lint, typecheck, tests, build
just ci             # check plus local db reset and pgTAP (needs Docker)
just dev-supabase   # app against the local Supabase stack
```

`just` wraps the npm scripts and pinned Supabase CLI commands; see `docs/RUNBOOK.md` for the full recipe table and hosted operations (all guarded by `confirm=hosted`).

Use the runbook for exact environment ownership and provider setup. Local `db reset` destroys local records. A production build can succeed without mode configuration; the running production UI then reports an error. Configure mode explicitly before deployment. Public environment values are embedded at build time; changing Vercel settings requires a new build. The graph command is an administrative runner requiring its separate service-role/Neo4j credentials, not a user-facing traversal API or a requirement for demo UI. `.env.local` is ignored; document variable names/placeholders rather than copying actual credential values into handoffs.

Latest confirmed checks (November 14, 2026, shared-space branch): lint, typecheck, 113 Vitest tests, 26 node tests and the production build pass; 67 pgTAP assertions passed at step a (`021331b`). A browser run against the local Supabase stack is pending (see `VALIDATION.md`). Earlier October counts (41 + 18 tests, 40 and 54 SQL assertions) are historical. These figures are a dated snapshot, not complete code coverage.

## Audit corrections to preserve

The deeper audit added historical second-offset conversion and original-instant preservation during text-only edits, validated corrupt-storage/write-failure recovery, and introduced shared configuration readiness (health 503 for invalid/unconfigured state), a latest-request guard against stale session results/errors and mutation completion, authenticated load-error retry/sign-out, mobile-visible sign-out, complete paginated SDK reads, and runner cleanup that cannot skip unlock because driver close failed. The expanded unit suites passed their first run; further targeted regressions/live local checks are in progress. Consult final `VALIDATION.md` counts for the final repeat. Do not revert these fixes to the earlier skeleton's simpler behavior. Pagination assumes the checked-in 1,000-row API cap and stable authorization-scoped ordering; it is not an atomic snapshot across concurrent writes.

## Warnings and unverified work

No Vercel, hosted Supabase, Neo4j or Cloudflare deployment/account setup occurred; GitHub-hosted workflows were not executed here. Hosted signup/email/session behavior, browser RLS integration, real Neo4j connectivity/Cypher/replay failure recovery, worker deployment, DNS/TLS, backups and production monitoring remain unverified. Unit/SQL/manual demo checks do not prove every line/function, full accessibility, performance, complete timezone history, realtime consistency or complete browser regression.

Dependency review found zero production vulnerabilities and five high development-tool transitive findings through `eslint-config-next` / `micromatch` / `braces`; re-run audit before release and resolve with a compatible upstream update. Do not suppress constraints to make checks pass. Postgres timezone names and JavaScript Intl support can differ for historical aliases; returned-row validation reports unsupported values. Secrets/build/CLI caches are ignored; avoid committing `.env.local` or runtime credentials. No requested code/infra change is automatically permission to provision or deploy new external services.

## Next scoped tasks

1. Finish the local-stack browser run, merge `feature/shared-space-db` into `feature/base-tbellini-site`, then, with explicit user approval, provision: Supabase project and `db push`, hosted Auth settings, first-invite seeding, Vercel project and env vars, live two-account smoke test, DNS. Order and status: `plans/STATUS.md`.
2. Add automated browser regressions for auth transitions, forms, calendars, member switching, claims and error recovery; review keyboard/mobile/accessibility behavior. Target components/adapters in the source map rather than rewriting the app.
3. Verify actual Neo4j projection/retry/delete/rebuild in staging; extend runner orchestration coverage against real providers as needed, then choose explicit reconciliation/monitoring before enabling schedules.
4. Resolve development dependency advisories compatibly; validate lockfile/install/CI again. (`ci.yml` push filter targets the default branch `site-code`.)
5. Establish backups, queue/lock monitoring, release/rollback practices and operational ownership. Only after M0 acceptance begin M1 places/event enrichment via new cohesive contracts/modules; R2/media starts in M2.
