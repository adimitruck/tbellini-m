# TBellini MVP go-live status

Update this file after every completed step, commit, or decision. `plans/mvp-go-live.md` stays stable and is revised only by explicit replan.

Last updated: 2026-11-14 (steps 0-1e, 2.1, 2.6 and D1 done)

## Next action
1. Merge `feature/shared-space-db` into `feature/base-tbellini-site`.
2. Ask the user for approval before any provisioning (2.2, 2.3, 2.4, 2.5, 2.8), then run Phase 2 and the live smoke test (2.7).
3. Open question: the generated invite code is shown only behind a Copy button, not as text.

## Blocked on
- User review of step a claiming decisions (auto Person per member, invite names Person, creator confirms claim); the claim UI (1d) already implements them.
- User approval before any provisioning (steps 2.2, 2.3, 2.4, 2.5, 2.8).
- Production domain name and Supabase region (needed for 2.2, 2.3, 2.8).

## Steps

| ID | Title | Status | Commit | Verified by | Date |
|---|---|---|---|---|---|
| 0 | Fix invite-only signup | done | 5810760 | lint, tsc, 45 vitest, node tests, build, 54 pgTAP | 2026-10-17 |
| 1a | Shared-space DB migration and pgTAP | done | 021331b | supabase db reset + test db 67/67 | 2026-11-14 |
| 1b | Domain, adapters, snapshot v3, composition root, AuthPort | done | b358f28 | lint, tsc, 113 vitest, 26 node, build pass (final run on this branch) | 2026-11-14 |
| 1c | Graph outbox types and projector (deferrable) | done | 5c28c8f | node tests (26 total) pass; real Neo4j not exercised; existing graphs need wipe + full replay | 2026-11-14 |
| 1d | UI: People page, tag picker, labels, claim UI | done | 1efc757 | lint, tsc, 113 vitest, build pass; local-stack browser e2e PENDING | 2026-11-14 |
| 1e | Docs to shared model | done | uncommitted | grep for community/membership/private people over the in-scope docs; examples checked against source | 2026-11-14 |
| 2.1 | First-invite seeding script and RUNBOOK | done | 70c4c90 (script); RUNBOOK uncommitted | node tests (seed-invite.test.mjs); `just seed-invite confirm=hosted` documented; not run against hosted | 2026-11-14 |
| 2.2 | Supabase prod project and db push [APPROVAL] | todo | | | |
| 2.3 | Hosted Auth config [APPROVAL] | todo | | | |
| 2.4 | Seed first invite on prod [APPROVAL] | todo | | | |
| 2.5 | Vercel project, env vars, Node 22 [APPROVAL] | todo | | | |
| 2.6 | Health ping to Supabase | done | 70c4c90 | `tests/health.test.ts`; not run against a live project | 2026-11-14 |
| 2.7 | Live smoke test | todo | | | |
| 2.8 | Cloudflare DNS [APPROVAL] | todo | | | |
| D1 | Doc fixes: README, RUNBOOK, ROADMAP, PROJECT_HANDOFF, VALIDATION, PROJECT_MEMORY | done (live smoke test entry waits for 2.7) | uncommitted | docs checked against source; browser e2e row in VALIDATION is a placeholder | 2026-11-14 |

## Change log
- 2026-11-14: Steps 1b-1d, 2.1 and 2.6 committed (b358f28, 5c28c8f, 1efc757, 70c4c90) plus the justfile (f44eeb4). Docs (step 1e, D1) rewritten to the shared model; architecture debt that was fixed was removed and the remaining debt (long lines, `events.owner_id` vs `people.created_by` via `CREATOR_COLUMN`, tested-on-fake contract) kept. Local browser e2e is pending; nothing provisioned.
- 2026-11-14: Created plans/mvp-go-live.md and this file. Facts rechecked in repo: five migrations present, first-invite gap confirmed (`join_tbellini` at shared_space.sql:136, seed disabled in config.toml).
- 2026-11-14: a873b04 rewrote docs/ARCHITECTURE.md ([DB]/[code]/[planned] labels, current vs target). It records that Supabase mode in code is broken against the new migration until 1b (adapter still reads memberships, event_people, event_user_tags), so do not deploy this branch before 1b.
- 2026-11-14: 021331b committed (step a). After it, tsc/vitest/build are expected to fail until 1b.
- 2026-10-17: 5810760 (phase 0) merged.
