# Setup and operations

## Local app and Supabase

## Task runner (primary interface)

The `justfile` is the primary interface; run `just` to list recipes (install [just](https://github.com/casey/just)). It needs Node.js 22.18 or newer (`engines` in `package.json`) and npm; recipes that touch the local database also need a running Docker-compatible runtime and use the pinned Supabase CLI through `npx`. Recipes that act on the hosted project or graph refuse to run unless called with `confirm=hosted`.

| Recipe | Does |
| --- | --- |
| `just setup` | `npm ci`; creates `.env.local` from `.env.example` if missing |
| `just dev` | App in demo mode (no backend) |
| `just dev-supabase` | Starts the local Supabase stack and runs the app against it; keys stay in the process environment |
| `just lint`, `typecheck`, `test`, `build`, `start` | The matching npm scripts; `just check` runs lint, typecheck, test and build |
| `just db-start`, `db-stop`, `db-reset`, `db-test`, `db-diff` | Local Supabase stack, reset (destroys local data only), pgTAP tests, schema diff; `just ci` is `check` plus reset and test |
| `just seed-invite-local` | Creates an invitation on the local stack |
| `just seed-invite confirm=hosted` | Creates the first invitation on the hosted project (see below) |
| `just bootstrap confirm=hosted [mode=apply]` | One-time: finds or creates the Supabase and Vercel projects and writes env vars. Dry run unless `mode=apply` |
| `just configure-auth confirm=hosted [mode=apply]` | Prints the diff of hosted Auth settings (Site URL, redirects, SMTP); writes only with `mode=apply` |
| `just seed-member confirm=hosted` | Creates the first member from `SEED_MEMBER_NAME` / `SEED_MEMBER_EMAIL`, then sends the password reset email |
| `just deploy-check` | GETs `SITE_URL` plus `/api/health` with retries (read-only) |
| `just access-check` | Read-only: GitHub permissions of this clone and a `git push --dry-run` |
| `just db-push confirm=hosted` | Pushes migrations to the linked hosted project |
| `just graph-sync confirm=hosted`, `replay-outbox confirm=hosted` | Project the outbox into Neo4j using `.env.local` |
| `just health` | GETs the running app's `/api/health` |
| `just clean` | Removes build output and caches |

## Local app and Supabase

The declared minimum is Node.js 22.18; CI and the Vercel setup below select Node 22. `just setup`, then `just dev` (or `npm ci`, copy `.env.example` to `.env.local`, `npm run dev`). Demo mode needs no cloud accounts. The example file explicitly selects demo; production requires an explicit mode. Selecting Supabase mode without its public configuration must fail visibly. Demo data is stored under `tbellini.community.v3`; older v2 and v1 browser data is converted automatically when the newer key is absent. There is no demo-to-Supabase import; switching provider does not upload browser records.

For local authenticated storage, install the [Supabase CLI](https://supabase.com/docs/guides/local-development) and have a Docker-compatible runtime already running. Docker is optional for app development; no installation is performed by this repository.

```sh
npx --yes supabase@2.119.0 start
npx --yes supabase@2.119.0 db reset --local
npx --yes supabase@2.119.0 test db
npx --yes supabase@2.119.0 stop
```

`db reset` destroys the local development database contents; never use reset against a hosted production archive. Before stopping, obtain local public URL and publishable/anon key from `npx --yes supabase@2.119.0 status`. The CLI prints local development credentials; copy only the required values into ignored `.env.local`. For continued local authenticated app work, leave the stack running and stop it when finished. Use `API_URL` as `NEXT_PUBLIC_SUPABASE_URL` and `PUBLISHABLE_KEY` (or the local legacy `ANON_KEY`) as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, set `NEXT_PUBLIC_ARCHIVE_MODE=supabase`, and restart the app. Local confirmation emails are available through the mail viewer printed by `supabase start`. `just dev-supabase` does the status lookup and environment wiring for you. The SQL tests switch to the authenticated role and exercise signed-in-only reads, creator-only writes, shared people and tags, claims, invitations, and inaccessible service tables.

For hosted Supabase, create a project in its dashboard, review the migration, then link the CLI and apply it:

```sh
npx --yes supabase@2.119.0 login
npx --yes supabase@2.119.0 link --project-ref YOUR_PROJECT_REF
npx --yes supabase@2.119.0 db push --dry-run
npx --yes supabase@2.119.0 db push
```

Hosted Auth settings are dashboard values; `db push` does not apply them, and `supabase/config.toml` governs only the local stack. In Dashboard > Authentication set:

| Setting | Value |
| --- | --- |
| Site URL | `SITE_URL`: the production URL (until a domain exists, the Vercel production URL `<project>-<scope>.vercel.app`). Confirmation emails link to it; the app currently passes no `emailRedirectTo` (planned: pass the current origin, plan step 2.10) |
| Redirect URLs allow-list | The production URL and the Vercel preview pattern `https://*-<team>.vercel.app/**` (this project's team is `queen-of-hearts`; confirm the exact preview host in Vercel) |
| Email provider | Enabled |
| Confirm email | On (matches `enable_confirmations = true` locally) |
| Signups | Enabled. The invite gate is the `join_tbellini()` database trigger, so disabling signups would break invited signup |
| SMTP | Custom SMTP configured (`SMTP_*`). The built-in sender only reaches Supabase team members at about 2 emails per hour, so it cannot invite anyone else |
| Minimum password length | Set deliberately (a value is not fixed by this repository) |

Planned (plans/mvp-go-live.md Phase 2 replan, not implemented yet): a configure-auth script will apply these values from `SITE_URL`, `EXTRA_REDIRECT_URLS` and `SMTP_*` (GitHub Environment `preview` and `production` variables), and `deploy.yml` will run it after `db push`; the hosted region is `us-east-2`. Until then the values are set by hand. When a domain is added later, change `SITE_URL` and re-apply the Site URL and allow-list. These values have never been applied to a hosted project; verify with a signup whose confirmation link must land on the production URL. The current UI uses invite-only email/password signup/sign-in, with email confirmation followed by manual sign-in; no application callback route or OAuth/magic-link flow is implemented. Use the dashboard's publishable key for the browser; use a separate service-role key exclusively for the graph runner. Review backup retention and restore policy before storing real archives. [Migrations](https://supabase.com/docs/guides/deployment/database-migrations), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [database tests](https://supabase.com/docs/guides/database/testing) are the upstream references.

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

Import this GitHub repository into Vercel using the Next.js preset, Node.js 22 (`engines` requires 22.18 or newer; there is no `.nvmrc`, so set this in the project settings), `npm run build`, and the default output directory. Set `NEXT_PUBLIC_ARCHIVE_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` per environment before the first build: they are inlined at build time, so changing them later needs a rebuild, and a build without them succeeds but reports "unconfigured" (CI builds this way, so it does not prove a supabase-mode build). Do not set the service-role key on Vercel. Use a separate Supabase development/preview project when preview deployments need durable data. Vercel Git integration supplies previews and production deployment; there is no duplicate Vercel deploy workflow.

Cloudflare and a custom domain are deferred: there is no domain yet and `SITE_URL` is the Vercel production URL. Vercel Authentication (deployment protection) blocks signed-out visitors on previews. Production deploys from `main` through the Vercel Git integration. When a domain exists, add it in Vercel and apply the exact DNS records it provides in Cloudflare. Begin with DNS-only records. Adding Cloudflare proxying requires reviewing [Vercel's Cloudflare integration guidance](https://vercel.com/docs/integrations/external-platforms/cloudflare), cache behavior and TLS; never cache authenticated archive responses. Git integration guidance: [Vercel Git deployments](https://vercel.com/docs/deployments/git).

## Migrations

`supabase/migrations/` holds five forward-only files; `db push` applies all of them to a hosted project in order:

1. `20261006000000_archive.sql`: events, people, attendance and the graph outbox.
2. `20261006000001_graph_lock.sql`: the graph sync mutex.
3. `20261006000002_community.sql`: the earlier community, membership, tag and RSVP model (superseded by 5).
4. `20261006000003_invitations.sql`: invite-only signup.
5. `20261017000000_shared_space.sql`: moves the schema to one shared space. Drops `communities`, `memberships`, `event_people`, `event_user_tags` and `is_community_member()`; adds shared Persons (`people.member_id`), `event_person_tags`, `person_claims`, `ensure_member_person`, `confirm_person_claim` and `invitations.person_id`; every signed-in profile reads everything and only creators write.

Do not rewrite applied migrations; fix mistakes with a new forward migration. Its data-converting paths (Person backfill, conversion of `event_people` and `event_user_tags`) have not been tested on a non-empty database; a fresh hosted project has no data, so this only matters for an existing archive. Deploy the matching app and migration together. If graph replay jobs exist, stop them while applying a migration, and rebuild the graph as described under Neo4j projection.

## Invite-only signup and the first account

`20261006000003_invitations.sql` makes registration invite-only. Every signup must carry an unused, unexpired code; the signup trigger consumes it atomically, so a code admits exactly one account. Signed-in members create codes from the invite panel in the Members view, which calls the `create_invitation(expires_in_days, for_person)` RPC (1-30 days, default 7; `for_person` optionally names an unlinked Person the invitee will become). Browsers cannot read or write the `invitations` table.

Nobody can sign up before a code exists, so seed the first one with the service role. Put `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` of the hosted project in `.env.local` (never commit it), then:

```sh
just seed-invite confirm=hosted
```

It inserts one invitation with no creator and prints the code and expiry; the key is never printed. Optional environment overrides: `INVITE_CODE` (8-12 characters of A-Z, 0-9 or hyphen; a random code is generated when empty) and `INVITE_EXPIRY_DAYS` (1-30, default 7). Use `just seed-invite-local` for the local stack. Rollback: delete the row. Fallback without the script, in the privileged SQL editor:

```sql
insert into public.invitations(code, expires_at) values ('ABCD-2345', now() + interval '7 days');
```

Codes are 8-12 uppercase letters, digits or dashes; the signup form uppercases input. Inspect use with `select code, created_by, expires_at, used_at, used_by from public.invitations`. Demo mode generates random codes for display only; it has no signup flow to consume them. After the first member signs up, that member invites the others.

## Hosted configuration scripts and `deploy.yml`

All hosted names (variables, secrets, which script needs which) live in `scripts/hosted-config.mjs`; no value is committed. Set them as GitHub Environment variables or secrets for `preview` and `production`, or in the ignored `.env.local` for local runs. Every script is dry-run by default (`--apply`, or `mode=apply` in the recipe, writes) and prints names, never values. Hosted behavior is only unit-tested with injected fakes; nothing here has been run against a hosted project, and the Supabase Management API and Vercel endpoint shapes are UNCONFIRMED (see `plans/STATUS.md`, spike 2.0).

- `bootstrap`: Supabase project in `SUPABASE_REGION`, Vercel project linked to the repository, `NEXT_PUBLIC_*` values in Vercel, project ref and URL in the GitHub Environments. Needs `SUPABASE_ORGANIZATION_ID` (not in the original plan; the Management API requires an organization to create a project).
- `configure-auth`: sets `SITE_URL`, the redirect allow-list (`SITE_URL` plus `EXTRA_REDIRECT_URLS`, for example `https://*-<scope>.vercel.app/**`, syntax confirmed on the local stack), confirmations on, signups on (the invite gate is the database trigger), `SMTP_*` and the minimum password length. Changing the domain later means changing `SITE_URL` and re-running it.
- `seed-member`: the signup trigger also guards the Admin API, so the script inserts one invitation, calls `createUser` with `display_name` and `invite_code` in `user_metadata`, then sends a password reset email to `SITE_URL`. An existing user is left unchanged and the spare invitation is deleted.
- `.github/workflows/deploy.yml` (push to `main` or manual dispatch; GitHub Environment `production`, or the chosen one): `supabase link` and `db push`, `configure-auth`, `seed-member`, then the health check. It does nothing until the variable `DEPLOY_ENABLED` equals `true`.
- `just` accepts both `confirm=hosted` and `hosted` after the recipe name.

## Neo4j projection

Provision Neo4j Aura or another compatible Neo4j instance. Use TLS (`neo4j+s://` for Aura) and a dedicated credential. Supply `.env.local` server variables from `.env.example`, then:

```sh
node --env-file=.env.local scripts/sync-graph.mjs
```

The runner installs `neo4j/constraints.cypher` automatically. The app remains available if Neo4j is down; pending outbox rows accumulate. First sync projects all existing writes in order. `graph-sync.yml` runs the same script only by manual dispatch when repository variable `NEO4J_SYNC_ENABLED=true` is present. In the GitHub `production` environment set variable `SUPABASE_URL`, optional `NEO4J_DATABASE`, and secrets `SUPABASE_SERVICE_ROLE_KEY`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`. Configure reviewers/protection for this environment before enabling it. No graph cron is enabled by default. Follow [Neo4j executeQuery guidance](https://neo4j.com/docs/javascript-manual/current/query-simple/).

The projector acquires a database mutex that deliberately never expires. Normal success/failure attempts to release it independently of driver close. Cleanup errors are reported alongside the original failure. If a process is killed or disconnected during release, the next run fails safely. First confirm all sync runs have stopped, inspect `select * from public.graph_sync_lock`, and only then execute `delete from public.graph_sync_lock` in the privileged SQL editor. Never reset a lock while a runner might still be active. Failed rows are not acknowledged; fix the error and rerun. Error output should not expose secrets/payloads.

Graph node keys changed with the shared-space model (`event:<id>`, `person:<id>`, `profile:<id>`, no owner or community prefix), so a graph built by the earlier projector must be wiped and fully replayed before use; a graph that has never been synced needs no wipe. The projector skips the retired `attendance` and `user_tag` outbox types with a logged warning. For a full rebuild: stop all replay jobs and archive writes, back up Neo4j, remove only this app's `ArchiveEntity` nodes in the target database, set `graph_outbox.processed_at=null` through privileged SQL, and replay. Resume writes after validation. Outbox history must be retained for this procedure. Purging processed rows requires replacing replay with a snapshot/reconciliation strategy first. Event titles and person names are duplicated into Neo4j; its access/backup/deletion policy must be at least as strict as the archive.

## Optional Cloudflare worker

`cloudflare/worker.js` exposes `GET /health` and otherwise returns 404. It serves no archive data. To deploy manually, enable `CLOUDFLARE_DEPLOY_ENABLED=true`, configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the protected production environment, and dispatch the Cloudflare workflow. Use a token restricted to the intended account's Workers editing scope. The checked-in worker name is `tbellini-m-edge`; change it deliberately if needed. [Official action](https://github.com/cloudflare/wrangler-action) and [Wrangler deployment](https://developers.cloudflare.com/workers/wrangler/commands/) describe current behavior. Future R2/Queues bindings require explicit contracts and provisioning; none are fabricated here.

## Workflow behavior and health endpoints

`.github/workflows/ci.yml` runs on pull requests and pushes to `main` (the production branch; `site-code` is the legacy Jekyll site and is no longer a trigger). Its app job performs npm clean install, lint, types, domain/runtime/adapter tests, graph/replay/worker tests and build on Node.js 22. Its independent database job starts local Docker-backed Supabase, resets the local database, runs SQL tests and stops it; no hosted secrets are needed. No GitHub-hosted run was verified in this implementation session.

`graph-sync.yml` and `cloudflare.yml` are manual dispatch only, opt-in, production-environment jobs with separate concurrency groups and `cancel-in-progress: false`. The graph runner also enforces a database mutex, so local/CI overlap fails. No workflow deploys Supabase migrations or Neo4j hosting, and none creates infrastructure. Apply reviewed database migrations through the operator procedure above. Vercel deploys via its Git integration.

`GET /api/health` returns 200 with status `ok` when configured, and 503 with `configuration_required` when mode/credentials/URL configuration are missing or invalid. In supabase mode it also sends a `HEAD /rest/v1/` ping to Supabase with the publishable key (3-second timeout) and returns 503 with status `unavailable` and reason `supabase_unreachable` when that fails. It reports status/service/mode without secrets and does not probe Auth or Neo4j availability. The optional worker's `GET /health` likewise checks its request handler only. Diagnose dependency failures through provider logs and the pending queue, not through a healthy static endpoint alone.

## Data refresh and failure states

The app fetches snapshots through browser adapters. Shared data is not realtime: another user's changes require a reload or a subsequent local action. Supabase adapters fetch 1,000-row ranges with stable ordering, matching checked-in API max_rows=1000. If a hosted API limit is smaller, align that limit/page size before relying on complete reads. Independent page/table reads are not a database-wide transaction snapshot; concurrent insert/delete can shift offsets or produce brief cross-table differences. The current app still loads the full scoped archive into memory. UI errors must preserve authentication state and offer retry/sign-out rather than implying a logged-in user has signed out. The route error boundary and demo reset are separate recovery paths; resetting demo is explicitly destructive to that browser's v2 data.

## Release and recovery checklist

Run app validation, local migration replay and SQL tests. Smoke-test two authenticated members: shared event visibility, author-only corrections/deletion/tagging, each user's own Going/Interested/Clear controls, filtered My Calendar, shared People with tagging and claiming, signed-out visitors seeing nothing, timezone boundaries, reload and sign-out. Verify Neo4j retries and deletion in a staging instance. Inspect Vercel preview, keyboard navigation and mobile layout before production enablement. Neither unit tests nor demo mode verify hosted provider connectivity.

App rollback uses the prior Vercel deployment. Database migrations move forward: do not delete migration history or assume rolling back UI reverses schema/data. Correct a schema problem with a reviewed additive migration and verify backup restore independently. Monitor Vercel errors, Supabase/Auth failures, pending outbox count/oldest timestamp, sync mutex age, and Cloudflare worker logs. Never log private notes or credentials.
