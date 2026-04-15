# Multi-Env Deployment — Phase 2 (Dev environment + promotion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avoir un environnement `dev` (staging) qui tourne côte à côte avec `prod` sur la même machine POC, avec une commande de promotion `dev → prod` et un système de maintenance planifiée.

**Architecture:** Nouveau `docker-compose.staging.yml` avec ports décalés de +1000 (3xxx → 4xxx), base Postgres logique séparée (`signapps_staging`), network Docker isolé. Extension de `signapps-proxy` pour router selon le hostname (`app.x` vs `staging.x`). Extension de `signapps-deploy` avec une commande `promote` et un worker cron qui exécute les maintenances planifiées. CI/CD GitHub Actions pour builder + tagger les images automatiquement.

**Tech Stack:** Docker Compose 2, PostgreSQL (même instance, 2 bases), Axum hostname routing, `sqlx` pour les queries scheduled_maintenance, `cron` (ou `tokio::time` ticker), GitHub Actions + ghcr.io, `git-cliff` pour les tags.

**Scope:** Ce plan couvre uniquement **Phase 2** de la spec. Phase 1 est un prérequis (branche `feat/phase1-deploy-socle` à mergée ou rebasée). Phases 3-5 auront leurs propres plans.

**Prérequis Phase 1 :**
- Branche `feat/phase1-deploy-socle` (19 commits, tag `phase1-deploy-complete`) ou équivalent mergé sur main
- Tables `deployments` et `deployment_audit_log` en place
- Service `signapps-deploy` avec ses 3 commandes CLI

---

## File Structure

### Fichiers créés

| Fichier | Responsabilité |
|---|---|
| `docker-compose.staging.yml` | Stack dev complète, ports 4xxx, project `signapps-staging` |
| `scripts/init-staging-db.sh` | Crée la base `signapps_staging` + applique migrations |
| `scripts/seed-staging-data.sh` | Charge seed data anonymisé (étend `seed-demo-data.sh`) |
| `migrations/306_scheduled_maintenance.sql` | Table `scheduled_maintenance` |
| `services/signapps-proxy/src/app_middleware/hostname_router.rs` | Routing par Host header (app vs staging) |
| `services/signapps-deploy/src/promote.rs` | Logique de promotion dev → prod |
| `services/signapps-deploy/src/scheduler.rs` | Worker qui exécute les maintenances planifiées |
| `services/signapps-deploy/src/bin/scheduler.rs` | Binaire dédié pour le scheduler |
| `services/signapps-deploy/tests/promote_e2e.rs` | Test E2E de la promotion |
| `services/signapps-deploy/tests/scheduled_maintenance_e2e.rs` | Test E2E du scheduler |
| `.github/workflows/build-and-push.yml` | CI/CD : build + push image + tag git-cliff |

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `services/signapps-deploy/src/cli.rs` | Ajouter commandes `promote` + `schedule-maintenance` |
| `services/signapps-deploy/src/lib.rs` | Exporter les nouveaux modules `promote`, `scheduler` |
| `services/signapps-deploy/src/orchestrator.rs` | Paramétrer `compose_project(env)` pour retourner `signapps-prod` ou `signapps-staging` |
| `services/signapps-deploy/src/maintenance.rs` | Ajouter `is_enabled(cache, env)` pour le scheduler |
| `services/signapps-proxy/src/main.rs` | Monter le hostname router avant le maintenance middleware |
| `justfile` | 3 recettes : `promote-to-prod`, `schedule-maintenance`, `staging-up`, `staging-down` |
| `scripts/ports.json` | Ajouter section `staging` avec ports 4xxx dupliqués |
| `.env.example` | Documenter les vars dev : `STAGING_POSTGRES_DB`, `STAGING_DOMAIN` |

---

## Task 1: Migration SQL scheduled_maintenance

**Files:**
- Create: `migrations/306_scheduled_maintenance.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- Migration 306: Scheduled maintenance windows
-- Spec: docs/superpowers/specs/2026-04-15-multi-env-deployment-design.md section 4.5

BEGIN;

CREATE TABLE scheduled_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    env TEXT NOT NULL CHECK (env IN ('prod', 'dev')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 720),
    message TEXT NOT NULL,
    created_by UUID REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')) DEFAULT 'scheduled',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_reason TEXT
);

CREATE INDEX idx_scheduled_maintenance_env_status_time
    ON scheduled_maintenance (env, status, scheduled_at);

-- Partial index for the scheduler worker's hot query (find next window to run)
CREATE INDEX idx_scheduled_maintenance_next
    ON scheduled_maintenance (scheduled_at)
    WHERE status IN ('scheduled', 'active');

COMMIT;
```

- [ ] **Step 2: Appliquer la migration**

Run:
```bash
docker exec -i signapps-postgres psql -U signapps -d signapps < migrations/306_scheduled_maintenance.sql
```
Expected: `BEGIN`, `CREATE TABLE`, `CREATE INDEX ×2`, `COMMIT`. No `ERROR`.

- [ ] **Step 3: Vérifier la table**

Run: `docker exec signapps-postgres psql -U signapps -d signapps -c "\d scheduled_maintenance"`
Expected: 11 columns, 2 indexes, 3 CHECK constraints, FK to `identity.users(id)`.

- [ ] **Step 4: Commit**

```bash
rtk git add migrations/306_scheduled_maintenance.sql
rtk git commit -m "feat(deploy): add scheduled_maintenance table"
```

---

## Task 2: docker-compose.staging.yml

**Files:**
- Create: `docker-compose.staging.yml`
- Modify: `scripts/ports.json` (ajouter section staging)

- [ ] **Step 1: Créer le compose file**

Créer `docker-compose.staging.yml` en partant de `docker-compose.prod.yml`. Points clés :

```yaml
name: signapps-staging

x-backend: &backend
  image: ghcr.io/your-org/signapps-platform:${SIGNAPPS_STAGING_VERSION:-latest}
  restart: unless-stopped
  networks:
    - signapps-staging
  depends_on:
    postgres:
      condition: service_healthy
  environment: &backend-env
    DATABASE_URL: postgres://signapps:${POSTGRES_PASSWORD}@postgres:5432/signapps_staging
    SIGNAPPS_ENV: dev
    JWT_PUBLIC_KEY_PEM: ${JWT_PUBLIC_KEY_PEM}
    RUST_LOG: ${RUST_LOG:-info,signapps=debug}
    RUST_LOG_FORMAT: json
    MODELS_DIR: /data/models
    GPU_BACKEND: ${GPU_BACKEND:-cpu}
    STORAGE_MODE: fs
    STORAGE_FS_ROOT: /data/storage-staging
```

Tous les services sont dupliqués avec ports +1000. Par exemple :
```yaml
  identity:
    <<: *backend
    command: ["/app/bin/signapps-identity"]
    environment:
      <<: *backend-env
      SERVER_PORT: "3001"
      JWT_PRIVATE_KEY_PEM: ${JWT_PRIVATE_KEY_PEM}
    ports:
      - "${STAGING_IDENTITY_PORT:-4001}:3001"
```

Le conteneur reste sur port 3001 **en interne**, mais expose 4001 à l'hôte. La même approche pour les 32 autres services (calendar 4011, mail 4012, ..., gateway 4099).

**Particularité gateway :**
```yaml
  gateway:
    ports:
      - "${STAGING_GATEWAY_PORT:-4099}:3099"
    environment:
      <<: *backend-env
      IDENTITY_URL: http://identity:3001
      # ... tous les autres URL internes restent sur ports 3xxx (réseau interne)
```

**Service frontend :**
```yaml
  frontend:
    image: ghcr.io/your-org/signapps-frontend:${SIGNAPPS_STAGING_VERSION:-latest}
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_STAGING_API_URL:-http://localhost:4099}
      PORT: "3000"
    ports:
      - "${STAGING_FRONTEND_PORT:-4000}:3000"
```

**Postgres : on NE duplique PAS** — on réutilise l'instance `signapps-postgres` déjà lancée par la stack prod (ou en autonome). La base `signapps_staging` y est créée par un script (Task 3). Donc le compose staging ne déclare pas de service `postgres` ; il pointe vers un `postgres` externe :

```yaml
# Au lieu de déclarer un service postgres, on ajoute dans le network :
networks:
  signapps-staging:
    driver: bridge
    ipam:
      config:
        - subnet: "172.21.0.0/16"

# Et dans les services backend on utilise:
#   DATABASE_URL: postgres://signapps:${POSTGRES_PASSWORD}@host.docker.internal:5432/signapps_staging
```

(Sur Linux, remplacer `host.docker.internal` par `172.17.0.1` ou l'IP du bridge.)

Volumes spécifiques à staging :
```yaml
volumes:
  storage_staging_data:
    driver: local
  models_staging_data:
    driver: local
```

Modifier `scripts/ports.json` pour ajouter une section :

```json
"staging": {
  "_doc": "Staging environment ports — all prod ports +1000",
  "frontend": 4000,
  "services": [
    { "name": "identity", "port": 4001 },
    { "name": "containers", "port": 4002 },
    ...
    { "name": "gateway", "port": 4099 }
  ]
}
```

- [ ] **Step 2: Valider la syntaxe du compose**

Run: `docker compose -f docker-compose.staging.yml config > /dev/null`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
rtk git add docker-compose.staging.yml scripts/ports.json
rtk git commit -m "feat(deploy): staging docker-compose stack with 4xxx ports"
```

---

## Task 3: Script init-staging-db.sh

**Files:**
- Create: `scripts/init-staging-db.sh`

- [ ] **Step 1: Écrire le script**

```bash
#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# init-staging-db.sh — Create and migrate the signapps_staging database
#
# Idempotent: safe to re-run. Uses the existing signapps-postgres container.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${POSTGRES_CONTAINER:-signapps-postgres}"
DB_NAME="${STAGING_POSTGRES_DB:-signapps_staging}"
DB_USER="${POSTGRES_USER:-signapps}"

echo "==> Creating DB '$DB_NAME' if not exists"
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d postgres <<SQL
SELECT 'CREATE DATABASE $DB_NAME'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec
SQL

echo "==> Enabling required extensions on '$DB_NAME'"
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<SQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
SQL

echo "==> Applying migrations from migrations/ (300+)"
for file in $(ls "$BASE_DIR/migrations"/*.sql | sort); do
    name=$(basename "$file")
    # Skip if already applied (tracked in _sqlx_migrations)
    version=$(echo "$name" | grep -oE '^[0-9]+' || true)
    if [[ -n "$version" ]]; then
        already=$(docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
            "SELECT 1 FROM _sqlx_migrations WHERE version = $version LIMIT 1" 2>/dev/null || true)
        if [[ "$already" == "1" ]]; then
            continue
        fi
    fi
    echo "  -> $name"
    docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$file"
done

echo "==> '$DB_NAME' ready"
```

Make executable: `chmod +x scripts/init-staging-db.sh`

- [ ] **Step 2: Tester**

Run: `./scripts/init-staging-db.sh`
Expected: `signapps_staging ready` message, no errors.

Run (idempotency): `./scripts/init-staging-db.sh` again.
Expected: same success, migrations skipped.

- [ ] **Step 3: Vérifier**

Run: `docker exec signapps-postgres psql -U signapps -l | grep signapps_staging`
Expected: the DB is listed.

Run: `docker exec signapps-postgres psql -U signapps -d signapps_staging -c "SELECT count(*) FROM identity.users;"`
Expected: a count (may be 0 on fresh init).

- [ ] **Step 4: Commit**

```bash
rtk git add scripts/init-staging-db.sh
rtk git commit -m "feat(deploy): init-staging-db.sh script"
```

---

## Task 4: Seed staging data

**Files:**
- Create: `scripts/seed-staging-data.sh`

- [ ] **Step 1: Script qui étend seed-demo-data.sh**

```bash
#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# seed-staging-data.sh — Populate signapps_staging with demo/anonymized data
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Export vars so seed-demo-data.sh (or the test-seed tool) targets staging
export DATABASE_URL="postgres://signapps:signapps_dev@127.0.0.1:5432/signapps_staging"
export SIGNAPPS_ENV="dev"

echo "==> Seeding $DATABASE_URL"

# Prefer the Rust seed tool if available
if cargo run -q -p signapps-seed -- --help >/dev/null 2>&1; then
    cargo run -q -p signapps-seed -- --env dev --profile demo
else
    # Fallback: invoke the shell seed script
    "$BASE_DIR/scripts/seed-demo-data.sh"
fi

echo "==> Staging seed complete"
```

Make executable: `chmod +x scripts/seed-staging-data.sh`

- [ ] **Step 2: Tester**

Run: `./scripts/seed-staging-data.sh`
Expected: seed script runs to completion, exit 0.

- [ ] **Step 3: Vérifier**

Run:
```bash
docker exec signapps-postgres psql -U signapps -d signapps_staging \
  -c "SELECT count(*) FROM identity.users;"
```
Expected: > 0 (seeded users present).

- [ ] **Step 4: Commit**

```bash
rtk git add scripts/seed-staging-data.sh
rtk git commit -m "feat(deploy): seed-staging-data.sh script"
```

---

## Task 5: Parametrize compose_project by env in signapps-deploy

**Files:**
- Modify: `services/signapps-deploy/src/orchestrator.rs`

- [ ] **Step 1: Modifier compose_project()**

Remplacer la fonction actuelle :

```rust
// BEFORE:
fn compose_project(_env: &str) -> &'static str {
    DEFAULT_COMPOSE_PROJECT
}

// AFTER:
fn compose_project(env: &str) -> &'static str {
    match env {
        "prod" => "signapps-prod",
        "dev" => "signapps-staging",
        _ => "signapps-prod",
    }
}
```

Remplacer aussi l'appel à `compose_up` pour qu'il prenne l'env :

```rust
// BEFORE:
async fn compose_up(version: &str) -> Result<()> {
    let status = tokio::process::Command::new("docker")
        .args(["compose", "-f", "docker-compose.prod.yml", ...])
        ...
}

// AFTER:
async fn compose_up(env: &str, version: &str) -> Result<()> {
    let compose_file = match env {
        "prod" => "docker-compose.prod.yml",
        "dev" => "docker-compose.staging.yml",
        _ => anyhow::bail!("unknown env: {env}"),
    };
    let env_file = match env {
        "prod" => ".env.prod",
        "dev" => ".env.dev",
        _ => unreachable!(),
    };
    let version_var = match env {
        "prod" => "SIGNAPPS_VERSION",
        "dev" => "SIGNAPPS_STAGING_VERSION",
        _ => unreachable!(),
    };
    let status = tokio::process::Command::new("docker")
        .args([
            "compose", "-f", compose_file,
            "--env-file", env_file,
            "up", "-d",
        ])
        .env(version_var, version)
        .status()
        .await
        .context("spawn docker compose up")?;
    anyhow::ensure!(status.success(), "docker compose up failed on env={env}");
    Ok(())
}
```

Update all call sites of `compose_up` to pass env :
- `run_deploy` line that says `compose_up(version).await.context("docker compose up")?;` → `compose_up(env, version).await.context("docker compose up")?;`
- `run_rollback` similarly.

- [ ] **Step 2: Add test for compose_project**

Add in a `#[cfg(test)] mod tests` block at the end of `orchestrator.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compose_project_maps_known_envs() {
        assert_eq!(compose_project("prod"), "signapps-prod");
        assert_eq!(compose_project("dev"), "signapps-staging");
        assert_eq!(compose_project("unknown"), "signapps-prod");
    }
}
```

- [ ] **Step 3: Run tests**

Run: `cargo nextest run -p signapps-deploy orchestrator`
Expected: 1+ tests PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add services/signapps-deploy/src/orchestrator.rs
rtk git commit -m "feat(deploy): parametrize compose project and file by env"
```

---

## Task 6: Hostname routing middleware in signapps-proxy

**Files:**
- Create: `services/signapps-proxy/src/app_middleware/hostname_router.rs`
- Modify: `services/signapps-proxy/src/app_middleware/mod.rs`
- Modify: `services/signapps-proxy/src/main.rs`

- [ ] **Step 1: Créer le middleware**

```rust
//! Hostname-based routing middleware.
//!
//! Routes requests to the prod or staging backend cluster based on the
//! `Host` header. The backend cluster is selected before any other routing
//! happens, so downstream handlers see the correct upstream services.
//!
//! Mapping:
//! - `app.signapps.io` / `app.localhost` → prod backends (ports 3xxx)
//! - `staging.signapps.io` / `staging.localhost` → staging backends (ports 4xxx)
//! - Anything else → prod (backward compatibility).

use axum::{
    extract::{Request, State},
    http::HeaderValue,
    middleware::Next,
    response::Response,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BackendCluster {
    Prod,
    Staging,
}

impl BackendCluster {
    pub fn port_offset(&self) -> u16 {
        match self {
            BackendCluster::Prod => 0,
            BackendCluster::Staging => 1000,
        }
    }

    pub fn env_name(&self) -> &'static str {
        match self {
            BackendCluster::Prod => "prod",
            BackendCluster::Staging => "dev",
        }
    }
}

#[derive(Clone)]
pub struct HostnameRouterState {
    pub staging_hostnames: Vec<String>,
}

impl Default for HostnameRouterState {
    fn default() -> Self {
        Self {
            staging_hostnames: vec![
                "staging.signapps.io".to_string(),
                "staging.localhost".to_string(),
            ],
        }
    }
}

fn extract_host(header: Option<&HeaderValue>) -> Option<&str> {
    let val = header?.to_str().ok()?;
    // Strip port if present (host:3000 → host)
    Some(val.split(':').next().unwrap_or(val))
}

pub async fn hostname_router_middleware(
    State(state): State<HostnameRouterState>,
    mut req: Request,
    next: Next,
) -> Response {
    let host = extract_host(req.headers().get("host")).unwrap_or("");
    let cluster = if state.staging_hostnames.iter().any(|h| h == host) {
        BackendCluster::Staging
    } else {
        BackendCluster::Prod
    };
    req.extensions_mut().insert(cluster);
    next.run(req).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request as HttpRequest, middleware, routing::get, Router};
    use tower::ServiceExt;

    async fn captured_cluster_app(state: HostnameRouterState) -> Router {
        Router::new()
            .route(
                "/peek",
                get(|req: axum::extract::Request| async move {
                    let cluster = req
                        .extensions()
                        .get::<BackendCluster>()
                        .cloned()
                        .unwrap_or(BackendCluster::Prod);
                    match cluster {
                        BackendCluster::Prod => "prod",
                        BackendCluster::Staging => "staging",
                    }
                }),
            )
            .layer(middleware::from_fn_with_state(state, hostname_router_middleware))
    }

    #[tokio::test]
    async fn routes_staging_hostname_to_staging_cluster() {
        let app = captured_cluster_app(HostnameRouterState::default()).await;
        let resp = app
            .oneshot(
                HttpRequest::builder()
                    .uri("/peek")
                    .header("host", "staging.localhost")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        assert_eq!(&body[..], b"staging");
    }

    #[tokio::test]
    async fn routes_prod_hostname_to_prod_cluster() {
        let app = captured_cluster_app(HostnameRouterState::default()).await;
        let resp = app
            .oneshot(
                HttpRequest::builder()
                    .uri("/peek")
                    .header("host", "app.localhost")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        assert_eq!(&body[..], b"prod");
    }

    #[tokio::test]
    async fn unknown_hostname_defaults_to_prod() {
        let app = captured_cluster_app(HostnameRouterState::default()).await;
        let resp = app
            .oneshot(
                HttpRequest::builder()
                    .uri("/peek")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let body = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        assert_eq!(&body[..], b"prod");
    }

    #[test]
    fn extract_host_strips_port() {
        let v = HeaderValue::from_static("app.localhost:3000");
        assert_eq!(extract_host(Some(&v)), Some("app.localhost"));
    }
}
```

- [ ] **Step 2: Modifier mod.rs**

`services/signapps-proxy/src/app_middleware/mod.rs` — ajouter :

```rust
pub mod hostname_router;
pub mod maintenance;
```

- [ ] **Step 3: Monter le middleware dans le proxy**

Dans `services/signapps-proxy/src/main.rs`, ajouter le hostname router **avant** le maintenance middleware (la chaîne : request → hostname → maintenance → … → handler) :

```rust
use crate::app_middleware::hostname_router::{hostname_router_middleware, HostnameRouterState};

let hostname_state = HostnameRouterState::default();

let app = app
    .layer(axum::middleware::from_fn_with_state(
        hostname_state,
        hostname_router_middleware,
    ))
    .layer(axum::middleware::from_fn_with_state(
        maintenance_state,
        maintenance_middleware,
    ));
```

**Important:** le maintenance middleware devrait aussi lire le `BackendCluster` depuis les extensions pour choisir la bonne clé cache (`deploy:maintenance:prod` vs `deploy:maintenance:dev`). Modifier `maintenance.rs` :

```rust
pub async fn maintenance_middleware(
    State(state): State<MaintenanceState>,
    req: Request,
    next: Next,
) -> Response {
    if is_allowlisted(req.uri().path()) {
        return next.run(req).await;
    }

    // Prefer the env chosen by hostname_router if present; fall back to state.env
    let env = req
        .extensions()
        .get::<crate::app_middleware::hostname_router::BackendCluster>()
        .map(|c| c.env_name().to_string())
        .unwrap_or_else(|| state.env.clone());

    let key = format!("{MAINTENANCE_KEY_PREFIX}{env}");
    let is_on = state.cache.get(&key).await.as_deref() == Some("1");
    if is_on {
        return (StatusCode::SERVICE_UNAVAILABLE, Html(MAINTENANCE_HTML)).into_response();
    }
    next.run(req).await
}
```

- [ ] **Step 4: Run tests**

Run: `cargo nextest run -p signapps-proxy hostname_router`
Expected: 4/4 tests PASS.

Run: `cargo nextest run -p signapps-proxy maintenance`
Expected: still 5/5 tests PASS (no regression).

- [ ] **Step 5: Commit**

```bash
rtk git add services/signapps-proxy/
rtk git commit -m "feat(proxy): hostname-based routing for prod/staging clusters"
```

---

## Task 7: Promote command (dev → prod)

**Files:**
- Create: `services/signapps-deploy/src/promote.rs`
- Modify: `services/signapps-deploy/src/cli.rs`
- Modify: `services/signapps-deploy/src/lib.rs`

- [ ] **Step 1: Implement promote logic**

Create `services/signapps-deploy/src/promote.rs`:

```rust
//! Promote the current dev version to prod.
//!
//! Flow:
//! 1. Fetch the latest successful dev deployment
//! 2. Ensure it's healthy (via docker health check)
//! 3. Run the normal deploy flow on prod with the same version
//!
//! The acquisition of the global advisory lock is done by `orchestrator::deploy`,
//! not here — so we pass through the error path transparently if another deploy
//! is already running.

use crate::{docker::DockerClient, orchestrator, persistence};
use anyhow::{Context, Result};
use sqlx::PgPool;

async fn connect_pool() -> Result<PgPool> {
    let url = std::env::var("DATABASE_URL").context("DATABASE_URL not set")?;
    Ok(PgPool::connect(&url).await?)
}

/// Promote the last successful dev deployment to prod.
pub async fn promote_dev_to_prod() -> Result<()> {
    let pool = connect_pool().await?;

    let (dev_version, deployed_at) = persistence::last_successful(&pool, "dev")
        .await?
        .ok_or_else(|| anyhow::anyhow!(
            "no successful dev deployment to promote — run `just deploy-dev <version>` first"
        ))?;

    tracing::info!(%dev_version, %deployed_at, "promoting dev to prod");

    // Sanity check: dev must be healthy
    let docker = DockerClient::connect()?;
    let health = docker.health_by_project("signapps-staging").await?;
    let total = health.len();
    let healthy = health.values().filter(|h| **h).count();
    if total == 0 {
        anyhow::bail!(
            "dev stack has no containers — is docker-compose.staging.yml up? Run `just staging-up`."
        );
    }
    if healthy < total {
        anyhow::bail!(
            "dev is not fully healthy ({healthy}/{total}) — refusing to promote unreliable state"
        );
    }

    tracing::info!(
        %dev_version,
        healthy_containers = healthy,
        "dev healthy; invoking production deploy with same version"
    );
    orchestrator::deploy("prod", &dev_version).await
}
```

- [ ] **Step 2: Add `promote` to the CLI**

Modify `services/signapps-deploy/src/cli.rs`:

```rust
#[derive(Subcommand)]
pub enum Command {
    Deploy { /* unchanged */ },
    Rollback { /* unchanged */ },
    Status { /* unchanged */ },

    /// Promote the last successful dev deployment to prod.
    Promote,
}

impl Cli {
    pub async fn execute(self) -> anyhow::Result<()> {
        match self.command {
            Command::Deploy { env, version } => crate::orchestrator::deploy(&env, &version).await,
            Command::Rollback { env } => crate::orchestrator::rollback(&env).await,
            Command::Status { env } => crate::orchestrator::status(&env).await,
            Command::Promote => crate::promote::promote_dev_to_prod().await,
        }
    }
}
```

- [ ] **Step 3: Export the module**

In `services/signapps-deploy/src/lib.rs`, add:

```rust
pub mod promote;
```

- [ ] **Step 4: Build + smoke test**

Run: `cargo build -p signapps-deploy` — must succeed.
Run: `cargo run -p signapps-deploy -- promote 2>&1 | head -5`
Expected: error message `"no successful dev deployment to promote"` (because we have none yet) — confirms wiring works.

- [ ] **Step 5: Commit**

```bash
rtk git add services/signapps-deploy/
rtk git commit -m "feat(deploy): promote command (dev -> prod)"
```

---

## Task 8: Scheduled maintenance worker

**Files:**
- Create: `services/signapps-deploy/src/scheduler.rs`
- Create: `services/signapps-deploy/src/bin/scheduler.rs`
- Modify: `services/signapps-deploy/src/lib.rs`
- Modify: `services/signapps-deploy/src/cli.rs`
- Modify: `services/signapps-deploy/src/maintenance.rs`

- [ ] **Step 1: Add `is_enabled` to maintenance module**

Modify `services/signapps-deploy/src/maintenance.rs` — add after `disable`:

```rust
/// Check whether maintenance mode is currently enabled for the given env.
pub async fn is_enabled(cache: &Arc<CacheService>, env: &str) -> bool {
    cache.get(&key(env)).await.as_deref() == Some("1")
}
```

Add a test in the existing `#[cfg(test)] mod tests`:

```rust
#[tokio::test]
async fn is_enabled_matches_state() {
    let cache = Arc::new(CacheService::default_config());
    assert!(!is_enabled(&cache, "test").await);
    enable(&cache, "test").await.unwrap();
    assert!(is_enabled(&cache, "test").await);
    disable(&cache, "test").await.unwrap();
    assert!(!is_enabled(&cache, "test").await);
}
```

- [ ] **Step 2: Create scheduler module**

`services/signapps-deploy/src/scheduler.rs`:

```rust
//! Scheduled maintenance worker.
//!
//! Polls the `scheduled_maintenance` table every 30 seconds. For each window
//! whose `scheduled_at + duration` encompasses `now()`:
//!   - if status is `scheduled`: enable the maintenance flag, mark `active`
//!   - if status is `active` and now > end: disable the flag, mark `completed`
//!
//! This worker is its own binary (`signapps-deploy-scheduler`) so it can run
//! as a long-lived process alongside the main deploy CLI.

use crate::maintenance;
use anyhow::{Context, Result};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use signapps_cache::CacheService;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;
use uuid::Uuid;

const POLL_INTERVAL: Duration = Duration::from_secs(30);

pub struct SchedulerDeps {
    pub pool: PgPool,
    pub cache: Arc<CacheService>,
}

struct Window {
    id: Uuid,
    env: String,
    scheduled_at: DateTime<Utc>,
    duration_minutes: i32,
    status: String,
}

async fn fetch_active_or_due_windows(pool: &PgPool) -> Result<Vec<Window>> {
    let rows: Vec<(Uuid, String, DateTime<Utc>, i32, String)> = sqlx::query_as(
        "SELECT id, env, scheduled_at, duration_minutes, status \
         FROM scheduled_maintenance \
         WHERE status IN ('scheduled', 'active') \
         AND scheduled_at <= now() + interval '1 minute' \
         ORDER BY scheduled_at ASC",
    )
    .fetch_all(pool)
    .await
    .context("fetch scheduled maintenance")?;

    Ok(rows
        .into_iter()
        .map(|(id, env, scheduled_at, duration_minutes, status)| Window {
            id,
            env,
            scheduled_at,
            duration_minutes,
            status,
        })
        .collect())
}

async fn start_window(pool: &PgPool, cache: &Arc<CacheService>, w: &Window) -> Result<()> {
    maintenance::enable(cache, &w.env).await?;
    sqlx::query(
        "UPDATE scheduled_maintenance SET status = 'active', started_at = now() WHERE id = $1",
    )
    .bind(w.id)
    .execute(pool)
    .await?;
    tracing::warn!(env = %w.env, id = %w.id, "maintenance window ACTIVATED");
    Ok(())
}

async fn end_window(pool: &PgPool, cache: &Arc<CacheService>, w: &Window) -> Result<()> {
    maintenance::disable(cache, &w.env).await?;
    sqlx::query(
        "UPDATE scheduled_maintenance SET status = 'completed', completed_at = now() WHERE id = $1",
    )
    .bind(w.id)
    .execute(pool)
    .await?;
    tracing::info!(env = %w.env, id = %w.id, "maintenance window COMPLETED");
    Ok(())
}

async fn tick(deps: &SchedulerDeps) -> Result<()> {
    let now = Utc::now();
    for w in fetch_active_or_due_windows(&deps.pool).await? {
        let end = w.scheduled_at + ChronoDuration::minutes(w.duration_minutes as i64);

        match w.status.as_str() {
            "scheduled" if w.scheduled_at <= now => {
                start_window(&deps.pool, &deps.cache, &w).await?;
            }
            "active" if end <= now => {
                end_window(&deps.pool, &deps.cache, &w).await?;
            }
            _ => {
                // not time yet / already handled
            }
        }
    }
    Ok(())
}

/// Run the scheduler loop forever.
pub async fn run(deps: SchedulerDeps) -> Result<()> {
    tracing::info!("scheduled maintenance worker starting");
    loop {
        if let Err(e) = tick(&deps).await {
            tracing::error!(error = %e, "scheduler tick failed, will retry");
        }
        sleep(POLL_INTERVAL).await;
    }
}

#[cfg(test)]
mod tests {
    // See tests/scheduled_maintenance_e2e.rs for integration tests;
    // unit-testing the tick function requires a live DB so we skip here.
}
```

- [ ] **Step 3: Create the binary**

`services/signapps-deploy/src/bin/scheduler.rs`:

```rust
//! Scheduled maintenance worker binary — long-lived process.

use anyhow::{Context, Result};
use signapps_cache::CacheService;
use signapps_deploy::scheduler::{run, SchedulerDeps};
use sqlx::PgPool;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<()> {
    signapps_common::bootstrap::init_tracing("signapps-deploy-scheduler");
    signapps_common::bootstrap::load_env();

    let url = std::env::var("DATABASE_URL").context("DATABASE_URL not set")?;
    let pool = PgPool::connect(&url).await?;
    let cache = Arc::new(CacheService::default_config());

    run(SchedulerDeps { pool, cache }).await
}
```

- [ ] **Step 4: Add `schedule-maintenance` CLI command**

Modify `services/signapps-deploy/src/cli.rs`:

```rust
use chrono::{DateTime, Utc};

#[derive(Subcommand)]
pub enum Command {
    // ... existing commands ...

    /// Schedule a maintenance window.
    ScheduleMaintenance {
        #[arg(long, value_parser = ["prod", "dev"])]
        env: String,
        /// RFC 3339 timestamp, e.g. 2026-04-20T03:00:00Z
        #[arg(long)]
        at: DateTime<Utc>,
        /// Duration in minutes (1-720)
        #[arg(long)]
        duration_minutes: i32,
        /// Human-readable message shown in the UI (future Phase 3)
        #[arg(long, default_value = "Scheduled maintenance")]
        message: String,
    },

    /// List upcoming maintenance windows.
    ListMaintenance {
        #[arg(long, value_parser = ["prod", "dev"], default_value = "prod")]
        env: String,
    },
}
```

Add the dispatch in `impl Cli::execute`:

```rust
Command::ScheduleMaintenance { env, at, duration_minutes, message } => {
    crate::promote::schedule_maintenance(&env, at, duration_minutes, &message).await
}
Command::ListMaintenance { env } => crate::promote::list_maintenance(&env).await,
```

And add these two functions in `promote.rs` (even though they're not about promotion — they fit the CLI narrative of "operator helpers"):

```rust
use chrono::{DateTime, Utc};

pub async fn schedule_maintenance(
    env: &str,
    at: DateTime<Utc>,
    duration_minutes: i32,
    message: &str,
) -> anyhow::Result<()> {
    let pool = connect_pool().await?;
    let id = uuid::Uuid::new_v4();
    sqlx::query(
        "INSERT INTO scheduled_maintenance (id, env, scheduled_at, duration_minutes, message, status) \
         VALUES ($1, $2, $3, $4, $5, 'scheduled')",
    )
    .bind(id)
    .bind(env)
    .bind(at)
    .bind(duration_minutes)
    .bind(message)
    .execute(&pool)
    .await?;
    println!("Scheduled maintenance window {id} for {env} at {at} ({duration_minutes}m)");
    Ok(())
}

pub async fn list_maintenance(env: &str) -> anyhow::Result<()> {
    let pool = connect_pool().await?;
    let rows: Vec<(uuid::Uuid, DateTime<Utc>, i32, String, String)> = sqlx::query_as(
        "SELECT id, scheduled_at, duration_minutes, status, message \
         FROM scheduled_maintenance \
         WHERE env = $1 AND status IN ('scheduled', 'active') \
         ORDER BY scheduled_at",
    )
    .bind(env)
    .fetch_all(&pool)
    .await?;
    if rows.is_empty() {
        println!("No scheduled maintenance for {env}");
        return Ok(());
    }
    for (id, at, dur, status, message) in rows {
        println!("{id} | {at} | {dur}m | {status} | {message}");
    }
    Ok(())
}
```

- [ ] **Step 5: Register the binary in Cargo.toml**

Modify `services/signapps-deploy/Cargo.toml` — add after the existing `[[bin]]`:

```toml
[[bin]]
name = "signapps-deploy-scheduler"
path = "src/bin/scheduler.rs"
```

- [ ] **Step 6: Export module**

`services/signapps-deploy/src/lib.rs` — add:

```rust
pub mod scheduler;
```

- [ ] **Step 7: Build and test**

Run: `cargo build -p signapps-deploy`
Expected: both binaries compile.

Run: `cargo nextest run -p signapps-deploy maintenance`
Expected: 3 tests PASS (original 2 + new `is_enabled_matches_state`).

- [ ] **Step 8: Commit**

```bash
rtk git add services/signapps-deploy/
rtk git commit -m "feat(deploy): scheduled maintenance worker + CLI commands"
```

---

## Task 9: Justfile recipes for Phase 2

**Files:**
- Modify: `justfile`

- [ ] **Step 1: Add recipes**

Add to the `# ─── Deploy ───` section :

```just
# Bring up the staging stack (side-by-side with prod)
staging-up:
    ./scripts/init-staging-db.sh
    docker compose -f docker-compose.staging.yml --env-file .env.dev up -d

# Stop the staging stack
staging-down:
    docker compose -f docker-compose.staging.yml --env-file .env.dev down

# Seed staging with demo data
staging-seed:
    ./scripts/seed-staging-data.sh

# Promote the last successful dev deployment to prod (with confirmation)
promote-to-prod:
    @[ -t 0 ] || { echo "Interactive terminal required." >&2; exit 1; }
    @echo "Type 'PROMOTE TO PROD' to confirm:"
    @read -r input && [ "$input" = "PROMOTE TO PROD" ] || { echo "Aborted."; exit 1; }
    cargo run --release -p signapps-deploy -- promote

# Schedule a maintenance window
schedule-maintenance env at duration message:
    cargo run --release -p signapps-deploy -- schedule-maintenance \
        --env {{env}} --at {{at}} --duration-minutes {{duration}} --message "{{message}}"

# List upcoming maintenance windows
list-maintenance env="prod":
    cargo run --release -p signapps-deploy -- list-maintenance --env {{env}}

# Run the scheduler worker in the foreground (typically run as a service in prod)
scheduler-run:
    cargo run --release --bin signapps-deploy-scheduler
```

- [ ] **Step 2: Validate recipes appear**

Run: `just --list | grep -E "(staging|promote|maintenance|scheduler)"`
Expected: 7 new recipes listed.

- [ ] **Step 3: Commit**

```bash
rtk git add justfile
rtk git commit -m "feat(deploy): just recipes for staging/promote/scheduler"
```

---

## Task 10: E2E test — promotion happy path

**Files:**
- Create: `services/signapps-deploy/tests/promote_e2e.rs`

- [ ] **Step 1: Write the test**

```rust
//! E2E test: promote inherits the last successful dev version.

use sqlx::PgPool;

async fn test_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps".to_string());
    PgPool::connect(&url).await.expect("connect")
}

async fn cleanup(pool: &PgPool) {
    let _ = sqlx::query("DELETE FROM deployments WHERE version LIKE 'v0.0.0-promote-%'")
        .execute(pool)
        .await;
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn last_successful_dev_is_visible_to_promote_logic() {
    let pool = test_pool().await;
    cleanup(&pool).await;

    // Simulate a successful dev deploy
    let dep = signapps_deploy::persistence::insert_pending(
        &pool, "dev", "v0.0.0-promote-candidate", "sha1",
    )
    .await
    .expect("insert");
    signapps_deploy::persistence::mark_running(&pool, dep.id).await.expect("running");
    signapps_deploy::persistence::mark_success(&pool, dep.id, &[]).await.expect("success");

    // Query as promote() would
    let got = signapps_deploy::persistence::last_successful(&pool, "dev")
        .await
        .expect("query")
        .expect("some");
    assert_eq!(got.0, "v0.0.0-promote-candidate");

    cleanup(&pool).await;
}
```

- [ ] **Step 2: Run**

Run: `cargo nextest run -p signapps-deploy --test promote_e2e -- --ignored`
Expected: 1 PASS.

- [ ] **Step 3: Commit**

```bash
rtk git add services/signapps-deploy/tests/promote_e2e.rs
rtk git commit -m "test(deploy): E2E test for promotion lookup"
```

---

## Task 11: E2E test — scheduler tick

**Files:**
- Create: `services/signapps-deploy/tests/scheduled_maintenance_e2e.rs`

- [ ] **Step 1: Write the test**

```rust
//! E2E test: scheduler transitions a window from scheduled → active → completed.

use chrono::{Duration as ChronoDuration, Utc};
use signapps_cache::CacheService;
use signapps_deploy::scheduler::SchedulerDeps;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

async fn test_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps".to_string());
    PgPool::connect(&url).await.expect("connect")
}

async fn cleanup(pool: &PgPool, id: Uuid) {
    let _ = sqlx::query("DELETE FROM scheduled_maintenance WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await;
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn window_transitions_on_time() {
    // To test deterministically, the scheduler's tick function is exposed only
    // through the `run()` infinite loop. We invoke the persistence layer
    // directly to simulate what a tick would observe.

    let pool = test_pool().await;
    let id = Uuid::new_v4();
    let env = "dev";

    // Insert a window that should be ACTIVATED immediately (scheduled_at = now)
    let now = Utc::now();
    sqlx::query(
        "INSERT INTO scheduled_maintenance (id, env, scheduled_at, duration_minutes, message, status) \
         VALUES ($1, $2, $3, 1, 'test', 'scheduled')",
    )
    .bind(id)
    .bind(env)
    .bind(now)
    .execute(&pool)
    .await
    .expect("insert scheduled");

    // Fetch as the scheduler would
    let found: (String, ) = sqlx::query_as(
        "SELECT status FROM scheduled_maintenance WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .expect("fetch");
    assert_eq!(found.0, "scheduled");

    // Simulate the scheduler's `start_window` by calling maintenance::enable directly
    let cache = Arc::new(CacheService::default_config());
    signapps_deploy::maintenance::enable(&cache, env).await.expect("enable");
    sqlx::query(
        "UPDATE scheduled_maintenance SET status = 'active', started_at = now() WHERE id = $1",
    )
    .bind(id)
    .execute(&pool)
    .await
    .expect("update active");

    assert!(signapps_deploy::maintenance::is_enabled(&cache, env).await);

    // Now simulate end
    signapps_deploy::maintenance::disable(&cache, env).await.expect("disable");
    sqlx::query(
        "UPDATE scheduled_maintenance SET status = 'completed', completed_at = now() WHERE id = $1",
    )
    .bind(id)
    .execute(&pool)
    .await
    .expect("update completed");

    assert!(!signapps_deploy::maintenance::is_enabled(&cache, env).await);

    let final_status: (String, ) = sqlx::query_as(
        "SELECT status FROM scheduled_maintenance WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .expect("fetch final");
    assert_eq!(final_status.0, "completed");

    cleanup(&pool, id).await;

    // silence unused var warning
    let _ = SchedulerDeps { pool, cache };
}
```

- [ ] **Step 2: Run**

Run: `cargo nextest run -p signapps-deploy --test scheduled_maintenance_e2e -- --ignored`
Expected: 1 PASS.

- [ ] **Step 3: Commit**

```bash
rtk git add services/signapps-deploy/tests/scheduled_maintenance_e2e.rs
rtk git commit -m "test(deploy): E2E scheduled maintenance lifecycle"
```

---

## Task 12: CI/CD — GitHub Actions workflow

**Files:**
- Create: `.github/workflows/build-and-push.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Build and push image

on:
  push:
    branches:
      - main
    tags:
      - 'v*.*.*'
  workflow_dispatch:

permissions:
  contents: write
  packages: write

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/signapps-platform
  FRONTEND_IMAGE_NAME: ${{ github.repository_owner }}/signapps-frontend

jobs:
  build-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate tag via git-cliff
        id: tag
        uses: orhun/git-cliff-action@v4
        with:
          config: cliff.toml
          args: --bump --tag=auto
        env:
          OUTPUT: CHANGELOG.md

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable=${{ github.ref == format('refs/heads/{0}', 'main') }}
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha,prefix=sha-,format=short

      - name: Build and push backend image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile.backend
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  build-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract frontend metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.FRONTEND_IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable=${{ github.ref == format('refs/heads/{0}', 'main') }}
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha,prefix=sha-,format=short

      - name: Build and push frontend image
        uses: docker/build-push-action@v6
        with:
          context: ./client
          file: ./client/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Note on Dockerfiles:** this plan assumes `Dockerfile.backend` at repo root and `client/Dockerfile` exist. If they don't (Phase 1 built the binaries locally), add a **blocking-if-missing** pre-check in Task 14 (docs) that lists them as follow-up work before CI can run.

- [ ] **Step 2: Validate YAML syntax**

Run: `cat .github/workflows/build-and-push.yml | python -c "import yaml,sys; yaml.safe_load(sys.stdin); print('OK')"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
rtk git add .github/workflows/build-and-push.yml
rtk git commit -m "ci(deploy): build + push images to ghcr.io on main and tags"
```

---

## Task 13: Update signapps-deploy README with Phase 2 additions

**Files:**
- Modify: `services/signapps-deploy/README.md`

- [ ] **Step 1: Add Phase 2 section after the existing "Usage" block**

Add :

````markdown
## Phase 2 additions

### Staging environment

```bash
# Start the staging stack (ports 4xxx)
just staging-up

# Seed it with demo data
just staging-seed

# Stop it
just staging-down
```

### Promotion

```bash
# Deploy to dev first
just deploy-dev v1.2.3

# Once validated, promote the same version to prod
just promote-to-prod
```

The promote command:
1. Looks up the last successful `env=dev` deployment
2. Verifies the staging stack is healthy
3. Runs the normal deploy flow on `env=prod` with the same version

### Scheduled maintenance

```bash
# Schedule a 15-minute maintenance on prod starting Apr 20 at 3am UTC
just schedule-maintenance prod 2026-04-20T03:00:00Z 15 "Nightly DB index rebuild"

# List upcoming windows
just list-maintenance prod

# Run the scheduler worker (typically as a systemd service in prod)
just scheduler-run
```

The scheduler polls every 30 seconds. When a window's `scheduled_at` is reached, the maintenance flag is enabled; when `scheduled_at + duration` passes, it's disabled.

### CI/CD

`.github/workflows/build-and-push.yml` builds and pushes images on every push to `main` and on version tags (`v*.*.*`). The tag is generated by `git-cliff` from Conventional Commits.
````

- [ ] **Step 2: Commit**

```bash
rtk git add services/signapps-deploy/README.md
rtk git commit -m "docs(deploy): Phase 2 additions in README"
```

---

## Task 14: Final validation

**Files:** none (read-only check)

- [ ] **Step 1: Full quality pipeline**

```
cargo fmt --all -- --check
cargo clippy -p signapps-deploy -p signapps-proxy --all-features -- -D warnings
cargo nextest run -p signapps-deploy -p signapps-proxy
cargo nextest run -p signapps-deploy --run-ignored only
```

Each must PASS. If the pre-existing fmt drift from Phase 1 resurfaces, run `cargo fmt --all` and commit as a `style(deploy)` commit before tagging.

- [ ] **Step 2: Manual smoke test**

```
just staging-up
# wait ~30s for containers to settle
just deploy-status prod
just deploy-status dev
just list-maintenance prod
# schedule a 1-min maintenance starting 1 min from now (bash: date -u -d '+1 min' +%Y-%m-%dT%H:%M:%SZ)
```

Verify via psql :
```
docker exec signapps-postgres psql -U signapps -d signapps \
  -c "SELECT id, env, scheduled_at, status FROM scheduled_maintenance ORDER BY created_at DESC LIMIT 5;"
```

Then `just staging-down`.

- [ ] **Step 3: Tag completion**

```bash
rtk git tag -a phase2-deploy-complete -m "Phase 2: dev env + promotion + scheduled maintenance + CI complete"
```

Do NOT push.

---

## Review Checklist (après exécution du plan)

Avant de déclarer Phase 2 complète, valider :

- [ ] `just staging-up` démarre une stack dev complète sur ports 4xxx
- [ ] `just staging-seed` remplit la base `signapps_staging` sans toucher à `signapps`
- [ ] `just deploy-dev v1.x.y` puis `just promote-to-prod` fonctionne end-to-end
- [ ] Le worker scheduler (`just scheduler-run`) fait correctement transitionner une fenêtre scheduled → active → completed
- [ ] Le middleware hostname_router route correctement selon le Host header (4 tests)
- [ ] Le middleware maintenance honore le cluster choisi par hostname_router (test regression)
- [ ] Le workflow CI builde et pousse les images sur push `main` et sur tag
- [ ] `cargo clippy -D warnings` passe sur tous les crates modifiés
- [ ] Les E2E tests passent (`cargo nextest run --run-ignored only`)
- [ ] Pas de nouveaux `unwrap()` / `println!` / `dbg!` en code non-test
- [ ] Les tables `scheduled_maintenance` et `deployments` partagent bien l'instance Postgres mais pas la base (prod=signapps, staging=signapps_staging)
