# signapps-deploy

Deployment orchestrator for SignApps Platform — Phase 1 (CLI mode only).

## Usage

```bash
# Deploy v1.2.3 to prod (with confirmation)
just deploy-prod v1.2.3

# Deploy v1.2.3 to dev
just deploy-dev v1.2.3

# Rollback prod (to the last successful version)
just rollback-prod

# Check status
just deploy-status prod
```

## What it does

1. Inserts a `pending` deployment record
2. Pulls the Docker image from `ghcr.io/your-org/signapps-platform:{version}`
3. Activates the maintenance flag (proxy serves `/maintenance` page)
4. Runs `docker compose up -d` with `SIGNAPPS_VERSION` set
5. Waits for all services to be healthy (timeout 5 min)
6. Lists any pending DB migrations (does not auto-apply — see note below)
7. Disables the maintenance flag
8. Marks the deployment `success`

On any error, auto-rollback to the previous successful version.

## Migration policy

Phase 1 does **not** automatically apply SQL migrations. The orchestrator
lists pending files; an operator applies them manually during the
maintenance window. This is by design because the maintenance window is an
explicit product decision (see the design spec).

## Audit trail

All actions are logged to the `deployment_audit_log` table (retained 7 years
per the compliance policy).

## Phase 1 POC limitation

The maintenance flag is currently written to the `signapps-deploy` process's
local cache, not to a shared backend. For the flag to reach the proxy in
production, a future task must replace the in-process cache with a shared
backend (e.g., Redis, a DB row, or a small HTTP call to the proxy). Until
then, the CLI still runs the full deploy flow correctly but end-users won't
see the maintenance page during a deploy on a different host.

## Phase roadmap

- **Phase 1 (current):** CLI only, single-machine POC
- **Phase 2:** dev environment + promotion workflow
- **Phase 3:** REST API + admin UI (6 pages)
- **Phase 4:** on-premise installer
- **Phase 5:** Blue/Green (2 machines)

See `docs/superpowers/specs/2026-04-15-multi-env-deployment-design.md`.

## Port

`3035` (registered in `scripts/ports.json`). The HTTP server is dormant in
Phase 1 — activated via `DEPLOY_API_ENABLED=true` in Phase 3.

## Phase 2 additions

### Staging environment

The staging stack cohabits with prod on the same host. Ports are prod+1000 (e.g., identity at 4001), project name `signapps-staging`, database `signapps_staging`, isolated network.

```bash
# Create the staging DB and apply migrations (idempotent)
./scripts/init-staging-db.sh

# Start the staging stack
just staging-up

# Seed demo data into signapps_staging
just staging-seed

# Stop the staging stack
just staging-down
```

### Promotion (dev -> prod)

```bash
# Deploy a version to dev first
just deploy-dev v1.2.3

# Once validated, promote the same version to prod
just promote-to-prod
```

The `promote` command:
1. Fetches the last successful `env=dev` deployment
2. Verifies the staging stack is fully healthy
3. Runs the normal production deploy flow with that same version

### Scheduled maintenance

A long-lived scheduler worker polls the `scheduled_maintenance` table every 30 seconds and toggles the maintenance flag based on `scheduled_at` and `duration_minutes`.

```bash
# Schedule a 15-min maintenance on prod starting Apr 20 at 03:00 UTC
just schedule-maintenance prod 2026-04-20T03:00:00Z 15 "Nightly DB reindex"

# List upcoming windows
just list-maintenance prod

# Run the worker in the foreground (typically managed as a systemd service)
just scheduler-run
```

Lifecycle: `scheduled` -> `active` (flag ON) -> `completed` (flag OFF). Cancellation is supported at the DB level (status `cancelled`) but not yet exposed via CLI.

### Hostname routing (proxy)

`signapps-proxy` now selects the backend cluster based on the `Host` header:

- `app.signapps.io` / `app.localhost` -> prod cluster
- `staging.signapps.io` / `staging.localhost` -> staging cluster
- Anything else -> prod (backward compatibility)

The maintenance middleware reads the selected cluster from the request extensions, so `deploy:maintenance:prod` and `deploy:maintenance:dev` are independent keys and either env can be under maintenance without affecting the other.

### CI/CD

`.github/workflows/build-and-push.yml` runs on every push to `main` and on version tags (`v*.*.*`):
- Builds + pushes the backend image to `ghcr.io/<org>/signapps-platform`
- Builds + pushes the frontend image to `ghcr.io/<org>/signapps-frontend`
- Auto-tags a new semver release via `git-cliff` based on Conventional Commits
- Commits the updated `CHANGELOG.md`

**Phase 2 CI prereq:** `Dockerfile.backend` at the repo root and `client/Dockerfile` must exist. They are not part of the Phase 2 plan — create them (or reuse existing ones) before merging.

### Phase 1 POC limitation still applies

The `CacheService` used for the maintenance flag is in-process. The scheduler worker writes to its own cache; the proxy reads from its own cache; they don't share state. A shared cache backend (Redis or similar) is planned for Phase 3+ — until then, the scheduler drives DB state correctly but cannot actually serve the maintenance page to end-users at the proxy level.
