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
