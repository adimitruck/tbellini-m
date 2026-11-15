# Architecture

This document describes TBellini as implemented. The database, the TypeScript code in `src/`, the graph scripts and
the UI all use the shared-space model. Statements carry one of three labels:

- **[DB]** implemented in `supabase/migrations/` (through `20261017000000_shared_space.sql`).
- **[code]** implemented in `src/`, `scripts/`, `cloudflare/` or `.github/`.
- **[planned]** not implemented yet (hosting, Spotify, media).

Read the migrations, not memory, when in doubt: they are the source of truth for data and access rules.

## 1. Product model

- **[DB]** One shared group. There is no community, membership or per-person privacy. A `profiles` row means
  "can log in". Every signed-in user with a profile reads everything; only a record's creator edits or deletes it
  (`supabase/migrations/20261017000000_shared_space.sql:3-5`, `:252-271`).
- **[DB]** Signup is invite-only (`20261006000003_invitations.sql`, `join_tbellini()` redefined in the shared-space
  migration at `:136-166`). Any member can create an invite; there is no admin role (`create_invitation`, `:169-203`).
- **[DB]** RSVPs are self-only. Tags point at a Person and never imply an RSVP (`:84-85`, `:265-268`).
- **[code]** UI nuance: another member's details are reached on purpose (People and Members views, then a detail
  page) rather than shown inline. This is a UI choice (`src/components/person-detail.tsx`), not an RLS restriction.

## 2. System context

```mermaid
flowchart LR
  User([Member browser]) -->|HTTPS| Vercel[Next.js app on Vercel]
  User -. optional edge .-> CF[Cloudflare DNS + optional Worker]
  Vercel -->|Supabase JS: Auth + PostgREST, publishable key + user session| SB[(Supabase: Postgres, Auth, RLS)]
  SB -->|triggers write| Outbox[graph_outbox table]
  GH[GitHub Actions: manual graph-sync] -->|service_role key| Outbox
  GH -->|Bolt| Neo[(Neo4j Aura, optional)]
  Spotify[Spotify, later] -.-> Vercel
```

Hosting status:

| Component | Role | Status |
| --- | --- | --- |
| Next.js 16 app (`package.json`: `next` 16.3.8) | UI; single client component tree, one API route (`/api/health`) | [code] runs locally; **not deployed** |
| Vercel | Hosts the app | [planned] no project exists yet (Phase 2) |
| Supabase | Postgres, Auth, RLS: the source of truth | [DB] migrations and pgTAP tests exist; **no hosted project exists** (Phase 2) |
| Cloudflare | DNS (later) and an optional Worker `cloudflare/worker.js` that only serves `GET /health`; deployed by a manual workflow gated on `vars.CLOUDFLARE_DEPLOY_ENABLED` (`.github/workflows/cloudflare.yml`) | [code] worker and workflow; nothing deployed |
| Neo4j Aura | Optional derived graph, replayed from the outbox | [code] projector and manual workflow gated on `vars.NEO4J_SYNC_ENABLED` (`.github/workflows/graph-sync.yml`); no instance |
| Spotify | Music integration | [planned] (M2a); no code |
| Media storage (R2) | Object storage for media | [planned] (M2b); no port or code exists yet (the unused `MediaStorage` interface was removed) |

## 3. Repository layout

| Path | Contents |
| --- | --- |
| `src/app/` | Next.js App Router: `layout.tsx`, `page.tsx`, `error.tsx`, `api/health/route.ts` |
| `src/app/archive-root.tsx` | Client entry: builds the runtime once in the browser and renders `ArchiveApp` or a configuration error |
| `src/components/` | React UI: `archive-app.tsx`, `use-archive-session.ts`, `auth.tsx`, `calendar.tsx`, `event-list.tsx`, `event-detail.tsx`, `forms.tsx`, `people-view.tsx`, `person-detail.tsx`, `person-picker.tsx`, `members-view.tsx`, `invite-panel.tsx`, `labels.ts` (all view labels) |
| `src/domain/` | Pure domain: `archive.ts` (events, people, tags, claims), `members.ts` (profiles, RSVPs, sign-up schema), `rules.ts` (shared guards), `service.ts` (`ArchiveService`), `snapshot.ts`, `ports.ts`, `primitives.ts`, `invite-code.ts`, `time.ts` |
| `src/infrastructure/` | Adapters. Demo: `demo.ts`, `demo-store.ts`, `demo-auth.ts`, `demo-claims.ts`, `demo-seed.ts`, `demo-migration.ts`. Supabase: `supabase.ts` (barrel), `supabase-repositories.ts`, `supabase-auth.ts`, `supabase-schema.ts`. Shared: `read-all.ts` |
| `src/lib/` | `archive-config.ts` (run-mode resolution), `archive-runtime.ts` (composition root), `health.ts` (readiness report and Supabase probe), `latest-request.ts` |
| `supabase/migrations/`, `supabase/tests/` | Schema, RLS, functions; pgTAP tests |
| `scripts/` | Outbox replay and graph projection (`sync-graph.mjs`, `replay-outbox.mjs`, `project-graph.mjs`, `graph-schema.mjs`) and first-invite seeding (`seed-invite.mjs`, `seed-invite-core.mjs`) |
| `justfile` | Task runner: setup, run, checks, local database, hosted operations (see `docs/RUNBOOK.md`) |
| `neo4j/constraints.cypher`, `cloudflare/` | Graph constraint; optional edge worker |
| `tests/` | Vitest suites; `tests/contract.test.ts` runs one behavioural contract against the demo adapter and the Supabase adapter (over an in-memory fake PostgREST in `tests/support/fake-database.ts`) |

## 4. Layering

[code]

```
components (UI)  ->  ArchiveRuntime (composition root)  ->  ArchiveService (domain)  ->  ports
                          |                                                               ^
                          +-> demo adapters | supabase adapters  -------------------------+
                          +-> config (archive-config)
```

- The domain is pure: entities, zod schemas, time rules, shared guards (`rules.ts`) and `ArchiveService`
  (`src/domain/service.ts`) import no framework, storage or network code. Both adapter sets reuse the same guards.
- `src/domain/ports.ts` declares the repositories (`Repository`, `TagRepository`, `RsvpRepository`, `MemberRepository`,
  `ClaimRepository`, `InvitationRepository`), `ArchiveRepositories`, `RepositoryFactory`, `AuthPort` and `DemoControls`.
- Two adapter sets implement them: demo (`localStorage`, `DemoAuth`) and Supabase (`SupabaseAuth`,
  `createSupabaseRepositories`). `tests/contract.test.ts` holds them to one behaviour; the Supabase side runs over a fake
  database, not real Postgres, so RLS itself is proven only by pgTAP.
- `createArchiveRuntime` (`src/lib/archive-runtime.ts`) is the single place that reads configuration and picks the
  adapter set. `src/app/archive-root.tsx` builds it once in the browser. Components receive the runtime, never read
  `process.env` (only `readArchiveEnvironment` does) and do not import adapters.
- The browser session lives in the Supabase client (`createArchiveClient`, `src/infrastructure/supabase.ts`); components see only `AuthPort`.
- Demo storage is snapshot v3 (`tbellini.community.v3`); `demo-migration.ts` upgrades v2 and v1 data.

## 5. Data model [DB]

Authoritative: the migrations in order `20261006000000_archive.sql`, `…01_graph_lock.sql`, `…02_community.sql`,
`…03_invitations.sql`, `20261017000000_shared_space.sql`. The last is forward-only; earlier files still show the old model.

| Table | Key columns (after shared-space) | Notes |
| --- | --- | --- |
| `profiles` | `id` (= `auth.users.id`), `display_name`, timestamps | Created by the signup trigger. Presence means "can log in" (`has_profile()`, shared_space `:8-12`). Identity immutable (`…02:44-50`) |
| `events` | `id`, `owner_id` (creator, -> `auth.users`), `title` (1-200), `description`, `starts_at`, `ends_at`, `timezone` (validated), `location`, `provenance` (`manual`), timestamps | `community_id` and `visibility` dropped (`:120-123`). Identity and creator immutable (`:124-131`). Note the naming: events use `owner_id`, people use `created_by` |
| `people` | `id`, `display_name`, `notes`, `created_by` (-> `profiles`, nullable on profile delete), `member_id` (unique -> `profiles`), `provenance`, timestamps | The shared Person. People without accounts are Persons with null `member_id`. `owner_id` and `visibility` dropped (`:51-58`). Creator can become null, never be reassigned (`prevent_person_transfer`, `:60-69`) |
| `event_person_tags` | PK (`event_id`, `person_id`), `tagged_by`, `created_at` | Replaces `event_people` and `event_user_tags` (data converted, old tables dropped, `:84-103`). A tag never implies an RSVP |
| `event_rsvps` | PK (`event_id`, `user_id`), `status` (`going` or `interested`), timestamps | `community_id` dropped (`:105-110`). Identity immutable (`prevent_connection_transfer`, `:111-118`) |
| `invitations` | `code` (`^[A-Z0-9-]{8,12}$`), `created_by`, `expires_at`, `used_at`, `used_by`, `person_id` | No client access at all (`…03:13-15`). `person_id` added at shared_space `:134` |
| `person_claims` | PK (`person_id`, `claimant_id`), `claimant_id` unique | Claiming path 2 (`:206-211`). The UI requests and cancels claims; the Person's creator confirms through RPC `confirm_person_claim` (`person-detail.tsx`, `supabase-repositories.ts`) |
| `graph_outbox` | `id`, `owner_id`, `aggregate_type`, `aggregate_id`, `operation`, `payload`, `created_at`, `processed_at` | Service role only. Types allowed: `event, person, attendance, profile, user_tag, rsvp, tag` (`:16-18`); `attendance` and `user_tag` are retired but still permitted |
| `graph_sync_lock` | single-lock table | Service role only (`…01:3-9`) |

Removed by the shared-space migration: `communities`, `memberships`, `event_people`, `event_user_tags`, `is_community_member()` (`:102-103`, `:237-239`).

Functions (all `set search_path = ''`):

- `has_profile()`: used by every RLS policy.
- `join_tbellini()`: after-insert trigger on `auth.users` (`auth_join_tbellini`, `…02:21`).
- `create_invitation(expires_in_days default 7, for_person default null)`: executable by `authenticated` only.
- `ensure_member_person(uuid)`: service role only; every member gets a Person (default; the body is the one place to change this).
- `confirm_person_claim(claimed_person, claimant)`: creator of an unlinked Person confirms and merges.
- `enqueue_graph_change()`, `touch_updated_at()`, `prevent_*_transfer()`: triggers.
- `acquire_graph_sync_lock(uuid)`, `release_graph_sync_lock(uuid)`: service role only.

## 6. Auth, RLS and invite flow

### Row-level security [DB]

All policies are `to authenticated`, so `anon` reads nothing. See `shared_space.sql:252-271`.

| Table | Read | Insert | Update / delete |
| --- | --- | --- | --- |
| `profiles` | any profile holder | none (trigger only) | none (no policy) |
| `events` | any profile holder | `owner_id = auth.uid()` | creator only |
| `people` | any profile holder | `created_by = auth.uid()` | creator only; clients may update only `display_name`, `notes` (`:243-245`); `member_id` is never client-writable |
| `event_person_tags` | any profile holder | `tagged_by = auth.uid()` **and** caller owns the event | delete by `tagged_by`; no update grant |
| `event_rsvps` | any profile holder | own `user_id` | own `user_id` |
| `person_claims` | any profile holder | own claim on an unlinked Person | claimant or the Person's creator may delete |

Access is verified by pgTAP: `supabase/tests/archive_rls.sql`, `community_rls.sql`, `invitations_rls.sql`
(67/67 passing per the project context; run by the `database` job in `.github/workflows/ci.yml`).
The three test files predate the rename but run against the migrated schema.

### Invite flow

1. [DB] A member calls RPC `create_invitation` (code format `XXXX-XXXX`, alphabet without ambiguous characters, 1-30 days,
   optionally naming an unlinked Person to claim).
2. [code] The sign-up form (`src/components/auth.tsx`) calls `AuthPort.signUp`; `SupabaseAuth` (`supabase-auth.ts`) sends
   `invite_code` and `display_name` as user metadata and uses password sign-in for login. Members create codes from the
   invite panel (`invite-panel.tsx`) through `InvitationRepository.generate`, which calls `create_invitation`.
3. [DB] The `auth.users` insert trigger `join_tbellini()` atomically marks the invite used; an invalid, used or expired
   code raises and the signup fails. It then creates the profile and links the named Person (or creates a new one).
4. [code] The first user cannot sign up without an invite, so `scripts/seed-invite.mjs` (service role, from `.env.local`;
   `just seed-invite confirm=hosted`) inserts one invitation with no creator. Hosted Auth settings (site URL, redirect
   URLs, email confirmation, SMTP) are dashboard settings that `db push` does not apply; values are in `docs/RUNBOOK.md`
   and have never been exercised against a hosted project.

There is no server-side session handling: the browser client (`createArchiveClient`, `@supabase/ssr`
`createBrowserClient`) holds the session, and there is no middleware or server component auth. [code]

## 7. Outbox to graph flow

1. [DB] Row triggers on `events`, `people`, `profiles`, `event_person_tags` and `event_rsvps` call `enqueue_graph_change()`
   (`shared_space.sql:19-30`, `:95`; `…02:129-131`), inserting into `graph_outbox` in the same transaction as the change.
2. [code] `scripts/sync-graph.mjs` (run manually via the `Replay archive graph` workflow, `workflow_dispatch` only) uses the
   service role key to take `acquire_graph_sync_lock`, read up to 100 pending rows in `id` order, project each into Neo4j
   (`scripts/project-graph.mjs`), set `processed_at`, then release the lock. `scripts/replay-outbox.mjs` holds the replay loop.
3. Neo4j is a replayable projection. Postgres stays authoritative; the app never reads Neo4j.
4. [code] `scripts/graph-schema.mjs` is the one home for aggregate types, labels, edges and the node key format
   (`event:<id>`, `person:<id>`, `profile:<id>`; no owner or community prefix). The projector handles `event`, `person`,
   `profile`, `tag` (edge `TAGGED_IN`) and `rsvp` (edge `RSVP`), links a Profile to its Person (`IS`), and skips the retired
   `attendance` and `user_tag` types with a logged reason instead of failing. Because node keys changed, a graph built by
   the old projector must be wiped and fully replayed (`docs/RUNBOOK.md`, Neo4j projection).

## 8. Run modes and environment variables

`NEXT_PUBLIC_ARCHIVE_MODE` selects the mode (`src/lib/archive-config.ts:5-11`):

| Value | Behaviour [code] |
| --- | --- |
| `demo` | Data in browser `localStorage` (key `tbellini.community.v3`, `demo-migration.ts:9`), two seeded demo users, no network |
| `supabase` | Real mode. Requires URL and publishable key, valid http(s) URL; otherwise a configuration error |
| unset | `demo` when `NODE_ENV` is not `production`; `unconfigured` error in production |
| anything else | `unconfigured` error |

`GET /api/health` (`src/app/api/health/route.ts`, logic in `src/lib/health.ts`) reports `ok`, `configuration_required`
(503) or `unavailable` (503, reason `supabase_unreachable`). In supabase mode it sends a `HEAD /rest/v1/` with the
publishable key and a 3-second timeout; any answer below 500 counts as up. The response never contains URLs, keys or errors.

| Variable | Used by | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_ARCHIVE_MODE` | app, health route | Build-time, browser-visible. Rebuild after changing |
| `NEXT_PUBLIC_SUPABASE_URL` | app, health route, `sync-graph.mjs` | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app, health route | Public; RLS and the user session enforce access |
| `SUPABASE_SERVICE_ROLE_KEY` | `sync-graph.mjs` only | Secret; never `NEXT_PUBLIC_`, never on Vercel |
| `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE` | `sync-graph.mjs` only | Secrets (database defaults to `neo4j`) |

Template: `.env.example`. In the graph workflow the URL comes from `vars.SUPABASE_URL` and the secrets from GitHub
`production` environment secrets.

Local verification commands (`package.json`): `npm run lint`, `typecheck`, `test` (vitest plus node tests for graph scripts and
the worker), `build`; the `database` CI job runs `supabase db reset` and `supabase test db`.

## 9. Known architectural debt

The shared-space refactor removed the earlier items (no composition root, no `AuthPort`, unused ports, duplicated guards,
unverified adapter parity). What remains:

- Long lines: 78 lines over 120 characters remain (src 16, scripts 24, tests 36, cloudflare 2; the largest are the
  minified `src/app/globals.css:1` and `src/domain/time.ts`, `src/app/error.tsx:4`, `scripts/project-graph.mjs:29`).
- Naming: `events.owner_id` versus `people.created_by` [DB]. The code hides it behind `CREATOR_COLUMN`
  (`src/infrastructure/supabase-schema.ts:33`), which maps both to the domain's `createdBy`. Removing the split needs a forward migration.
- The outbox check constraint still permits the retired types `attendance` and `user_tag` [DB]; the projector skips them.
- The Supabase contract test runs over an in-memory fake, so adapter-to-Postgres behaviour is covered only by pgTAP and
  the pending local-stack browser run (`docs/VALIDATION.md`).
- The data-migrating paths of the shared-space migration (Person backfill, conversion of `event_people` and
  `event_user_tags`) were never tested on a non-empty database [DB].
- Real-mode flows have never run against a hosted Supabase project.
- No `.nvmrc`; Node 22 on Vercel is a dashboard setting. No Dependabot.
