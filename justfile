# tbellini-m task runner. Run `just` to list recipes.
# Requires: just, Node >= node_major, npm. Supabase recipes use the pinned CLI via npx.

set shell := ["bash", "-euo", "pipefail", "-c"]

node_major := "22"
supabase_cli := "supabase@2.119.0"
supabase := "npx --yes " + supabase_cli
app_port := "3000"
app_url := "http://localhost:" + app_port
health_path := "/api/health"
env_file := ".env.local"
env_example := ".env.example"
confirm_hosted := "hosted"
github_repo := "adimitruck/tbellini-m"

# List all recipes.
default:
    @just --list --unsorted

# Fail fast unless Node >= node_major and npm are available.
[private]
need-node:
    #!/usr/bin/env bash
    set -euo pipefail
    command -v node >/dev/null || { echo "error: node not found; install Node {{ node_major }}+" >&2; exit 1; }
    command -v npm >/dev/null || { echo "error: npm not found" >&2; exit 1; }
    major="$(node -p 'process.versions.node.split(".")[0]')"
    if [ "$major" -lt {{ node_major }} ]; then
        echo "error: Node $major found; Node {{ node_major }}+ required" >&2
        exit 1
    fi

# Fail fast unless Docker is running (needed by the local Supabase stack).
[private]
need-docker:
    #!/usr/bin/env bash
    set -euo pipefail
    command -v docker >/dev/null || { echo "error: docker not found; install Docker" >&2; exit 1; }
    docker info >/dev/null 2>&1 || { echo "error: docker daemon is not running" >&2; exit 1; }

# Fail fast unless the named confirmation equals confirm_hosted.
[private]
need-confirm confirm action:
    #!/usr/bin/env bash
    set -euo pipefail
    # just passes `confirm=hosted` after a recipe name as one positional value, so accept both forms.
    given="{{ confirm }}"
    if [ "${given#confirm=}" != "{{ confirm_hosted }}" ]; then
        echo "error: {{ action }} affects HOSTED services." >&2
        echo "Re-run with confirm={{ confirm_hosted }}, e.g. just {{ action }} confirm={{ confirm_hosted }}" >&2
        exit 1
    fi

# Install dependencies (npm ci) and create .env.local from .env.example if missing.
[group('setup')]
setup: need-node
    npm ci
    @if [ -f {{ env_file }} ]; then echo "{{ env_file }} exists; left untouched"; \
        else cp {{ env_example }} {{ env_file }} && echo "created {{ env_file }} from {{ env_example }}"; fi

# Run the app in isolated demo mode (no backend needed).
[group('run')]
dev: need-node
    NEXT_PUBLIC_ARCHIVE_MODE=demo npm run dev -- --port {{ app_port }}

# Start the local Supabase stack and run the app against it (keys stay in the process env).
[group('run')]
dev-supabase: need-node db-start
    #!/usr/bin/env bash
    set -euo pipefail
    status="$({{ supabase }} status -o env)"
    get() { printf '%s\n' "$status" | sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p" | head -n1; }
    url="$(get API_URL)"
    key="$(get PUBLISHABLE_KEY)"
    [ -n "$key" ] || key="$(get ANON_KEY)"
    if [ -z "$url" ] || [ -z "$key" ]; then
        echo "error: could not read API URL / publishable key from supabase status" >&2
        exit 1
    fi
    echo "Using local Supabase at $url"
    NEXT_PUBLIC_ARCHIVE_MODE=supabase NEXT_PUBLIC_SUPABASE_URL="$url" \
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$key" npm run dev -- --port {{ app_port }}

# Production build.
[group('run')]
build: need-node
    npm run build

# Serve the production build (run `just build` first).
[group('run')]
start: need-node
    npm run start -- --port {{ app_port }}

# Lint with ESLint.
[group('quality')]
lint: need-node
    npm run lint

# Type-check with tsc.
[group('quality')]
typecheck: need-node
    npm run typecheck

# Run vitest and the node:test suites.
[group('quality')]
test: need-node
    npm test

# CI equivalent: lint, typecheck, test, build.
[group('quality')]
check: lint typecheck test build

# Full CI equivalent: app checks plus local database reset and pgTAP tests.
[group('quality')]
ci: check db-reset db-test db-stop

# Start the local Supabase stack (needs Docker).
[group('database')]
db-start: need-node need-docker
    {{ supabase }} start

# Stop the local Supabase stack.
[group('database')]
db-stop: need-node
    {{ supabase }} stop

# Reset the LOCAL database and replay migrations (destroys local data only).
[group('database')]
db-reset: db-start
    {{ supabase }} db reset

# Run pgTAP SQL tests in supabase/tests against the local stack.
[group('database')]
db-test: db-start
    {{ supabase }} test db

# Show schema drift of the local database as a migration diff (stdout).
[group('database')]
db-diff: db-start
    {{ supabase }} db diff

# Push migrations to the HOSTED project (must be linked); requires confirm=hosted.
[group('hosted')]
db-push confirm="": (need-confirm confirm "db-push")
    {{ supabase }} db push

# Project the graph outbox into Neo4j using .env.local; requires confirm=hosted.
[group('hosted')]
graph-sync confirm="": (need-confirm confirm "graph-sync") need-node
    @test -f {{ env_file }} || { echo "error: {{ env_file }} missing; run just setup and fill graph variables" >&2; exit 1; }
    node --env-file={{ env_file }} scripts/sync-graph.mjs

# Replay pending outbox rows to the graph (same runner as graph-sync); requires confirm=hosted.
[group('hosted')]
replay-outbox confirm="": (graph-sync confirm)

# Create the first invitation on the HOSTED project using .env.local; requires confirm=hosted.
# Optional env: INVITE_CODE, INVITE_EXPIRY_DAYS. Prints the code, never the service-role key.
[group('hosted')]
seed-invite confirm="": (need-confirm confirm "seed-invite") need-node
    @test -f {{ env_file }} || { echo "error: {{ env_file }} missing; set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY" >&2; exit 1; }
    node --env-file={{ env_file }} scripts/seed-invite.mjs

# Create an invitation on the LOCAL Supabase stack (reads its URL and service-role key from the CLI).
[group('database')]
seed-invite-local: need-node db-start
    #!/usr/bin/env bash
    set -euo pipefail
    eval "$({{ supabase }} status -o env)"
    NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" node scripts/seed-invite.mjs

# One-time: create the Supabase and Vercel projects and write their env vars. Dry run unless mode=apply.
# Reads names from .env.local or the shell (see scripts/hosted-config.mjs); requires confirm=hosted.
[group('hosted')]
bootstrap confirm="" mode="dry-run": (need-confirm confirm "bootstrap") need-node
    node --env-file-if-exists={{ env_file }} scripts/bootstrap-hosted.mjs {{ if mode =~ "(^|=)apply$" { "--apply" } else { "" } }}

# Apply Auth settings (Site URL, redirects, SMTP) to the HOSTED project. Dry run unless mode=apply.
[group('hosted')]
configure-auth confirm="" mode="dry-run": (need-confirm confirm "configure-auth") need-node
    node --env-file-if-exists={{ env_file }} scripts/configure-auth.mjs {{ if mode =~ "(^|=)apply$" { "--apply" } else { "" } }}

# Create the first member (SEED_MEMBER_NAME / SEED_MEMBER_EMAIL) on the HOSTED project; requires confirm=hosted.
[group('hosted')]
seed-member confirm="": (need-confirm confirm "seed-member") need-node
    node --env-file-if-exists={{ env_file }} scripts/seed-member.mjs

# GET SITE_URL + health_path of the deployed site (read-only; SITE_URL from .env.local or the shell).
[group('hosted')]
deploy-check: need-node
    node --env-file-if-exists={{ env_file }} scripts/deploy-check.mjs

# Read-only check that this clone can push to github_repo (permissions and a push dry run).
[group('hosted')]
access-check:
    @command -v gh >/dev/null || { echo "error: gh not found" >&2; exit 1; }
    gh api repos/{{ github_repo }} --jq .permissions
    git push --dry-run origin HEAD

# GET the running app's health endpoint (status 200 when configured).
[group('run')]
health:
    @command -v curl >/dev/null || { echo "error: curl not found" >&2; exit 1; }
    curl --fail-with-body --silent --show-error {{ app_url }}{{ health_path }}; echo

# Remove build output and caches (.next, tsconfig.tsbuildinfo); keeps node_modules.
[group('setup')]
clean:
    rm -rf .next tsconfig.tsbuildinfo
