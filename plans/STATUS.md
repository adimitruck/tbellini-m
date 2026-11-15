# TBellini MVP go-live status

Update this file after every completed step, commit, or decision. `plans/mvp-go-live.md` stays stable and is revised only by explicit replan.

Last updated: 2026-11-14

## Next action
Step 1b: domain, adapters, demo snapshot v3, composition root and AuthPort (branch `feature/shared-space-db`, base a873b04).

## Blocked on
- User review of step a claiming decisions (auto Person per member, invite names Person, creator confirms claim) before 1d claim UI.
- User approval before any provisioning (steps 2.2, 2.3, 2.4, 2.5, 2.8).
- Production domain name and Supabase region (needed for 2.2, 2.3, 2.8).

## Steps

| ID | Title | Status | Commit | Verified by | Date |
|---|---|---|---|---|---|
| 0 | Fix invite-only signup | done | 5810760 | lint, tsc, 45 vitest, node tests, build, 54 pgTAP | 2026-10-17 |
| 1a | Shared-space DB migration and pgTAP | done | 021331b | supabase db reset + test db 67/67 | 2026-11-14 |
| 1b | Domain, adapters, snapshot v3, composition root, AuthPort | todo | | | |
| 1c | Graph outbox types and projector (deferrable) | todo | | | |
| 1d | UI: People page, tag picker, labels, claim UI | todo | | | |
| 1e | Docs to shared model | todo | | | |
| 2.1 | First-invite seeding script and RUNBOOK | todo | | | |
| 2.2 | Supabase prod project and db push [APPROVAL] | todo | | | |
| 2.3 | Hosted Auth config [APPROVAL] | todo | | | |
| 2.4 | Seed first invite on prod [APPROVAL] | todo | | | |
| 2.5 | Vercel project, env vars, Node 22 [APPROVAL] | todo | | | |
| 2.6 | Health ping to Supabase | todo | | | |
| 2.7 | Live smoke test | todo | | | |
| 2.8 | Cloudflare DNS [APPROVAL] | todo | | | |
| D1 | Doc fixes: README, RUNBOOK, ROADMAP, PROJECT_HANDOFF, VALIDATION, PROJECT_MEMORY | todo | | | |

## Change log
- 2026-11-14: Created plans/mvp-go-live.md and this file. Facts rechecked in repo: five migrations present, first-invite gap confirmed (`join_tbellini` at shared_space.sql:136, seed disabled in config.toml).
- 2026-11-14: a873b04 rewrote docs/ARCHITECTURE.md ([DB]/[code]/[planned] labels, current vs target). It records that Supabase mode in code is broken against the new migration until 1b (adapter still reads memberships, event_people, event_user_tags), so do not deploy this branch before 1b.
- 2026-11-14: 021331b committed (step a). After it, tsc/vitest/build are expected to fail until 1b.
- 2026-10-17: 5810760 (phase 0) merged.
