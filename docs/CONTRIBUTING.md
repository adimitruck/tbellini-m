# Contributor and model direction

Read `AGENTS.md` and `PROJECT_MEMORY.md` first, then `docs/PROJECT_HANDOFF.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` and the relevant source. The archive-first M0 direction takes precedence over assumptions from the old static site. The historical transcript is product evidence, not a precise implementation specification.

## Work in small capability slices

1. Choose one concrete M0 outcome and identify its domain contract, service method, provider adapter, UI and tests.
2. Inspect call sites and current working changes. Do not revert another model's edits or rename public contracts without updating all consumers.
3. Implement shared interfaces before adapters. Keep ownership explicit, inputs validated, types strict, and SDK usage inside infrastructure boundaries. Favor cohesive composition and generics for actual reuse. Avoid speculative frameworks and deep inheritance.
4. Cover observable behavior, failure paths and owner isolation. New schema requires a forward migration and SQL tests; new provider behavior requires mocked unit tests plus a documented live smoke test.
5. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; run `supabase test db` when migrations change and a local stack is available. Report checks you could not run.
6. Update the matching architecture/runbook/roadmap sections. State what is implemented, what is scaffolded, and what needs account/operator setup. Do not claim deployment based on a local build.

## Review constraints

- Supabase remains authoritative; Neo4j remains an asynchronous projection.
- Events are shared within the fixed TBellini community; archive people remain private. Event author manages tags, each member manages only their own RSVP. RLS, immutable identity triggers and compound membership/event foreign keys enforce these boundaries. Never merge registered profiles with private people.
- Keep all `NEXT_PUBLIC_*` variables non-secret. Service-role/Neo4j/Cloudflare tokens never enter browser code.
- Preserve durable outbox acknowledgements after successful graph writes only. Keep tenant keys and deletion handling in every graph change.
- Demo data belongs to the current browser. Do not imply it is backed up or silently send it to a cloud account.
- Existing migrations are immutable once deployed; add new files for corrections.
- Deploy workflows remain explicit opt-ins. New schedules or service provisioning require an intentional operator decision.
- Linear edits are limited to tbellini-m and keep capability → user-story structure.

## Suggested next slices

First verify hosted M0 end to end and strengthen browser regression/accessibility coverage. Then improve archive correction UX and graph reconciliation/observability. Begin M1 only after M0 acceptance is met. Each task handoff should include changed paths, public contracts, tests/results, unresolved risks and the next concrete action. Keep source names/commands in these docs aligned with the actual repository.

## Documentation and evidence discipline

`PROJECT_MEMORY.md` records product decisions; the source transcript is immutable historical evidence. `PROJECT_HANDOFF.md` maps current code, constraints and next work. `ARCHITECTURE.md` explains responsibilities, `RUNBOOK.md` contains exact operator commands/configuration, `ROADMAP.md` keeps scope, and `VALIDATION.md` separates checks executed from coverage gaps. Update only the affected documents and avoid multiplying contradictory status summaries.

Current tests exercise domain/demo behavior, graph query construction with a fake driver, and local Postgres policies. They do not prove every function/line, live SDK integration, hosted auth, deployments, realtime consistency, or complete accessibility. Add tests against observable behavior and report the exact environment and limitations. Keep legacy migrations unchanged after application; test new migrations on both a clean replay and representative prior-schema fixtures. Never replace an existing archive with demo seed data to hide a load failure.
