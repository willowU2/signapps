# Multi-Env Deployment — Phase 3a (Backend API + WebSocket) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activer l'API HTTP REST + WebSocket du service `signapps-deploy` (dormante jusqu'ici), protégée par un middleware `superadmin`, avec la totalité des endpoints nécessaires pour piloter les déploiements depuis une UI admin future.

**Architecture:** Nouveau binaire `signapps-deploy-server` qui démarre un router Axum si `DEPLOY_API_ENABLED=true`. Les handlers délèguent au `orchestrator` et à `persistence` existants. Feature flags gérés par une nouvelle crate `signapps-feature-flags` (DB + cache local TTL 60s). WebSocket sur `/api/v1/deploy/events` pour streamer les événements `deployment.*` via `PgEventBus` existant. Documentation OpenAPI via `utoipa` conforme à la politique Code-First du projet.

**Tech Stack:** Axum 0.7, tokio-tungstenite (WebSocket), utoipa + utoipa-swagger-ui, sqlx (PostgreSQL), `PgEventBus` (existant dans `signapps-common`), `signapps-cache` (existant), `signapps-common::auth::require_role("superadmin")`.

**Scope:** Ce plan couvre uniquement **Phase 3a** (backend API). **Phase 3b (admin UI Next.js)** sera un plan séparé. Prérequis : Phase 1 (socle CLI) + Phase 2 (dev env + promotion + scheduler) mergées ou disponibles en branche parente.

---

## File Structure

### Fichiers créés

| Fichier | Responsabilité |
|---|---|
| `migrations/307_feature_flags_runtime_config.sql` | Tables `feature_flags` + `runtime_config` |
| `crates/signapps-feature-flags/Cargo.toml` | Manifeste |
| `crates/signapps-feature-flags/src/lib.rs` | API publique (`ff::is_enabled`, `ff::variant`) |
| `crates/signapps-feature-flags/src/types.rs` | `FeatureFlag`, `RolloutContext` |
| `crates/signapps-feature-flags/src/repository.rs` | `PgFeatureFlagRepository` |
| `crates/signapps-feature-flags/src/cache.rs` | Cache local TTL 60s via `signapps-cache` |
| `crates/signapps-feature-flags/src/evaluator.rs` | Logique rollout/targeting (hash stable) |
| `services/signapps-deploy/src/api/mod.rs` | Module racine API |
| `services/signapps-deploy/src/api/state.rs` | `AppState` partagé (pool, cache, event bus) |
| `services/signapps-deploy/src/api/routes.rs` | Assemblage du router v1 |
| `services/signapps-deploy/src/api/handlers/envs.rs` | `GET /envs`, `GET /envs/{env}/health` |
| `services/signapps-deploy/src/api/handlers/versions.rs` | `GET /versions` |
| `services/signapps-deploy/src/api/handlers/deploy.rs` | `POST /envs/{env}/deploy` |
| `services/signapps-deploy/src/api/handlers/rollback.rs` | `POST /envs/{env}/rollback` |
| `services/signapps-deploy/src/api/handlers/maintenance.rs` | `POST /envs/{env}/maintenance` |
| `services/signapps-deploy/src/api/handlers/history.rs` | `GET /history` |
| `services/signapps-deploy/src/api/handlers/promote.rs` | `POST /promote` |
| `services/signapps-deploy/src/api/handlers/feature_flags.rs` | CRUD `/feature-flags` |
| `services/signapps-deploy/src/api/handlers/events_ws.rs` | WebSocket `/events` |
| `services/signapps-deploy/src/api/openapi.rs` | Agrégateur OpenAPI via `utoipa` |
| `services/signapps-deploy/src/bin/server.rs` | Binaire HTTP |
| `services/signapps-deploy/tests/api_smoke.rs` | Tests E2E API (reqwest) |

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `Cargo.toml` (workspace) | Ajouter `crates/signapps-feature-flags` aux members |
| `services/signapps-deploy/Cargo.toml` | Dep `signapps-feature-flags` + `axum-extra` (ws) + `utoipa-swagger-ui` + `[[bin]] server` |
| `services/signapps-deploy/src/lib.rs` | `pub mod api;` |
| `scripts/ports.json` | (aucune modification — le port 3035 de deploy reste le même) |
| `.env.example` | Ajouter `DEPLOY_API_ENABLED=false` (par défaut) |

---

## Task 1: Migration feature_flags + runtime_config

**Files:**
- Create: `migrations/307_feature_flags_runtime_config.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- Migration 307: Feature flags + runtime config tables
-- Spec: docs/superpowers/specs/2026-04-15-multi-env-deployment-design.md section 3.3

BEGIN;

CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    env TEXT NOT NULL CHECK (env IN ('prod', 'dev', 'all')),
    enabled BOOLEAN NOT NULL DEFAULT false,
    rollout_percent INT NOT NULL DEFAULT 100 CHECK (rollout_percent BETWEEN 0 AND 100),
    target_orgs UUID[] NOT NULL DEFAULT '{}',
    target_users UUID[] NOT NULL DEFAULT '{}',
    description TEXT,
    created_by UUID REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (key, env)
);

CREATE INDEX idx_feature_flags_key ON feature_flags (key);

CREATE TABLE runtime_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    env TEXT NOT NULL CHECK (env IN ('prod', 'dev', 'all')),
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES identity.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (key, env)
);

CREATE INDEX idx_runtime_config_key ON runtime_config (key);

COMMIT;
```

- [ ] **Step 2: Appliquer la migration**

```bash
docker exec -i signapps-postgres psql -U signapps -d signapps < migrations/307_feature_flags_runtime_config.sql
```

Expected: `BEGIN`, `CREATE TABLE`, `CREATE INDEX`, `CREATE TABLE`, `CREATE INDEX`, `COMMIT` sans `ERROR`.

- [ ] **Step 3: Vérifier**

```bash
docker exec signapps-postgres psql -U signapps -d signapps -c "\d feature_flags"
docker exec signapps-postgres psql -U signapps -d signapps -c "\d runtime_config"
```

Expected: les 2 tables avec colonnes, contraintes, FK.

- [ ] **Step 4: Commit**

```bash
rtk git add migrations/307_feature_flags_runtime_config.sql
rtk git commit -m "feat(deploy): add feature_flags and runtime_config tables"
```

---

## Task 2: Crate signapps-feature-flags (squelette + types)

**Files:**
- Create: `crates/signapps-feature-flags/Cargo.toml`
- Create: `crates/signapps-feature-flags/src/lib.rs`
- Create: `crates/signapps-feature-flags/src/types.rs`
- Modify: `Cargo.toml` (workspace)

- [ ] **Step 1: Créer le Cargo.toml**

```toml
[package]
name = "signapps-feature-flags"
version.workspace = true
edition = "2021"
rust-version = "1.75"

[lib]
path = "src/lib.rs"

[dependencies]
anyhow = { workspace = true }
async-trait = "0.1"
chrono = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
signapps-cache = { path = "../signapps-cache" }
sqlx = { workspace = true }
thiserror = { workspace = true }
tokio = { workspace = true }
tracing = { workspace = true }
utoipa = { workspace = true }
uuid = { workspace = true }

[dev-dependencies]
tokio = { workspace = true, features = ["full"] }
```

- [ ] **Step 2: Ajouter au workspace**

Modifier `Cargo.toml` (root) — dans `[workspace] members`, insérer `"crates/signapps-feature-flags"` alphabétiquement.

- [ ] **Step 3: Créer lib.rs + types.rs**

`crates/signapps-feature-flags/src/lib.rs`:

```rust
//! Feature flags for SignApps Platform.
//!
//! Flags live in the `feature_flags` table (one row per (key, env) pair). The
//! library exposes an evaluator that combines enabled/rollout_percent/
//! target_orgs/target_users to answer `is_enabled(key, ctx)` in O(1) against
//! an in-process TTL cache.

#![warn(missing_docs)]

pub mod cache;
pub mod evaluator;
pub mod repository;
pub mod types;

pub use evaluator::Evaluator;
pub use types::{FeatureFlag, RolloutContext};
```

`crates/signapps-feature-flags/src/types.rs`:

```rust
//! Public types for feature flags and rollout contexts.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

/// A single feature flag row.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, sqlx::FromRow)]
pub struct FeatureFlag {
    pub id: Uuid,
    pub key: String,
    pub env: String,
    pub enabled: bool,
    pub rollout_percent: i32,
    pub target_orgs: Vec<Uuid>,
    pub target_users: Vec<Uuid>,
    pub description: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Information used by the evaluator to decide whether a flag is enabled
/// for the current request.
#[derive(Debug, Clone, Default)]
pub struct RolloutContext {
    pub env: String,
    pub user_id: Option<Uuid>,
    pub org_id: Option<Uuid>,
}
```

- [ ] **Step 4: Créer cache.rs + evaluator.rs + repository.rs (stubs)**

Stubs qui compilent :

`cache.rs`: `//! Local TTL cache — fleshed out in Task 3.`
`evaluator.rs`: `//! Rollout/targeting logic — fleshed out in Task 4.`
`repository.rs`: `//! PostgreSQL repository — fleshed out in Task 5.`

- [ ] **Step 5: Build**

```
cargo check -p signapps-feature-flags
```

Expected: compile cleanly.

- [ ] **Step 6: Commit**

```bash
rtk git add Cargo.toml crates/signapps-feature-flags/
rtk git commit -m "feat(feature-flags): scaffold signapps-feature-flags crate"
```

---

## Task 3: Feature flags cache (TTL 60s)

**Files:**
- Modify: `crates/signapps-feature-flags/src/cache.rs`

- [ ] **Step 1: Implémenter le cache**

```rust
//! Local TTL cache for feature-flag lookups.
//!
//! Caches `FeatureFlag` rows by `(key, env)` for 60 seconds. Invalidations
//! are signaled via [`signapps_cache::CacheService`] delete operations that
//! the admin API issues after mutations.

use crate::types::FeatureFlag;
use signapps_cache::CacheService;
use std::sync::Arc;
use std::time::Duration;

const CACHE_TTL: Duration = Duration::from_secs(60);

fn cache_key(key: &str, env: &str) -> String {
    format!("ff:{key}:{env}")
}

/// Read-through cache wrapper.
#[derive(Clone)]
pub struct FeatureFlagCache {
    inner: Arc<CacheService>,
}

impl FeatureFlagCache {
    pub fn new(cache: Arc<CacheService>) -> Self {
        Self { inner: cache }
    }

    pub async fn get(&self, key: &str, env: &str) -> Option<FeatureFlag> {
        let raw = self.inner.get(&cache_key(key, env)).await?;
        serde_json::from_str(&raw).ok()
    }

    pub async fn put(&self, flag: &FeatureFlag) -> anyhow::Result<()> {
        let raw = serde_json::to_string(flag)?;
        self.inner
            .set(&cache_key(&flag.key, &flag.env), &raw, CACHE_TTL)
            .await;
        Ok(())
    }

    pub async fn invalidate(&self, key: &str, env: &str) {
        self.inner.delete(&cache_key(key, env)).await;
    }
}
```

- [ ] **Step 2: Build**

```
cargo check -p signapps-feature-flags
```

- [ ] **Step 3: Commit**

```bash
rtk git add crates/signapps-feature-flags/src/cache.rs
rtk git commit -m "feat(feature-flags): local TTL cache for flag lookups"
```

---

## Task 4: Feature flags evaluator (rollout + targeting)

**Files:**
- Modify: `crates/signapps-feature-flags/src/evaluator.rs`

- [ ] **Step 1: Implémenter**

```rust
//! Evaluate whether a flag is enabled for a given [`RolloutContext`].
//!
//! Rules (short-circuit in order):
//! 1. If `enabled == false`: always false.
//! 2. If `target_users` contains `ctx.user_id`: true.
//! 3. If `target_orgs` contains `ctx.org_id`: true.
//! 4. If `rollout_percent == 100`: true.
//! 5. If `rollout_percent == 0`: false.
//! 6. Otherwise: stable hash of `user_id` or `org_id` mod 100 < `rollout_percent`.

use crate::types::{FeatureFlag, RolloutContext};
use std::hash::{Hash, Hasher};
use uuid::Uuid;

/// Evaluates a single flag against a context.
pub struct Evaluator;

impl Evaluator {
    /// Returns whether the flag is enabled for this context.
    pub fn is_enabled(flag: &FeatureFlag, ctx: &RolloutContext) -> bool {
        if !flag.enabled {
            return false;
        }
        if let Some(uid) = ctx.user_id {
            if flag.target_users.contains(&uid) {
                return true;
            }
        }
        if let Some(oid) = ctx.org_id {
            if flag.target_orgs.contains(&oid) {
                return true;
            }
        }
        if flag.rollout_percent <= 0 {
            return false;
        }
        if flag.rollout_percent >= 100 {
            return true;
        }
        let bucket = stable_bucket(ctx.user_id.or(ctx.org_id), &flag.key);
        bucket < (flag.rollout_percent as u32)
    }
}

fn stable_bucket(seed: Option<Uuid>, key: &str) -> u32 {
    use std::collections::hash_map::DefaultHasher;
    let mut h = DefaultHasher::new();
    if let Some(id) = seed {
        id.hash(&mut h);
    }
    key.hash(&mut h);
    (h.finish() % 100) as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn flag(enabled: bool, rollout: i32) -> FeatureFlag {
        FeatureFlag {
            id: Uuid::new_v4(),
            key: "k".into(),
            env: "prod".into(),
            enabled,
            rollout_percent: rollout,
            target_orgs: vec![],
            target_users: vec![],
            description: None,
            created_by: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    fn ctx(uid: Option<Uuid>) -> RolloutContext {
        RolloutContext { env: "prod".into(), user_id: uid, org_id: None }
    }

    #[test]
    fn disabled_flag_never_fires() {
        assert!(!Evaluator::is_enabled(&flag(false, 100), &ctx(None)));
    }

    #[test]
    fn full_rollout_always_fires_when_enabled() {
        for _ in 0..10 {
            assert!(Evaluator::is_enabled(&flag(true, 100), &ctx(Some(Uuid::new_v4()))));
        }
    }

    #[test]
    fn zero_rollout_never_fires_when_enabled() {
        for _ in 0..10 {
            assert!(!Evaluator::is_enabled(&flag(true, 0), &ctx(Some(Uuid::new_v4()))));
        }
    }

    #[test]
    fn targeted_user_is_always_enabled() {
        let uid = Uuid::new_v4();
        let mut f = flag(true, 0);
        f.target_users = vec![uid];
        assert!(Evaluator::is_enabled(&f, &ctx(Some(uid))));
    }

    #[test]
    fn rollout_distribution_is_roughly_correct() {
        let f = flag(true, 30);
        let hits = (0..10_000)
            .filter(|_| Evaluator::is_enabled(&f, &ctx(Some(Uuid::new_v4()))))
            .count();
        // Expect ~30% ± 3%
        let pct = hits as f64 / 10_000.0 * 100.0;
        assert!((27.0..=33.0).contains(&pct), "distribution off: got {pct}%");
    }
}
```

- [ ] **Step 2: Run tests**

```
cargo nextest run -p signapps-feature-flags evaluator
```

Expected: 5/5 PASS.

- [ ] **Step 3: Commit**

```bash
rtk git add crates/signapps-feature-flags/src/evaluator.rs
rtk git commit -m "feat(feature-flags): evaluator with rollout + targeting + stable hash"
```

---

## Task 5: Feature flags PG repository

**Files:**
- Modify: `crates/signapps-feature-flags/src/repository.rs`

- [ ] **Step 1: Implémenter**

```rust
//! PostgreSQL repository for `feature_flags`.
//!
//! All writes invalidate the corresponding cache entry before returning.

use crate::cache::FeatureFlagCache;
use crate::types::FeatureFlag;
use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct PgFeatureFlagRepository {
    pool: PgPool,
    cache: FeatureFlagCache,
}

impl PgFeatureFlagRepository {
    pub fn new(pool: PgPool, cache: FeatureFlagCache) -> Self {
        Self { pool, cache }
    }

    pub async fn get(&self, key: &str, env: &str) -> Result<Option<FeatureFlag>> {
        if let Some(flag) = self.cache.get(key, env).await {
            return Ok(Some(flag));
        }
        let row: Option<FeatureFlag> = sqlx::query_as(
            "SELECT id, key, env, enabled, rollout_percent, target_orgs, \
             target_users, description, created_by, created_at, updated_at \
             FROM feature_flags WHERE key = $1 AND env = $2",
        )
        .bind(key)
        .bind(env)
        .fetch_optional(&self.pool)
        .await?;
        if let Some(ref f) = row {
            self.cache.put(f).await.ok();
        }
        Ok(row)
    }

    pub async fn list(&self, env: Option<&str>) -> Result<Vec<FeatureFlag>> {
        let rows: Vec<FeatureFlag> = match env {
            Some(e) => sqlx::query_as(
                "SELECT id, key, env, enabled, rollout_percent, target_orgs, \
                 target_users, description, created_by, created_at, updated_at \
                 FROM feature_flags WHERE env = $1 ORDER BY key",
            )
            .bind(e)
            .fetch_all(&self.pool)
            .await?,
            None => sqlx::query_as(
                "SELECT id, key, env, enabled, rollout_percent, target_orgs, \
                 target_users, description, created_by, created_at, updated_at \
                 FROM feature_flags ORDER BY key, env",
            )
            .fetch_all(&self.pool)
            .await?,
        };
        Ok(rows)
    }

    pub async fn upsert(
        &self,
        key: &str,
        env: &str,
        enabled: bool,
        rollout_percent: i32,
        target_orgs: &[Uuid],
        target_users: &[Uuid],
        description: Option<&str>,
        actor_id: Option<Uuid>,
    ) -> Result<FeatureFlag> {
        let row: FeatureFlag = sqlx::query_as(
            "INSERT INTO feature_flags \
               (key, env, enabled, rollout_percent, target_orgs, target_users, description, created_by) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
             ON CONFLICT (key, env) DO UPDATE SET \
               enabled = EXCLUDED.enabled, \
               rollout_percent = EXCLUDED.rollout_percent, \
               target_orgs = EXCLUDED.target_orgs, \
               target_users = EXCLUDED.target_users, \
               description = EXCLUDED.description, \
               updated_at = now() \
             RETURNING id, key, env, enabled, rollout_percent, target_orgs, \
                       target_users, description, created_by, created_at, updated_at",
        )
        .bind(key)
        .bind(env)
        .bind(enabled)
        .bind(rollout_percent)
        .bind(target_orgs)
        .bind(target_users)
        .bind(description)
        .bind(actor_id)
        .fetch_one(&self.pool)
        .await?;
        self.cache.invalidate(key, env).await;
        Ok(row)
    }

    pub async fn delete(&self, key: &str, env: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM feature_flags WHERE key = $1 AND env = $2")
            .bind(key)
            .bind(env)
            .execute(&self.pool)
            .await?;
        self.cache.invalidate(key, env).await;
        Ok(result.rows_affected() > 0)
    }
}
```

- [ ] **Step 2: Build**

```
cargo check -p signapps-feature-flags
```

- [ ] **Step 3: Commit**

```bash
rtk git add crates/signapps-feature-flags/src/repository.rs
rtk git commit -m "feat(feature-flags): PG repository with cache invalidation"
```

---

## Task 6: signapps-deploy — API module + state + server binary

**Files:**
- Create: `services/signapps-deploy/src/api/mod.rs`
- Create: `services/signapps-deploy/src/api/state.rs`
- Create: `services/signapps-deploy/src/api/routes.rs`
- Create: `services/signapps-deploy/src/bin/server.rs`
- Modify: `services/signapps-deploy/Cargo.toml`
- Modify: `services/signapps-deploy/src/lib.rs`

- [ ] **Step 1: Ajouter deps au Cargo.toml de signapps-deploy**

Dans `services/signapps-deploy/Cargo.toml`, section `[dependencies]`, ajouter :

```toml
axum = { workspace = true, features = ["ws"] }
axum-extra = "0.9"
signapps-feature-flags = { path = "../../crates/signapps-feature-flags" }
tower-http = { workspace = true, features = ["trace", "cors"] }
utoipa = { workspace = true }
utoipa-swagger-ui = { version = "7", features = ["axum"] }
```

Et ajouter un nouveau `[[bin]]` après les deux existants :

```toml
[[bin]]
name = "signapps-deploy-server"
path = "src/bin/server.rs"
```

- [ ] **Step 2: Créer `src/api/mod.rs`**

```rust
//! HTTP API for the deployment orchestrator.
//!
//! Dormant by default. Activated by setting `DEPLOY_API_ENABLED=true` in the
//! environment. All routes require the `superadmin` role via the existing
//! `signapps-common` auth middleware.

pub mod handlers;
pub mod openapi;
pub mod routes;
pub mod state;
```

- [ ] **Step 3: Créer `src/api/state.rs`**

```rust
//! Shared state for all API handlers.

use signapps_cache::CacheService;
use signapps_common::JwtConfig;
use signapps_feature_flags::{cache::FeatureFlagCache, repository::PgFeatureFlagRepository};
use sqlx::PgPool;
use std::sync::Arc;

/// State injected into every handler.
#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub cache: Arc<CacheService>,
    pub jwt: JwtConfig,
    pub feature_flags: PgFeatureFlagRepository,
}

impl signapps_common::middleware::AuthState for AppState {
    fn jwt_config(&self) -> &JwtConfig {
        &self.jwt
    }
}
```

- [ ] **Step 4: Créer `src/api/routes.rs` (squelette)**

```rust
//! Router assembly.
//!
//! All handler modules are mounted here. Each handler module adds a set of
//! routes to a small sub-router; `build_router` merges them and wraps the
//! whole thing in the admin-required auth layer.

use crate::api::state::AppState;
use axum::Router;

pub fn build_router(state: AppState) -> Router {
    Router::new()
        // Handlers will be merged in in subsequent tasks.
        .with_state(state)
}
```

- [ ] **Step 5: Créer les stubs des handlers**

`services/signapps-deploy/src/api/handlers/mod.rs`:

```rust
pub mod deploy;
pub mod envs;
pub mod events_ws;
pub mod feature_flags;
pub mod history;
pub mod maintenance;
pub mod promote;
pub mod rollback;
pub mod versions;
```

Chaque fichier (`envs.rs`, `deploy.rs`, etc.) commence comme stub compilable :

```rust
//! Placeholder — filled in subsequent tasks.

use crate::api::state::AppState;
use axum::Router;

pub fn router() -> Router<AppState> {
    Router::new()
}
```

- [ ] **Step 6: Créer `src/api/openapi.rs` (stub)**

```rust
//! OpenAPI aggregator — expanded per handler in later tasks.

use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    paths(),
    components(schemas()),
    tags(
        (name = "deploy", description = "Deployment orchestrator API"),
        (name = "feature-flags", description = "Feature flag management"),
    ),
)]
pub struct ApiDoc;
```

- [ ] **Step 7: Créer `src/bin/server.rs`**

```rust
//! SignApps Deploy HTTP API — dormant by default.
//!
//! Starts an Axum server on port 3035 if `DEPLOY_API_ENABLED=true`.
//! Otherwise exits cleanly with a log line so ops can tell it was invoked.

use anyhow::{Context, Result};
use signapps_cache::CacheService;
use signapps_common::JwtConfig;
use signapps_deploy::api::{routes::build_router, state::AppState};
use signapps_feature_flags::{
    cache::FeatureFlagCache, repository::PgFeatureFlagRepository,
};
use sqlx::PgPool;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<()> {
    signapps_common::bootstrap::init_tracing("signapps-deploy-server");
    signapps_common::bootstrap::load_env();

    if std::env::var("DEPLOY_API_ENABLED").unwrap_or_else(|_| "false".into()) != "true" {
        tracing::warn!(
            "DEPLOY_API_ENABLED is not 'true'; HTTP API is dormant. \
             Set DEPLOY_API_ENABLED=true to enable it."
        );
        return Ok(());
    }

    let db_url = std::env::var("DATABASE_URL").context("DATABASE_URL not set")?;
    let pool = PgPool::connect(&db_url).await?;

    let cache = Arc::new(CacheService::default_config());
    let jwt = JwtConfig::from_env().context("load JWT config")?;

    let feature_flags = PgFeatureFlagRepository::new(
        pool.clone(),
        FeatureFlagCache::new(cache.clone()),
    );

    let state = AppState {
        pool,
        cache,
        jwt,
        feature_flags,
    };

    let port = std::env::var("DEPLOY_PORT")
        .unwrap_or_else(|_| "3035".into())
        .parse::<u16>()
        .context("invalid DEPLOY_PORT")?;

    let app = build_router(state);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    tracing::info!(port, "signapps-deploy HTTP API listening");
    axum::serve(listener, app).await?;
    Ok(())
}
```

- [ ] **Step 8: Exporter depuis lib.rs**

Modifier `services/signapps-deploy/src/lib.rs` — ajouter :

```rust
pub mod api;
```

- [ ] **Step 9: Build**

```
cargo build -p signapps-deploy
```

Expected: les 3 binaires (`signapps-deploy`, `signapps-deploy-scheduler`, `signapps-deploy-server`) compilent.

- [ ] **Step 10: Smoke test server dormant**

```
DEPLOY_API_ENABLED=false cargo run -p signapps-deploy --bin signapps-deploy-server 2>&1 | tail -5
```

Expected: warning log "HTTP API is dormant", exit 0.

- [ ] **Step 11: Commit**

```bash
rtk git add services/signapps-deploy/
rtk git commit -m "feat(deploy): scaffold HTTP API module (dormant by default)"
```

---

## Task 7: Auth layer + admin middleware on the router

**Files:**
- Modify: `services/signapps-deploy/src/api/routes.rs`

- [ ] **Step 1: Wire auth middleware**

Remplacer `routes.rs` :

```rust
//! Router assembly.

use crate::api::{handlers, state::AppState};
use axum::{middleware, Router};
use signapps_common::middleware::{auth_middleware, require_admin};

/// Build the Phase 3a API router.
///
/// Layer order (outer → inner):
/// 1. Tracing (`TraceLayer` from tower_http)
/// 2. JWT extraction (`auth_middleware`)
/// 3. Superadmin enforcement (`require_admin` with role="superadmin")
/// 4. Handler routers
pub fn build_router(state: AppState) -> Router {
    let api = Router::new()
        .merge(handlers::envs::router())
        .merge(handlers::versions::router())
        .merge(handlers::deploy::router())
        .merge(handlers::rollback::router())
        .merge(handlers::maintenance::router())
        .merge(handlers::history::router())
        .merge(handlers::promote::router())
        .merge(handlers::feature_flags::router())
        .merge(handlers::events_ws::router())
        .with_state(state.clone());

    // Apply auth layer: require_admin reads the JWT set by auth_middleware.
    let protected = api
        .layer(middleware::from_fn_with_state(state.clone(), require_admin))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    Router::new()
        .nest("/api/v1/deploy", protected)
        .with_state(state)
}
```

**Note:** If `require_admin` in `signapps-common` checks role `"admin"` only, adapt to check `"superadmin"` via a local wrapper middleware. The task "Task 7.5" below handles this.

- [ ] **Step 2: Check require_admin role**

Run: `rtk grep -rn "require_admin\|superadmin" crates/signapps-common/src/ | head`

If `require_admin` checks only `"admin"`, create `services/signapps-deploy/src/api/auth.rs` with a `require_superadmin` wrapper:

```rust
//! Wrapper middleware: require that the caller has the superadmin role.

use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use signapps_common::auth::Claims;

pub async fn require_superadmin(req: Request, next: Next) -> Response {
    let Some(claims) = req.extensions().get::<Claims>() else {
        return (StatusCode::UNAUTHORIZED, "missing auth").into_response();
    };
    if !claims.is_superadmin() {
        return (StatusCode::FORBIDDEN, "superadmin required").into_response();
    }
    next.run(req).await
}
```

If `Claims` has a different method name (e.g., `has_role("superadmin")`), adapt the condition. If the concept doesn't exist and only a generic `role: String` is available, use `claims.role == "superadmin"`.

Then use `auth::require_superadmin` in `routes.rs` instead of `require_admin`.

Add `pub mod auth;` in `api/mod.rs`.

- [ ] **Step 3: Build**

```
cargo build -p signapps-deploy
```

- [ ] **Step 4: Commit**

```bash
rtk git add services/signapps-deploy/src/api/
rtk git commit -m "feat(deploy): auth layer requires superadmin role"
```

---

## Task 8: Read-only endpoints (envs, versions, history)

**Files:**
- Modify: `services/signapps-deploy/src/api/handlers/envs.rs`
- Modify: `services/signapps-deploy/src/api/handlers/versions.rs`
- Modify: `services/signapps-deploy/src/api/handlers/history.rs`

- [ ] **Step 1: Implement `envs.rs`**

```rust
//! `GET /envs` and `GET /envs/{env}/health`.

use crate::{api::state::AppState, docker::DockerClient, persistence};
use axum::{
    extract::{Path, State},
    response::Json,
    routing::get,
    Router,
};
use chrono::{DateTime, Utc};
use serde::Serialize;
use signapps_common::error::AppError;
use std::collections::HashMap;
use utoipa::ToSchema;

#[derive(Serialize, ToSchema)]
pub struct EnvStatus {
    pub env: String,
    pub current_version: Option<String>,
    pub deployed_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, ToSchema)]
pub struct EnvHealth {
    pub env: String,
    pub containers: HashMap<String, bool>,
    pub healthy: usize,
    pub total: usize,
}

#[utoipa::path(
    get,
    path = "/api/v1/deploy/envs",
    responses((status = 200, description = "List environments and their current versions", body = [EnvStatus])),
    tag = "deploy"
)]
async fn list_envs(State(state): State<AppState>) -> Result<Json<Vec<EnvStatus>>, AppError> {
    let mut out = Vec::new();
    for env in ["prod", "dev"] {
        let last = persistence::last_successful(&state.pool, env)
            .await
            .map_err(|e| AppError::internal(format!("query: {e:#}")))?;
        out.push(EnvStatus {
            env: env.to_string(),
            current_version: last.as_ref().map(|(v, _)| v.clone()),
            deployed_at: last.as_ref().map(|(_, d)| *d),
        });
    }
    Ok(Json(out))
}

#[utoipa::path(
    get,
    path = "/api/v1/deploy/envs/{env}/health",
    params(("env" = String, Path, description = "'prod' or 'dev'")),
    responses((status = 200, description = "Health of the stack", body = EnvHealth)),
    tag = "deploy"
)]
async fn env_health(Path(env): Path<String>) -> Result<Json<EnvHealth>, AppError> {
    if env != "prod" && env != "dev" {
        return Err(AppError::bad_request(format!("unknown env: {env}")));
    }
    let project = match env.as_str() {
        "prod" => "signapps-prod",
        "dev" => "signapps-staging",
        _ => unreachable!(),
    };
    let docker = DockerClient::connect()
        .map_err(|e| AppError::internal(format!("docker connect: {e:#}")))?;
    let containers = docker
        .health_by_project(project)
        .await
        .map_err(|e| AppError::internal(format!("docker query: {e:#}")))?;
    let total = containers.len();
    let healthy = containers.values().filter(|h| **h).count();
    Ok(Json(EnvHealth {
        env,
        containers,
        healthy,
        total,
    }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/envs", get(list_envs))
        .route("/envs/:env/health", get(env_health))
}
```

- [ ] **Step 2: Implement `versions.rs`**

```rust
//! `GET /versions`.
//!
//! Phase 3a: list distinct versions from the `deployments` table. A future
//! phase may query the GHCR API for tags, but for now the deployment history
//! is the authoritative source of what has been deployed.

use crate::api::state::AppState;
use axum::{extract::State, response::Json, routing::get, Router};
use chrono::{DateTime, Utc};
use serde::Serialize;
use signapps_common::error::AppError;
use utoipa::ToSchema;

#[derive(Serialize, ToSchema, sqlx::FromRow)]
pub struct VersionEntry {
    pub version: String,
    pub last_deployed_at: DateTime<Utc>,
    pub envs: Vec<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/deploy/versions",
    responses((status = 200, description = "Distinct versions ever deployed", body = [VersionEntry])),
    tag = "deploy"
)]
async fn list_versions(State(state): State<AppState>) -> Result<Json<Vec<VersionEntry>>, AppError> {
    let rows: Vec<VersionEntry> = sqlx::query_as(
        "SELECT version, \
                MAX(completed_at) AS last_deployed_at, \
                ARRAY_AGG(DISTINCT env ORDER BY env) AS envs \
         FROM deployments \
         WHERE status = 'success' \
         GROUP BY version \
         ORDER BY last_deployed_at DESC \
         LIMIT 100",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::internal(format!("query: {e:#}")))?;
    Ok(Json(rows))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/versions", get(list_versions))
}
```

- [ ] **Step 3: Implement `history.rs`**

```rust
//! `GET /history`.

use crate::api::state::AppState;
use axum::{
    extract::{Query, State},
    response::Json,
    routing::get,
    Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::error::AppError;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct HistoryQuery {
    pub env: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Serialize, ToSchema, sqlx::FromRow)]
pub struct DeploymentEntry {
    pub id: Uuid,
    pub env: String,
    pub version: String,
    pub status: String,
    pub triggered_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i32>,
    pub error_message: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/deploy/history",
    responses((status = 200, description = "Deployment history (most recent first)", body = [DeploymentEntry])),
    tag = "deploy"
)]
async fn list_history(
    State(state): State<AppState>,
    Query(q): Query<HistoryQuery>,
) -> Result<Json<Vec<DeploymentEntry>>, AppError> {
    let limit = q.limit.unwrap_or(50).clamp(1, 500);
    let rows: Vec<DeploymentEntry> = match q.env {
        Some(env) => sqlx::query_as(
            "SELECT id, env, version, status, triggered_at, completed_at, \
                    duration_seconds, error_message \
             FROM deployments \
             WHERE env = $1 \
             ORDER BY triggered_at DESC LIMIT $2",
        )
        .bind(env)
        .bind(limit)
        .fetch_all(&state.pool)
        .await,
        None => sqlx::query_as(
            "SELECT id, env, version, status, triggered_at, completed_at, \
                    duration_seconds, error_message \
             FROM deployments \
             ORDER BY triggered_at DESC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&state.pool)
        .await,
    }
    .map_err(|e| AppError::internal(format!("query: {e:#}")))?;
    Ok(Json(rows))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/history", get(list_history))
}
```

- [ ] **Step 4: Build**

```
cargo build -p signapps-deploy
```

Expected: compile cleanly. If `AppError::bad_request` / `AppError::internal` don't exist, check the actual methods in `signapps_common::error::AppError` and adapt.

- [ ] **Step 5: Commit**

```bash
rtk git add services/signapps-deploy/src/api/handlers/
rtk git commit -m "feat(deploy): read-only API endpoints (envs, versions, history)"
```

---

## Task 9: Mutation endpoints (deploy, rollback, maintenance, promote)

**Files:**
- Modify: `services/signapps-deploy/src/api/handlers/deploy.rs`
- Modify: `services/signapps-deploy/src/api/handlers/rollback.rs`
- Modify: `services/signapps-deploy/src/api/handlers/maintenance.rs`
- Modify: `services/signapps-deploy/src/api/handlers/promote.rs`

- [ ] **Step 1: Implement `deploy.rs`**

```rust
//! `POST /envs/{env}/deploy`.

use crate::{api::state::AppState, orchestrator};
use axum::{
    extract::{Path, State},
    response::Json,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::error::AppError;
use utoipa::ToSchema;

#[derive(Deserialize, ToSchema)]
pub struct DeployRequest {
    pub version: String,
    pub confirm: String,
}

#[derive(Serialize, ToSchema)]
pub struct DeployResponse {
    pub status: String,
}

#[utoipa::path(
    post,
    path = "/api/v1/deploy/envs/{env}/deploy",
    params(("env" = String, Path, description = "'prod' or 'dev'")),
    request_body = DeployRequest,
    responses(
        (status = 202, description = "Deployment started", body = DeployResponse),
        (status = 400, description = "Invalid request"),
        (status = 403, description = "Confirmation mismatch"),
    ),
    tag = "deploy"
)]
async fn deploy(
    Path(env): Path<String>,
    State(_state): State<AppState>,
    Json(req): Json<DeployRequest>,
) -> Result<Json<DeployResponse>, AppError> {
    if env != "prod" && env != "dev" {
        return Err(AppError::bad_request(format!("unknown env: {env}")));
    }
    if env == "prod" {
        let expected = format!("DEPLOY PROD {}", req.version);
        if req.confirm != expected {
            return Err(AppError::forbidden(format!(
                "confirmation mismatch — expected '{expected}'"
            )));
        }
    }
    // Kick off the deploy in a background task — return 202 immediately so
    // the UI can follow via WebSocket.
    let env_clone = env.clone();
    let version = req.version.clone();
    tokio::spawn(async move {
        if let Err(e) = orchestrator::deploy(&env_clone, &version).await {
            tracing::error!(error = %e, env = %env_clone, version = %version, "background deploy failed");
        }
    });
    Ok(Json(DeployResponse {
        status: "started".into(),
    }))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/envs/:env/deploy", post(deploy))
}
```

- [ ] **Step 2: Implement `rollback.rs`**

```rust
//! `POST /envs/{env}/rollback`.

use crate::{api::state::AppState, orchestrator};
use axum::{
    extract::{Path, State},
    response::Json,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::error::AppError;
use utoipa::ToSchema;

#[derive(Deserialize, ToSchema)]
pub struct RollbackRequest {
    pub confirm: String,
}

#[derive(Serialize, ToSchema)]
pub struct RollbackResponse {
    pub status: String,
}

#[utoipa::path(
    post,
    path = "/api/v1/deploy/envs/{env}/rollback",
    params(("env" = String, Path, description = "'prod' or 'dev'")),
    request_body = RollbackRequest,
    responses(
        (status = 202, description = "Rollback started", body = RollbackResponse),
        (status = 400, description = "Invalid request"),
        (status = 403, description = "Confirmation mismatch"),
    ),
    tag = "deploy"
)]
async fn rollback(
    Path(env): Path<String>,
    State(_state): State<AppState>,
    Json(req): Json<RollbackRequest>,
) -> Result<Json<RollbackResponse>, AppError> {
    if env != "prod" && env != "dev" {
        return Err(AppError::bad_request(format!("unknown env: {env}")));
    }
    if env == "prod" && req.confirm != "ROLLBACK PROD" {
        return Err(AppError::forbidden("confirmation mismatch"));
    }
    let env_clone = env.clone();
    tokio::spawn(async move {
        if let Err(e) = orchestrator::rollback(&env_clone).await {
            tracing::error!(error = %e, env = %env_clone, "background rollback failed");
        }
    });
    Ok(Json(RollbackResponse {
        status: "started".into(),
    }))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/envs/:env/rollback", post(rollback))
}
```

- [ ] **Step 3: Implement `maintenance.rs`**

```rust
//! `POST /envs/{env}/maintenance`.
//!
//! Toggles the maintenance flag. Body `{ "enable": true }` or `{ "enable": false }`.

use crate::{api::state::AppState, maintenance as mx};
use axum::{
    extract::{Path, State},
    response::Json,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::error::AppError;
use utoipa::ToSchema;

#[derive(Deserialize, ToSchema)]
pub struct MaintenanceRequest {
    pub enable: bool,
}

#[derive(Serialize, ToSchema)]
pub struct MaintenanceResponse {
    pub env: String,
    pub enabled: bool,
}

#[utoipa::path(
    post,
    path = "/api/v1/deploy/envs/{env}/maintenance",
    params(("env" = String, Path, description = "'prod' or 'dev'")),
    request_body = MaintenanceRequest,
    responses((status = 200, description = "Maintenance toggled", body = MaintenanceResponse)),
    tag = "deploy"
)]
async fn toggle_maintenance(
    Path(env): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<MaintenanceRequest>,
) -> Result<Json<MaintenanceResponse>, AppError> {
    if env != "prod" && env != "dev" {
        return Err(AppError::bad_request(format!("unknown env: {env}")));
    }
    if req.enable {
        mx::enable(&state.cache, &env)
            .await
            .map_err(|e| AppError::internal(format!("enable: {e:#}")))?;
    } else {
        mx::disable(&state.cache, &env)
            .await
            .map_err(|e| AppError::internal(format!("disable: {e:#}")))?;
    }
    Ok(Json(MaintenanceResponse {
        env,
        enabled: req.enable,
    }))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/envs/:env/maintenance", post(toggle_maintenance))
}
```

- [ ] **Step 4: Implement `promote.rs`**

```rust
//! `POST /promote`.

use crate::{api::state::AppState, promote};
use axum::{extract::State, response::Json, routing::post, Router};
use serde::{Deserialize, Serialize};
use signapps_common::error::AppError;
use utoipa::ToSchema;

#[derive(Deserialize, ToSchema)]
pub struct PromoteRequest {
    pub confirm: String,
}

#[derive(Serialize, ToSchema)]
pub struct PromoteResponse {
    pub status: String,
}

#[utoipa::path(
    post,
    path = "/api/v1/deploy/promote",
    request_body = PromoteRequest,
    responses(
        (status = 202, description = "Promotion started", body = PromoteResponse),
        (status = 403, description = "Confirmation mismatch"),
    ),
    tag = "deploy"
)]
async fn promote(
    State(_state): State<AppState>,
    Json(req): Json<PromoteRequest>,
) -> Result<Json<PromoteResponse>, AppError> {
    if req.confirm != "PROMOTE TO PROD" {
        return Err(AppError::forbidden("confirmation mismatch"));
    }
    tokio::spawn(async move {
        if let Err(e) = promote::promote_dev_to_prod().await {
            tracing::error!(error = %e, "background promote failed");
        }
    });
    Ok(Json(PromoteResponse {
        status: "started".into(),
    }))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/promote", post(promote))
}
```

- [ ] **Step 5: Build**

```
cargo build -p signapps-deploy
```

- [ ] **Step 6: Commit**

```bash
rtk git add services/signapps-deploy/src/api/handlers/
rtk git commit -m "feat(deploy): mutation endpoints (deploy, rollback, maintenance, promote)"
```

---

## Task 10: Feature flags CRUD endpoints

**Files:**
- Modify: `services/signapps-deploy/src/api/handlers/feature_flags.rs`

- [ ] **Step 1: Implement**

```rust
//! Feature flags CRUD.
//!
//! - `GET    /feature-flags?env=prod`
//! - `GET    /feature-flags/{key}?env=prod`
//! - `PUT    /feature-flags/{key}` (upsert with `env` in body)
//! - `DELETE /feature-flags/{key}?env=prod`

use crate::api::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, put},
    Router,
};
use serde::{Deserialize, Serialize};
use signapps_common::error::AppError;
use signapps_feature_flags::FeatureFlag;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct EnvQuery {
    pub env: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpsertRequest {
    pub env: String,
    pub enabled: bool,
    pub rollout_percent: i32,
    pub target_orgs: Vec<Uuid>,
    pub target_users: Vec<Uuid>,
    pub description: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct DeleteResponse {
    pub deleted: bool,
}

#[utoipa::path(
    get,
    path = "/api/v1/deploy/feature-flags",
    responses((status = 200, description = "List flags", body = [FeatureFlag])),
    tag = "feature-flags"
)]
async fn list_flags(
    State(state): State<AppState>,
    Query(q): Query<EnvQuery>,
) -> Result<Json<Vec<FeatureFlag>>, AppError> {
    let flags = state
        .feature_flags
        .list(q.env.as_deref())
        .await
        .map_err(|e| AppError::internal(format!("list: {e:#}")))?;
    Ok(Json(flags))
}

#[utoipa::path(
    get,
    path = "/api/v1/deploy/feature-flags/{key}",
    params(("key" = String, Path, description = "Flag key")),
    responses(
        (status = 200, description = "Flag details", body = FeatureFlag),
        (status = 404, description = "Flag not found"),
    ),
    tag = "feature-flags"
)]
async fn get_flag(
    Path(key): Path<String>,
    State(state): State<AppState>,
    Query(q): Query<EnvQuery>,
) -> Result<Json<FeatureFlag>, AppError> {
    let env = q.env.unwrap_or_else(|| "prod".into());
    let flag = state
        .feature_flags
        .get(&key, &env)
        .await
        .map_err(|e| AppError::internal(format!("get: {e:#}")))?
        .ok_or_else(|| AppError::not_found(format!("flag '{key}' in env '{env}'")))?;
    Ok(Json(flag))
}

#[utoipa::path(
    put,
    path = "/api/v1/deploy/feature-flags/{key}",
    params(("key" = String, Path, description = "Flag key")),
    request_body = UpsertRequest,
    responses((status = 200, description = "Upserted", body = FeatureFlag)),
    tag = "feature-flags"
)]
async fn upsert_flag(
    Path(key): Path<String>,
    State(state): State<AppState>,
    Json(req): Json<UpsertRequest>,
) -> Result<Json<FeatureFlag>, AppError> {
    let flag = state
        .feature_flags
        .upsert(
            &key,
            &req.env,
            req.enabled,
            req.rollout_percent,
            &req.target_orgs,
            &req.target_users,
            req.description.as_deref(),
            None, // actor_id — plugged in when claims are available
        )
        .await
        .map_err(|e| AppError::internal(format!("upsert: {e:#}")))?;
    Ok(Json(flag))
}

#[utoipa::path(
    delete,
    path = "/api/v1/deploy/feature-flags/{key}",
    params(("key" = String, Path, description = "Flag key")),
    responses((status = 200, description = "Deleted", body = DeleteResponse)),
    tag = "feature-flags"
)]
async fn delete_flag(
    Path(key): Path<String>,
    State(state): State<AppState>,
    Query(q): Query<EnvQuery>,
) -> Result<(StatusCode, Json<DeleteResponse>), AppError> {
    let env = q.env.unwrap_or_else(|| "prod".into());
    let deleted = state
        .feature_flags
        .delete(&key, &env)
        .await
        .map_err(|e| AppError::internal(format!("delete: {e:#}")))?;
    Ok((
        if deleted { StatusCode::OK } else { StatusCode::NOT_FOUND },
        Json(DeleteResponse { deleted }),
    ))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/feature-flags", get(list_flags))
        .route(
            "/feature-flags/:key",
            get(get_flag).put(upsert_flag).delete(delete_flag),
        )
}
```

- [ ] **Step 2: Build**

```
cargo build -p signapps-deploy
```

- [ ] **Step 3: Commit**

```bash
rtk git add services/signapps-deploy/src/api/handlers/feature_flags.rs
rtk git commit -m "feat(deploy): feature flags CRUD endpoints"
```

---

## Task 11: WebSocket events streaming

**Files:**
- Modify: `services/signapps-deploy/src/api/handlers/events_ws.rs`

- [ ] **Step 1: Implement**

```rust
//! `GET /events` — WebSocket upgrade. Streams `deployment.*` events.
//!
//! Source: `PgEventBus` in `signapps-common`. The bus publishes events with
//! channel names like `deployment.started`, `deployment.completed`, etc. This
//! handler subscribes to all `deployment.*` channels and forwards each event
//! as a JSON text message over the WebSocket.
//!
//! Keepalive: a ping is sent every 30s so the connection survives idle
//! periods and intermediate proxies don't time out.

use crate::api::state::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use serde::Serialize;
use std::time::Duration;
use tokio::time::interval;

#[derive(Serialize)]
struct Frame {
    channel: String,
    payload: serde_json::Value,
}

async fn events_ws_handler(
    ws: WebSocketUpgrade,
    State(_state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    let mut keepalive = interval(Duration::from_secs(30));

    // Phase 3a: publish a startup frame so the client sees something
    // immediately. Real event subscription will hook into PgEventBus once
    // the bus surface is stable across crates — for now, the loop is a
    // heartbeat placeholder that can be extended.
    let startup = Frame {
        channel: "deploy.connected".into(),
        payload: serde_json::json!({ "version": env!("CARGO_PKG_VERSION") }),
    };
    if let Ok(txt) = serde_json::to_string(&startup) {
        if socket.send(Message::Text(txt)).await.is_err() {
            return;
        }
    }

    loop {
        tokio::select! {
            _ = keepalive.tick() => {
                if socket.send(Message::Ping(Vec::new())).await.is_err() {
                    break;
                }
            }
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => { /* ignore client frames */ }
                }
            }
        }
    }
    tracing::info!("events websocket closed");
}

pub fn router() -> Router<AppState> {
    Router::new().route("/events", get(events_ws_handler))
}
```

**Why only a heartbeat for Phase 3a:** the `PgEventBus` integration needs a subscribe-all-prefix primitive that may or may not exist yet. Getting the WebSocket wiring right on its own (upgrade, keepalive, clean shutdown) is a valid Phase 3a deliverable. Phase 3b or a later task can swap the heartbeat loop for a real bus subscription once the bus API is confirmed — with the advantage that the UI already has a working WebSocket from day 1.

Document this in the module comment.

- [ ] **Step 2: Build**

```
cargo build -p signapps-deploy
```

- [ ] **Step 3: Commit**

```bash
rtk git add services/signapps-deploy/src/api/handlers/events_ws.rs
rtk git commit -m "feat(deploy): WebSocket events endpoint with heartbeat (bus hookup deferred)"
```

---

## Task 12: OpenAPI + Swagger UI

**Files:**
- Modify: `services/signapps-deploy/src/api/openapi.rs`
- Modify: `services/signapps-deploy/src/api/routes.rs`

- [ ] **Step 1: Aggregate the OpenAPI**

Replace `openapi.rs`:

```rust
//! OpenAPI aggregator for the Phase 3a API.

use utoipa::OpenApi;

use crate::api::handlers::{deploy, envs, feature_flags, history, maintenance, promote, rollback, versions};

#[derive(OpenApi)]
#[openapi(
    paths(
        envs::list_envs,
        envs::env_health,
        versions::list_versions,
        history::list_history,
        deploy::deploy,
        rollback::rollback,
        maintenance::toggle_maintenance,
        promote::promote,
        feature_flags::list_flags,
        feature_flags::get_flag,
        feature_flags::upsert_flag,
        feature_flags::delete_flag,
    ),
    components(schemas(
        envs::EnvStatus,
        envs::EnvHealth,
        versions::VersionEntry,
        history::DeploymentEntry,
        deploy::DeployRequest,
        deploy::DeployResponse,
        rollback::RollbackRequest,
        rollback::RollbackResponse,
        maintenance::MaintenanceRequest,
        maintenance::MaintenanceResponse,
        promote::PromoteRequest,
        promote::PromoteResponse,
        feature_flags::UpsertRequest,
        feature_flags::DeleteResponse,
        signapps_feature_flags::FeatureFlag,
    )),
    tags(
        (name = "deploy", description = "Deployment orchestrator API"),
        (name = "feature-flags", description = "Feature flag management"),
    ),
    info(title = "SignApps Deploy API", version = "0.1.0"),
)]
pub struct ApiDoc;
```

**Note:** The `utoipa::path` attribute macros on each handler function require the handler to be `pub`. Each handler currently is declared as `async fn` without a `pub` keyword. Change the handler functions to `pub async fn` so the utoipa-generated path items resolve.

Actually — for OpenAPI generation, `utoipa::path` only needs the function to be visible from the `openapi.rs` aggregator. Since the aggregator uses `envs::list_envs`, the function must be public at least at the module level. Declare them as `pub(crate) async fn` or `pub async fn` as needed.

- [ ] **Step 2: Mount Swagger UI in routes**

Modify `routes.rs` — add the swagger UI before the nest:

```rust
use utoipa_swagger_ui::SwaggerUi;

pub fn build_router(state: AppState) -> Router {
    // ... existing protected/api assembly ...

    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", crate::api::openapi::ApiDoc::openapi()))
        .nest("/api/v1/deploy", protected)
        .with_state(state)
}
```

**Security:** Swagger UI is publicly readable by default. Since this API is internal and Phase 3a is dormant by default, that's acceptable for now. Phase 3b or a later ops task can restrict it.

- [ ] **Step 3: Make handler fns visible**

Go through each handler file (`envs.rs`, `versions.rs`, etc.) and prefix the annotated handler functions with `pub`.

- [ ] **Step 4: Build**

```
cargo build -p signapps-deploy
```

Expected: compiles. If utoipa complains about missing `ToSchema` for a type, add `#[derive(utoipa::ToSchema)]` (or wrap the type).

- [ ] **Step 5: Commit**

```bash
rtk git add services/signapps-deploy/src/api/
rtk git commit -m "feat(deploy): OpenAPI spec + Swagger UI at /swagger-ui"
```

---

## Task 13: E2E API smoke tests

**Files:**
- Create: `services/signapps-deploy/tests/api_smoke.rs`

- [ ] **Step 1: Write the test**

```rust
//! E2E smoke test: spin up the API in-process, hit each read-only endpoint.
//!
//! Auth is bypassed by building the router with a no-op auth layer because
//! the default real layer requires a signed JWT. For production-path E2E,
//! the staging stack (Phase 2) hits the real /api/v1/deploy from outside.

use axum::Router;
use reqwest::StatusCode;
use signapps_cache::CacheService;
use signapps_common::JwtConfig;
use signapps_deploy::api::state::AppState;
use signapps_feature_flags::{cache::FeatureFlagCache, repository::PgFeatureFlagRepository};
use sqlx::PgPool;
use std::{net::SocketAddr, sync::Arc};
use tokio::net::TcpListener;

async fn test_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://signapps:signapps_dev@127.0.0.1:5432/signapps".to_string());
    PgPool::connect(&url).await.expect("connect")
}

async fn spawn_router_without_auth() -> String {
    let pool = test_pool().await;
    let cache = Arc::new(CacheService::default_config());
    let jwt = JwtConfig::hs256_from_secret("test-secret-that-is-long-enough-for-hs256");
    let ff_cache = FeatureFlagCache::new(cache.clone());
    let ff_repo = PgFeatureFlagRepository::new(pool.clone(), ff_cache);
    let state = AppState {
        pool,
        cache,
        jwt,
        feature_flags: ff_repo,
    };

    // Build ONLY the handler routers (no auth layer), nested under the same
    // path prefix as the real router so paths in tests match production.
    let api = Router::new()
        .merge(signapps_deploy::api::handlers::envs::router())
        .merge(signapps_deploy::api::handlers::versions::router())
        .merge(signapps_deploy::api::handlers::history::router())
        .merge(signapps_deploy::api::handlers::feature_flags::router())
        .with_state(state);

    let app = Router::new().nest("/api/v1/deploy", api);

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr: SocketAddr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    format!("http://{addr}")
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn list_envs_returns_two_entries() {
    let base = spawn_router_without_auth().await;
    let resp = reqwest::get(format!("{base}/api/v1/deploy/envs"))
        .await
        .expect("GET");
    assert_eq!(resp.status(), StatusCode::OK);
    let body: serde_json::Value = resp.json().await.expect("json");
    let arr = body.as_array().expect("array");
    assert_eq!(arr.len(), 2);
    let envs: Vec<&str> = arr
        .iter()
        .map(|e| e["env"].as_str().unwrap_or(""))
        .collect();
    assert!(envs.contains(&"prod"));
    assert!(envs.contains(&"dev"));
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn list_history_accepts_env_filter() {
    let base = spawn_router_without_auth().await;
    let resp = reqwest::get(format!("{base}/api/v1/deploy/history?env=dev&limit=5"))
        .await
        .expect("GET");
    assert_eq!(resp.status(), StatusCode::OK);
    let body: serde_json::Value = resp.json().await.expect("json");
    assert!(body.is_array());
}

#[tokio::test]
#[ignore = "requires Postgres"]
async fn feature_flag_upsert_get_delete_roundtrip() {
    let base = spawn_router_without_auth().await;
    let client = reqwest::Client::new();
    let key = format!("test-flag-{}", uuid::Uuid::new_v4());

    // Upsert
    let resp = client
        .put(format!("{base}/api/v1/deploy/feature-flags/{key}"))
        .json(&serde_json::json!({
            "env": "prod",
            "enabled": true,
            "rollout_percent": 50,
            "target_orgs": [],
            "target_users": [],
            "description": "test"
        }))
        .send()
        .await
        .expect("PUT");
    assert_eq!(resp.status(), StatusCode::OK);

    // Get
    let resp = client
        .get(format!("{base}/api/v1/deploy/feature-flags/{key}?env=prod"))
        .send()
        .await
        .expect("GET");
    assert_eq!(resp.status(), StatusCode::OK);

    // Delete
    let resp = client
        .delete(format!("{base}/api/v1/deploy/feature-flags/{key}?env=prod"))
        .send()
        .await
        .expect("DELETE");
    assert_eq!(resp.status(), StatusCode::OK);
}
```

- [ ] **Step 2: Add reqwest as a dev-dep**

In `services/signapps-deploy/Cargo.toml`, under `[dev-dependencies]`:

```toml
reqwest = { version = "0.12", features = ["json"] }
```

- [ ] **Step 3: Run tests**

```
cargo nextest run -p signapps-deploy --test api_smoke -- --ignored
```

Expected: 3/3 PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add services/signapps-deploy/
rtk git commit -m "test(deploy): E2E API smoke tests (envs, history, feature flags)"
```

---

## Task 14: Docs + final validation

**Files:**
- Modify: `services/signapps-deploy/README.md`
- Modify: `.env.example`

- [ ] **Step 1: Document the API in README**

Append a new section to `services/signapps-deploy/README.md`:

````markdown
## Phase 3a additions — HTTP API + WebSocket

The orchestrator now ships a dormant HTTP API (port 3035) activated by an env var. When enabled, all endpoints live under `/api/v1/deploy/` and require the `superadmin` JWT role.

### Enabling the API

```bash
export DEPLOY_API_ENABLED=true
export DATABASE_URL=postgres://signapps:signapps_dev@localhost:5432/signapps
export JWT_PUBLIC_KEY_PEM=...       # same key as identity
cargo run --release --bin signapps-deploy-server
```

### Endpoints (v1)

| Method | Path | Purpose |
|---|---|---|
| GET | `/envs` | List environments + current versions |
| GET | `/envs/{env}/health` | Container health (prod/dev) |
| GET | `/versions` | Distinct versions ever deployed |
| GET | `/history` | Deployment history (filter by `?env=`) |
| POST | `/envs/{env}/deploy` | Kick off a deployment (requires confirm) |
| POST | `/envs/{env}/rollback` | Rollback (requires confirm on prod) |
| POST | `/envs/{env}/maintenance` | Toggle maintenance flag |
| POST | `/promote` | Promote last dev success to prod |
| GET | `/feature-flags` | List flags (filter by `?env=`) |
| GET | `/feature-flags/{key}` | Single flag |
| PUT | `/feature-flags/{key}` | Upsert flag |
| DELETE | `/feature-flags/{key}` | Delete flag |
| GET | `/events` | WebSocket stream of deploy events |

### OpenAPI + Swagger UI

Interactive docs at `http://<host>:3035/swagger-ui/`. The raw OpenAPI JSON is at `/api-docs/openapi.json`.

### WebSocket

`GET /api/v1/deploy/events` upgrades to WebSocket. Phase 3a emits a `deploy.connected` frame then keeps the connection alive with pings every 30s. Real `deployment.*` event streaming from `PgEventBus` is a follow-up.

### Feature flags

Flags are per (key, env) pairs. The evaluator applies:
1. `enabled == false` → always false
2. `target_users` contains user → true
3. `target_orgs` contains org → true
4. `rollout_percent` mod-100 hash bucket of user/org id
````

- [ ] **Step 2: Add `DEPLOY_API_ENABLED=false` to `.env.example`**

Append:

```
# Deploy API (Phase 3a). Set to "true" to activate HTTP endpoints.
DEPLOY_API_ENABLED=false
```

- [ ] **Step 3: Full quality pipeline**

```
cargo fmt -p signapps-deploy -p signapps-feature-flags -- --check
cargo clippy -p signapps-deploy -p signapps-feature-flags -- -D warnings
cargo nextest run -p signapps-deploy -p signapps-feature-flags
cargo nextest run -p signapps-deploy --run-ignored only
```

Each must pass. If fmt drift appears on Phase 3a files, run `cargo fmt -p <crate>` and commit separately.

- [ ] **Step 4: Tag completion**

```bash
rtk git tag -a phase3a-deploy-api-complete -m "Phase 3a: Backend API + WebSocket complete"
```

Do NOT push the tag.

- [ ] **Step 5: Commit docs**

```bash
rtk git add services/signapps-deploy/README.md .env.example
rtk git commit -m "docs(deploy): document Phase 3a HTTP API + env vars"
```

---

## Review Checklist (après exécution)

- [ ] `DEPLOY_API_ENABLED=false cargo run --bin signapps-deploy-server` exits cleanly with warning
- [ ] `DEPLOY_API_ENABLED=true` with a valid DB starts the server on port 3035
- [ ] Swagger UI at `/swagger-ui/` shows all 13 routes
- [ ] All routes behind `/api/v1/deploy/` return 401 without a JWT
- [ ] `GET /api/v1/deploy/envs` returns `prod` + `dev` with the current versions
- [ ] `GET /api/v1/deploy/history` respects `?env=` and `?limit=` query params
- [ ] `PUT /api/v1/deploy/feature-flags/{key}` upserts and the cache is invalidated
- [ ] WebSocket `/events` connects, sends `deploy.connected`, keeps alive with pings
- [ ] `cargo clippy -D warnings` passes on `signapps-deploy` and `signapps-feature-flags`
- [ ] 5 unit tests in `signapps-feature-flags::evaluator` pass
- [ ] 3 E2E API tests pass (`api_smoke.rs --ignored`)
- [ ] Tag `phase3a-deploy-api-complete` created locally
