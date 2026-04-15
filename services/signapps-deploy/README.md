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

`3700` (registered in `scripts/ports.json`). The HTTP server is dormant in
Phase 1 — activated via `DEPLOY_API_ENABLED=true` in Phase 3.

> **Windows note:** `3700` was chosen because the default `3035` slot falls
> inside the Windows Hyper-V reserved port range (`2953-3653` on most
> Docker/WSL hosts). Binding there natively fails with `WSAEACCES (os error
> 10013)`. `3700` is the first port immediately after the reserved block.
> Override with `DEPLOY_PORT=<n>` if needed; run `netsh interface ipv4 show
> excludedportrange protocol=tcp` to list reserved ranges on your host.

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

## Phase 3a additions — HTTP API + WebSocket

The orchestrator now ships a dormant HTTP API (port 3700 — see "Port" section above for the Windows rationale) activated by an env var. When enabled, all endpoints live under `/api/v1/deploy/` and require the `superadmin` JWT role.

### Enabling the API

```bash
export DEPLOY_API_ENABLED=true
export DATABASE_URL=postgres://signapps:signapps_dev@localhost:5432/signapps
export JWT_SECRET=<same as identity>
cargo run --release --bin signapps-deploy-server
```

### Endpoints (v1)

| Method | Path | Purpose |
|---|---|---|
| GET | `/envs` | List environments + current versions |
| GET | `/envs/{env}/health` | Container health (prod/dev) |
| GET | `/versions` | Distinct versions ever deployed |
| GET | `/history?env=&limit=` | Deployment history |
| POST | `/envs/{env}/deploy` | Kick off a deployment (confirm required on prod) |
| POST | `/envs/{env}/rollback` | Rollback (confirm required on prod) |
| POST | `/envs/{env}/maintenance` | Toggle maintenance flag |
| POST | `/promote` | Promote last dev success to prod |
| GET | `/feature-flags?env=` | List flags |
| GET | `/feature-flags/{key}?env=` | Single flag |
| PUT | `/feature-flags/{key}` | Upsert flag (env in body) |
| DELETE | `/feature-flags/{key}?env=` | Delete flag |
| GET | `/events` | WebSocket stream of deploy events |

All routes under `/api/v1/deploy/` require a JWT with `role >= 3` (SuperAdmin).

### OpenAPI + Swagger UI

Interactive docs at `http://<host>:3700/swagger-ui/`. Raw OpenAPI JSON at `/api-docs/openapi.json`.

### Feature flags

Flags live in `feature_flags` (one row per `(key, env)` pair). The evaluator applies rules in order:
1. `enabled == false` -> false
2. `target_users` contains user -> true
3. `target_orgs` contains org -> true
4. `rollout_percent >= 100` -> true
5. `rollout_percent <= 0` -> false
6. Stable hash bucket of seed (user/org id) + flag key mod 100 < percent

Cache TTL 60s; writes invalidate.

### WebSocket

`GET /api/v1/deploy/events` upgrades to a WebSocket. Phase 3a emits a `deploy.connected` startup frame and keeps the connection alive with 30-second pings. Real `deployment.*` event streaming from `PgEventBus` is a documented follow-up.

### Phase 3c: POC limitations resolved

- ✅ **Maintenance flag reaches the proxy.** The flag is now stored in the
  `maintenance_flags` table and read by both the deploy server (writer) and
  the `signapps-proxy` maintenance middleware (reader). Seen by end users.
- ✅ **WebSocket events stream real data.** `GET /api/v1/deploy/events`
  subscribes to the `deployment_events` PG channel (populated by an
  `AFTER INSERT` trigger on `deployment_audit_log`). Every audited deploy
  transition now shows up live in the admin UI.

### Remaining POC limitations

- **No API rate limiting.** Access is gated by the superadmin role; any
  caller with a valid superadmin JWT can spam endpoints. Add a per-IP or
  per-actor limiter in Phase 4+ if the threat model changes.
- **`.sqlx/` offline metadata.** The backend Dockerfile sets
  `SQLX_OFFLINE=true` and expects a `.sqlx/` directory at the repo root.
  Run `cargo sqlx prepare --workspace` against a live DB and commit the
  resulting `.sqlx/*.json` files before CI image builds can succeed.

## Phase 3b additions — Admin UI

Le frontend expose maintenant les pages :

- `/admin/deploy` — Environnements (dashboard : versions en cours, health, actions deploy/rollback/maintenance/promote)
- `/admin/deploy/versions` — Versions déployables + historique
- `/admin/deploy/feature-flags` — CRUD feature flags (rollout, targeting)
- `/admin/deploy/maintenance` — Toggle manuel de maintenance
- `/admin/deploy/runtime-config` — Placeholder (Phase 3c)
- `/admin/deploy/on-premise` — Placeholder (Phase 4)

Toutes les actions destructives utilisent la double confirmation textuelle (même token que les recettes justfile) : `DEPLOY PROD v1.2.3`, `ROLLBACK PROD`, `PROMOTE TO PROD`, `DELETE <key>`.

### Variables d'env frontend

Dans `.env` du frontend ou via Next.js runtime config :

```
NEXT_PUBLIC_DEPLOY_URL=http://localhost:3700
```

### Auth

Les pages `/admin/deploy/*` sont accessibles uniquement aux utilisateurs avec rôle `3` (SuperAdmin), conformément à la garde backend du Phase 3a. Le middleware existant du `/admin` redirige déjà les non-superadmins.

## Phase 3c — Resolved follow-ups

Three gaps identified during Phase 3a/3b review are now closed:

| Gap | Resolution |
|---|---|
| Backend image for CI | `Dockerfile.backend` at repo root, multi-stage Rust build, aligned with existing `docker-compose.prod.yml` paths. |
| WebSocket /events heartbeat-only | Trigger on `deployment_audit_log` → `pg_notify('deployment_events', ...)`, WS handler uses `PgListener` per connection. |
| Maintenance flag in-process | New `maintenance_flags` table + `signapps_common::maintenance_flag` module. Deploy server writes, proxy reads. |

Migration numbers added : `308_deployment_events_notify.sql`, `309_maintenance_flags.sql`.

## Phase 5 — Blue/Green (2-host, zero-downtime)

Activate via `DEPLOY_STRATEGY=blue_green` + SSH targets for the two hosts.

### Architecture

Two machines (`host_blue`, `host_green`) run identical compose stacks. A DB row `active_stack(env, active_color)` tells the proxy which host is currently serving traffic.

### Deploy flow

1. Deploy server reads `active_stack` → `active = blue`
2. Runs `docker compose up -d` on **green** (the idle host) with the new version
3. Polls `docker ps` on green until all containers are healthy
4. Updates `active_stack` row : `blue → green`
5. Proxy sees the swap within 5s (middleware cache TTL) and routes new requests to green
6. Old blue stack stays up — rollback is a single DB swap

### Rollback

Swap the row back. The old stack is still running — zero re-pull, zero re-provision, instantaneous.

### Env vars

```
DEPLOY_STRATEGY=blue_green
DEPLOY_BG_BLUE_SSH=deploy@blue.signapps.internal
DEPLOY_BG_GREEN_SSH=deploy@green.signapps.internal
DEPLOY_BG_COMPOSE_PATH=/etc/signapps/docker-compose.prod.yml
DEPLOY_BG_ENV_PATH=/etc/signapps/.env
DEPLOY_IMAGE_REPO=ghcr.io/myorg/signapps-platform
```

### Wiring

Phase 5 scaffolds everything but the final wiring of `BlueGreenStrategy` in the deploy server is left as a follow-up (requires operator input for SSH targets + pre-deployed compose files). Construct the strategy manually for now:

```rust
use signapps_deploy::strategies::blue_green::BlueGreenStrategy;
use signapps_deploy::docker::remote::RemoteDockerHost;
use std::sync::Arc;

let blue = Arc::new(RemoteDockerHost::new(
    "deploy@blue.signapps.internal".into(),
    "host_blue".into(),
));
let green = Arc::new(RemoteDockerHost::new(
    "deploy@green.signapps.internal".into(),
    "host_green".into(),
));

let strategy = BlueGreenStrategy {
    pool,
    blue_host: blue,
    green_host: green,
    compose_file: "/etc/signapps/docker-compose.prod.yml".into(),
    env_file: "/etc/signapps/.env".into(),
    image_repo: "ghcr.io/myorg/signapps-platform".into(),
    compose_project: "signapps-prod".into(),
};

strategy.deploy("prod", "v1.2.3").await?;
```

### Limitations

- **SSH shell-out.** `RemoteDockerHost` uses `ssh user@host docker ...` under the hood. Requires passwordless SSH key on the deploy server.
- **Compose + env files must be pre-deployed** to both hosts (rsync / ansible / etc.) — not in scope of Phase 5 code.
- **DB migrations** run only on the shared PG instance. Between-version DB changes must remain backward-compatible during the window both stacks are up.
- **Proxy forwarder integration.** The `upstream_switcher` middleware injects the active `Color` into request extensions — the *actual* routing of requests to blue vs green upstream hosts is the proxy forwarder's job (not part of this middleware).
- **No auto-rollback on failed health.** If the target stack fails to become healthy within 5 min, the DB swap doesn't happen and the current active stays up (safe default). An explicit `rollback()` call (single DB swap) is required to return to a known-good state after operator review.
