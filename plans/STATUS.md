# TBellini MVP go-live status

Update this file after every completed step, commit, or decision. `plans/mvp-go-live.md` stays stable and is revised only by explicit replan.

Last updated: 2026-11-14 (steps 0-1e, 2.1, 2.6 and D1 done; Phase 2 replanned)

## Next action
1. Merge `feature/shared-space-db` into `feature/base-tbellini-site` (if not already merged).
2. Run the no-approval Phase 2 work in this order: spike 2.0 (local stack), then 2.11 (verify push access to origin `adimitruck/tbellini-m`, move CI triggers from `site-code` to `main`), 2.10 (`emailRedirectTo`), 2.12 (justfile recipes), and write the scripts and `deploy.yml` (2.2, 2.4, 2.5, 2.9).
3. Ask the user for approval before running anything that provisions or writes externally (2.2, 2.3, 2.4, 2.5, 2.5b, 2.9 first run, 2.8), then the live smoke test (2.7).
4. Open question: the generated invite code is shown only behind a Copy button, not as text.

## Blocked on
- User review of step a claiming decisions (auto Person per member, invite names Person, creator confirms claim); the claim UI (1d) already implements them.
- User approval before any provisioning (steps 2.2, 2.3, 2.4, 2.5, 2.8).
- Pending design: `plans/runtime-config-and-admin.md` (runtime feature flags and an admin role) is being written by another agent; the 2026-10-17 "no admin role" decision is under review, not changed.

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
| 2.0 | Spike: config push, Management API, redirect wildcard, createUser metadata, Vercel env calls | todo | | | |
| 2.2 | Bootstrap script, then Supabase and Vercel projects [APPROVAL to run] | todo | | | |
| 2.3 | Migrations via deploy.yml [APPROVAL first run] | todo | | | |
| 2.4 | configure-auth script, then hosted Auth config [APPROVAL to run] | todo | | | |
| 2.5 | seed-member script (Justin Fischman via env vars), then seed [APPROVAL to run] | todo | | | |
| 2.5b | Vercel settings: Git integration, Node 22, env vars, Authentication note [APPROVAL] | todo | | | |
| 2.9 | deploy.yml (db push, configure-auth, seed, health) [APPROVAL first run] | todo | | | |
| 2.10 | App passes `emailRedirectTo` from current origin | todo | | | |
| 2.11 | Verify origin push access; CI triggers to `main`; PR to `main` | todo | | | |
| 2.12 | justfile recipes for the new steps | todo | | | |
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
