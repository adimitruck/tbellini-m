# TBellini MVP go-live status

Update this file after every completed step, commit, or decision. `plans/mvp-go-live.md` stays stable and is revised only by explicit replan.

Last updated: 2026-11-14 (no-approval Phase 2 work done: 2.0 local spike, 2.10, 2.11 trigger, 2.12, scripts and deploy.yml written; all hosted runs pending approval)

## Next action
1. Merge `feature/shared-space-db` into `feature/base-tbellini-site` (if not already merged).
2. No-approval Phase 2 work is done (see Steps). Remaining for the user: decide `SUPABASE_ORGANIZATION_ID` and `DEPLOY_ENABLED` handling, confirm the UNCONFIRMED API shapes (spike findings), open the PR into `main`.
3. Ask the user for approval before running anything that provisions or writes externally (2.2, 2.3, 2.4, 2.5, 2.5b, 2.9 first run, 2.8), then the live smoke test (2.7).
4. Open question: the generated invite code is shown only behind a Copy button, not as text.

## Blocked on
- User review of step a claiming decisions (auto Person per member, invite names Person, creator confirms claim); the claim UI (1d) already implements them.
- User approval before any provisioning (steps 2.2, 2.3, 2.4, 2.5, 2.8).
- Pending design: `plans/runtime-config-and-admin.md` (runtime feature flags and an admin role) is being written by another agent; the 2026-10-17 "no admin role" decision is under review, not changed.

## Spike 2.0 findings (2026-11-14, local stack, Supabase CLI 2.119.0; nothing hosted touched)

CONFIRMED locally:
- `env()` substitution: with `site_url = "env(SPIKE_SITE_URL)"` the CLI start passed `GOTRUE_SITE_URL` and `GOTRUE_URI_ALLOW_LIST` to the auth container with the variable's value (checked with `docker inspect supabase_auth_tbellini-m`). The temporary config change was reverted.
- Redirect wildcard: entry `https://*-spike.vercel.app/**` made a reset email keep `redirect_to=https://abc-spike.vercel.app/`; a non-matching `https://evil.example.com/` fell back to the Site URL (no error). For Vercel previews use `https://*-<scope>.vercel.app/**`.
- Admin `createUser` with `user_metadata {display_name, invite_code}` reaches `join_tbellini()`: profile created with the display name, invitation marked used. WITHOUT an invitation row it fails (`Database error creating new user`, HTTP 500), and a reused code fails the same way. So seed-member must first insert an invitation with the service role and pass its code as `invite_code` (the trigger is not bypassed for admin calls).
- Existing email: `createUser` returns `email_exists` (code `email_exists`), which seed-member treats as "already seeded, leave unchanged".
- `supabase config push --help`: pushes only declared properties to the linked project (or branch), prompts per change unless `--yes`/`SUPABASE_YES`; `config diff` previews.

UNCONFIRMED (needs a hosted project or network access to docs; do not assume):
- That `config push` applies `[auth.email.smtp]` with `env()` on a hosted project (local `start` cannot prove push behavior; it needs a link). configure-auth is therefore built on the Management API (`PATCH /v1/projects/{ref}/config/auth`) and its field names are UNCONFIRMED.
- Management API auth field names (`site_url`, `uri_allow_list`, `smtp_*`, `password_min_length`, `mailer_autoconfirm`, `disable_signup`): written from memory of the API, UNCONFIRMED.
- Vercel env-var REST/CLI calls, project creation and Git link: UNCONFIRMED.

## Steps

| ID | Title | Status | Commit | Verified by | Date |
|---|---|---|---|---|---|
| 0 | Fix invite-only signup | done | 5810760 | lint, tsc, 45 vitest, node tests, build, 54 pgTAP | 2026-10-17 |
| 1a | Shared-space DB migration and pgTAP | done | 021331b | supabase db reset + test db 67/67 | 2026-11-14 |
| 1b | Domain, adapters, snapshot v3, composition root, AuthPort | done | b358f28 | lint, tsc, 113 vitest, 26 node, build pass (final run on this branch) | 2026-11-14 |
| 1c | Graph outbox types and projector (deferrable) | done | 5c28c8f | node tests (26 total) pass; real Neo4j not exercised; existing graphs need wipe + full replay | 2026-11-14 |
| 1d | UI: People page, tag picker, labels, claim UI | done | 1efc757 | lint, tsc, vitest, build pass; local-stack browser e2e PASS (VALIDATION.md); invite input fix bb142a6 | 2026-11-14 |
| 1e | Docs to shared model | done | 4420f00 | grep for community/membership/private people over the in-scope docs; examples checked against source | 2026-11-14 |
| 2.1 | First-invite seeding script and RUNBOOK | done | 70c4c90 (script); 4420f00 (RUNBOOK) | node tests (seed-invite.test.mjs); `just seed-invite confirm=hosted` documented; not run against hosted | 2026-11-14 |
| 2.0 | Spike: config push, Management API, redirect wildcard, createUser metadata, Vercel env calls | partial (local items 1, 3, 4 done; items 2, 5 and hosted push UNCONFIRMED) | docs(plans) spike commit | local stack, CLI 2.119.0 | 2026-11-14 |
| 2.2 | Bootstrap script, then Supabase and Vercel projects [APPROVAL to run] | script done, run pending | 5f34f3b | node tests with fake clients; dry run default; Management API/Vercel endpoints UNCONFIRMED; needs `SUPABASE_ORGANIZATION_ID` (decision) | 2026-11-14 |
| 2.3 | Migrations via deploy.yml [APPROVAL first run] | todo | | | |
| 2.4 | configure-auth script, then hosted Auth config [APPROVAL to run] | script done, run pending | 5f34f3b | node tests with fake API; Management API field names UNCONFIRMED | 2026-11-14 |
| 2.5 | seed-member script (Justin Fischman via env vars), then seed [APPROVAL to run] | script done, run pending | 5f34f3b | node tests; behavior matches local-stack spike (invitation first, then createUser); not run end to end | 2026-11-14 |
| 2.5b | Vercel settings: Git integration, Node 22, env vars, Authentication note [APPROVAL] | todo | | | |
| 2.9 | deploy.yml (db push, configure-auth, seed, health) [APPROVAL first run] | file done, first run pending | 5f34f3b | names checked against `hosted-config.mjs` by a node test; gated by `vars.DEPLOY_ENABLED == 'true'`; not run | 2026-11-14 |
| 2.10 | App passes `emailRedirectTo` from current origin | done | f6901fe | lint, tsc, 116 vitest, node tests, build | 2026-11-14 |
| 2.11 | Verify origin push access; CI triggers to `main`; PR to `main` | CI trigger done; PR not opened | 5819e6d | access confirmed earlier (permissions.push=true); PR to `main` still to open | 2026-11-14 |
| 2.12 | justfile recipes for the new steps | done | 5f34f3b | `just --dry-run` renders; `just bootstrap` without confirm refuses; also fixed `confirm=hosted` form (just passes it as one positional value) | 2026-11-14 |
| 2.6 | Health ping to Supabase | done | 70c4c90 | `tests/health.test.ts`; not run against a live project | 2026-11-14 |
| 2.7 | Live smoke test | todo | | | |
| 2.8 | Custom domain and Cloudflare DNS (deferred until a domain exists) [APPROVAL] | deferred | | | |
| D1 | Doc fixes: README, RUNBOOK, ROADMAP, PROJECT_HANDOFF, VALIDATION, PROJECT_MEMORY | done (live smoke test entry waits for 2.7) | 4420f00 | docs checked against source; local e2e result recorded in VALIDATION | 2026-11-14 |

## Change log
- 2026-11-14: Decided all 8 questions in plans/runtime-config-and-admin.md (section 8): admin + runtime settings approved, scheduled after go-live; suspension in; SQL owns limits; 60 s refetch, no Realtime; no RSVP edit or creator reassign; Vercel committed; admins visible; graph read-only. Docs only.
- 2026-11-14: Phase 2 replanned in `plans/mvp-go-live.md` (user decisions): region us-east-2; no domain, `SITE_URL` = Vercel production URL; production branch `main`, `site-code` is legacy Jekyll; scripted bootstrap, configure-auth, seed-member and deploy.yml driven by env vars; Cloudflare deferred. Docs only; nothing provisioned, no code changed.
- 2026-11-14: Local-stack browser e2e passed (signup with invite, event, RSVP, calendar, tag a new person, invite naming a Person, second signup linking to it, privacy, sign-out/in, health). One bug fixed (bb142a6). Docs committed (4420f00). Nothing provisioned.
- 2026-11-14: Steps 1b-1d, 2.1 and 2.6 committed (b358f28, 5c28c8f, 1efc757, 70c4c90) plus the justfile (f44eeb4). Docs (step 1e, D1) rewritten to the shared model; architecture debt that was fixed was removed and the remaining debt (long lines, `events.owner_id` vs `people.created_by` via `CREATOR_COLUMN`, tested-on-fake contract) kept. Local browser e2e is pending; nothing provisioned.
- 2026-11-14: Created plans/mvp-go-live.md and this file. Facts rechecked in repo: five migrations present, first-invite gap confirmed (`join_tbellini` at shared_space.sql:136, seed disabled in config.toml).
- 2026-11-14: a873b04 rewrote docs/ARCHITECTURE.md ([DB]/[code]/[planned] labels, current vs target). It records that Supabase mode in code is broken against the new migration until 1b (adapter still reads memberships, event_people, event_user_tags), so do not deploy this branch before 1b.
- 2026-11-14: 021331b committed (step a). After it, tsc/vitest/build are expected to fail until 1b.
- 2026-10-17: 5810760 (phase 0) merged.
