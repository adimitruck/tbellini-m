# tbellini-m

An archive-first Events & Calendar app. M0 brings registered users into one TBellini community with shared events/calendar, registered-user tags, Going/Interested RSVPs and a personal RSVP calendar. Private archive people remain separate. Authors control event corrections. Product decisions are recorded in [PROJECT_MEMORY.md](PROJECT_MEMORY.md); the imported planning conversation remains in [the source transcript](docs/conversations/2026-10-06-plan-product-features.md).

## Start locally

Use Node.js 22 and npm:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The example environment explicitly selects `NEXT_PUBLIC_ARCHIVE_MODE=demo`: records stay in this browser's local storage. Demo data is not synced to hosted services and should not hold irreplaceable records. To use durable authenticated storage, follow [the runbook](docs/RUNBOOK.md) and set mode to `supabase` with valid public credentials. Restart/rebuild after changing public environment values. The production app requires an explicit mode; an unconfigured build can succeed but its UI reports a configuration error.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

The app deploys through Vercel's Git integration. Supabase Postgres/Auth is authoritative; Neo4j is a recoverable connection projection. Cloudflare hosts the optional edge worker and can manage DNS. No account, remote infrastructure, or deployment is created by installing this repository.

- [Project handoff and source map](docs/PROJECT_HANDOFF.md)
- [Architecture and boundaries](docs/ARCHITECTURE.md)
- [Setup, deployment, recovery](docs/RUNBOOK.md)
- [Roadmap and acceptance criteria](docs/ROADMAP.md)
- [Contributor/model workflow](docs/CONTRIBUTING.md)
- [Validation and dependency risk record](docs/VALIDATION.md)

The configured CI workflow validates the app and replays Supabase migrations/tests locally; GitHub-hosted execution has not been verified in this work. Graph replay and Cloudflare deployment are manually dispatched, disabled until configured, and use a protected GitHub `production` environment.
