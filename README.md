# tbellini-m

An archive-first Events & Calendar app for one shared group. Every signed-in member sees all events, people and RSVPs; there are no communities, memberships or private people. An account means "can log in". Only a record's creator edits or deletes it, tags point at shared Person records and never imply an RSVP, and each member sets only their own Going/Interested RSVP. Signup is invite-only: any member can create a single-use code. People without accounts are shared Persons that a member can later claim. Product decisions are recorded in [PROJECT_MEMORY.md](PROJECT_MEMORY.md); the imported planning conversation remains in [the source transcript](docs/conversations/2026-10-06-plan-product-features.md).

## Start locally

Use Node.js 22.18 or newer (`engines` in `package.json`) and npm. The [justfile](justfile) is the primary interface (run `just` to list recipes; needs [just](https://github.com/casey/just)):

```sh
just setup          # npm ci, and .env.local from .env.example if missing
just dev            # demo mode, no backend
just dev-supabase   # local Supabase stack (needs Docker) plus the app against it
just check          # lint, typecheck, tests, build
just ci             # check plus local database reset and pgTAP tests
```

Without `just`, the equivalent is `npm ci`, `cp .env.example .env.local`, `npm run dev`.

Open http://localhost:3000. The example environment explicitly selects `NEXT_PUBLIC_ARCHIVE_MODE=demo`: records stay in this browser's local storage. Demo data is not synced to hosted services and should not hold irreplaceable records. To use durable authenticated storage, follow [the runbook](docs/RUNBOOK.md) and set mode to `supabase` with valid public credentials. Restart/rebuild after changing public environment values. The production app requires an explicit mode; an unconfigured build can succeed but its UI reports a configuration error.

The npm scripts behind `just check`:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

The app deploys through Vercel's Git integration. Supabase Postgres/Auth is authoritative; Neo4j is a recoverable connection projection. Cloudflare hosts the optional edge worker and can manage DNS. Nothing is deployed yet: no Supabase, Vercel or Cloudflare project exists. No account, remote infrastructure, or deployment is created by installing this repository.

- [Project handoff and source map](docs/PROJECT_HANDOFF.md)
- [Architecture and boundaries](docs/ARCHITECTURE.md)
- [Setup, deployment, recovery](docs/RUNBOOK.md)
- [Roadmap and acceptance criteria](docs/ROADMAP.md)
- [Contributor/model workflow](docs/CONTRIBUTING.md)
- [Validation and dependency risk record](docs/VALIDATION.md)

The configured CI workflow validates the app and replays Supabase migrations/tests locally; GitHub-hosted execution has not been verified in this work. Graph replay and Cloudflare deployment are manually dispatched, disabled until configured, and use a protected GitHub `production` environment.
