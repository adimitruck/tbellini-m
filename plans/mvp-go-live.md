# TBellini MVP go-live plan

Stable plan. Revised only by explicit replan. Progress lives in `plans/STATUS.md`.
Sources: `/Users/justinfischman/Documents/projects/tbellini-m/project.devlang` lines 379-493 (untracked, outside the repo), `.agent-context.local.md` and `.agent-setup-findings.local.md` (local, never committed), repo state at HEAD 021331b on branch `feature/shared-space-db` (main branch: `site-code`). Plan date: 2026-11-14.

Legend: **[APPROVAL]** = needs explicit user OK before it runs (any provisioning, external write, or spend). Items marked "(unverified)" were not checked against the repo or hosted systems.

## 1. Goal and MVP definition

Goal: a private, invite-only, archive-first Events and Calendar app (milestone M0) that one friend group uses on a production URL.

MVP is met when all of these hold (from project.devlang Phase 1 and Phase 2 acceptance):
1. A signed-in member sees all events, people, tags and RSVPs; a signed-out visitor sees nothing.
2. Only a record's creator edits or deletes it; RSVPs are self-only; tags never imply RSVPs.
3. A person without an account can be tagged and later linked to a new member.
4. Signup works only with a valid single-use invite code; any member can create invites; no admin.
5. No code or schema references community or membership.
6. All tests pass (unit, pgTAP, node/graph).
7. Two real accounts complete the smoke test on the production URL and the group is invited.

Out of scope for MVP: places, festivals, music, media, memories, timeline/search, extended archive (see section 9).

## 2. What is DONE

| Item | Commit | Evidence |
|---|---|---|
| Archive-first Events and Calendar MVP code, Supabase adapter, demo adapter, ports, tests | 0efc1bc | git log |
| Invite-only registration | 28a2536, 4d10e92 | git log |
| Phase 0: invite-only signup repaired, codes sealed, `create_invitation` RPC, atomic single-use consumption, random demo codes, ci.yml targets site-code, RUNBOOK first-account note | 5810760 | project.devlang:383-389; 5810760 baseline: lint, tsc, 45 vitest, node tests, next build pass; 54 pgTAP |
| Phase 1 step a: forward migration to one shared space | 021331b | `supabase/migrations/20261017000000_shared_space.sql` (274 lines added) plus `supabase/tests/{archive,community,invitations}_rls.sql`; `supabase db reset` + `supabase test db` 67/67 pass (setup context, not re-run for this plan) |
| Setup audit: CI, workflows, scripts, env vars, Node 22 | n/a | `.agent-setup-findings.local.md` (PASS list) |

Known caveat of step a: after 021331b the TypeScript domain, adapters, UI, graph code and docs still implement the OLD model, so `tsc`, vitest and `next build` are expected to FAIL until step b. Data-migrating paths in the migration (backfill Persons, convert event_people and event_user_tags) were not tested on a non-empty database; accepted as low risk because no real data exists.

Verified in this session: git log (HEAD 021331b), the five migration files exist, `join_tbellini()` at migration line 136 rejects signup without a valid invite, `create_invitation` requires `has_profile()`, `supabase/config.toml` has `[db.seed] enabled = false` and local-only auth URLs, `src/app/api/health/route.ts` exists, `plans/` did not exist.

## 3. Decisions and nuances

- **Shared-space model.** One group, one space. No community, membership, or private records. A profile means "can log in" (decided 2026-10-17; supersedes the 2026-10-06 community and private-people model).
- **Claiming (step a decisions, proposed by agent, pending user review).** Every member automatically gets a Person (`ensure_member_person()`). Path 1: an invite names a Person (`invitations.person_id`, `create_invitation(days, for_person)`); signup links it. Path 2 (schema only, no UI yet): `person_claims` plus `confirm_person_claim()`; the Person's creator confirms and the claimant's auto Person merges into the claimed one. Member tags become tags on that member's Person (`event_person_tags` replaces `event_people` and `event_user_tags`).
- **Privacy = signed-in only.** Nothing is readable without sign-in; nothing else is private (user confirmed 2026-11-14). UX nuance: members should have to make an effort to look up another member's info unless it was posted. That is a UI concern for step d, not an RLS restriction.
- **Creator-only edits and deletes.** RSVPs self-only. Tags never imply RSVPs.
- **Forward-only, immutable migrations.** Never edit an applied migration. The Phase 0 in-place edit was justified only because the broken version could never have applied. Fixes go in new migrations.
- **Demo vs supabase modes.** `NEXT_PUBLIC_ARCHIVE_MODE` = `demo` (localStorage) or `supabase`. Unset means demo in dev and a visible "unconfigured" error in production (`src/lib/archive-config.ts:4-8`). Production must set `supabase`.
- **Neo4j optional and deferrable.** Derived, rebuildable projection (outbox to `scripts/sync-graph.mjs`, manual workflow only). Graph availability never blocks a write; the browser never queries Neo4j. Phase 1 step c can follow go-live.
- **Secrets.** Service-role key, Neo4j credentials, Spotify secrets never reach the browser or any `NEXT_PUBLIC_*` var. No secrets in git.
- **Invite policy (current default).** Single-use, expiry 1-30 days (default 7). Code regex `^[A-Z0-9-]{8,12}$` (`20261006000003_invitations.sql:6`).
- **Naming debt.** `events.owner_id` vs `people.created_by` inconsistent; step b may rename.
- **Outbox check** still allows retired types `attendance` and `user_tag`; new type `tag` added.
- **Process.** Phases run in order; small pull requests; step a was the pilot; Linear changes stay inside the tbellini-m project; no commits without user request.

## 4. Phase 1 remaining steps (one PR each, in order)

### 1b. Domain, adapters, demo snapshot v3, composition root, AuthPort
- Inputs: step a migration, current `src/domain`, `src/infrastructure` (supabase and demo adapters), `src/components/archive-app.tsx`, `src/components/auth.tsx`, `src/lib`, `ports.ts`.
- Deliverables: remove `TBELLINI_COMMUNITY_ID`, `CommunityMembership`, `Attendance`; shared Person (createdBy, memberId); tags retarget Person; both adapters updated; demo snapshot v2 to v3 migration with tests; composition root moved out of `archive-app.tsx` (it imports both adapters, reads `process.env`, duplicates `new ArchiveService` and snapshot code near lines 42, 53, 85); `AuthPort` so `auth.tsx` and `archive-app.tsx` stop using concrete `SupabaseClient`; fix architecture debt in section 7; unit tests updated and added, including adapter parity tests.
- Prerequisites: step a merged or branch base. No approval needed.
- Verification: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` all pass; grep shows no `community`/`membership`/`Attendance` in `src`; demo v2 snapshot loads and migrates.
- Rollback: revert the PR; step a schema is independent and stays.

### 1c. Graph outbox types, projector, tests (deferrable until after go-live)
- Inputs: `scripts/project-graph.mjs`, `scripts/sync-graph.mjs`, `scripts/replay-outbox.mjs` and tests, outbox check in the migration.
- Deliverables: keys `event:id`, `profile:id`, `person:id`; shared Person; remove ATTENDED; add Profile-IS-Person; projector tests; rebuild notes for RUNBOOK; a forward migration if the outbox check must drop retired types.
- Prerequisites: 1b. Affects only optional Neo4j.
- Verification: `npm test` (node tests) pass; `supabase test db` pass.
- Rollback: revert PR; graph is rebuildable from Postgres.

### 1d. UI
- Inputs: 1b domain; project.devlang:Phase 1 step d.
- Deliverables: shared People page replacing "My archive people"; Person tag picker with add-new-person; remove the event private panel; labels Events, Calendar, Members; claim UI (invite names a Person at invite creation; "this is me" request and creator confirm, if path 2 is exposed); lookup-effort nuance for member info is a UI choice.
- Prerequisites: 1b.
- Verification: unit tests, build, and manual local run in demo and supabase mode (`npm run dev`, local supabase stack): tag a non-account Person, sign up with an invite naming that Person, confirm link.
- Rollback: revert PR.

### 1e. Docs
- Deliverables: see section 6. Mark Phase 1 done in project.devlang (outside repo; the user owns that file) and in `plans/STATUS.md`.
- Prerequisites: 1b and 1d (1c may be pending; say so in docs).
- Verification: grep for "community", "membership", "private people" across `docs/`, `README.md` returns only historical notes.
- Rollback: revert PR.

Phase 1 acceptance: all tests pass; no code references community or membership; behavior matches section 1 items 1-5.

## 5. Phase 2 go-live (after Phase 1 b, d, e; 1c optional)

Every step here that provisions or writes externally is **[APPROVAL]**.

### 2.1 First-invite seeding script (no approval; code only)
- Gap: on a fresh hosted DB nobody can sign up, because `join_tbellini()` needs a valid `invitations` row and `create_invitation()` needs an existing profile. `config.toml` seed is disabled.
- Deliverable: a script (preferred over manual SQL; RUNBOOK:62 suggests this) that inserts one invitation with `created_by` null, code matching `^[A-Z0-9-]{8,12}$`, `expires_at` of about 7 days, using the service role from env only; plus a RUNBOOK section. Fallback: one-time SQL in the dashboard SQL editor.
- Verification: run against the local stack; signup with that code succeeds; second use fails.
- Rollback: delete the invitation row.

### 2.2 Supabase production project **[APPROVAL]**
- Inputs: Supabase account (0 projects today), region choice, org.
- Deliverables: production project (plus a preview/branch project if wanted); `supabase link` and `supabase db push` applying all five migrations; backups confirmed.
- Prerequisites: user OK, 1b merged (schema is stable).
- Verification: `supabase migration list` shows all five applied; Dashboard table list matches; RLS enabled on all tables; run security advisor.
- Rollback: forward-only; fix with a new migration. A fresh project may be deleted before any real data exists.

### 2.3 Hosted Auth configuration **[APPROVAL]** (dashboard writes; `db push` does not apply them, `config.toml:17-25` governs only the local stack)
Values to set in Dashboard > Authentication:
- Site URL = production URL (confirmation emails link to it; the app passes no `emailRedirectTo`, `src/components/auth.tsx:29-36`).
- Redirect URL allow-list = production URL plus Vercel preview pattern `https://*-<team>.vercel.app/**`.
- Email provider enabled; Confirm email ON (matches local config); signups ENABLED (the invite gate is the DB trigger; disabling signups breaks it).
- Custom SMTP configured (built-in sender is heavily rate-limited, unusable for real invites).
- Minimum password length set.
- Verification: signup with the seeded invite sends an email whose link lands on the production URL. Rollback: revert dashboard values.

### 2.4 Seed first invite **[APPROVAL]**
Run 2.1 against production. Verify one `invitations` row exists with `used_at` null. Rollback: delete the row.

### 2.5 Vercel project and env vars **[APPROVAL]**
- Team `queen-of-hearts` (team_Ha9uJkETPIVPX2Pnc3I2E09W), 0 projects, access authorized for this session.
- Set Node 22 (no `.nvmrc`; manual dashboard setting, RUNBOOK:48; consider adding `.nvmrc`).
- Set before the first build: `NEXT_PUBLIC_ARCHIVE_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (names per `.env.example`; confirm exact names there). Do not set the service-role key unless a server route needs it.
- Note: CI `npm run build` has no `NEXT_PUBLIC_*` and builds as "unconfigured"; it does not prove a supabase-mode build. Verify the Vercel build log.
- Verification: build succeeds; production URL shows the login page, not "unconfigured". Rollback: Vercel instant rollback to a previous deployment; remove the project if needed.

### 2.6 Health ping
- Extend `src/app/api/health/route.ts` to ping Supabase (no secrets in the response; expose only ok/degraded). Add a unit test. Prerequisite: 1b. Verification: `curl <url>/api/health`.
- Optional uptime monitor later.

### 2.7 Smoke test on the live URL
Steps: sign up with the seeded invite; confirm email; create event; RSVP; open calendar; create second invite; second user signs up and sees the event; creator-only edit denied for the second user; signed-out visitor sees nothing. Acceptance: two real accounts pass, then the group is invited. Record in `docs/VALIDATION.md`.

### 2.8 Cloudflare DNS (later) **[APPROVAL]**
Point the custom domain at Vercel; update Supabase Site URL and redirect list and Vercel domain. Optional worker (`cloudflare/worker.js`, `/health`) deploys only via the repo-var-gated manual workflow. Rollback: revert DNS records.

### Phase 2 optional extras (project.devlang)
Browser tests, URL routes for event pages, backups and basic monitoring. Not required for the first smoke test; schedule after 2.7.

## 6. Documentation fixes

Another agent is rewriting `docs/ARCHITECTURE.md`; do not touch it from this plan's work. Fix in step 1e (or earlier where it prevents a wrong deployment):
- `README.md:3`: still says "one TBellini community ... Private archive people remain separate". Also note GitHub-hosted CI has never run (README:33).
- `docs/RUNBOOK.md`: line 54 "Forward community migration" describes the old model and omits `20261017000000_shared_space.sql`; add concrete hosted Auth values (section 5.3), first-invite seeding (2.1), Node 22, graph rebuild notes (1c), repository-level (not environment) gate vars for cloudflare/graph-sync workflows (lines 39, 41 already correct).
- `docs/ROADMAP.md`, `docs/PROJECT_HANDOFF.md`, `docs/VALIDATION.md`, `PROJECT_MEMORY.md` (repo root of the main checkout): move to the shared model; add a VALIDATION entry for step a and for the live smoke test. Update `AGENTS.md`-referenced memory only if the user asks.
- Never commit `.agent-*.local.md`.

## 7. Architecture debt (fix in 1b unless noted)

- `ports.ts`: `MediaStorage` and `GraphProjection` unused; remove or wire.
- Very long lines (for example `demo-store.ts:19`, 983 characters); reformat and split to near 300-line files.
- Duplicated tag and RSVP guards across the demo and supabase community adapters; extract to a shared domain rule.
- Adapter behavioral parity unverified; add shared contract tests run against both.
- Composition root and `AuthPort` (see 1b).
- Naming: `events.owner_id` vs `people.created_by` (needs a forward migration if renamed).
- Optional: no Dependabot; no `.nvmrc`.

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Hosted Supabase Auth never exercised | signup or email links fail live | do 2.3 and 2.7 early on a preview project |
| First-invite gap | nobody can sign up | 2.1 before 2.4 |
| Hosted auth config not applied by `db push` | wrong redirect URLs, rate-limited email | explicit checklist in 2.3 |
| Data-migrating paths in step a untested on non-empty DB | migration failure on a DB with data | apply to an empty prod DB; test with seeded local data if any exists |
| `tsc` and build fail between step a and 1b | broken branch | do not deploy until 1b is merged |
| CI build proves only unconfigured mode | supabase-mode build break unseen | verify Vercel build; optionally add CI build with dummy `NEXT_PUBLIC_*` |
| Immutable migrations | mistakes need forward fixes | review each migration before 2.2 |
| Email deliverability (SMTP) | invites not received | custom SMTP; test with a real inbox |
| Quality degradation in long sessions | rule drift | small PRs; fresh session when quality drops |

## 9. Deferred roadmap (project.devlang Phases 3-8)

- Past-events view, password reset (not scheduled).
- Phase 3 (M1): Place entity and picker, Festival/Series with yearly editions and child events, post-event "I went", Member and Place pages.
- Phase 4 (M2a): Spotify app, server-side search, Artist and Performance, lineup editor, setlists.
- Phase 5 (M2b): R2 media uploads, galleries.
- Phase 6 (M3): Memories, members-only graph read API, scheduled graph sync.
- Phase 7 (M4): timeline, search, paged queries.
- Phase 8 (M5): collections, astrology, historical import, approximate dates, export.

## 10. Open questions

1. Invite expiry: are single-use, 1-30 days (default 7) right? (project.devlang:484-ish)
2. "I went" records about another person: do they need that person's confirmation? (Phase 3 blocker, not MVP.)
3. Step a claiming decisions (auto Person per member; invite-names-Person; claim confirm by creator): confirm or amend.
4. Festival model: Series plus yearly editions with child events (proposed default).
5. Astrology scope (member birth charts, sky at events, both).
6. User-story IDs live in the Linear project tbellini-m, not the repo; the traceability table below uses plan step IDs and must be cross-linked to Linear by the user or with explicit permission to read Linear.
7. Production domain name and Supabase region (needed for 2.2, 2.3, 2.8).
8. Whether to add a preview Supabase project, or use one prod project only at first.

## 11. Requirements to step traceability

| Requirement | Step(s) | Acceptance check |
|---|---|---|
| Signed-in only, nothing public | 1a (done), 1b, 2.7 | pgTAP; smoke test as signed-out visitor |
| Creator-only edit/delete | 1a (done), 1b | pgTAP; adapter tests; smoke test |
| Self-only RSVP; tags do not imply RSVP | 1a, 1b | pgTAP; unit tests |
| Shared Person, non-account person taggable then linked | 1a, 1b, 1d | unit + local manual run |
| Invite-only signup, any member invites | 0 (done), 1a, 2.1, 2.4 | pgTAP; live signup |
| No community/membership references | 1a, 1b, 1e | grep in `src`, docs |
| All tests pass (unit, SQL, graph) | 1b, 1c | npm test, supabase test db |
| Demo vs supabase mode correct in prod | 2.5 | live URL not "unconfigured" |
| Hosted Auth works | 2.3, 2.7 | email link lands on prod URL |
| Two accounts smoke test on prod | 2.2-2.7 | recorded in VALIDATION.md |
| Docs match shared model | 1e, section 6 | grep |
| Secrets never in browser or git | 2.5, all | env var audit; `.gitignore` |
| Graph non-blocking, optional | 1c, section 3 | graph workflows manual only |
| Backups and monitoring | 2.2, 2.6 | dashboard check; health ping |
