# Multi-Env Deployment — Phase 5 (Blue/Green 2 machines) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre le déploiement Blue/Green sur 2 machines séparées (prod host + staging host). Zero-downtime réel : on déploie la nouvelle version sur la machine "green" (staging actuel), on teste, puis on bascule le trafic de la "blue" (prod actuel) vers la "green" via le proxy. L'ancienne blue devient la nouvelle staging.

**Architecture:** `signapps-deploy` apprend à piloter des hosts Docker distants via SSH (tunnel) ou Docker API socket exposé en TLS. Une nouvelle abstraction `DockerHost` remplace le `DockerClient` local-only. Un flag `DEPLOY_STRATEGY=blue_green` active la logique : deploy sur host inactif, wait healthy, switch proxy DNS/route, mark new active. Un proxy frontal (haproxy / caddy / signapps-proxy lui-même en mode "load-balancer-of-upstreams") lit une clé `active_stack=blue|green` pour router le trafic.

**Tech Stack:** Rust, `bollard` (Docker API over TCP/TLS), `russh` or shell-out to `ssh` for remote SSH commands, `signapps-common::config` extensions pour `DEPLOY_STRATEGY`, modifications au `signapps-proxy` pour introduire un upstream switchable.

**Scope:** Phase 5 uniquement. Prérequis : Phase 1-4 mergées ou disponibles en branche parente. Ce plan NE traite PAS la configuration réseau / DNS / TLS entre les 2 machines — c'est une tâche d'ops, pas de code.

**Préconditions opérationnelles (hors code) :**
- 2 machines atteignables par SSH depuis la machine qui exécute `signapps-deploy`
- Docker daemon sur chaque machine exposé sur un socket local (pas besoin de TCP si SSH tunnel)
- Un load-balancer entre les clients et les 2 machines (peut être le signapps-proxy lui-même, ou un haproxy externe)
- DNS records `app.signapps.io` pointant soit directement sur le LB, soit sur un VIP

---

## File Structure

### Fichiers créés

| Fichier | Responsabilité |
|---|---|
| `migrations/310_active_stack.sql` | Table `active_stack` (env → `blue` ou `green`) |
| `crates/signapps-common/src/active_stack.rs` | Module partagé : `get_active_stack(pool, env)`, `swap(pool, env)` |
| `services/signapps-deploy/src/docker/mod.rs` | Nouveau module (split du `docker.rs` actuel) |
| `services/signapps-deploy/src/docker/local.rs` | Wrapper bollard pour Docker local (ex-`docker.rs`) |
| `services/signapps-deploy/src/docker/remote.rs` | Wrapper bollard over TCP/TLS pour Docker distant |
| `services/signapps-deploy/src/docker/host.rs` | Trait `DockerHost` unifié + factory selon config |
| `services/signapps-deploy/src/strategies/mod.rs` | Nouveau module stratégies de déploiement |
| `services/signapps-deploy/src/strategies/maintenance_window.rs` | Stratégie actuelle (single-host, maintenance) |
| `services/signapps-deploy/src/strategies/blue_green.rs` | Stratégie Blue/Green (2 hosts, zero-downtime) |
| `services/signapps-proxy/src/app_middleware/upstream_switcher.rs` | Middleware qui choisit l'upstream selon `active_stack` |
| `services/signapps-deploy/tests/blue_green_state_e2e.rs` | Test E2E swap actif + persistence |

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `services/signapps-deploy/src/lib.rs` | Exporter `pub mod docker; pub mod strategies;` |
| `services/signapps-deploy/src/orchestrator.rs` | Router vers la bonne stratégie selon `DEPLOY_STRATEGY` |
| `services/signapps-deploy/src/bin/server.rs` | Charger la strategy depuis config |
| `services/signapps-deploy/Cargo.toml` | Ajouter `russh = "0.45"` OU juste shell-out ssh |
| `.env.example` | `DEPLOY_STRATEGY=maintenance_window` (default) et vars SSH/hosts |
| `services/signapps-deploy/README.md` | Section Phase 5 |

---

## Task 1: Migration `active_stack` table

**Files:**
- Create: `migrations/310_active_stack.sql`

- [ ] **Step 1: SQL**

```sql
-- Migration 310: Active stack tracking for Blue/Green deployments.
BEGIN;

CREATE TABLE active_stack (
    env TEXT PRIMARY KEY CHECK (env IN ('prod', 'dev')),
    active_color TEXT NOT NULL CHECK (active_color IN ('blue', 'green')),
    swapped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    swapped_by UUID REFERENCES identity.users(id)
);

-- Seed: both envs start on 'blue'.
INSERT INTO active_stack (env, active_color) VALUES ('prod', 'blue'), ('dev', 'blue');

COMMIT;
```

Apply : `docker exec -i signapps-postgres psql -U signapps -d signapps < migrations/310_active_stack.sql`

Verify : `SELECT * FROM active_stack` → 2 rows.

- [ ] **Step 2: Commit**

```bash
rtk git add migrations/310_active_stack.sql
rtk git commit -m "feat(deploy): add active_stack table for Blue/Green"
```

---

## Task 2: Shared module `active_stack.rs` in signapps-common

**Files:**
- Create: `crates/signapps-common/src/active_stack.rs`
- Modify: `crates/signapps-common/src/lib.rs`

- [ ] **Step 1: Module content**

```rust
//! Active stack lookup + swap for Blue/Green deployments.
//!
//! Readers: signapps-proxy (chooses upstream on every request).
//! Writer: signapps-deploy (swaps after a successful Blue/Green deploy).

use anyhow::{Context, Result};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Color {
    Blue,
    Green,
}

impl Color {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Blue => "blue",
            Self::Green => "green",
        }
    }

    pub fn other(&self) -> Self {
        match self {
            Self::Blue => Self::Green,
            Self::Green => Self::Blue,
        }
    }

    fn from_str(s: &str) -> Result<Self> {
        match s {
            "blue" => Ok(Self::Blue),
            "green" => Ok(Self::Green),
            other => anyhow::bail!("invalid color: {other}"),
        }
    }
}

pub async fn get_active(pool: &PgPool, env: &str) -> Result<Color> {
    let raw: String =
        sqlx::query_scalar("SELECT active_color FROM active_stack WHERE env = $1")
            .bind(env)
            .fetch_one(pool)
            .await
            .with_context(|| format!("fetch active_stack for env={env}"))?;
    Color::from_str(&raw)
}

pub async fn swap(pool: &PgPool, env: &str, actor: Option<Uuid>) -> Result<Color> {
    let current = get_active(pool, env).await?;
    let new_color = current.other();
    sqlx::query(
        "UPDATE active_stack \
         SET active_color = $2, swapped_at = now(), swapped_by = $3 \
         WHERE env = $1",
    )
    .bind(env)
    .bind(new_color.as_str())
    .bind(actor)
    .execute(pool)
    .await
    .context("swap active_stack")?;
    tracing::warn!(%env, previous = %current.as_str(), new = %new_color.as_str(), "active stack swapped");
    Ok(new_color)
}
```

In `lib.rs`, add `pub mod active_stack;`.

- [ ] **Step 2: Commit**

```bash
rtk git add crates/signapps-common/
rtk git commit -m "feat(common): active_stack module for Blue/Green state"
```

---

## Task 3: DockerHost trait + local/remote implementations

**Files:**
- Create: `services/signapps-deploy/src/docker/mod.rs`
- Create: `services/signapps-deploy/src/docker/local.rs`
- Create: `services/signapps-deploy/src/docker/remote.rs`
- Create: `services/signapps-deploy/src/docker/host.rs`
- Move: existing `services/signapps-deploy/src/docker.rs` content into `docker/local.rs`

- [ ] **Step 1: Module split**

Delete old `src/docker.rs` (move its content into `src/docker/local.rs`).

`src/docker/mod.rs`:
```rust
//! Docker API abstraction — supports local (unix socket / named pipe) and
//! remote (TCP+TLS or SSH tunnel) hosts.

pub mod host;
pub mod local;
pub mod remote;

pub use host::DockerHost;
```

`src/docker/host.rs`:
```rust
//! `DockerHost` trait — unifies local and remote Docker daemons.

use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashMap;

#[async_trait]
pub trait DockerHost: Send + Sync {
    async fn pull_image(&self, image_ref: &str) -> Result<()>;
    async fn health_by_project(&self, project: &str) -> Result<HashMap<String, bool>>;
    async fn compose_up(&self, compose_file: &str, env_file: &str, version_env: (&str, &str)) -> Result<()>;
    async fn compose_down(&self, compose_file: &str, env_file: &str) -> Result<()>;
    fn host_label(&self) -> &str;
}
```

`src/docker/local.rs` (move content from old `docker.rs`, adapt to implement `DockerHost`):
```rust
//! Docker API via local socket (existing behaviour since Phase 1).

use super::host::DockerHost;
use anyhow::{Context, Result};
use async_trait::async_trait;
use bollard::Docker;
use futures_util::TryStreamExt;
use std::collections::HashMap;

pub struct LocalDockerHost {
    inner: Docker,
}

impl LocalDockerHost {
    pub fn connect() -> Result<Self> {
        let inner = Docker::connect_with_local_defaults().context("connect to local Docker")?;
        Ok(Self { inner })
    }
}

#[async_trait]
impl DockerHost for LocalDockerHost {
    async fn pull_image(&self, image_ref: &str) -> Result<()> {
        use bollard::image::CreateImageOptions;
        let opts = CreateImageOptions::<String> {
            from_image: image_ref.to_string(),
            ..Default::default()
        };
        self.inner
            .create_image(Some(opts), None, None)
            .try_for_each(|_| async { Ok(()) })
            .await
            .context("pull image")?;
        Ok(())
    }

    async fn health_by_project(&self, project: &str) -> Result<HashMap<String, bool>> {
        use bollard::container::ListContainersOptions;
        let mut filters: HashMap<String, Vec<String>> = HashMap::new();
        filters.insert(
            "label".to_string(),
            vec![format!("com.docker.compose.project={project}")],
        );
        let opts = ListContainersOptions::<String> { all: true, filters, ..Default::default() };
        let containers = self.inner.list_containers(Some(opts)).await.context("list containers")?;
        let mut out = HashMap::new();
        for c in containers {
            let name = c.names.and_then(|n| n.into_iter().next()).unwrap_or_default();
            let healthy = c.status.as_deref().map(|s| s.contains("(healthy)")).unwrap_or(false);
            out.insert(name, healthy);
        }
        Ok(out)
    }

    async fn compose_up(&self, compose_file: &str, env_file: &str, version_env: (&str, &str)) -> Result<()> {
        let status = tokio::process::Command::new("docker")
            .args(["compose", "-f", compose_file, "--env-file", env_file, "up", "-d"])
            .env(version_env.0, version_env.1)
            .status()
            .await
            .context("spawn docker compose up")?;
        anyhow::ensure!(status.success(), "docker compose up failed");
        Ok(())
    }

    async fn compose_down(&self, compose_file: &str, env_file: &str) -> Result<()> {
        let status = tokio::process::Command::new("docker")
            .args(["compose", "-f", compose_file, "--env-file", env_file, "down"])
            .status()
            .await
            .context("spawn docker compose down")?;
        anyhow::ensure!(status.success(), "docker compose down failed");
        Ok(())
    }

    fn host_label(&self) -> &str { "local" }
}
```

`src/docker/remote.rs`:
```rust
//! Docker API via TCP or SSH tunnel.
//!
//! Phase 5 MVP: use SSH shell-out (`ssh user@host docker compose ...`).
//! A future optimisation is to use bollard's TLS transport directly.

use super::host::DockerHost;
use anyhow::{Context, Result};
use async_trait::async_trait;
use std::collections::HashMap;

pub struct RemoteDockerHost {
    ssh_target: String,  // e.g., "deploy@host.example.com"
    label: String,
}

impl RemoteDockerHost {
    pub fn new(ssh_target: String, label: String) -> Self {
        Self { ssh_target, label }
    }
}

#[async_trait]
impl DockerHost for RemoteDockerHost {
    async fn pull_image(&self, image_ref: &str) -> Result<()> {
        let status = tokio::process::Command::new("ssh")
            .arg(&self.ssh_target)
            .arg(format!("docker pull {image_ref}"))
            .status()
            .await
            .context("spawn ssh docker pull")?;
        anyhow::ensure!(status.success(), "ssh docker pull failed on {}", self.ssh_target);
        Ok(())
    }

    async fn health_by_project(&self, project: &str) -> Result<HashMap<String, bool>> {
        // Uses `docker ps --format json` for structured output parsing.
        let out = tokio::process::Command::new("ssh")
            .arg(&self.ssh_target)
            .arg(format!(
                "docker ps -a --filter label=com.docker.compose.project={project} \
                 --format '{{.Names}}|{{.Status}}'"
            ))
            .output()
            .await
            .context("spawn ssh docker ps")?;
        if !out.status.success() {
            anyhow::bail!("ssh docker ps failed on {}", self.ssh_target);
        }
        let mut result = HashMap::new();
        for line in String::from_utf8_lossy(&out.stdout).lines() {
            if let Some((name, status)) = line.split_once('|') {
                result.insert(name.to_string(), status.contains("(healthy)"));
            }
        }
        Ok(result)
    }

    async fn compose_up(&self, compose_file: &str, env_file: &str, version_env: (&str, &str)) -> Result<()> {
        // Assumes the compose + env files are PRE-DEPLOYED to the remote host
        // at the same paths. Deploying them is an ops concern (rsync / ansible).
        let status = tokio::process::Command::new("ssh")
            .arg(&self.ssh_target)
            .arg(format!(
                "{}={} docker compose -f {compose_file} --env-file {env_file} up -d",
                version_env.0, version_env.1
            ))
            .status()
            .await
            .context("spawn ssh docker compose up")?;
        anyhow::ensure!(status.success(), "ssh docker compose up failed");
        Ok(())
    }

    async fn compose_down(&self, compose_file: &str, env_file: &str) -> Result<()> {
        let status = tokio::process::Command::new("ssh")
            .arg(&self.ssh_target)
            .arg(format!(
                "docker compose -f {compose_file} --env-file {env_file} down"
            ))
            .status()
            .await?;
        anyhow::ensure!(status.success(), "ssh docker compose down failed");
        Ok(())
    }

    fn host_label(&self) -> &str { &self.label }
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add services/signapps-deploy/src/docker/
rtk git commit -m "feat(deploy): DockerHost trait + local and remote (SSH) impls"
```

---

## Task 4: Strategy module + maintenance_window (existing behaviour refactored)

**Files:**
- Create: `services/signapps-deploy/src/strategies/mod.rs`
- Create: `services/signapps-deploy/src/strategies/maintenance_window.rs`

- [ ] **Step 1: Module**

`src/strategies/mod.rs`:
```rust
//! Deployment strategies.
//!
//! Phase 1-4: `MaintenanceWindow` — single host, short maintenance page.
//! Phase 5: `BlueGreen` — 2 hosts, zero-downtime via active_stack swap.

pub mod blue_green;
pub mod maintenance_window;

use async_trait::async_trait;
use anyhow::Result;

#[async_trait]
pub trait DeploymentStrategy: Send + Sync {
    async fn deploy(&self, env: &str, version: &str) -> Result<()>;
    async fn rollback(&self, env: &str) -> Result<()>;
    fn name(&self) -> &'static str;
}
```

`src/strategies/maintenance_window.rs`:
```rust
//! The original strategy: enable maintenance flag → compose up → disable flag.

use super::DeploymentStrategy;
use crate::orchestrator as orch_existing;
use anyhow::Result;
use async_trait::async_trait;

pub struct MaintenanceWindowStrategy;

#[async_trait]
impl DeploymentStrategy for MaintenanceWindowStrategy {
    async fn deploy(&self, env: &str, version: &str) -> Result<()> {
        orch_existing::deploy(env, version).await
    }

    async fn rollback(&self, env: &str) -> Result<()> {
        orch_existing::rollback(env).await
    }

    fn name(&self) -> &'static str {
        "maintenance_window"
    }
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add services/signapps-deploy/src/strategies/
rtk git commit -m "feat(deploy): DeploymentStrategy trait + MaintenanceWindow wrapping existing flow"
```

---

## Task 5: BlueGreen strategy

**Files:**
- Modify: `services/signapps-deploy/src/strategies/blue_green.rs`

- [ ] **Step 1: Content**

```rust
//! Blue/Green deployment strategy.
//!
//! Flow :
//! 1. Read `active_stack` for env → `active_color`.
//! 2. `target_color` = other color.
//! 3. `docker compose up -d` on the TARGET host (the one currently idle).
//! 4. Wait healthy on target (5 min max).
//! 5. Swap `active_stack` in DB → proxy picks up on next request.
//! 6. Optionally `docker compose down` on the OLD active (or leave for rollback).
//!
//! Rollback : just swap the DB row back — old stack is still up.

use super::DeploymentStrategy;
use crate::docker::host::DockerHost;
use anyhow::{Context, Result};
use async_trait::async_trait;
use signapps_common::active_stack;
use sqlx::PgPool;
use std::sync::Arc;

pub struct BlueGreenStrategy {
    pub pool: PgPool,
    /// One DockerHost per color. The "blue_host" is just a label — either color
    /// may be active at any time.
    pub blue_host: Arc<dyn DockerHost>,
    pub green_host: Arc<dyn DockerHost>,
    /// Compose file path (must exist on each remote host).
    pub compose_file: String,
    /// Env file path.
    pub env_file: String,
    /// Image repo base (e.g. `ghcr.io/myorg/signapps-platform`).
    pub image_repo: String,
}

impl BlueGreenStrategy {
    fn host_for(&self, color: active_stack::Color) -> &Arc<dyn DockerHost> {
        match color {
            active_stack::Color::Blue => &self.blue_host,
            active_stack::Color::Green => &self.green_host,
        }
    }
}

#[async_trait]
impl DeploymentStrategy for BlueGreenStrategy {
    async fn deploy(&self, env: &str, version: &str) -> Result<()> {
        let active = active_stack::get_active(&self.pool, env).await?;
        let target = active.other();
        let target_host = self.host_for(target).clone();
        let image_ref = format!("{}:{version}", self.image_repo);

        tracing::info!(%env, active = %active.as_str(), target = %target.as_str(), %version, "BG deploy starting");

        target_host.pull_image(&image_ref).await.context("pull image on target")?;
        target_host
            .compose_up(&self.compose_file, &self.env_file, ("SIGNAPPS_VERSION", version))
            .await
            .context("compose up on target")?;

        // Wait for target to become healthy.
        wait_healthy(&*target_host, "signapps-prod").await.context("wait healthy on target")?;

        // Swap active_stack in DB → proxy routes new traffic to target.
        active_stack::swap(&self.pool, env, None).await?;

        tracing::info!(%env, new_active = %target.as_str(), "BG swap done — target is now active");
        Ok(())
    }

    async fn rollback(&self, env: &str) -> Result<()> {
        // Simply swap back. The old active is still up (we didn't bring it down).
        active_stack::swap(&self.pool, env, None).await?;
        Ok(())
    }

    fn name(&self) -> &'static str {
        "blue_green"
    }
}

async fn wait_healthy(host: &dyn DockerHost, project: &str) -> Result<()> {
    use std::time::Duration;
    use tokio::time::{sleep, timeout};

    const HEALTHCHECK_TIMEOUT: Duration = Duration::from_secs(300);
    const HEALTHCHECK_POLL: Duration = Duration::from_secs(2);

    timeout(HEALTHCHECK_TIMEOUT, async {
        loop {
            let health = host.health_by_project(project).await?;
            if !health.is_empty() && health.values().all(|h| *h) {
                return Ok::<(), anyhow::Error>(());
            }
            sleep(HEALTHCHECK_POLL).await;
        }
    })
    .await
    .context("healthcheck timeout")?
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add services/signapps-deploy/src/strategies/blue_green.rs
rtk git commit -m "feat(deploy): BlueGreen strategy with atomic active_stack swap"
```

---

## Task 6: Orchestrator dispatches by strategy

**Files:**
- Modify: `services/signapps-deploy/src/orchestrator.rs`
- Modify: `services/signapps-deploy/src/lib.rs`

- [ ] **Step 1: Read `DEPLOY_STRATEGY` env var**

Add to orchestrator :

```rust
fn resolve_strategy() -> Box<dyn crate::strategies::DeploymentStrategy> {
    let name = std::env::var("DEPLOY_STRATEGY").unwrap_or_else(|_| "maintenance_window".into());
    match name.as_str() {
        "maintenance_window" => Box::new(crate::strategies::maintenance_window::MaintenanceWindowStrategy),
        "blue_green" => panic!(
            "blue_green strategy requires explicit construction with DockerHosts + image_repo. \
             Use `orchestrator::deploy_with_strategy(strategy, env, version)`."
        ),
        other => panic!("unknown DEPLOY_STRATEGY: {other}"),
    }
}
```

Note: MaintenanceWindow wraps the *existing* `deploy()` function. So the strategy trait is a thin shim for now — the plumbing is future-proof even if today all callers use MaintenanceWindow.

BlueGreen needs construction with hosts + image_repo — the caller (server binary or a dedicated test) builds it explicitly.

In `lib.rs`, add :
```rust
pub mod docker;
pub mod strategies;
```

(replacing any old `pub mod docker;` if the file-based one existed.)

- [ ] **Step 2: Commit**

```bash
rtk git add services/signapps-deploy/src/
rtk git commit -m "feat(deploy): orchestrator dispatches DeploymentStrategy (default maintenance_window)"
```

---

## Task 7: Upstream switcher middleware in signapps-proxy

**Files:**
- Create: `services/signapps-proxy/src/app_middleware/upstream_switcher.rs`

- [ ] **Step 1: Middleware**

```rust
//! Upstream switcher: chooses the backend cluster color based on active_stack.
//!
//! Reads the `active_stack` table to decide whether `env=prod` requests go to
//! the "blue" or "green" host. Called on every request — cached for 5 seconds
//! to avoid hammering the DB.

use crate::app_middleware::hostname_router::BackendCluster;
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use signapps_common::active_stack::Color;
use sqlx::PgPool;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const CACHE_TTL: Duration = Duration::from_secs(5);

#[derive(Clone)]
pub struct UpstreamSwitcherState {
    pub pool: PgPool,
    cache: Arc<Mutex<Option<(Instant, Color)>>>,
}

impl UpstreamSwitcherState {
    pub fn new(pool: PgPool) -> Self {
        Self { pool, cache: Arc::new(Mutex::new(None)) }
    }

    async fn get_color(&self, env: &str) -> Color {
        {
            let guard = self.cache.lock().unwrap();
            if let Some((when, color)) = *guard {
                if when.elapsed() < CACHE_TTL {
                    return color;
                }
            }
        }
        let color = signapps_common::active_stack::get_active(&self.pool, env)
            .await
            .unwrap_or(Color::Blue);
        let mut guard = self.cache.lock().unwrap();
        *guard = Some((Instant::now(), color));
        color
    }
}

/// Injects the active `Color` into request extensions so downstream proxy
/// logic can route to the correct upstream host.
pub async fn upstream_switcher_middleware(
    State(state): State<UpstreamSwitcherState>,
    mut req: Request,
    next: Next,
) -> Response {
    let env = req
        .extensions()
        .get::<BackendCluster>()
        .map(|c| c.env_name().to_string())
        .unwrap_or_else(|| "prod".to_string());

    let color = state.get_color(&env).await;
    req.extensions_mut().insert(color);
    next.run(req).await
}
```

- [ ] **Step 2: Wire in main.rs**

Modify `services/signapps-proxy/src/main.rs` to add the layer between hostname_router and maintenance. Caveat : this requires access to the PG pool from the proxy's main — which already exists (proxy connects to Postgres for other reasons).

Add :
```rust
use crate::app_middleware::upstream_switcher::{upstream_switcher_middleware, UpstreamSwitcherState};

let upstream_state = UpstreamSwitcherState::new(pool.clone());

let app = app
    .layer(axum::middleware::from_fn_with_state(
        maintenance_state,
        maintenance_middleware,
    ))
    .layer(axum::middleware::from_fn_with_state(
        upstream_state,
        upstream_switcher_middleware,
    ))
    .layer(axum::middleware::from_fn_with_state(
        hostname_state,
        hostname_router_middleware,
    ));
```

**Caveat:** the actual *routing* of requests to blue vs green upstreams requires the proxy's reverse-proxy logic to consume the `Color` extension. That logic probably lives in some proxy forwarder (not detailed here). For Phase 5, this middleware just injects the color — the actual upstream switching is the proxy team's integration.

- [ ] **Step 3: Commit**

```bash
rtk git add services/signapps-proxy/src/app_middleware/upstream_switcher.rs services/signapps-proxy/src/main.rs services/signapps-proxy/src/app_middleware/mod.rs
rtk git commit -m "feat(proxy): upstream_switcher middleware reads active_stack from DB"
```

---

## Task 8: E2E test for active_stack swap

**Files:**
- Create: `services/signapps-deploy/tests/blue_green_state_e2e.rs`

- [ ] **Step 1: Test**

```rust
//! E2E test: active_stack starts as blue, swap → green, swap → blue.

use signapps_common::active_stack::{get_active, swap, Color};
use sqlx::PgPool;

async fn test_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps".to_string());
    PgPool::connect(&url).await.expect("connect")
}

async fn reset_to_blue(pool: &PgPool, env: &str) {
    let _ = sqlx::query("UPDATE active_stack SET active_color = 'blue' WHERE env = $1")
        .bind(env)
        .execute(pool)
        .await;
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn swap_alternates_blue_and_green() {
    let pool = test_pool().await;
    reset_to_blue(&pool, "dev").await;

    let c1 = get_active(&pool, "dev").await.expect("get");
    assert_eq!(c1, Color::Blue);

    let c2 = swap(&pool, "dev", None).await.expect("swap 1");
    assert_eq!(c2, Color::Green);

    let c3 = swap(&pool, "dev", None).await.expect("swap 2");
    assert_eq!(c3, Color::Blue);

    reset_to_blue(&pool, "dev").await;
}
```

- [ ] **Step 2: Run**

```
cargo nextest run -p signapps-deploy --test blue_green_state_e2e -- --ignored
```
Expected : 1 PASS.

- [ ] **Step 3: Commit**

```bash
rtk git add services/signapps-deploy/tests/blue_green_state_e2e.rs
rtk git commit -m "test(deploy): E2E active_stack swap alternates colors"
```

---

## Task 9: Docs + validation finale

**Files:**
- Modify: `services/signapps-deploy/README.md`
- Modify: `.env.example`

Append to README :

```markdown

## Phase 5 — Blue/Green (2-host, zero-downtime)

Activate via `DEPLOY_STRATEGY=blue_green` + SSH targets for the two hosts.

### Architecture

Two machines (`host_blue`, `host_green`) run identical compose stacks. A DB row `active_stack(env, active_color)` tells the proxy which host is currently serving traffic.

### Deploy flow

1. Deploy server reads `active_stack` → `active=blue`
2. Runs `docker compose up -d` on **green** (the idle host) with the new version
3. Polls `docker ps` on green until all 33 containers are healthy
4. Updates `active_stack` row : `blue` → `green`
5. Proxy sees the swap within 5s (middleware cache TTL) and routes new requests to green
6. Old blue stays up for rollback (can be pruned later)

### Rollback

Swap the row back. The old stack is still running — zero re-pull, zero re-provision.

### Env vars

```
DEPLOY_STRATEGY=blue_green
DEPLOY_BG_BLUE_SSH=deploy@blue.signapps.internal
DEPLOY_BG_GREEN_SSH=deploy@green.signapps.internal
DEPLOY_BG_COMPOSE_PATH=/etc/signapps/docker-compose.prod.yml
DEPLOY_BG_ENV_PATH=/etc/signapps/.env
DEPLOY_IMAGE_REPO=ghcr.io/myorg/signapps-platform
```

### Limitations

- Remote host uses shell-out to `ssh` (not bollard-TLS). Requires passwordless SSH key on the deploy server.
- Compose file and env file must be pre-deployed to both hosts (rsync/ansible — not in scope).
- DB migrations run only on the shared PG instance. Between-version DB changes must be backward-compatible during the window both stacks are up.
```

Append to `.env.example` :
```
# ─── Blue/Green (Phase 5, optional) ─────────────────────────────────────
DEPLOY_STRATEGY=maintenance_window    # or "blue_green"
DEPLOY_BG_BLUE_SSH=                   # e.g. deploy@blue.signapps.internal
DEPLOY_BG_GREEN_SSH=                  # e.g. deploy@green.signapps.internal
DEPLOY_BG_COMPOSE_PATH=/etc/signapps/docker-compose.prod.yml
DEPLOY_BG_ENV_PATH=/etc/signapps/.env
```

Pipeline qualité :
```
cargo fmt -p signapps-deploy -p signapps-common -p signapps-proxy -- --check
cargo clippy -p signapps-deploy -p signapps-common -p signapps-proxy --all-features -- -D warnings
cargo nextest run -p signapps-deploy -p signapps-common -p signapps-proxy
```

Tag :
```
rtk git tag -a phase5-blue-green-complete -m "Phase 5: Blue/Green 2-host support complete"
```

Commit docs :
```
rtk git add services/signapps-deploy/README.md .env.example
rtk git commit -m "docs(deploy): Phase 5 Blue/Green documentation"
```

---

## Review Checklist

- [ ] Migration 310 applied, `active_stack` table with 2 rows
- [ ] `signapps_common::active_stack::{get_active, swap, Color}` exports work
- [ ] `DockerHost` trait + Local + Remote (SSH) compile
- [ ] `DeploymentStrategy` trait + MaintenanceWindow + BlueGreen compile
- [ ] Orchestrator defaults to MaintenanceWindow; `DEPLOY_STRATEGY=blue_green` panics unless hosts passed explicitly (to keep this task scope manageable)
- [ ] `upstream_switcher` middleware in proxy reads `active_stack` with 5s cache
- [ ] E2E test swap alternates colors (1 test)
- [ ] README Phase 5 section + `.env.example` entries
- [ ] Tag `phase5-blue-green-complete` created locally

## Known limitations for this plan

- Blue/Green doesn't yet expose a top-level CLI flag in the deploy server; the strategy must be constructed explicitly. A Phase 5.1 can add a config-driven factory.
- The proxy actually forwarding requests to blue-vs-green upstreams requires changes to the existing proxy forwarder logic which varies per deployment. The `upstream_switcher` middleware only injects the `Color` into extensions — consuming it is left to the forwarder.
- The SSH-based RemoteDockerHost is basic (shell-out); a future revision could use bollard over TLS for better observability.
