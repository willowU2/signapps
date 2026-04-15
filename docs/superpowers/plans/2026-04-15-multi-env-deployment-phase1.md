# Multi-Env Deployment — Phase 1 (Socle minimum) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pouvoir déployer une nouvelle version de SignApps en prod via CLI (`just deploy-prod v1.2.3`), avec activation automatique d'une page de maintenance, healthchecks, rollback automatique sur échec, et audit trail complet.

**Architecture:** Nouveau service `signapps-deploy` (port 3033) en mode CLI uniquement (API REST dormante). Orchestration via API Docker (`bollard`). Mode maintenance activé via un flag stocké dans `signapps-cache`, lu par un middleware du `signapps-proxy`. Audit dans deux nouvelles tables PostgreSQL (`deployments`, `deployment_audit_log`).

**Tech Stack:** Rust 1.75+, Axum, Tokio, bollard (Docker API), sqlx (PostgreSQL), clap (CLI), vergen (build info), Next.js 16 (page maintenance). Suit la spec `docs/superpowers/specs/2026-04-15-multi-env-deployment-design.md` — sections 2, 3, 4, 5.

**Scope:** Ce plan couvre uniquement **Phase 1** de la spec. Phases 2 (dev+promotion), 3 (admin UI), 4 (on-premise), 5 (Blue/Green) auront chacune leur propre plan.

---

## File Structure

### Fichiers créés

| Fichier | Responsabilité |
|---|---|
| `migrations/305_deployments.sql` | Tables `deployments` + `deployment_audit_log` |
| `crates/signapps-common/build.rs` | Génération infos version via `vergen` |
| `crates/signapps-common/src/version.rs` | Handler réutilisable `GET /version` + struct `VersionInfo` |
| `services/signapps-proxy/src/middleware/maintenance.rs` | Middleware qui sert `/maintenance` si flag activé |
| `services/signapps-proxy/static/maintenance.html` | Page HTML statique (fallback sans JS) |
| `client/src/app/maintenance/page.tsx` | Page Next.js équivalente (dans app quand elle tourne) |
| `services/signapps-deploy/Cargo.toml` | Manifeste du nouveau service |
| `services/signapps-deploy/src/main.rs` | Entry point + routing CLI via `clap` |
| `services/signapps-deploy/src/cli.rs` | Définition des commandes CLI (`deploy`, `rollback`, `status`) |
| `services/signapps-deploy/src/orchestrator.rs` | Machine à états du déploiement |
| `services/signapps-deploy/src/docker.rs` | Wrapper `bollard` : pull, up, down |
| `services/signapps-deploy/src/maintenance.rs` | Activation/désactivation flag maintenance |
| `services/signapps-deploy/src/persistence.rs` | Insertion dans `deployments` + `deployment_audit_log` |
| `services/signapps-deploy/src/migrate.rs` | Exécution des migrations DB via `sqlx migrate run` |
| `services/signapps-deploy/tests/deploy_happy_path.rs` | Test E2E du chemin nominal |
| `services/signapps-deploy/tests/rollback_on_failure.rs` | Test E2E du rollback auto |

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `Cargo.toml` (workspace root) | Ajouter `services/signapps-deploy` aux members |
| `crates/signapps-common/Cargo.toml` | Ajouter `vergen` comme build-dep |
| `crates/signapps-common/src/lib.rs` | Exporter `pub mod version` |
| `services/signapps-identity/src/main.rs` | Monter la route `/version` via `signapps_common::version::router()` |
| `services/signapps-calendar/src/main.rs` | Idem (modèle pour les 31 autres services) |
| `services/signapps-proxy/src/main.rs` | Monter le middleware maintenance |
| `scripts/ports.json` | Ajouter `deploy: 3033` |
| `justfile` | 3 nouvelles recettes : `deploy-prod`, `rollback-prod`, `deploy-status` |
| `.env.example` | Ajouter `GHCR_TOKEN`, `SIGNAPPS_VERSION` |

---

## Task 1: Migration SQL pour les tables deployments

**Files:**
- Create: `migrations/305_deployments.sql`

- [ ] **Step 1: Écrire la migration SQL**

Créer `migrations/305_deployments.sql` :

```sql
-- Migration 305: Deployment tracking tables
-- Spec: docs/superpowers/specs/2026-04-15-multi-env-deployment-design.md section 3.5

BEGIN;

CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    env TEXT NOT NULL CHECK (env IN ('prod', 'dev')),
    version TEXT NOT NULL,
    git_sha TEXT NOT NULL,
    triggered_by UUID REFERENCES users(id),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed', 'rolled_back')),
    previous_version TEXT,
    migrations_applied TEXT[] NOT NULL DEFAULT '{}',
    duration_seconds INT,
    error_message TEXT,
    logs_path TEXT
);

CREATE INDEX idx_deployments_env_time ON deployments (env, triggered_at DESC);
CREATE INDEX idx_deployments_status ON deployments (status) WHERE status IN ('pending', 'running');

CREATE TABLE deployment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID REFERENCES deployments(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_id UUID REFERENCES users(id),
    actor_ip INET,
    actor_user_agent TEXT,
    payload JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_deployment ON deployment_audit_log (deployment_id);
CREATE INDEX idx_audit_actor_time ON deployment_audit_log (actor_id, timestamp DESC);

COMMIT;
```

- [ ] **Step 2: Appliquer la migration**

Run: `just db-migrate`
Expected: `Applied 305_deployments.sql`

- [ ] **Step 3: Vérifier les tables**

Run: `psql "$DATABASE_URL" -c "\d deployments"` et `psql "$DATABASE_URL" -c "\d deployment_audit_log"`
Expected: les deux tables listées avec leurs colonnes et index.

- [ ] **Step 4: Commit**

```bash
rtk git add migrations/305_deployments.sql
rtk git commit -m "feat(deploy): add deployments and audit log tables"
```

---

## Task 2: Endpoint `/version` via signapps-common

**Files:**
- Modify: `crates/signapps-common/Cargo.toml`
- Create: `crates/signapps-common/build.rs`
- Create: `crates/signapps-common/src/version.rs`
- Modify: `crates/signapps-common/src/lib.rs:1-20`

- [ ] **Step 1: Ajouter vergen comme build-dep**

Modifier `crates/signapps-common/Cargo.toml` :

```toml
[build-dependencies]
vergen = { version = "8", features = ["build", "cargo", "git", "gitcl", "rustc"] }
```

- [ ] **Step 2: Créer le build.rs**

Créer `crates/signapps-common/build.rs` :

```rust
use vergen::EmitBuilder;

fn main() {
    EmitBuilder::builder()
        .all_build()
        .all_git()
        .emit()
        .expect("vergen should emit env vars");
}
```

- [ ] **Step 3: Écrire le test de VersionInfo**

Créer `crates/signapps-common/src/version.rs` avec le test d'abord :

```rust
//! Version info endpoint for all SignApps services.

use axum::{response::Json, routing::get, Router};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Version metadata exposed on `/version` by every service.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VersionInfo {
    pub service: String,
    pub version: String,
    pub git_sha: String,
    pub build_time: String,
    pub env: String,
}

impl VersionInfo {
    pub fn from_env(service_name: &'static str) -> Self {
        Self {
            service: service_name.to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            git_sha: env!("VERGEN_GIT_SHA").to_string(),
            build_time: env!("VERGEN_BUILD_TIMESTAMP").to_string(),
            env: std::env::var("SIGNAPPS_ENV").unwrap_or_else(|_| "unknown".to_string()),
        }
    }
}

/// Returns a pre-built router with `GET /version` mounted.
pub fn router(service_name: &'static str) -> Router {
    let info = VersionInfo::from_env(service_name);
    Router::new().route("/version", get(move || {
        let info = info.clone();
        async move { Json(info) }
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_info_populates_all_fields() {
        let info = VersionInfo::from_env("test-svc");
        assert_eq!(info.service, "test-svc");
        assert!(!info.version.is_empty());
        assert!(!info.git_sha.is_empty());
        assert!(!info.build_time.is_empty());
    }
}
```

- [ ] **Step 4: Exporter le module**

Modifier `crates/signapps-common/src/lib.rs` — ajouter après les autres `pub mod` :

```rust
pub mod version;
```

- [ ] **Step 5: Run tests**

Run: `cargo nextest run -p signapps-common version`
Expected: `test version::tests::version_info_populates_all_fields ... PASS`

- [ ] **Step 6: Commit**

```bash
rtk git add crates/signapps-common/
rtk git commit -m "feat(common): add reusable /version endpoint with vergen"
```

---

## Task 3: Monter /version sur identity (service pilote)

**Files:**
- Modify: `services/signapps-identity/src/main.rs`

- [ ] **Step 1: Trouver la création du router**

Run: `grep -n "Router::new" services/signapps-identity/src/main.rs`
Noter la ligne où le router principal est créé.

- [ ] **Step 2: Merger le router version**

Modifier `services/signapps-identity/src/main.rs` — après la création du router principal, ajouter :

```rust
.merge(signapps_common::version::router("signapps-identity"))
```

Exemple :
```rust
let app = Router::new()
    .route("/health", get(health))
    // ... routes existantes ...
    .merge(signapps_common::version::router("signapps-identity"));
```

- [ ] **Step 3: Lancer le service et tester**

Run: `just run identity` (dans un terminal séparé)
Dans un autre terminal : `curl -s http://localhost:3001/version | jq`
Expected: JSON avec `service`, `version`, `git_sha`, `build_time`, `env`.

- [ ] **Step 4: Commit**

```bash
rtk git add services/signapps-identity/src/main.rs
rtk git commit -m "feat(identity): expose /version endpoint"
```

- [ ] **Step 5: Répéter pour les 32 autres services**

Appliquer le même patch (merger `signapps_common::version::router("signapps-<name>")`) dans chaque `services/signapps-*/src/main.rs`.

Commit groupé :
```bash
rtk git add services/
rtk git commit -m "feat(services): expose /version on all 33 services"
```

---

## Task 4: Middleware maintenance mode dans signapps-proxy

**Files:**
- Create: `services/signapps-proxy/src/middleware/maintenance.rs`
- Create: `services/signapps-proxy/static/maintenance.html`
- Modify: `services/signapps-proxy/src/main.rs`

- [ ] **Step 1: Créer la page HTML statique**

Créer `services/signapps-proxy/static/maintenance.html` :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="30">
    <title>Mise à jour en cours — SignApps</title>
    <style>
        body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0a; color: #eaeaea; }
        .card { text-align: center; max-width: 420px; padding: 2rem; }
        h1 { font-size: 1.5rem; margin-bottom: 1rem; }
        p { color: #a0a0a0; line-height: 1.5; }
        .spinner { width: 40px; height: 40px; border: 3px solid #333; border-top-color: #0070f3; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.5rem; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="card">
        <div class="spinner"></div>
        <h1>Mise à jour en cours</h1>
        <p>SignApps sera de retour dans quelques instants.<br>Cette page se rafraîchit automatiquement.</p>
    </div>
</body>
</html>
```

- [ ] **Step 2: Écrire le test du middleware (failing)**

Créer `services/signapps-proxy/src/middleware/maintenance.rs` :

```rust
//! Maintenance mode middleware.
//!
//! Reads the `deploy:maintenance:{env}` cache key. When `true`, returns the
//! static maintenance HTML page with HTTP 503.

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{Html, IntoResponse, Response},
};
use signapps_cache::CacheService;
use std::sync::Arc;

const MAINTENANCE_HTML: &str = include_str!("../../static/maintenance.html");

#[derive(Clone)]
pub struct MaintenanceState {
    pub cache: Arc<CacheService>,
    pub env: String,
}

pub async fn maintenance_middleware(
    State(state): State<MaintenanceState>,
    req: Request,
    next: Next,
) -> Response {
    let key = format!("deploy:maintenance:{}", state.env);
    let is_on = state.cache.get::<bool>(&key).await.unwrap_or(false);
    if is_on {
        return (StatusCode::SERVICE_UNAVAILABLE, Html(MAINTENANCE_HTML)).into_response();
    }
    next.run(req).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request, middleware, routing::get, Router};
    use signapps_cache::CacheService;
    use tower::ServiceExt;

    async fn make_app(cache: Arc<CacheService>, env: &str) -> Router {
        let state = MaintenanceState { cache, env: env.to_string() };
        Router::new()
            .route("/test", get(|| async { "ok" }))
            .layer(middleware::from_fn_with_state(state, maintenance_middleware))
    }

    #[tokio::test]
    async fn returns_503_when_maintenance_on() {
        let cache = Arc::new(CacheService::new_in_memory());
        cache.set("deploy:maintenance:prod", &true, None).await.unwrap();
        let app = make_app(cache, "prod").await;

        let resp = app
            .oneshot(Request::builder().uri("/test").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn passes_through_when_maintenance_off() {
        let cache = Arc::new(CacheService::new_in_memory());
        let app = make_app(cache, "prod").await;

        let resp = app
            .oneshot(Request::builder().uri("/test").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }
}
```

- [ ] **Step 3: Monter le middleware dans le proxy**

Modifier `services/signapps-proxy/src/main.rs` — dans la construction du router, ajouter :

```rust
use crate::middleware::maintenance::{maintenance_middleware, MaintenanceState};

let maintenance_state = MaintenanceState {
    cache: state.cache.clone(),
    env: std::env::var("SIGNAPPS_ENV").unwrap_or_else(|_| "prod".to_string()),
};

let app = app.layer(axum::middleware::from_fn_with_state(
    maintenance_state,
    maintenance_middleware,
));
```

Également créer le fichier `services/signapps-proxy/src/middleware/mod.rs` s'il n'existe pas :

```rust
pub mod maintenance;
```

- [ ] **Step 4: Run tests**

Run: `cargo nextest run -p signapps-proxy maintenance`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add services/signapps-proxy/
rtk git commit -m "feat(proxy): add maintenance mode middleware"
```

---

## Task 5: Page /maintenance dans le frontend Next.js

**Files:**
- Create: `client/src/app/maintenance/page.tsx`

- [ ] **Step 1: Créer la page Next.js**

Créer `client/src/app/maintenance/page.tsx` :

```tsx
'use client';

import { useEffect } from 'react';

export default function MaintenancePage() {
  useEffect(() => {
    const timer = setInterval(() => {
      fetch('/api/v1/health', { cache: 'no-store' })
        .then((r) => { if (r.ok) window.location.href = '/'; })
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
      <div className="text-center max-w-md p-8">
        <div className="mx-auto mb-6 h-10 w-10 rounded-full border-4 border-muted border-t-primary animate-spin" />
        <h1 className="text-2xl font-semibold mb-4">Mise à jour en cours</h1>
        <p className="text-muted-foreground">
          SignApps sera de retour dans quelques instants.
          <br />
          Cette page se rafraîchit automatiquement.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier l'affichage**

Run: `cd client && npm run dev`
Ouvrir : `http://localhost:3000/maintenance`
Expected: page avec spinner + message, thème dark respecté.

- [ ] **Step 3: Commit**

```bash
rtk git add client/src/app/maintenance/page.tsx
rtk git commit -m "feat(client): add maintenance page"
```

---

## Task 6: Squelette du service signapps-deploy

**Files:**
- Create: `services/signapps-deploy/Cargo.toml`
- Create: `services/signapps-deploy/src/main.rs`
- Create: `services/signapps-deploy/src/cli.rs`
- Modify: `Cargo.toml` (workspace root)
- Modify: `scripts/ports.json`

- [ ] **Step 1: Créer le Cargo.toml**

Créer `services/signapps-deploy/Cargo.toml` :

```toml
[package]
name = "signapps-deploy"
version = { workspace = true }
edition = "2021"
rust-version = "1.75"

[dependencies]
anyhow = { workspace = true }
bollard = "0.17"
chrono = { workspace = true }
clap = { version = "4", features = ["derive"] }
serde = { workspace = true }
serde_json = { workspace = true }
signapps-cache = { path = "../../crates/signapps-cache" }
signapps-common = { path = "../../crates/signapps-common" }
signapps-db = { path = "../../crates/signapps-db" }
sqlx = { workspace = true }
thiserror = { workspace = true }
tokio = { workspace = true }
tracing = { workspace = true }
uuid = { workspace = true }

[dev-dependencies]
tempfile = "3"
wiremock = "0.6"
```

- [ ] **Step 2: Ajouter le service au workspace**

Modifier `Cargo.toml` (root) — dans la section `[workspace] members`, ajouter `"services/signapps-deploy"` en respectant l'ordre alphabétique.

- [ ] **Step 3: Créer le main.rs avec clap**

Créer `services/signapps-deploy/src/main.rs` :

```rust
//! SignApps Deploy — Orchestrator for multi-environment deployments.
//!
//! In Phase 1 this runs as a CLI only. The HTTP API is dormant and will be
//! activated in Phase 3 via `DEPLOY_API_ENABLED=true`.

mod cli;
mod docker;
mod maintenance;
mod migrate;
mod orchestrator;
mod persistence;

use clap::Parser;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    signapps_common::bootstrap::init_tracing();
    signapps_common::bootstrap::load_env();

    let args = cli::Cli::parse();
    args.execute().await
}
```

- [ ] **Step 4: Créer cli.rs avec les 3 commandes**

Créer `services/signapps-deploy/src/cli.rs` :

```rust
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "signapps-deploy", about = "SignApps deployment orchestrator")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand)]
pub enum Command {
    /// Deploy a specific version to an environment.
    Deploy {
        #[arg(long, value_parser = ["prod", "dev"])]
        env: String,
        #[arg(long)]
        version: String,
    },
    /// Rollback the last deployment of an environment.
    Rollback {
        #[arg(long, value_parser = ["prod", "dev"])]
        env: String,
    },
    /// Show deployment status of an environment.
    Status {
        #[arg(long, value_parser = ["prod", "dev"])]
        env: String,
    },
}

impl Cli {
    pub async fn execute(self) -> anyhow::Result<()> {
        match self.command {
            Command::Deploy { env, version } => {
                crate::orchestrator::deploy(&env, &version).await
            }
            Command::Rollback { env } => crate::orchestrator::rollback(&env).await,
            Command::Status { env } => crate::orchestrator::status(&env).await,
        }
    }
}
```

- [ ] **Step 5: Stubs pour les modules**

Créer des stubs qui compilent :

`services/signapps-deploy/src/docker.rs` : `//! Docker API wrapper.`
`services/signapps-deploy/src/maintenance.rs` : `//! Maintenance flag toggle.`
`services/signapps-deploy/src/migrate.rs` : `//! DB migration runner.`
`services/signapps-deploy/src/persistence.rs` : `//! Deployments DB access.`

Créer `services/signapps-deploy/src/orchestrator.rs` avec les stubs :

```rust
//! Deployment state machine.

use anyhow::Result;

pub async fn deploy(env: &str, version: &str) -> Result<()> {
    tracing::info!(%env, %version, "deploy not yet implemented");
    anyhow::bail!("deploy not yet implemented")
}

pub async fn rollback(env: &str) -> Result<()> {
    tracing::info!(%env, "rollback not yet implemented");
    anyhow::bail!("rollback not yet implemented")
}

pub async fn status(env: &str) -> Result<()> {
    tracing::info!(%env, "status not yet implemented");
    anyhow::bail!("status not yet implemented")
}
```

- [ ] **Step 6: Ajouter deploy au ports registry**

Modifier `scripts/ports.json` — ajouter l'entrée :

```json
"deploy": 3033
```

(Respecter le format JSON existant.)

- [ ] **Step 7: Vérifier que tout compile**

Run: `cargo check -p signapps-deploy`
Expected: `Finished` sans erreurs.

- [ ] **Step 8: Commit**

```bash
rtk git add Cargo.toml services/signapps-deploy/ scripts/ports.json
rtk git commit -m "feat(deploy): scaffold signapps-deploy service with CLI"
```

---

## Task 7: Docker API wrapper

**Files:**
- Modify: `services/signapps-deploy/src/docker.rs`

- [ ] **Step 1: Écrire le test avec wiremock**

Remplacer `services/signapps-deploy/src/docker.rs` avec un test d'abord :

```rust
//! Docker API wrapper using bollard.
//!
//! Wraps the operations needed by the orchestrator: pull image, up stack,
//! check container health.

use anyhow::{Context, Result};
use bollard::Docker;
use bollard::image::CreateImageOptions;
use futures_util::TryStreamExt;
use std::collections::HashMap;

pub struct DockerClient {
    inner: Docker,
}

impl DockerClient {
    pub fn connect() -> Result<Self> {
        let inner = Docker::connect_with_local_defaults()
            .context("connect to Docker socket")?;
        Ok(Self { inner })
    }

    /// Pull an image by ref (`ghcr.io/foo/bar:v1.2.3`).
    pub async fn pull_image(&self, image_ref: &str) -> Result<()> {
        let opts = CreateImageOptions {
            from_image: image_ref,
            ..Default::default()
        };
        self.inner
            .create_image(Some(opts), None, None)
            .try_for_each(|_| async { Ok(()) })
            .await
            .context("pull image")?;
        Ok(())
    }

    /// List containers healthy on a given docker-compose project.
    pub async fn health_by_project(&self, project: &str) -> Result<HashMap<String, bool>> {
        use bollard::container::ListContainersOptions;
        let mut filters: HashMap<&str, Vec<&str>> = HashMap::new();
        let proj_filter = format!("com.docker.compose.project={project}");
        filters.insert("label", vec![&proj_filter]);
        let containers = self.inner
            .list_containers(Some(ListContainersOptions { all: true, filters, ..Default::default() }))
            .await
            .context("list containers")?;
        let mut out = HashMap::new();
        for c in containers {
            let name = c.names.and_then(|n| n.first().cloned()).unwrap_or_default();
            let healthy = c.status.as_deref().map(|s| s.contains("(healthy)")).unwrap_or(false);
            out.insert(name, healthy);
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn docker_client_connect_does_not_panic_without_socket() {
        // Running on a host without Docker should yield Err, not panic.
        let _ = DockerClient::connect();
    }
}
```

- [ ] **Step 2: Ajouter futures-util au Cargo.toml**

Dans `services/signapps-deploy/Cargo.toml`, section `[dependencies]` :

```toml
futures-util = "0.3"
```

- [ ] **Step 3: Run tests**

Run: `cargo nextest run -p signapps-deploy docker`
Expected: PASS (le test vérifie juste que la connexion ne panique pas).

- [ ] **Step 4: Commit**

```bash
rtk git add services/signapps-deploy/
rtk git commit -m "feat(deploy): wrap bollard Docker API"
```

---

## Task 8: Persistence (insertion dans deployments + audit log)

**Files:**
- Modify: `services/signapps-deploy/src/persistence.rs`

- [ ] **Step 1: Écrire la logique de persistence**

Remplacer `services/signapps-deploy/src/persistence.rs` :

```rust
//! Persistence layer for deployment records.

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

pub struct Deployment {
    pub id: Uuid,
    pub env: String,
    pub version: String,
    pub git_sha: String,
    pub previous_version: Option<String>,
}

pub async fn insert_pending(
    pool: &PgPool,
    env: &str,
    version: &str,
    git_sha: &str,
) -> Result<Deployment> {
    let id = Uuid::new_v4();
    let previous_version: Option<String> = sqlx::query_scalar(
        "SELECT version FROM deployments
         WHERE env = $1 AND status = 'success'
         ORDER BY completed_at DESC LIMIT 1",
    )
    .bind(env)
    .fetch_optional(pool)
    .await?;

    sqlx::query(
        "INSERT INTO deployments (id, env, version, git_sha, status, previous_version, triggered_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, now())",
    )
    .bind(id)
    .bind(env)
    .bind(version)
    .bind(git_sha)
    .bind(&previous_version)
    .execute(pool)
    .await?;

    Ok(Deployment {
        id,
        env: env.to_string(),
        version: version.to_string(),
        git_sha: git_sha.to_string(),
        previous_version,
    })
}

pub async fn mark_running(pool: &PgPool, id: Uuid) -> Result<()> {
    sqlx::query("UPDATE deployments SET status = 'running', started_at = now() WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn mark_success(pool: &PgPool, id: Uuid, migrations: &[String]) -> Result<()> {
    sqlx::query(
        "UPDATE deployments SET
           status = 'success',
           completed_at = now(),
           migrations_applied = $2,
           duration_seconds = EXTRACT(EPOCH FROM (now() - started_at))::int
         WHERE id = $1",
    )
    .bind(id)
    .bind(migrations)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_failed(pool: &PgPool, id: Uuid, error: &str) -> Result<()> {
    sqlx::query(
        "UPDATE deployments SET
           status = 'failed',
           completed_at = now(),
           error_message = $2,
           duration_seconds = EXTRACT(EPOCH FROM (now() - started_at))::int
         WHERE id = $1",
    )
    .bind(id)
    .bind(error)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_rolled_back(pool: &PgPool, id: Uuid) -> Result<()> {
    sqlx::query("UPDATE deployments SET status = 'rolled_back' WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn audit(
    pool: &PgPool,
    deployment_id: Uuid,
    action: &str,
    payload: Value,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO deployment_audit_log (deployment_id, action, payload)
         VALUES ($1, $2, $3)",
    )
    .bind(deployment_id)
    .bind(action)
    .bind(payload)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn last_successful(pool: &PgPool, env: &str) -> Result<Option<(String, DateTime<Utc>)>> {
    let row: Option<(String, DateTime<Utc>)> = sqlx::query_as(
        "SELECT version, completed_at FROM deployments
         WHERE env = $1 AND status = 'success'
         ORDER BY completed_at DESC LIMIT 1",
    )
    .bind(env)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}
```

- [ ] **Step 2: Vérifier que ça compile**

Run: `cargo check -p signapps-deploy`
Expected: `Finished` sans erreurs.

- [ ] **Step 3: Commit**

```bash
rtk git add services/signapps-deploy/
rtk git commit -m "feat(deploy): persistence layer for deployments and audit"
```

---

## Task 9: Maintenance flag toggle

**Files:**
- Modify: `services/signapps-deploy/src/maintenance.rs`

- [ ] **Step 1: Implémenter le toggle**

Remplacer `services/signapps-deploy/src/maintenance.rs` :

```rust
//! Toggle the maintenance flag in the shared cache.

use anyhow::Result;
use signapps_cache::CacheService;
use std::sync::Arc;
use std::time::Duration;

const MAINTENANCE_TTL: Duration = Duration::from_secs(30 * 60); // 30 min safety net

pub async fn enable(cache: &Arc<CacheService>, env: &str) -> Result<()> {
    let key = format!("deploy:maintenance:{env}");
    cache.set(&key, &true, Some(MAINTENANCE_TTL)).await?;
    tracing::warn!(%env, "maintenance mode ENABLED");
    Ok(())
}

pub async fn disable(cache: &Arc<CacheService>, env: &str) -> Result<()> {
    let key = format!("deploy:maintenance:{env}");
    cache.delete(&key).await?;
    tracing::info!(%env, "maintenance mode disabled");
    Ok(())
}
```

- [ ] **Step 2: Vérifier que ça compile**

Run: `cargo check -p signapps-deploy`
Expected: `Finished`. Si `CacheService::delete` n'existe pas, l'ajouter dans `crates/signapps-cache/src/lib.rs` (méthode simple qui supprime une clé).

- [ ] **Step 3: Commit**

```bash
rtk git add services/signapps-deploy/ crates/signapps-cache/
rtk git commit -m "feat(deploy): maintenance flag toggle via cache"
```

---

## Task 10: Migration runner

**Files:**
- Modify: `services/signapps-deploy/src/migrate.rs`

- [ ] **Step 1: Implémenter**

Remplacer `services/signapps-deploy/src/migrate.rs` :

```rust
//! Run pending SQL migrations in an atomic transaction.

use anyhow::Result;
use sqlx::PgPool;

pub async fn run_pending(pool: &PgPool) -> Result<Vec<String>> {
    // sqlx::migrate! embeds migrations from `./migrations` at compile time.
    let migrator = sqlx::migrate!("../../migrations");
    let before: Vec<String> = sqlx::query_scalar("SELECT version::text FROM _sqlx_migrations ORDER BY version")
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    migrator.run(pool).await?;

    let after: Vec<String> = sqlx::query_scalar("SELECT version::text FROM _sqlx_migrations ORDER BY version")
        .fetch_all(pool)
        .await?;

    let applied: Vec<String> = after.into_iter().filter(|v| !before.contains(v)).collect();
    if !applied.is_empty() {
        tracing::info!(count = applied.len(), "migrations applied");
    }
    Ok(applied)
}
```

- [ ] **Step 2: Vérifier**

Run: `cargo check -p signapps-deploy`
Expected: `Finished`.

- [ ] **Step 3: Commit**

```bash
rtk git add services/signapps-deploy/
rtk git commit -m "feat(deploy): SQL migration runner"
```

---

## Task 11: Orchestrator — chemin nominal (deploy)

**Files:**
- Modify: `services/signapps-deploy/src/orchestrator.rs`

- [ ] **Step 1: Implémenter deploy avec machine à états**

Remplacer `services/signapps-deploy/src/orchestrator.rs` :

```rust
//! Deployment state machine.
//!
//! State flow:
//!   pending → running → success
//!                    ↘ failed → rolled_back

use crate::{docker::DockerClient, maintenance, migrate, persistence};
use anyhow::{Context, Result};
use serde_json::json;
use signapps_cache::CacheService;
use signapps_db::DatabasePool;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::{sleep, timeout};

const HEALTHCHECK_TIMEOUT: Duration = Duration::from_secs(300); // 5 min
const HEALTHCHECK_POLL: Duration = Duration::from_secs(2);
const COMPOSE_PROJECT: &str = "signapps-prod";

pub async fn deploy(env: &str, version: &str) -> Result<()> {
    let pool = DatabasePool::connect_from_env().await?.into_inner();
    let cache = Arc::new(CacheService::connect_from_env().await?);
    let docker = DockerClient::connect()?;

    let git_sha = std::env::var("GIT_SHA").unwrap_or_else(|_| "unknown".to_string());
    let dep = persistence::insert_pending(&pool, env, version, &git_sha).await?;
    persistence::audit(&pool, dep.id, "deploy_requested", json!({"version": version})).await?;

    let result = run_deploy(&docker, &cache, &pool, env, version, &dep).await;

    match result {
        Ok(migrations) => {
            maintenance::disable(&cache, env).await.ok();
            persistence::mark_success(&pool, dep.id, &migrations).await?;
            persistence::audit(&pool, dep.id, "deploy_succeeded", json!({})).await?;
            tracing::info!(%env, %version, "deployment succeeded");
            Ok(())
        }
        Err(e) => {
            let err_msg = format!("{e:#}");
            persistence::mark_failed(&pool, dep.id, &err_msg).await?;
            persistence::audit(&pool, dep.id, "deploy_failed", json!({"error": err_msg})).await?;
            tracing::error!(%env, %version, error = %err_msg, "deployment failed");

            // Attempt auto-rollback if we have a previous version.
            if let Some(prev) = &dep.previous_version {
                tracing::warn!(%prev, "attempting auto-rollback");
                if let Err(re) = run_rollback(&docker, &cache, env, prev).await {
                    tracing::error!(error = %re, "auto-rollback also failed; maintenance stays ON");
                } else {
                    persistence::mark_rolled_back(&pool, dep.id).await.ok();
                    persistence::audit(&pool, dep.id, "auto_rolled_back", json!({"to": prev})).await?;
                    maintenance::disable(&cache, env).await.ok();
                }
            } else {
                tracing::warn!("no previous version to roll back to; maintenance stays ON");
            }
            Err(e)
        }
    }
}

async fn run_deploy(
    docker: &DockerClient,
    cache: &Arc<CacheService>,
    pool: &sqlx::PgPool,
    env: &str,
    version: &str,
    dep: &persistence::Deployment,
) -> Result<Vec<String>> {
    persistence::mark_running(pool, dep.id).await?;

    // 1. Pull image
    let image_ref = format!(
        "ghcr.io/your-org/signapps-platform:{version}"
    );
    persistence::audit(pool, dep.id, "pulling_image", json!({"image": &image_ref})).await?;
    docker.pull_image(&image_ref).await.context("pull image")?;

    // 2. Enable maintenance
    maintenance::enable(cache, env).await?;
    persistence::audit(pool, dep.id, "maintenance_on", json!({})).await?;

    // 3. Compose up -d
    persistence::audit(pool, dep.id, "compose_up", json!({})).await?;
    compose_up(version).await.context("docker compose up")?;

    // 4. Wait for healthchecks
    wait_healthy(docker).await.context("wait healthy")?;

    // 5. Run migrations
    persistence::audit(pool, dep.id, "migrations_start", json!({})).await?;
    let applied = migrate::run_pending(pool).await.context("run migrations")?;

    Ok(applied)
}

async fn compose_up(version: &str) -> Result<()> {
    let status = tokio::process::Command::new("docker")
        .args([
            "compose", "-f", "docker-compose.prod.yml",
            "--env-file", ".env.prod",
            "up", "-d",
        ])
        .env("SIGNAPPS_VERSION", version)
        .status()
        .await?;
    anyhow::ensure!(status.success(), "docker compose up failed");
    Ok(())
}

async fn wait_healthy(docker: &DockerClient) -> Result<()> {
    timeout(HEALTHCHECK_TIMEOUT, async {
        loop {
            let health = docker.health_by_project(COMPOSE_PROJECT).await?;
            if !health.is_empty() && health.values().all(|h| *h) {
                return Ok::<(), anyhow::Error>(());
            }
            let unhealthy: Vec<_> = health.iter().filter(|(_, h)| !**h).map(|(n, _)| n.clone()).collect();
            tracing::info!(unhealthy_count = unhealthy.len(), "waiting for healthy");
            sleep(HEALTHCHECK_POLL).await;
        }
    })
    .await
    .context("healthcheck timeout")?
}

pub async fn rollback(env: &str) -> Result<()> {
    let pool = DatabasePool::connect_from_env().await?.into_inner();
    let cache = Arc::new(CacheService::connect_from_env().await?);
    let docker = DockerClient::connect()?;

    let prev = persistence::last_successful(&pool, env).await?
        .ok_or_else(|| anyhow::anyhow!("no successful deployment to roll back to"))?;

    tracing::warn!(%env, version = %prev.0, "manual rollback requested");
    run_rollback(&docker, &cache, env, &prev.0).await
}

async fn run_rollback(
    _docker: &DockerClient,
    cache: &Arc<CacheService>,
    env: &str,
    version: &str,
) -> Result<()> {
    maintenance::enable(cache, env).await?;
    compose_up(version).await?;
    maintenance::disable(cache, env).await?;
    Ok(())
}

pub async fn status(env: &str) -> Result<()> {
    let pool = DatabasePool::connect_from_env().await?.into_inner();
    match persistence::last_successful(&pool, env).await? {
        Some((version, when)) => {
            println!("{env}: v{version} (deployed {when})");
        }
        None => println!("{env}: no successful deployment yet"),
    }
    Ok(())
}
```

- [ ] **Step 2: Ajouter la dépendance DatabasePool::connect_from_env**

Vérifier que `DatabasePool::connect_from_env` existe dans `crates/signapps-db`. Sinon, utiliser directement `sqlx::PgPool::connect(&std::env::var("DATABASE_URL")?)`.

- [ ] **Step 3: Vérifier**

Run: `cargo check -p signapps-deploy`
Expected: `Finished`. Corriger les imports/types manquants si besoin.

- [ ] **Step 4: Commit**

```bash
rtk git add services/signapps-deploy/
rtk git commit -m "feat(deploy): orchestrator with auto-rollback on failure"
```

---

## Task 12: Justfile recettes

**Files:**
- Modify: `justfile`

- [ ] **Step 1: Ajouter les recettes**

Ajouter en fin de `justfile` (juste avant la dernière ligne) :

```just
# ─────────────────────────── Deploy ───────────────────────────

# Deploy a version to prod (with confirmation)
deploy-prod version:
    @echo "Type 'DEPLOY PROD {{version}}' to confirm:"
    @read -r input && [ "$input" = "DEPLOY PROD {{version}}" ] || { echo "Aborted."; exit 1; }
    cargo run --release -p signapps-deploy -- deploy --env prod --version {{version}}

# Deploy a version to dev (no confirmation)
deploy-dev version:
    cargo run --release -p signapps-deploy -- deploy --env dev --version {{version}}

# Rollback the last deployment
rollback-prod:
    @echo "Type 'ROLLBACK PROD' to confirm:"
    @read -r input && [ "$input" = "ROLLBACK PROD" ] || { echo "Aborted."; exit 1; }
    cargo run --release -p signapps-deploy -- rollback --env prod

# Show deploy status
deploy-status env="prod":
    cargo run --release -p signapps-deploy -- status --env {{env}}
```

- [ ] **Step 2: Tester les recettes**

Run: `just --list | grep -E "(deploy|rollback)"`
Expected: 4 nouvelles recettes listées.

- [ ] **Step 3: Commit**

```bash
rtk git add justfile
rtk git commit -m "feat(deploy): add just recipes for deploy/rollback/status"
```

---

## Task 13: Test E2E — happy path

**Files:**
- Create: `services/signapps-deploy/tests/deploy_happy_path.rs`

- [ ] **Step 1: Écrire le test**

Créer `services/signapps-deploy/tests/deploy_happy_path.rs` :

```rust
//! E2E test: full deployment happy path against a test Postgres.

use signapps_deploy as _; // ensure crate builds
use sqlx::PgPool;

async fn test_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL_TEST")
        .unwrap_or_else(|_| "postgres://signapps:password@localhost:5432/signapps_test".to_string());
    let pool = PgPool::connect(&url).await.expect("test db");
    sqlx::migrate!("../../migrations").run(&pool).await.expect("migrate");
    pool
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn deploy_record_created_and_succeeds() {
    let pool = test_pool().await;
    // Clean previous runs
    sqlx::query("DELETE FROM deployments WHERE env = 'test'").execute(&pool).await.ok();

    let dep = signapps_deploy::persistence::insert_pending(&pool, "test", "v0.0.1", "abc123")
        .await
        .expect("insert");
    assert_eq!(dep.env, "test");
    assert_eq!(dep.version, "v0.0.1");

    signapps_deploy::persistence::mark_running(&pool, dep.id).await.unwrap();
    signapps_deploy::persistence::mark_success(&pool, dep.id, &["305".to_string()]).await.unwrap();

    let status: String = sqlx::query_scalar("SELECT status FROM deployments WHERE id = $1")
        .bind(dep.id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status, "success");
}
```

- [ ] **Step 2: Exposer les modules pour les tests**

Modifier `services/signapps-deploy/src/main.rs` — convertir en binary + library. Créer `services/signapps-deploy/src/lib.rs` qui re-exporte les modules :

```rust
pub mod cli;
pub mod docker;
pub mod maintenance;
pub mod migrate;
pub mod orchestrator;
pub mod persistence;
```

Et dans `main.rs`, remplacer les `mod xxx;` par `use signapps_deploy::...;`.

Ajouter dans `Cargo.toml` :

```toml
[lib]
path = "src/lib.rs"

[[bin]]
name = "signapps-deploy"
path = "src/main.rs"
```

- [ ] **Step 3: Run test**

Run: `cargo nextest run -p signapps-deploy --test deploy_happy_path -- --ignored`
Expected: PASS si Postgres est démarré (`just db-start`).

- [ ] **Step 4: Commit**

```bash
rtk git add services/signapps-deploy/
rtk git commit -m "test(deploy): E2E happy path against real Postgres"
```

---

## Task 14: Test E2E — rollback sur échec

**Files:**
- Create: `services/signapps-deploy/tests/rollback_on_failure.rs`

- [ ] **Step 1: Écrire le test**

Créer `services/signapps-deploy/tests/rollback_on_failure.rs` :

```rust
//! E2E test: rollback flow when deploy fails.

use sqlx::PgPool;

async fn test_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL_TEST")
        .unwrap_or_else(|_| "postgres://signapps:password@localhost:5432/signapps_test".to_string());
    let pool = PgPool::connect(&url).await.expect("test db");
    sqlx::migrate!("../../migrations").run(&pool).await.expect("migrate");
    pool
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn failed_deploy_is_marked_and_audited() {
    let pool = test_pool().await;
    sqlx::query("DELETE FROM deployments WHERE env = 'test-rb'").execute(&pool).await.ok();

    // Create a previous successful deployment first
    let prev = signapps_deploy::persistence::insert_pending(&pool, "test-rb", "v0.0.1", "aaa")
        .await.unwrap();
    signapps_deploy::persistence::mark_running(&pool, prev.id).await.unwrap();
    signapps_deploy::persistence::mark_success(&pool, prev.id, &[]).await.unwrap();

    // Now a new deployment that fails
    let dep = signapps_deploy::persistence::insert_pending(&pool, "test-rb", "v0.0.2", "bbb")
        .await.unwrap();
    assert_eq!(dep.previous_version, Some("v0.0.1".to_string()));

    signapps_deploy::persistence::mark_running(&pool, dep.id).await.unwrap();
    signapps_deploy::persistence::mark_failed(&pool, dep.id, "boom").await.unwrap();

    let (status, err): (String, Option<String>) = sqlx::query_as(
        "SELECT status, error_message FROM deployments WHERE id = $1"
    )
    .bind(dep.id)
    .fetch_one(&pool).await.unwrap();
    assert_eq!(status, "failed");
    assert_eq!(err.as_deref(), Some("boom"));

    // Audit
    signapps_deploy::persistence::audit(
        &pool, dep.id, "deploy_failed", serde_json::json!({"error": "boom"})
    ).await.unwrap();

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM deployment_audit_log WHERE deployment_id = $1"
    )
    .bind(dep.id)
    .fetch_one(&pool).await.unwrap();
    assert!(count >= 1);
}
```

- [ ] **Step 2: Run test**

Run: `cargo nextest run -p signapps-deploy --test rollback_on_failure -- --ignored`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
rtk git add services/signapps-deploy/tests/
rtk git commit -m "test(deploy): E2E rollback on failure marks deployment and audit"
```

---

## Task 15: Documentation et validation finale

**Files:**
- Create: `services/signapps-deploy/README.md`

- [ ] **Step 1: Écrire le README**

Créer `services/signapps-deploy/README.md` :

````markdown
# signapps-deploy

Deployment orchestrator for SignApps Platform (Phase 1: CLI mode only).

## Usage

```bash
# Deploy v1.2.3 to prod (with confirmation)
just deploy-prod v1.2.3

# Deploy v1.2.3 to dev
just deploy-dev v1.2.3

# Rollback prod
just rollback-prod

# Check status
just deploy-status prod
```

## What it does

1. Inserts a `pending` deployment record
2. Pulls the Docker image
3. Activates the maintenance flag (proxy serves `/maintenance` page)
4. Runs `docker compose up -d`
5. Waits for all services to be healthy (timeout 5 min)
6. Runs pending DB migrations (in a transaction)
7. Disables the maintenance flag
8. Marks the deployment `success`

On any error, auto-rollback to previous successful version.

## Audit trail

All actions are logged to `deployment_audit_log` (retained 7 years per compliance policy).

## Phase roadmap

- **Phase 1 (current):** CLI only
- **Phase 2:** dev environment + promotion
- **Phase 3:** REST API + admin UI
- **Phase 4:** on-premise installer
- **Phase 5:** Blue/Green (2 machines)

See `docs/superpowers/specs/2026-04-15-multi-env-deployment-design.md`.
````

- [ ] **Step 2: Pipeline qualité complète**

Run séquentiel :
```bash
cargo fmt --all -- --check
cargo clippy -p signapps-deploy --all-features -- -D warnings
cargo nextest run -p signapps-deploy
cargo nextest run -p signapps-common version
cargo nextest run -p signapps-proxy maintenance
```

Expected: tout PASS.

- [ ] **Step 3: Test manuel sur une machine de dev**

Pré-requis : docker-compose up, DB migrée, image `ghcr.io/your-org/signapps-platform:v1.0.0` disponible.

Run: `just deploy-prod v1.0.0`
Expected :
- Confirmation textuelle demandée
- Page maintenance servie par proxy pendant le deploy
- Message `deployment succeeded` à la fin
- Entrée dans `deployments` avec status=success

- [ ] **Step 4: Commit final**

```bash
rtk git add services/signapps-deploy/README.md
rtk git commit -m "docs(deploy): add README with usage and phase roadmap"
```

- [ ] **Step 5: Tag de release Phase 1**

```bash
rtk git tag -a phase1-deploy-complete -m "Phase 1: Multi-env deployment socle minimum complete"
```

---

## Review Checklist (après exécution du plan)

Avant de déclarer Phase 1 complète, valider :

- [ ] `just deploy-prod v1.x.y` fonctionne end-to-end sur machine test
- [ ] Une erreur simulée (image inexistante) déclenche un rollback auto
- [ ] La page `/maintenance` s'affiche pendant le deploy
- [ ] La page redirige automatiquement vers `/` après le deploy
- [ ] Les 33 services exposent `/version` avec les bonnes infos
- [ ] La table `deployments` contient l'historique complet
- [ ] La table `deployment_audit_log` contient au moins 6 entrées par deploy (requested, pulling_image, maintenance_on, compose_up, migrations_start, succeeded)
- [ ] `cargo clippy -D warnings` passe
- [ ] `cargo nextest run -p signapps-deploy` passe (tests unitaires + E2E ignored)
- [ ] Pas de `println!`, `eprintln!`, `dbg!`, `unwrap()`, `expect()` en code non-test
- [ ] Pas de secrets hardcodés (GHCR_TOKEN via env uniquement)
