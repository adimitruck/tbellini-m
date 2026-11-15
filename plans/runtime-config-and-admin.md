# Runtime configuration, feature flags and admin abilities

Status: DECIDED 2026-11-14 (section 8), scheduled AFTER go-live. Not implemented. Read-only audit of branch feature/base-tbellini-site.
Citations are path:line. "(unverified)" means not checked against a running system.

## 0. Approval needed (reverses recorded decisions)

This plan reverses two recorded decisions. The user approved the reversal on 2026-11-14, to start only after the MVP go-live (Phase 2 of plans/mvp-go-live.md) is complete.

| Recorded today | Where | Changes to |
|---|---|---|
| "There is no admin role" (2026-10-17) | project.devlang:287, :499; PROJECT_MEMORY.md:75; plans/mvp-go-live.md:16; docs/ARCHITECTURE.md:18 | Two roles: `member`, `admin`. Anyone may still create invites; only admins set a role on one |
| Creator-only edits and deletes | mvp-go-live.md:17 (MVP item 2) and section 3 "Creator-only edits"; src/domain/rules.ts:23-26, :8-9; ports.ts:4; RLS `*_creator_update/delete` at 20261017000000_shared_space.sql:256-271 | Creator OR admin edits and deletes events, people, tags and claims. RSVPs stay self-only. Identity and creator stay immutable (`prevent_*_transfer`) |
| Invitations have no client access | 20261006000003_invitations.sql:13-15 | Still no direct table access; admin-only RPCs list and revoke |
| MVP item 4 "no admin" and the go-live acceptance list | mvp-go-live.md:13-17 | Needs a replan note; the plan file is read-only during execution, so this is a separate follow-on, not an edit of the MVP plan |

Recommendation: ship the MVP first (this work is post go-live), because admin changes RLS on every table.

## 1. Audit: build-time versus runtime today

| Setting | Read at | Build or run time | Evidence |
|---|---|---|---|
| NEXT_PUBLIC_ARCHIVE_MODE | src/lib/archive-config.ts:43 | BUILD. Next replaces literal `process.env.NEXT_PUBLIC_*` in the client bundle with the value present at `next build` | comment archive-config.ts:40; docs/ARCHITECTURE.md:184 "Rebuild after changing" |
| NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | archive-config.ts:44-45 | BUILD (same reason). Changing the Supabase project means a rebuild | .env.example:1 |
| NODE_ENV | archive-config.ts:46 | BUILD (inlined) |
| /api/health | src/app/api/health/route.ts:6 calls the same `readArchiveEnvironment` | Server code, but it sees the baked values, so it can report a stale mode | route.ts:6 |
| Composition | src/app/archive-root.tsx:9-18 | Client, once per page load, from the baked values; `createArchiveRuntime` (archive-runtime.ts:20) picks adapters | archive-runtime.ts:21-32 |
| Next config | next.config.ts:2 | Has no `env`, no runtime config |  |
| SUPABASE_SERVICE_ROLE_KEY, NEO4J_*, INVITE_* | scripts/*.mjs | RUNTIME, but only for scripts and CI, never the app | .env.example:7-14; ARCHITECTURE.md:187-188 |

Only four `process.env` reads exist in `src` (archive-config.ts:43-46). Supabase project settings (site URL, SMTP, email confirmation) are dashboard values (docs/ARCHITECTURE.md:136-149, Invite flow step 4).

### Feature flags today

None. Your belief is correct. No flag table, no flag reader, no flag in the UI or domain. `NEXT_PUBLIC_ARCHIVE_MODE` is a deployment mode (demo or supabase), not a flag, and it needs a rebuild. Grep for `process.env` finds nothing else in `src`.

### Hardcoded values that should be configurable

| Value | Where | Notes |
|---|---|---|
| Invite expiry min 1, max 30, default 7 | src/domain/invite-code.ts:11; used members.ts:34-35, service.ts:124-127 | Duplicated in SQL: `create_invitation` default 7 and `between 1 and 30` (shared_space.sql:169-179). Two copies already; a runtime change must touch one |
| "expires in 7 days" copy | src/components/labels.ts:185 | A third copy; goes stale when the default changes |
| Invite code format, alphabet | invite-code.ts:6-9; SQL alphabet shared_space.sql:171; check constraint invitations.sql:6 | Format changes need a migration; keep build-time (see section 3) |
| Field limits 200, 500, 10000 | forms.tsx:56,87,95,136,140; auth.tsx:51,60; members-view.tsx:64; person-picker.tsx:45; members.ts:6; DB check on title 1-200 | Schema and HTML repeat the number. Keep as code constants, but each should come from one domain constant (cleanup, not runtime config) |
| Password minimum 8 | members.ts:39 | Supabase Auth has its own setting; the two can disagree |
| Health ping timeout 3000 ms | src/lib/health.ts:3 | Operational, leave as is |
| All UI text | src/components/labels.ts (`INVITE_TEXT` etc.) | A single module already; runtime editing of labels is not recommended (section 3) |
| Demo users, storage key `tbellini.community.v3` | infrastructure/demo*.ts | Demo only |
| Mode default `unconfigured` in production | archive-config.ts:30 | Correct safety default; keep |

## 2. Options: runtime feature flags and settings

| | A. DB table `app_settings` | B. Vercel Edge Config / Flags | C. `/api/config` route |
|---|---|---|---|
| Edit without redeploy | Yes, in-app by admins | Yes, in Vercel dashboard or API | Only if it reads some store; alone it just re-reads env |
| Fits current stack | Yes: Supabase, RLS, ports, pgTAP already here | Adds a Vercel-only dependency; repo also ships a Cloudflare worker (cloudflare/) so host lock-in is a real cost | Yes, small |
| Who can edit | Admin role, audited | Whoever has Vercel access; in-app edit needs a Vercel API token (a new secret) | n/a |
| Demo mode and tests | Same port, localStorage adapter, runs in contract suite | Needs a fake; not testable in pgTAP | Trivial |
| Latency / cost | One small read per session plus refetch | Fastest reads | One extra request |
| Works before sign-in | No (member-readable only) | Yes | Yes |
| Typing and validation | Server-side in RPC plus domain zod | Weak, free-form JSON | Whatever you build |
| Audit | Yes (section 4) | Vercel history only | No |

Recommendation: A for flags and tunable settings; plus the runtime-environment mechanism in section 3 for the Supabase connection (it is a different problem: a flag table cannot tell the app where the database is). Use Edge Config later only if a pre-sign-in kill switch is needed.

Design of A, in the project's ports style:
- `src/domain/settings.ts`: one registry, `SETTINGS = { inviteExpiryDays: {key, schema, default}, ... }`, keys written once. Flags are booleans in the same registry (`flags.*`). Labels for the admin screen come from labels.ts keyed off the registry keys, no repeated strings.
- Table `public.app_settings(key text primary key, value jsonb not null, value_type text, updated_by uuid, updated_at)`. Rows are seeded by migrations, so a new setting needs a registry entry and a migration seed. Clients cannot insert or delete keys.
- RLS: select for `has_profile()`; no insert/update/delete grants. Writes only through `set_setting(key, value)` (security definer, `is_admin()`, validates `jsonb_typeof` against `value_type`).
- Enforced limits live in SQL and are read by the RPCs: `create_invitation` reads `invite.expiry_min/max/default` from `app_settings` instead of literals 1, 30, 7. The UI reads the same rows. The TS registry default is only a fallback when a row is missing; a vitest check compares registry defaults with the migration seed (open question 3).
- Port: `SettingsRepository { list(): Promise<Setting[]>; set(key, value): Promise<void> }` added to `ArchiveRepositories` (ports.ts:47-56); demo and Supabase adapters both implement it and run in tests/contract.test.ts.
- Client cache: `ArchiveService.settings()` loads in the same `Promise.all` as the snapshot (service.ts:45-52), kept in memory, refetched on window focus and every 60 s while visible (value is a tunable, open question 4); optional Supabase Realtime later. A change reaches users within about a minute, no redeploy.
- Failure mode: if the fetch fails, keep the last good values, else use registry defaults (fail closed for risky flags, i.e. the registry default for each flag is the safe value).

## 3. Supabase URL, key and mode at runtime

What can be runtime: mode, Supabase URL, publishable key (all public by design; RLS enforces access, ARCHITECTURE.md:186).
Mechanism (recommended): read server-side env at request time and hand it to the client as props.
1. New server-only reader `readRuntimeEnvironment()` in `src/lib/` using non-prefixed names (`ARCHIVE_MODE`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`). One `ENV_NAMES` constant holds every variable name; `CONFIG_MESSAGES.unsetMode` (archive-config.ts:15, which names NEXT_PUBLIC_ARCHIVE_MODE) is built from it, so no string is duplicated.
2. `src/app/page.tsx` becomes an async server component that awaits `connection()` (or `export const dynamic = 'force-dynamic'`) so it renders per request, validates with the existing pure `archiveConfiguration` (archive-config.ts:29), and passes `{mode, supabaseUrl, supabaseKey}` to `ArchiveRoot` (archive-root.tsx:26) as props. `boot()` takes them instead of calling `readArchiveEnvironment()` at line 11.
3. Fallback order: runtime env, then the baked `NEXT_PUBLIC_*` values (kept so today's deploys and local dev keep working), then the production default `unconfigured`.
4. `/api/health` uses the same runtime reader (route.ts:6) so health matches what the page serves.
5. Alternative considered: client fetch of `/api/config` before boot. It works, costs a round trip and a loading state, and duplicates the server read; props are simpler. Choose it only if the page must stay statically cached.

Trade-offs: the page is no longer statically prerendered (negligible for a private app, one small server render per load). Changing the env var on Vercel still needs a new deployment instance or an env redeploy for the server process to see it (unverified on this host; on a long-running server it is immediate). To change values with literally no redeploy, store them in Edge Config or a host-managed runtime variable; with env vars alone "no rebuild" is true, "no redeploy" depends on the host.

Must stay build-time: the code bundle itself, `NODE_ENV`, both adapter sets (both are bundled, so mode switching works at runtime), the invite-code format and alphabet (SQL check constraint invitations.sql:6 plus domain regex), `labels.ts` copy, the secrets (service role, Neo4j: never in the browser). Switching the Supabase URL invalidates stored sessions (they are per project) and needs the new project migrated and its Auth site URL set (dashboard step, not covered by `db push`).

## 4. Admin model

Roles: `profiles.role text not null default 'member' check (role in ('member','admin'))` (recommended over an `admins` table: one column, one `is_admin()` function, no join, visible to the UI in the same profile read that already runs, members.ts:7-12 gains `role`). The existing grant `update(display_name)` on profiles (community.sql:91) already prevents clients from writing `role`; keep it so. `profiles.disabled_at timestamptz` added; `has_profile()` (shared_space.sql:8-12) also requires `disabled_at is null`, so suspending a member removes all access through every existing policy with one change.

New helper: `is_admin()` stable, security definer, `set search_path = ''`, same shape as `has_profile()`; revoke from public and anon.

First admin: add `invitations.role` (default `member`). `join_tbellini()` (shared_space.sql:136-167) copies the invitation role into the new profile. `scripts/seed-invite-core.mjs` sets `role = 'admin'` for the service-role seed invite (the one with no creator), so the first seeded member is the admin. `create_invitation` accepts a role only when `is_admin()`, otherwise forces `member`. For databases that already have members, the migration promotes the earliest profile (`order by created_at limit 1`) only if no admin exists. A trigger refuses removing or demoting the last active admin.

Policy changes (new forward migration; never edit applied ones, mvp-go-live.md:37):
| Table | Change |
|---|---|
| events (owner_id) | update and delete: `owner_id = auth.uid() or is_admin()`, both `using` and `with check`; `prevent_event_transfer` still blocks owner change |
| people | same with `created_by`; `member_id` still not client-writable; admins link or unlink through RPC `admin_link_person(person, member)` and `admin_unlink_person(person)` (reuse the merge logic in `confirm_person_claim`, shared_space.sql:212-234, which today requires `created_by = auth.uid()` and gains `or is_admin()`) |
| event_person_tags | insert: `tagged_by = auth.uid()` and (owns the event or `is_admin()`); delete: `tagged_by = auth.uid() or is_admin()` |
| person_claims | delete: existing claimant-or-creator rule plus `or is_admin()`; insert stays own-claim only |
| event_rsvps | unchanged, self-only (admin editing another member's RSVP is not proposed; open question 5) |
| invitations | still no table access. New RPCs `admin_list_invitations()` and `admin_revoke_invitation(code)`, admin only |
| profiles | no client update of role. RPCs `admin_set_member_role(member, role)` and `admin_set_member_disabled(member, bool)` with last-admin guard |
| app_settings | section 2 |
| graph | `graph_outbox` stays service-role only (shared_space.sql grants). The app only gets read-only `admin_graph_status()` (pending count, oldest unprocessed). A replay needs the service key and stays the existing manual workflow (ARCHITECTURE.md:153-160); do not put the key in the app |

Audit trail: `public.audit_log(id bigint identity, at timestamptz default now(), actor uuid references profiles on delete set null, action text, table_name text, record_id text, before jsonb, after jsonb)`. Written by an `audit_admin_write` trigger on events, people, event_person_tags, person_claims, profiles, app_settings when `is_admin()` and the actor is not the record's creator, and directly by every admin RPC. Append-only: no update or delete grant for anyone, plus a trigger that raises on update/delete. Readable by admins only through `admin_list_audit(limit, before_id)` (bounded pages). The outbox (graph_outbox) is not an audit trail: it is service-only, processed and replayable.

Code fit (ports, AuthPort, contract suite):
- `AuthPort` stays identity-only (ports.ts:75-82). Role is data, read from the profile.
- `requireCreator` (rules.ts:24) becomes `requireCreatorOrAdmin(record, actor)`; `requireTaggable`, `requireConfirmable`, `requireClaimParty` (rules.ts:29-63) use it. Message `notCreator` (rules.ts:8) becomes "Only the creator or an admin can change this record." and `missingOrNotCreator` (rules.ts:9) likewise, each once, reused by both adapters.
- `ArchiveService` private helpers `ownEvent`, `ownPerson` (service.ts:66-76) take the actor from `repositories`.
- `RepositoryFactory` (ports.ts:59) takes an `Actor { id, role }` instead of a bare id, so `SupabaseRecords` (supabase-repositories.ts:69-71, which adds `.eq(creatorColumn, userId)` to mirror RLS) drops that filter only for admins. The caller builds it after the profile loads (use-archive-session.ts:68); a role change triggers a rebuild (risk 3).
- New port `AdminRepository { listInvitations, revokeInvitation, setMemberRole, setMemberDisabled, linkPerson, unlinkPerson, listAudit, graphStatus }`, exposed on `ArchiveRepositories` only; `ArchiveService` guards each method with `requireAdmin`. RPC names go in `RPC` (supabase-schema.ts:51) next to the existing ones; no string repeated in adapters.
- Demo adapter: seed makes the first demo user (SAM) admin; same port, same rules.
- UI: an Admin view gated on `snapshot.members` role; admin controls appear on other members' records (event-detail, person-detail, members-view, invite-panel) through labels.ts keys.

## 5. Tests needed

pgTAP: new `supabase/tests/admin_rls.sql` (plus updates to the three existing files only where a seeded role matters):
- member cannot update/delete another's event or person (unchanged); admin can; admin cannot change `owner_id`/`created_by`.
- member cannot call `admin_*`, `set_setting`, `admin_list_audit`; `anon` cannot call anything; role column not writable by `update profiles`.
- last active admin cannot be demoted or disabled; disabled member reads nothing (`has_profile()` false) and cannot create invitations.
- `create_invitation` ignores a requested role for members, honours it for admins; a seed invite with `role = 'admin'` yields an admin profile through `join_tbellini()`.
- `app_settings`: members read, nobody writes directly; `set_setting` rejects wrong type and unknown key; `create_invitation` honours the stored expiry bounds.
- audit rows appear for an admin edit of another's record, not for a creator's own edit; update/delete of `audit_log` fails for everyone including admin.
- admin link/unlink person keeps one member per Person and merges the claimant's automatic Person.
Contract suite (tests/contract.test.ts, runs against demo and Supabase fake, :22-33): add cases for admin edit/delete of others' events and people, tag removal, claim rejection, non-admin refusal with the one shared message, role change with last-admin guard, settings get/set with validation, invitation list/revoke, audit listing. Extend tests/support/fake-database.ts for new tables and RPCs.
Unit: registry defaults vs migration seed, runtime env reader and fallback order (tests/archive-runtime.test.ts, tests/health.test.ts), `requireCreatorOrAdmin`, settings cache refetch and fail-closed behaviour (tests/components.test.tsx).
Docs to update after implementation: ARCHITECTURE.md sections 4-8, RUNBOOK, .env.example, PROJECT_MEMORY.md, project.devlang decisions.

## 6. Ordered implementation steps (one PR each; pilot first)

0. User approves section 0. Record the reversal in PROJECT_MEMORY.md and project.devlang (not the read-only MVP plan). Verify: written approval.
1. Pilot, runtime env: section 3 only (server reader, async `page.tsx`, props into `ArchiveRoot`, health uses it, `ENV_NAMES`). Verify: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`; run `next start` with only `ARCHIVE_MODE` and `SUPABASE_*` set, change the value and restart without rebuilding, confirm `/api/health` and the page follow it. No provisioning.
2. Migration A (roles, `is_admin()`, `disabled_at`, invitation role, `join_tbellini`, seed script role, last-admin guard) with pgTAP. Verify: `supabase db reset`, `supabase test db`.
3. Migration B (RLS widened for admin, admin RPCs, `audit_log`, triggers) with pgTAP. Verify: same, plus the non-admin regression cases.
4. Domain and ports: `role` on profile, `Actor`, `requireCreatorOrAdmin`, `AdminRepository`, demo and Supabase adapters, contract tests. Verify: contract suite green on both adapters; grep shows no duplicated message or RPC string.
5. Migration C (`app_settings`, `set_setting`, `create_invitation` reads settings) plus `SettingsRepository`, registry, cache and refetch; replace invite-code.ts:11 constants and labels.ts:185 with registry values. Verify: pgTAP, contract, changing the expiry in the table changes the UI within the refetch interval with no rebuild.
6. UI: Admin view (members and roles, invitations, flags and settings, audit, graph status) and admin controls on records. Verify: component tests; manual run in demo with the admin user.
7. Docs and validation: update the docs above; end-to-end on a local Supabase stack. Hosted run is a separate approval item (provisioning).

## 7. Risks

1. Widening RLS on every write policy is the highest-risk change; a mistake exposes edits to all members. Mitigation: pgTAP regression for every non-admin path before the UI exists.
2. Admin account compromise now means data loss for the whole group. Mitigation: audit log, disable instead of delete, last-admin guard, no hard-delete of members in the app.
3. Role changes mid-session: repositories built with a stale `Actor` would filter wrongly. Rebuild repositories on profile refetch; RLS remains the real check.
4. Settings read by SQL and TS can drift (the invite expiry already has three copies). Mitigation: SQL authoritative, UI reads rows, registry-vs-seed test.
5. Dynamic rendering of the page and env-based runtime config depend on host behavior (unverified on Vercel).
6. The shared_space migration's data-converting paths were never run on a non-empty database (ARCHITECTURE.md:208-209); new migrations stack on it.
7. Roles and admin identity are visible to every member (profiles are member-readable, shared_space.sql:253).

## 8. Decisions (user, 2026-11-14)

1. Reversal of "no admin" and "creator-only edits" approved. Timing: AFTER go-live.
2. Suspension (`disabled_at`) is included, alongside role changes and deletion.
3. SQL is the source of enforced limits and feature-flag limits; TS reads them rather than duplicating constants.
4. Flag refetch every 60 s; no Realtime.
5. Admins may NOT edit another member's RSVP or reassign a record's creator.
6. Vercel is the committed host, so Edge Config is not planned and the Cloudflare worker stays deferred.
7. Admins are visible to all members.
8. Graph management is read-only status in the app; no service-key server route.
