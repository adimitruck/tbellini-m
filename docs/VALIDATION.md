# Validation record

This records checks executed so far: the shared-space verification first, then the earlier skeleton and community-model records, which describe superseded behavior and are kept as history. It is not a claim of complete line/function coverage or production readiness. Later audit results should replace the current-status table below, preserving meaningful migration/browser evidence.

## Shared-space verification — November 14, 2026

Branch `feature/shared-space-db`, commits `021331b` (database), `b358f28` (domain, adapters, composition root), `5c28c8f` (graph), `70c4c90` (seed script, health ping), `1efc757` (People page, picker, claim flow). The sections below this one describe the superseded community model and are kept as history.

| Check | Recorded result | What it establishes |
| --- | --- | --- |
| `npm run lint` | Passed | Static lint constraints |
| `npm run typecheck` | Passed | TypeScript contracts, including the shared-space domain and adapters |
| `npm test`, Vitest | 113 tests passed (re-run when this entry was written) | Domain rules, demo adapter, the adapter contract run against demo and a fake PostgREST, auth, components, health, runtime, SDK boundary |
| `npm test`, node | 26 tests passed (re-run when this entry was written) | Graph projection and replay, seed script, worker |
| `npm run build` | Passed | Build output can be generated (with no `NEXT_PUBLIC_*` it builds as "unconfigured") |
| `supabase db reset` + `supabase test db` at step a (`021331b`) | 67 pgTAP assertions passed | Shared-space schema and RLS on local Postgres. Not re-run after later commits, which changed no SQL |
| Local-stack browser end-to-end (2026-11-14) | PASS | Against the local Supabase stack with Playwright: `just db-reset` and `just db-test` (67 pgTAP), `just seed-invite-local`, `/api/health` 200 in supabase mode. Signup with an invite (email confirmed through Mailpit), event create, RSVP, calendar and My calendar, add and tag a new person, invite naming that Person, second signup linking to the existing Person (no duplicate), another member's RSVP absent from the personal calendar, no edit or delete on another member's event, sign-out and sign-in. One defect found and fixed (bb142a6): the invite input `pattern` was invalid under the browser `v` flag. Local only; hosted behaviour is still unverified |

Not verified: hosted Supabase Auth settings, email delivery, the Vercel build with `NEXT_PUBLIC_*` set, the live two-account smoke test, the data-converting paths of the shared-space migration on a non-empty database, and a real Neo4j instance with the new node keys. The Supabase side of the adapter contract test uses an in-memory fake, so only pgTAP and the pending browser run cover real Postgres behaviour. The live smoke test result will be recorded here after provisioning.

## Earlier verification (community model, historical)

| Check | Recorded result | What it establishes |
| --- | --- | --- |
| `npm run lint` | Zero warnings/errors | Static lint constraints for the checked source |
| `npm run typecheck` | Passed | TypeScript compile-time contracts |
| `npm test` | 41 Vitest domain/demo/time/runtime/adapter/storage tests + 18 node projection/replay/worker tests passed | Selected observable behavior and graph query construction |
| `npm run build` | Optimized Next.js 16.3.8 build passed | Build output can be generated; credentials/providers are not probed |
| Supabase clean migration replay + `test db` | 40 assertions passed on CLI 2.119.0 / Postgres 17 | Local schema and selected authenticated/anonymous policies |
| Forward community migration | Existing synthetic records preserved/backfilled | Applied migration 3 over original migrations 1/2 with prior data |
| Demo browser smoke | Passed the specific flows below | Manual browser behavior with local demo storage |

The deeper audit is still adding targeted regressions and repeating live local checks; the table reflects its last confirmed 41 + 18 unit run until final repeat results are supplied. No hosted Vercel/Supabase/Neo4j/Cloudflare deployment, remote account provisioning, commit or PR is claimed.

## Tests and coverage boundaries

`tests/archive.test.ts` covers validation, persistence, missing IDs, attendance references/deduplication/cascades, actual-instant sorting, malformed demo records and timezone/DST conversion. `tests/community.test.ts` covers shared events, author restrictions in service/repositories, tagging independent of RSVP, own calendar filtering, private people isolation, own profile editing, deletion cascades and v1 demo conversion. These use an in-memory StoragePort and demo adapters. `tests/runtime.test.ts` exercises configuration readiness, latest-request asynchronous race handling and paginated fetch behavior. `tests/supabase.test.ts` drives the real Supabase SDK against fake HTTP transport to verify request scope, pagination, errors and row decoders; it does not contact a hosted project.

`tests/storage-time.test.ts` covers corruption/reset, preserving legacy state, failed writes and temporal regressions including historical second offsets and unchanged-instant edits. These are selected cases rather than exhaustive timezone-history coverage.

`scripts/sync-graph.test.mjs` uses a fake Neo4j driver to check parameterized keys/queries, idempotent writes, deletion, missing endpoints, community conversion, profiles, tags, RSVP status and private attendance visibility. `scripts/replay-outbox.test.mjs` adds fake-provider runner tests for exclusive lock handling, exact ordered acknowledgement, failure retention/retry and independent cleanup. These tests do not execute Cypher against Neo4j or test Aura connectivity; seven replay tests passed as part of the 18-test node suite.

`supabase/tests/archive_rls.sql`, `community_rls.sql` and `invitations_rls.sql` run against actual local Postgres through pgTAP, switch roles/JWT claims, and cover owner privacy, cross-owner attendance FKs, timezone validation, service-table denial, graph mutex ownership, automatic membership, shared event reads, author-only mutations/tags, own RSVP and immutable identity, plus invite-only signup (missing/unknown/expired/reused codes rejected, case-insensitive entry, consumer recorded), invitations table denial for members, and member-only `create_invitation` with expiry bounds. SQL tests do not exercise signup email delivery, a real browser session or the JavaScript provider adapter. `cloudflare/worker.test.mjs` adds local handler tests for read-only health/cache headers and rejected routes/methods; two handler tests passed as part of that node suite; they do not deploy a Worker.

Hosted auth/session/RLS integration, automatic updates between browsers, full browser regression, full accessibility, realistic load/performance, backups/restore, deployed worker/DNS/TLS and GitHub-hosted Actions are not verified by the above checks. `/api/health` checks configuration readiness only (200 configured, 503 invalid/missing configuration), not provider availability.

## Migration preservation evidence

The forward `20261006000002_community.sql` migration was applied to the original two-migration schema with a synthetic existing account, event, private person and attendance link. It backfilled a registered profile and TBellini membership; preserved event content while changing its visibility to community; kept the person private; and retained the attendance. Three older pending graph records remained alongside four new conversion/snapshot records. A subsequent clean replay passed all 40 SQL assertions. The temporary local Supabase stack was stopped after that validation.

The original owner-only SQL assumption was updated intentionally: after the forward migration, authenticated community members read all community events while private people/attendance and write boundaries remain scoped. Historical migration files were preserved.

## Browser evidence

Before the community correction, local demo smoke testing created an event, linked a person, corrected the title while retaining the link, created a private person and saw the event on its calendar date.

After the correction, the previous demo's four events survived v1 → v2 migration. Sam tagged Alex on Sam's event. Alex saw the same four community events and tag marker, with no edit/delete/private-archive controls for Sam's event. Alex's My Calendar contained zero events before an RSVP and one October 6 event after choosing Interested. This was a simulated member switch in one browser dataset, not hosted authentication.

Community members can see who is Going or Interested; writes are self-only. Event-author tags never imply RSVP. Private archive people/links remain owner scoped. Manual browser observations establish only the paths actually exercised.

## Dependency audit

The recorded production dependency audit found zero vulnerabilities. The full audit found five high development-tool transitive findings through `eslint-config-next` / `micromatch` / `braces`, requiring a compatible upstream fix. Development-tool findings remain unresolved; they were not ignored as safe simply because they are outside the production bundle. Re-run both `npm audit --omit=dev` and `npm audit` before release because advisories change. Dependency versions and the lockfile remain the authoritative inputs.

## Invitations hardening — October 17, 2026

Repaired `20261006000003_invitations.sql` (its function delimiters had been corrupted), enabled RLS on `invitations`, moved code generation into the member-only `create_invitation` RPC, and made code consumption atomic. On branch `fix/invitations-hardening`: lint and typecheck clean; 45 Vitest tests and 18 node tests passed; production build passed; local Supabase `db reset` applied all four migrations and `test db` passed 54 pgTAP assertions across three files. A manual check against local Auth/REST confirmed: an unknown code is rejected with "Invalid or expired invite code."; a seeded code admits one account and cannot be reused; a signed-in member's RPC returns a code such as `PU94-93YL`; out-of-range expiry is rejected; members get permission denied reading `invitations`; anonymous callers cannot execute the RPC. Hosted Auth was not exercised.
