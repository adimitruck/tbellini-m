# Setup and operations

## Local app and Supabase

The declared minimum is Node.js 22; CI and the Vercel setup below select 22. `npm ci`, copy `.env.example` to `.env.local`, and `npm run dev`. Demo mode needs no cloud accounts. The example file explicitly selects demo; production requires an explicit mode. Selecting Supabase mode without its public configuration must fail visibly. Old local v1 demo data is automatically converted to v2 when v2 is absent. There is no demo-to-Supabase import; switching provider does not upload browser records.

For local authenticated storage, install the [Supabase CLI](https://supabase.com/docs/guides/local-development) and have a Docker-compatible runtime already running. Docker is optional for app development; no installation is performed by this repository.

```sh
npx --yes supabase@2.119.0 start
npx --yes supabase@2.119.0 db reset --local
npx --yes supabase@2.119.0 test db
npx --yes supabase@2.119.0 stop
```

`db reset` destroys the local development database contents; never use reset against a hosted production archive. Before stopping, obtain local public URL and publishable/anon key from `npx --yes supabase@2.119.0 status`. The CLI prints local development credentials; copy only the required values into ignored `.env.local`. For continued local authenticated app work, leave the stack running and stop it when finished. Use `API_URL` as `NEXT_PUBLIC_SUPABASE_URL` and `PUBLISHABLE_KEY` (or the local legacy `ANON_KEY`) as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, set `NEXT_PUBLIC_ARCHIVE_MODE=supabase`, and restart the app. Local confirmation emails are available through the mail viewer printed by `supabase start`. The SQL tests switch to the authenticated role and exercise owner isolation, cross-owner foreign keys, and inaccessible service tables.

For hosted Supabase, create a project in its dashboard, review the migration, then link the CLI and apply it:

```sh
npx --yes supabase@2.119.0 login
npx --yes supabase@2.119.0 link --project-ref YOUR_PROJECT_REF
npx --yes supabase@2.119.0 db push --dry-run
npx --yes supabase@2.119.0 db push
```

Set Auth site URL to the deployed app and allow the intended app/preview redirect URLs. The current UI uses email/password signup/sign-in, with email confirmation followed by manual sign-in; no application callback route or OAuth/magic-link flow is implemented. Configure email delivery/confirmation for production. Use the dashboard's publishable key for the browser; use a separate service-role key exclusively for the graph runner. Review backup retention and restore policy before storing real archives. [Migrations](https://supabase.com/docs/guides/deployment/database-migrations), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [database tests](https://supabase.com/docs/guides/database/testing) are the upstream references.

## Configuration ownership

| Name | Where | Purpose / exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_ARCHIVE_MODE` | `.env.local`, Vercel project per environment | `demo` or `supabase`; browser-visible build value |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel project | Public app endpoint; graph runner uses this same variable name |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, Vercel project | Public browser key; user session and RLS enforce authorization |
| `SUPABASE_SERVICE_ROLE_KEY` | Local graph process or GitHub production secret | Privileged graph queue access only; never browser/Vercel UI value |
| `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` | Local graph process or GitHub production secrets | Private graph connection credentials; URI should use TLS |
| `NEO4J_DATABASE` | Local graph process or GitHub production variable | Defaults to `neo4j` when omitted/empty |
| `NEO4J_SYNC_ENABLED` | GitHub repository variable | Must equal `true` for manually dispatched graph job to run |
| `SUPABASE_URL` | GitHub production environment variable | Workflow maps it to `NEXT_PUBLIC_SUPABASE_URL` for the runner |
| `CLOUDFLARE_DEPLOY_ENABLED` | GitHub repository variable | Must equal `true` for manually dispatched worker job to run |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub production environment secrets | Optional worker deployment account/token |

Do not add credentials to tracked files. `.env.example` contains placeholders, and `.env*` is ignored except that example. Public variables are compiled into browser output, so rebuild when changing them. Installing the repository sets up no remote account or secret. Configure the GitHub `production` environment and its protections in GitHub; the YAML refers to it but does not configure reviewers automatically.

## Vercel and Cloudflare DNS

Import this GitHub repository into Vercel using the Next.js preset, Node.js 22, `npm run build`, and the default output directory. Set the three `NEXT_PUBLIC_*` app variables per environment before building. Use a separate Supabase development/preview project when preview deployments need durable data. Vercel Git integration supplies previews and production deployment; there is no duplicate Vercel deploy workflow.

Add the custom domain in Vercel and apply the exact DNS records it provides in Cloudflare. Begin with DNS-only records. Adding Cloudflare proxying requires reviewing [Vercel's Cloudflare integration guidance](https://vercel.com/docs/integrations/external-platforms/cloudflare), cache behavior and TLS; never cache authenticated archive responses. Git integration guidance: [Vercel Git deployments](https://vercel.com/docs/deployments/git).

## Forward community migration

`20261006000002_community.sql` adds the fixed TBellini community, registered profiles, automatic signup membership, registered-user tags and RSVP. It backfills existing accounts and changes existing events to community visibility. Private people/notes and historical attendance stay owner scoped. Review this visibility change before applying it to an existing hosted archive; deploy the matching app and forward migration together. Do not rewrite the older applied migrations. Profiles use a valid provided display name or a neutral member label; email is never copied. Signup metadata never chooses community membership.

If replay jobs exist, stop them while applying this migration, then deploy the new projector before resuming. Older pending queue records are preserved; new snapshot records reproject profiles/events before private attendance. No invite/public access is added. Display name can be changed independently from private person records.

## Neo4j projection

Provision Neo4j Aura or another compatible Neo4j instance. Use TLS (`neo4j+s://` for Aura) and a dedicated credential. Supply `.env.local` server variables from `.env.example`, then:

```sh
node --env-file=.env.local scripts/sync-graph.mjs
```

The runner installs `neo4j/constraints.cypher` automatically. The app remains available if Neo4j is down; pending outbox rows accumulate. First sync projects all existing writes in order. `graph-sync.yml` runs the same script only by manual dispatch when repository variable `NEO4J_SYNC_ENABLED=true` is present. In the GitHub `production` environment set variable `SUPABASE_URL`, optional `NEO4J_DATABASE`, and secrets `SUPABASE_SERVICE_ROLE_KEY`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`. Configure reviewers/protection for this environment before enabling it. No graph cron is enabled by default. Follow [Neo4j executeQuery guidance](https://neo4j.com/docs/javascript-manual/current/query-simple/).

The projector acquires a database mutex that deliberately never expires. Normal success/failure attempts to release it independently of driver close. Cleanup errors are reported alongside the original failure. If a process is killed or disconnected during release, the next run fails safely. First confirm all sync runs have stopped, inspect `select * from public.graph_sync_lock`, and only then execute `delete from public.graph_sync_lock` in the privileged SQL editor. Never reset a lock while a runner might still be active. Failed rows are not acknowledged; fix the error and rerun. Error output should not expose secrets/payloads.

For a full rebuild: stop all replay jobs and archive writes, back up Neo4j, remove only this app's `ArchiveEntity` nodes in the target database, set `graph_outbox.processed_at=null` through privileged SQL, and replay. Resume writes after validation. Outbox history must be retained for this procedure. Purging processed rows requires replacing replay with a snapshot/reconciliation strategy first. Sensitive titles are duplicated into Neo4j; its access/backup/deletion policy must match the private archive.

## Optional Cloudflare worker

`cloudflare/worker.js` exposes `GET /health` and otherwise returns 404. It serves no archive data. To deploy manually, enable `CLOUDFLARE_DEPLOY_ENABLED=true`, configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the protected production environment, and dispatch the Cloudflare workflow. Use a token restricted to the intended account's Workers editing scope. The checked-in worker name is `tbellini-m-edge`; change it deliberately if needed. [Official action](https://github.com/cloudflare/wrangler-action) and [Wrangler deployment](https://developers.cloudflare.com/workers/wrangler/commands/) describe current behavior. Future R2/Queues bindings require explicit contracts and provisioning; none are fabricated here.

## Workflow behavior and health endpoints

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`. Its app job performs npm clean install, lint, types, domain/runtime/adapter tests, graph/replay/worker tests and build on Node.js 22. Its independent database job starts local Docker-backed Supabase, resets the local database, runs SQL tests and stops it; no hosted secrets are needed. Check the actual repository default branch when adopting the workflow; its push branch filter is explicitly `main`. No GitHub-hosted run was verified in this implementation session.

`graph-sync.yml` and `cloudflare.yml` are manual dispatch only, opt-in, production-environment jobs with separate concurrency groups and `cancel-in-progress: false`. The graph runner also enforces a database mutex, so local/CI overlap fails. No workflow deploys Supabase migrations or Neo4j hosting, and none creates infrastructure. Apply reviewed database migrations through the operator procedure above. Vercel deploys via its Git integration.

`GET /api/health` returns 200 when configured and 503 when mode/credentials/URL configuration are missing or invalid; it reports status/service/mode without secrets and does not probe Supabase, Auth or Neo4j availability. The optional worker's `GET /health` likewise checks its request handler only. Diagnose dependency failures through provider logs and the pending queue, not through a healthy static endpoint alone.

## Data refresh and failure states

The app fetches snapshots through browser adapters. Shared data is not realtime: another user's changes require a reload or a subsequent local action. Supabase adapters fetch 1,000-row ranges with stable ordering, matching checked-in API max_rows=1000. If a hosted API limit is smaller, align that limit/page size before relying on complete reads. Independent page/table reads are not a database-wide transaction snapshot; concurrent insert/delete can shift offsets or produce brief cross-table differences. The current app still loads the full scoped archive into memory. UI errors must preserve authentication state and offer retry/sign-out rather than implying a logged-in user has signed out. The route error boundary and demo reset are separate recovery paths; resetting demo is explicitly destructive to that browser's v2 data.

## Release and recovery checklist

Run app validation, local migration replay and SQL tests. Smoke-test two authenticated members: shared event visibility, author-only corrections/deletion/tagging, each user's own Going/Interested/Clear controls, filtered My Calendar, private people isolation, timezone boundaries, reload and sign-out. Verify Neo4j retries and deletion in a staging instance. Inspect Vercel preview, keyboard navigation and mobile layout before production enablement. Neither unit tests nor demo mode verify hosted provider connectivity.

App rollback uses the prior Vercel deployment. Database migrations move forward: do not delete migration history or assume rolling back UI reverses schema/data. Correct a schema problem with a reviewed additive migration and verify backup restore independently. Monitor Vercel errors, Supabase/Auth failures, pending outbox count/oldest timestamp, sync mutex age, and Cloudflare worker logs. Never log private notes or credentials.
