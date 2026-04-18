# Phase D2 · P1 — Single-Binary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fusionner les 33 services SignApps en un seul binaire `signapps-platform` (tokio tasks) avec ressources partagées init-once et supervisor restart, faisant passer le cold start de 60 s à < 3 s.

**Architecture:** Chaque `services/signapps-<svc>/` expose `pub fn router(shared) -> axum::Router` via son `lib.rs` et conserve un `bin/main.rs` legacy. Un nouveau crate `services/signapps-platform/` assemble le `SharedState` (PgPool, JwtConfig, Keystore, cache, event bus) une seule fois, puis `tokio::spawn` un router par service, supervisé par un superviseur avec backoff exponentiel. Les migrations deviennent idempotentes (`CREATE TABLE IF NOT EXISTS`) et ne s'exécutent qu'une fois. `signapps-ai` passe en lazy init via `OnceCell` — routeur disponible à t0, coût des modèles/providers payé à la 1re requête. `just start` bascule sur le single-binary ; `just start-legacy` conserve les 33 process pour debug isolé.

**Tech Stack:** Rust 1.75, tokio 1.x, axum 0.7, sqlx-postgres, `futures::future::try_join_all`, `OnceCell`, `signapps-common::bootstrap`, existing `signapps-service` crate, just, PowerShell.

---

## Scope Check

Ce plan couvre **uniquement la Phase 1** de la spec (`docs/superpowers/specs/2026-04-18-phase-d2-architectural-perf-design.md`). Les Phases 2 (frontend Turbopack + RSC) et 3 (Web Workers + edge cache + Lighthouse) auront leurs propres plans après livraison de P1.

## File Structure

### Fichiers créés

| Fichier | Responsabilité |
|---|---|
| `crates/signapps-service/src/shared_state.rs` | Struct `SharedState` + `init_once()` — pool + jwt + keystore + cache + event bus |
| `crates/signapps-service/src/supervisor.rs` | `Supervisor` + `ServiceSpec` + restart policy (exp backoff, plafond) |
| `crates/signapps-service/tests/supervisor.rs` | Tests respawn, plafond, aucune cascade |
| `services/signapps-platform/Cargo.toml` | Nouveau binaire qui dépend de tous les services (library) |
| `services/signapps-platform/src/main.rs` | Entry point : init SharedState + migrations + supervisor.run |
| `services/signapps-platform/src/services.rs` | Table de déclaration des 33 services (nom, port, constructor) |
| `services/signapps-platform/tests/boot.rs` | Test intégration : 33 `/health` répondent 200 en < 3 s |
| `services/signapps-platform/tests/migrations_idempotent.rs` | Boot 2× de suite, assert zéro warning |
| `services/signapps-<svc>/src/lib.rs` (×33) | Expose `pub fn router(shared) -> Router` + `pub struct State` (pour chaque service) |
| `services/signapps-<svc>/src/bin/main.rs` (×33) | Binaire legacy (`#[tokio::main] fn main` qui appelle `lib::router`) |
| `.claude/skills/single-binary-debug/SKILL.md` | Skill de debug boot/supervisor |
| `migrations/AUDIT.md` | Journal d'audit idempotence des 215 migrations |

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `crates/signapps-service/src/lib.rs` | Exporter `pub mod shared_state; pub mod supervisor;` |
| `services/signapps-<svc>/src/main.rs` (×33) | Supprimé (remplacé par `bin/main.rs`) |
| `services/signapps-<svc>/Cargo.toml` (×33) | `[lib] path = "src/lib.rs"` + `[[bin]] path = "src/bin/main.rs"` |
| `services/signapps-ai/src/lib.rs` | `OnceCell` pour `ProviderRegistry`, `ModelManager`, GPU detection |
| `migrations/*.sql` (215 fichiers audités) | Convertir `CREATE TABLE` → `CREATE TABLE IF NOT EXISTS`, idem `ADD CONSTRAINT`, `CREATE INDEX` |
| `justfile` | `start` → `signapps-platform` ; `start-legacy` → `start-all.ps1` |
| `scripts/start-platform.ps1` | Nouveau lanceur single-binary |
| `docs/product-specs/NN-perf-architecturale.md` | Spec produit miroir du design technique |
| `Cargo.toml` (workspace) | Ajouter `services/signapps-platform` aux members |

### Tests

| Test | Fichier | Cible |
|---|---|---|
| Supervisor respawn | `crates/signapps-service/tests/supervisor.rs` | Panic d'une task → restart avec backoff, process vivant |
| Supervisor plafond | `crates/signapps-service/tests/supervisor.rs` | 5 panic/min → état `failed`, plus de retry, 503 |
| Shared state init | `crates/signapps-service/tests/shared_state.rs` | PgPool + JWT + Keystore + cache + event bus init une fois |
| Platform boot | `services/signapps-platform/tests/boot.rs` | 33 `/health` = 200, `elapsed < 3s` |
| Migrations idempotent | `services/signapps-platform/tests/migrations_idempotent.rs` | 2× boot → zéro warning sqlx |
| Service router pilot | `services/signapps-identity/tests/lib_router.rs` | `router(state)` expose `/api/v1/auth/login` |
| Lazy AI init | `services/signapps-ai/tests/lazy_init.rs` | Boot en < 100 ms, 1re requête < 10 s, 2e < 50 ms |
| E2E single-binary | `tests/e2e_single_binary.rs` | Login + fetch `/api/v1/auth/me` avec backend single-binary |

---

## Milestones (séquence d'exécution)

| Wave | Tasks | Contenu |
|---|---|---|
| **W0** | 1–6 | Infra partagée (SharedState, Supervisor, platform crate shell) |
| **W1** | 7–10 | Service pilote `signapps-identity` refactor |
| **W2** | 11–15 | Batch simple (20 services sans background task) |
| **W3** | 16–18 | Batch complexe (gateway, ai, scheduler, webhooks) |
| **W4** | 19–21 | Lazy init AI (OnceCell) |
| **W5** | 22–28 | Migrations idempotentes (audit + rewrite) |
| **W6** | 29–32 | Bascule `just start` + scripts + docs |
| **W7** | 33–36 | Tests E2E, debug skill, product spec |

---

## Wave 0 — Infrastructure partagée

### Task 1: Créer `SharedState` dans `signapps-service`

**Files:**
- Create: `crates/signapps-service/src/shared_state.rs`
- Modify: `crates/signapps-service/src/lib.rs`
- Test: `crates/signapps-service/tests/shared_state.rs`

- [ ] **Step 1: Write failing integration test**

Create `crates/signapps-service/tests/shared_state.rs`:

```rust
use signapps_service::shared_state::SharedState;

#[tokio::test]
async fn shared_state_init_once_populates_all_fields() {
    std::env::set_var(
        "DATABASE_URL",
        "postgres://signapps:signapps_dev@localhost:5432/signapps",
    );
    std::env::set_var("JWT_SECRET", "x".repeat(32));
    std::env::set_var("KEYSTORE_MASTER_KEY", "0".repeat(64));

    let shared = SharedState::init_once()
        .await
        .expect("SharedState::init_once should succeed with env set");

    assert!(shared.pool.inner().size() > 0, "pg pool must be open");
    assert!(
        shared.jwt.algorithm() != signapps_common::auth::JwtAlgorithm::default(),
        "jwt config must load from env"
    );
    assert!(Arc::strong_count(&shared.keystore) >= 1);
    assert!(Arc::strong_count(&shared.cache) >= 1);
    assert!(Arc::strong_count(&shared.event_bus) >= 1);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p signapps-service --test shared_state -- --nocapture`
Expected: FAIL with "module shared_state does not exist" or similar.

- [ ] **Step 3: Implement `SharedState`**

Create `crates/signapps-service/src/shared_state.rs`:

```rust
//! Shared, init-once resources for the single-binary runtime.
//!
//! Every service inside `signapps-platform` borrows an `Arc<SharedState>`
//! rather than constructing its own pool / keystore / tracing.
//!
//! # Errors
//!
//! [`SharedState::init_once`] returns an error when any of the underlying
//! subsystems fail to load (database connect, keystore unlock, env missing).
//!
//! # Panics
//!
//! No panic possible — all failures are propagated via `anyhow::Result`.

use std::sync::Arc;

use anyhow::{Context, Result};
use signapps_cache::CacheService;
use signapps_common::{bootstrap::load_env, pg_events::PgEventBus, JwtConfig};
use signapps_db::{create_pool, DatabasePool};
use signapps_keystore::{Keystore, KeystoreBackend};

/// Aggregate of every resource that must live for the lifetime of the
/// single-binary process.  Constructed exactly once via [`init_once`].
#[derive(Clone)]
pub struct SharedState {
    pub pool: DatabasePool,
    pub jwt: Arc<JwtConfig>,
    pub keystore: Arc<Keystore>,
    pub cache: Arc<CacheService>,
    pub event_bus: Arc<PgEventBus>,
}

impl SharedState {
    /// Load env, open the database pool, unlock the keystore, build JWT
    /// config and event bus.  Safe to call at most once per process.
    pub async fn init_once() -> Result<Self> {
        load_env();

        let database_url = std::env::var("DATABASE_URL")
            .context("DATABASE_URL must be set for SharedState::init_once")?;
        let pool = create_pool(&database_url)
            .await
            .context("failed to create shared Postgres pool")?;

        let jwt = Arc::new(JwtConfig::from_env());

        let keystore = Arc::new(
            Keystore::init(KeystoreBackend::EnvVar)
                .await
                .context("failed to unlock shared keystore")?,
        );

        let cache = Arc::new(CacheService::new(
            50_000,
            std::time::Duration::from_secs(900),
        ));

        let event_bus = Arc::new(PgEventBus::new(
            pool.inner().clone(),
            "signapps-platform".to_string(),
        ));

        Ok(Self {
            pool,
            jwt,
            keystore,
            cache,
            event_bus,
        })
    }
}
```

Modify `crates/signapps-service/src/lib.rs` — add at the top of the file:

```rust
pub mod shared_state;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p signapps-service --test shared_state -- --nocapture`
Expected: PASS. Needs Postgres running on `localhost:5432` (use `just db-start`).

- [ ] **Step 5: Commit**

```bash
git add crates/signapps-service/src/shared_state.rs \
        crates/signapps-service/src/lib.rs \
        crates/signapps-service/tests/shared_state.rs
git commit -m "feat(service): add SharedState::init_once for single-binary runtime"
```

---

### Task 2: Créer `ServiceSpec` et `Supervisor`

**Files:**
- Create: `crates/signapps-service/src/supervisor.rs`
- Modify: `crates/signapps-service/src/lib.rs`
- Test: `crates/signapps-service/tests/supervisor.rs`

- [ ] **Step 1: Write failing test for happy path**

Create `crates/signapps-service/tests/supervisor.rs`:

```rust
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use signapps_service::supervisor::{ServiceSpec, Supervisor};

#[tokio::test]
async fn supervisor_runs_all_services_in_parallel() {
    let counter = Arc::new(AtomicUsize::new(0));

    let specs = (0..5)
        .map(|i| {
            let c = counter.clone();
            ServiceSpec::new(format!("svc-{i}"), 0, move || {
                let c = c.clone();
                Box::pin(async move {
                    c.fetch_add(1, Ordering::SeqCst);
                    tokio::time::sleep(Duration::from_millis(50)).await;
                    Ok(())
                })
            })
        })
        .collect::<Vec<_>>();

    let supervisor = Supervisor::new(specs);
    let handle = tokio::spawn(async move { supervisor.run_until_all_done().await });
    tokio::time::sleep(Duration::from_millis(200)).await;
    handle.abort();

    assert_eq!(counter.load(Ordering::SeqCst), 5);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p signapps-service --test supervisor -- --nocapture`
Expected: FAIL with "module supervisor not found".

- [ ] **Step 3: Implement the minimal Supervisor**

Create `crates/signapps-service/src/supervisor.rs`:

```rust
//! Task supervisor with exponential-backoff restart for the single-binary runtime.
//!
//! Each [`ServiceSpec`] declares a name, a port (for diagnostics) and an
//! `async fn() -> Result<()>` factory.  [`Supervisor::run_forever`] spawns
//! every service as a `tokio::task`, restarts those that exit in error
//! with exponential backoff (1 s, 2 s, 4 s, 8 s, 16 s, capped at 30 s),
//! and escalates to a permanent `failed` state after 5 crashes in under
//! 60 s — which is logged via `tracing::error!` and leaves the other
//! tasks running.
//!
//! # Errors
//!
//! [`Supervisor::run_until_all_done`] is a test helper; it waits until
//! every task has completed cleanly and returns the last error seen if any.
//!
//! # Panics
//!
//! Panics inside a task are caught (`tokio::spawn` propagates via
//! `JoinError::panic`) and treated as an error for the backoff counter.

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::Result;
use tokio::task::JoinSet;

type ServiceFactory =
    Arc<dyn Fn() -> Pin<Box<dyn Future<Output = Result<()>> + Send>> + Send + Sync>;

/// Declarative spec for one service inside the single-binary process.
pub struct ServiceSpec {
    pub name: String,
    pub port: u16,
    pub factory: ServiceFactory,
}

impl ServiceSpec {
    pub fn new<F, Fut>(name: impl Into<String>, port: u16, factory: F) -> Self
    where
        F: Fn() -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<()>> + Send + 'static,
    {
        let factory: ServiceFactory = Arc::new(move || Box::pin(factory()));
        Self {
            name: name.into(),
            port,
            factory,
        }
    }
}

/// Restart policy: exponential backoff up to 30 s, permanent failure after
/// 5 crashes in a 60 s sliding window.
#[derive(Clone, Copy, Debug)]
struct RestartPolicy {
    max_crashes_per_minute: usize,
    max_backoff: Duration,
}

impl Default for RestartPolicy {
    fn default() -> Self {
        Self {
            max_crashes_per_minute: 5,
            max_backoff: Duration::from_secs(30),
        }
    }
}

pub struct Supervisor {
    specs: Vec<ServiceSpec>,
    policy: RestartPolicy,
}

impl Supervisor {
    pub fn new(specs: Vec<ServiceSpec>) -> Self {
        Self {
            specs,
            policy: RestartPolicy::default(),
        }
    }

    /// Spawn every service and keep restarting failed ones until the
    /// process receives SIGINT/SIGTERM.  Never returns under normal use.
    #[tracing::instrument(skip(self), fields(count = self.specs.len()))]
    pub async fn run_forever(self) -> Result<()> {
        let mut set = JoinSet::new();

        for spec in self.specs {
            let policy = self.policy;
            set.spawn(async move {
                let mut crashes: Vec<Instant> = Vec::new();
                let mut attempt: u32 = 0;

                loop {
                    let fut = (spec.factory)();
                    match fut.await {
                        Ok(()) => {
                            tracing::info!(service = %spec.name, "service exited cleanly");
                            return;
                        },
                        Err(err) => {
                            let now = Instant::now();
                            crashes.retain(|t| now.duration_since(*t) < Duration::from_secs(60));
                            crashes.push(now);

                            tracing::error!(
                                service = %spec.name,
                                port = spec.port,
                                ?err,
                                crashes_in_last_minute = crashes.len(),
                                "service crashed"
                            );

                            if crashes.len() > policy.max_crashes_per_minute {
                                tracing::error!(
                                    service = %spec.name,
                                    "crash loop detected — marking service as failed"
                                );
                                return;
                            }

                            let backoff = std::cmp::min(
                                Duration::from_secs(1u64 << attempt.min(5)),
                                policy.max_backoff,
                            );
                            attempt = attempt.saturating_add(1);
                            tokio::time::sleep(backoff).await;
                        },
                    }
                }
            });
        }

        while set.join_next().await.is_some() {}
        Ok(())
    }

    /// Test-only helper that waits for every task to complete, cleanly or not.
    pub async fn run_until_all_done(self) -> Result<()> {
        let mut set = JoinSet::new();
        for spec in self.specs {
            set.spawn(async move { (spec.factory)().await });
        }
        let mut last: Result<()> = Ok(());
        while let Some(res) = set.join_next().await {
            if let Ok(Err(e)) = res {
                last = Err(e);
            }
        }
        last
    }
}
```

Modify `crates/signapps-service/src/lib.rs` — add:

```rust
pub mod supervisor;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p signapps-service --test supervisor -- --nocapture`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/signapps-service/src/supervisor.rs \
        crates/signapps-service/src/lib.rs \
        crates/signapps-service/tests/supervisor.rs
git commit -m "feat(service): add Supervisor with exp-backoff restart policy"
```

---

### Task 3: Ajouter le test de respawn et de plafond

**Files:**
- Modify: `crates/signapps-service/tests/supervisor.rs`

- [ ] **Step 1: Write failing test for respawn**

Append to `crates/signapps-service/tests/supervisor.rs`:

```rust
#[tokio::test]
async fn supervisor_restarts_crashing_service() {
    use std::sync::atomic::{AtomicU32, Ordering};

    let attempts = Arc::new(AtomicU32::new(0));
    let attempts_c = attempts.clone();

    let spec = ServiceSpec::new("crashy", 0, move || {
        let a = attempts_c.clone();
        async move {
            let n = a.fetch_add(1, Ordering::SeqCst);
            if n < 2 {
                Err(anyhow::anyhow!("boom"))
            } else {
                tokio::time::sleep(Duration::from_millis(20)).await;
                Ok(())
            }
        }
    });

    let supervisor = Supervisor::new(vec![spec]);
    let handle = tokio::spawn(supervisor.run_forever());

    tokio::time::sleep(Duration::from_secs(5)).await;
    handle.abort();

    assert!(
        attempts.load(Ordering::SeqCst) >= 3,
        "supervisor must respawn at least twice before the third succeeds"
    );
}

#[tokio::test]
async fn supervisor_gives_up_after_crash_loop() {
    use std::sync::atomic::{AtomicU32, Ordering};

    let attempts = Arc::new(AtomicU32::new(0));
    let attempts_c = attempts.clone();

    let spec = ServiceSpec::new("always-crashy", 0, move || {
        let a = attempts_c.clone();
        async move {
            a.fetch_add(1, Ordering::SeqCst);
            Err(anyhow::anyhow!("always fails"))
        }
    });

    let supervisor = Supervisor::new(vec![spec]);
    tokio::time::timeout(Duration::from_secs(90), supervisor.run_forever())
        .await
        .expect("supervisor should escalate to failed state under a minute")
        .unwrap();

    let n = attempts.load(Ordering::SeqCst);
    assert!(
        (5..=7).contains(&n),
        "expected ≈5 attempts (policy cap) before give-up, got {n}"
    );
}
```

- [ ] **Step 2: Run new tests**

Run: `cargo test -p signapps-service --test supervisor supervisor_restarts_crashing_service supervisor_gives_up_after_crash_loop -- --nocapture`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add crates/signapps-service/tests/supervisor.rs
git commit -m "test(service): add supervisor respawn and crash-loop policy tests"
```

---

### Task 4: Créer la crate `signapps-platform` (shell vide)

**Files:**
- Create: `services/signapps-platform/Cargo.toml`
- Create: `services/signapps-platform/src/main.rs`
- Create: `services/signapps-platform/src/services.rs`
- Modify: `Cargo.toml` (workspace root)

- [ ] **Step 1: Declare the new member in the workspace**

Edit `Cargo.toml` (root, `[workspace] members = [...]`) to add:

```toml
"services/signapps-platform",
```

- [ ] **Step 2: Create the crate manifest**

Create `services/signapps-platform/Cargo.toml`:

```toml
[package]
name = "signapps-platform"
version.workspace = true
edition = "2021"
rust-version.workspace = true
authors.workspace = true
license.workspace = true
description = "Single-binary runtime assembling every SignApps service as tokio tasks"

[[bin]]
name = "signapps-platform"
path = "src/main.rs"

[dependencies]
mimalloc = { workspace = true }

signapps-common  = { path = "../../crates/signapps-common" }
signapps-db      = { path = "../../crates/signapps-db" }
signapps-service = { path = "../../crates/signapps-service" }

anyhow    = { workspace = true }
axum      = { workspace = true }
tokio     = { workspace = true, features = ["full"] }
tracing   = { workspace = true }
futures   = { workspace = true }
```

- [ ] **Step 3: Write the initial entry point (no services yet)**

Create `services/signapps-platform/src/main.rs`:

```rust
//! SignApps Platform — single-binary runtime.
//!
//! Boots shared resources once, runs Postgres migrations once, then
//! spawns every service router as a supervised tokio task.

use anyhow::Result;
use signapps_common::bootstrap::init_tracing;
use signapps_db::run_migrations;
use signapps_service::{shared_state::SharedState, supervisor::Supervisor};

mod services;

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing("signapps_platform");
    tracing::info!("=== SignApps Platform — single-binary ===");

    let shared = SharedState::init_once().await?;
    tracing::info!("shared state initialized");

    run_migrations(&shared.pool)
        .await
        .unwrap_or_else(|e| tracing::warn!(?e, "migrations warning (non-fatal)"));
    tracing::info!("migrations complete");

    let specs = services::declare(shared);
    tracing::info!(count = specs.len(), "spawning services");

    Supervisor::new(specs).run_forever().await
}
```

Create `services/signapps-platform/src/services.rs`:

```rust
//! Declarative list of every service running inside the single-binary.
//!
//! Each entry provides a short name, its canonical port, and an async
//! factory that builds the service's router then binds it to that port.
//! Services are wired one-by-one in subsequent tasks.

use signapps_service::{shared_state::SharedState, supervisor::ServiceSpec};

/// Build the list of every service to run.  Returns an empty vector
/// today — services are added in Tasks 9, 11–17.
pub fn declare(_shared: SharedState) -> Vec<ServiceSpec> {
    Vec::new()
}
```

- [ ] **Step 4: Build the crate to verify it compiles**

Run: `cargo build -p signapps-platform`
Expected: successful compilation.

- [ ] **Step 5: Commit**

```bash
git add Cargo.toml \
        services/signapps-platform/Cargo.toml \
        services/signapps-platform/src/main.rs \
        services/signapps-platform/src/services.rs
git commit -m "feat(platform): scaffold signapps-platform single-binary crate"
```

---

### Task 5: Test de boot du shell `signapps-platform`

**Files:**
- Create: `services/signapps-platform/tests/boot.rs`

- [ ] **Step 1: Write the failing integration test**

Create `services/signapps-platform/tests/boot.rs`:

```rust
//! End-to-end smoke test for the single-binary runtime.
//!
//! Launches `signapps-platform` as a subprocess, waits for every
//! health endpoint to return 200, and asserts that the total boot
//! time is under three seconds.

use std::time::{Duration, Instant};

#[tokio::test]
#[ignore = "requires postgres running locally — run with `cargo test -- --ignored`"]
async fn platform_boots_in_under_three_seconds() {
    let expected_ports: &[u16] = &[3001]; // extended as services are wired
    let start = Instant::now();

    let mut child = std::process::Command::new(env!("CARGO_BIN_EXE_signapps-platform"))
        .spawn()
        .expect("failed to launch signapps-platform");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(500))
        .build()
        .unwrap();

    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        assert!(Instant::now() < deadline, "boot timed out");
        let mut all_up = true;
        for port in expected_ports {
            let url = format!("http://127.0.0.1:{port}/health");
            match client.get(&url).send().await {
                Ok(resp) if resp.status().is_success() => continue,
                _ => {
                    all_up = false;
                    break;
                },
            }
        }
        if all_up {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }

    let elapsed = start.elapsed();
    child.kill().ok();

    assert!(
        elapsed < Duration::from_secs(3),
        "single-binary boot took {elapsed:?}, expected < 3s"
    );
}
```

- [ ] **Step 2: Add `reqwest` as a dev-dependency**

Edit `services/signapps-platform/Cargo.toml`:

```toml
[dev-dependencies]
reqwest = { workspace = true, default-features = false, features = ["json"] }
```

- [ ] **Step 3: Run the test with Postgres up**

Run: `just db-start && cargo test -p signapps-platform --test boot -- --ignored`
Expected: initially FAIL (no services wired yet; test asserts on `3001` which isn't served). This is the tracking test — it will pass after Task 10.

- [ ] **Step 4: Commit (test intentionally failing until pilot is wired)**

```bash
git add services/signapps-platform/tests/boot.rs \
        services/signapps-platform/Cargo.toml
git commit -m "test(platform): add boot smoke test (skeleton, passes after pilot wiring)"
```

---

### Task 6: Ajouter les recettes `just start` / `just start-legacy`

**Files:**
- Modify: `justfile`
- Create: `scripts/start-platform.ps1`

- [ ] **Step 1: Rename legacy recipe**

Edit `justfile` — replace the current `start:` block with:

```make
# Lancer tous les services (legacy: 33 process, PowerShell)
start-legacy:
    powershell.exe -File scripts/start-all.ps1

# Lancer tous les services (single-binary, single process)
start:
    powershell.exe -File scripts/start-platform.ps1
```

- [ ] **Step 2: Create the new launcher script**

Create `scripts/start-platform.ps1`:

```powershell
<#
.SYNOPSIS
    Launch the SignApps single-binary runtime.

.DESCRIPTION
    Ensures Postgres is reachable, loads .env, rebuilds signapps-platform
    in debug mode unless -SkipBuild is supplied, then runs it in the
    foreground.  Ctrl+C terminates the process cleanly.

.PARAMETER SkipBuild
    Skip `cargo build -p signapps-platform`.
#>

param([switch]$SkipBuild)

$ErrorActionPreference = "Stop"
$BaseDir = (Get-Item $PSScriptRoot).Parent.FullName

if (-not $SkipBuild) {
    Write-Host "[build] cargo build -p signapps-platform" -ForegroundColor Cyan
    cargo build -p signapps-platform
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$EnvFile = Join-Path $BaseDir ".env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$' -and $_ -notmatch '^\s*#') {
            [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
        }
    }
    Write-Host "[env] loaded .env" -ForegroundColor Green
}

$Binary = Join-Path $BaseDir "target\debug\signapps-platform.exe"
Write-Host "[run] $Binary" -ForegroundColor Cyan
& $Binary
```

- [ ] **Step 3: Verify recipes render**

Run: `just --list | rg '^\s*(start|start-legacy):'`
Expected: both recipes are listed.

- [ ] **Step 4: Commit**

```bash
git add justfile scripts/start-platform.ps1
git commit -m "build(just): rename start -> start-legacy, add start for single-binary"
```

---

## Wave 1 — Pilote `signapps-identity`

### Task 7: Extraire `router()` + `AppState` dans `lib.rs`

**Files:**
- Create: `services/signapps-identity/src/lib.rs`
- Modify: `services/signapps-identity/src/main.rs`
- Modify: `services/signapps-identity/Cargo.toml`

- [ ] **Step 1: Build the library skeleton**

Create `services/signapps-identity/src/lib.rs`:

```rust
//! Public library interface for the identity service.
//!
//! Exposes [`router`] so the single-binary runtime can mount the
//! identity routes under `:3001` without owning its own pool.

pub mod auth;
pub mod handlers;
pub mod ldap;
pub mod middleware;
pub mod password_policy;
pub mod refresh_job;
pub mod services;
pub mod webhook_dispatcher;

use std::sync::Arc;

use anyhow::Context as _;
use axum::Router;
use signapps_common::pg_events::PgEventBus;
use signapps_common::JwtConfig;
use signapps_db::DatabasePool;
use signapps_keystore::Keystore;
use signapps_oauth::{Catalog, EngineV2, EngineV2Config, PgConfigStore};
use signapps_service::shared_state::SharedState;

use handlers::oauth::OAuthEngineState;

/// Application state shared across identity handlers.
#[derive(Clone)]
pub struct AppState {
    pub pool: DatabasePool,
    pub jwt_secret: String,
    pub jwt_config: JwtConfig,
    pub cache: signapps_cache::CacheService,
    pub keystore: Arc<Keystore>,
    pub security_policies: handlers::admin_security::SecurityPoliciesStore,
    pub active_sessions: handlers::admin_security::ActiveSessionsStore,
    pub login_attempts: handlers::admin_security::LoginAttemptsStore,
    pub migration: handlers::migration::MigrationStore,
    pub oauth_engine_state: Arc<OAuthEngineState>,
    pub event_bus: Arc<PgEventBus>,
}

/// Build the identity router using the shared runtime state.
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    refresh_job::spawn(state.clone());
    tracing::info!("signapps-identity router built");
    Ok(create_router(state))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    let oauth_state_secret = match std::env::var("OAUTH_STATE_SECRET") {
        Ok(hex_val) => hex::decode(&hex_val).unwrap_or_else(|e| {
            tracing::warn!(error = %e, "OAUTH_STATE_SECRET invalid hex — using zero (dev only)");
            vec![0u8; 32]
        }),
        Err(_) => {
            tracing::warn!("OAUTH_STATE_SECRET not set — using zero (dev only)");
            vec![0u8; 32]
        },
    };

    let catalog = Arc::new(
        Catalog::load_embedded().context("failed to load embedded OAuth provider catalog")?,
    );
    let configs: Arc<dyn signapps_oauth::ConfigStore> =
        Arc::new(PgConfigStore::new(shared.pool.inner().clone()));
    let callback_base_url = std::env::var("OAUTH_CALLBACK_BASE_URL")
        .unwrap_or_else(|_| "http://localhost:3001".to_string());

    let engine = EngineV2::new(EngineV2Config {
        catalog: Arc::clone(&catalog),
        configs: Arc::clone(&configs),
        state_secret: oauth_state_secret.clone(),
        callback_base_url,
    });

    let oauth_engine_state = Arc::new(OAuthEngineState {
        engine,
        catalog,
        configs,
        state_secret: oauth_state_secret,
    });

    Ok(AppState {
        pool: shared.pool.clone(),
        jwt_secret: String::new(),
        jwt_config: (*shared.jwt).clone(),
        cache: (*shared.cache).clone(),
        keystore: Arc::clone(&shared.keystore),
        security_policies: handlers::admin_security::SecurityPoliciesStore::new(),
        active_sessions: handlers::admin_security::ActiveSessionsStore::new(),
        login_attempts: handlers::admin_security::LoginAttemptsStore::new(),
        migration: handlers::migration::MigrationStore::new(),
        oauth_engine_state,
        event_bus: Arc::clone(&shared.event_bus),
    })
}

// `create_router` is moved here from main.rs, unchanged.
fn create_router(state: AppState) -> Router {
    // … copy of the existing `create_router` body from main.rs (lines 218-end) …
    todo_placeholder_to_be_replaced_in_step_2(state)
}

fn todo_placeholder_to_be_replaced_in_step_2(_state: AppState) -> Router {
    unreachable!("replace this in step 2 by moving create_router body verbatim")
}
```

- [ ] **Step 2: Move `create_router` body verbatim**

Open `services/signapps-identity/src/main.rs`, locate `fn create_router(state: AppState) -> Router { … }` (around line 219). Cut the entire body (from the opening `{` of `create_router` through its closing `}`) and paste it into `lib.rs` as the body of `create_router`. Delete the placeholder function and the placeholder call. Keep `use` statements needed by the function inside `lib.rs` (copy them from the original `main.rs` top-of-file imports as needed).

- [ ] **Step 3: Thin out `main.rs`**

Replace the entire `services/signapps-identity/src/main.rs` with:

```rust
//! Legacy single-service binary entry for signapps-identity.
//!
//! The preferred runtime is `signapps-platform` (single binary).  This
//! binary is preserved for `just start-legacy` and targeted debugging.

use anyhow::Result;
use signapps_common::bootstrap::{init_tracing, run_server, ServiceConfig};
use signapps_service::shared_state::SharedState;

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing("signapps_identity");
    let shared = SharedState::init_once().await?;
    signapps_db::run_migrations(&shared.pool)
        .await
        .unwrap_or_else(|e| tracing::warn!(?e, "migrations warning (non-fatal)"));
    let router = signapps_identity::router(shared).await?;
    let config = ServiceConfig::from_env("signapps-identity", 3001);
    config.log_startup();
    run_server(router, &config).await
}
```

- [ ] **Step 4: Adjust `Cargo.toml` to expose a library**

Edit `services/signapps-identity/Cargo.toml`:

```toml
default-run = "signapps-identity"

[lib]
name = "signapps_identity"
path = "src/lib.rs"

[[bin]]
name = "signapps-identity"
path = "src/main.rs"
```

Keep the other `[[bin]]` entries unchanged. Add to `[dependencies]`:

```toml
signapps-service = { path = "../../crates/signapps-service" }
```

- [ ] **Step 5: Build and check**

Run: `cargo build -p signapps-identity`
Expected: compiles without errors.

- [ ] **Step 6: Commit**

```bash
git add services/signapps-identity/src/lib.rs \
        services/signapps-identity/src/main.rs \
        services/signapps-identity/Cargo.toml
git commit -m "refactor(identity): extract router() to lib.rs, thin legacy main.rs"
```

---

### Task 8: Test que `identity::router` compose bien

**Files:**
- Create: `services/signapps-identity/tests/lib_router.rs`

- [ ] **Step 1: Write failing test**

Create `services/signapps-identity/tests/lib_router.rs`:

```rust
use axum::body::Body;
use axum::http::{Request, StatusCode};
use signapps_service::shared_state::SharedState;
use tower::ServiceExt;

#[tokio::test]
#[ignore = "requires postgres + env — run with `cargo test -- --ignored`"]
async fn identity_router_exposes_health_endpoint() {
    let shared = SharedState::init_once().await.expect("shared state");
    let app = signapps_identity::router(shared).await.expect("router");

    let response = app
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}
```

- [ ] **Step 2: Add dev-deps**

Edit `services/signapps-identity/Cargo.toml`:

```toml
[dev-dependencies]
tower = { workspace = true }
```

- [ ] **Step 3: Run**

Run: `cargo test -p signapps-identity --test lib_router -- --ignored`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add services/signapps-identity/tests/lib_router.rs \
        services/signapps-identity/Cargo.toml
git commit -m "test(identity): assert library router exposes /health"
```

---

### Task 9: Wire `signapps-identity` dans `signapps-platform`

**Files:**
- Modify: `services/signapps-platform/Cargo.toml`
- Modify: `services/signapps-platform/src/services.rs`

- [ ] **Step 1: Add dependency**

Edit `services/signapps-platform/Cargo.toml`, `[dependencies]`:

```toml
signapps-identity = { path = "../signapps-identity" }
```

- [ ] **Step 2: Declare the identity spec**

Replace `services/signapps-platform/src/services.rs`:

```rust
//! Declarative list of services running inside the single-binary.

use anyhow::Result;
use signapps_common::bootstrap::run_server_on_addr;
use signapps_service::{shared_state::SharedState, supervisor::ServiceSpec};

pub fn declare(shared: SharedState) -> Vec<ServiceSpec> {
    vec![spec_identity(shared.clone())]
}

fn spec_identity(shared: SharedState) -> ServiceSpec {
    ServiceSpec::new("signapps-identity", 3001, move || {
        let shared = shared.clone();
        async move {
            let router = signapps_identity::router(shared).await?;
            run_server_on_addr(router, "0.0.0.0", 3001).await
        }
    })
}
```

- [ ] **Step 3: Add `run_server_on_addr` helper if missing**

Check `crates/signapps-common/src/bootstrap.rs` for an exported
`run_server_on_addr(router, host, port)`. If absent, add right after
`run_server`:

```rust
pub async fn run_server_on_addr(
    router: axum::Router,
    host: &str,
    port: u16,
) -> anyhow::Result<()> {
    let addr: std::net::SocketAddr = format!("{host}:{port}").parse()?;
    tracing::info!(%addr, "listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, router.into_make_service_with_connect_info::<std::net::SocketAddr>())
        .with_graceful_shutdown(graceful_shutdown())
        .await?;
    Ok(())
}
```

- [ ] **Step 4: Build platform**

Run: `cargo build -p signapps-platform`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add services/signapps-platform/Cargo.toml \
        services/signapps-platform/src/services.rs \
        crates/signapps-common/src/bootstrap.rs
git commit -m "feat(platform): wire signapps-identity as first supervised service"
```

---

### Task 10: Vérifier le boot réel

**Files:**
- Modify: `services/signapps-platform/tests/boot.rs`

- [ ] **Step 1: Enable the boot test by default (unignored)**

Edit `services/signapps-platform/tests/boot.rs` — remove the `#[ignore = …]` attribute.

- [ ] **Step 2: Run it**

Run: `just db-start && cargo test -p signapps-platform --test boot`
Expected: PASS, elapsed < 3 s.

- [ ] **Step 3: Manual smoke**

Run: `just start` then `curl http://localhost:3001/health`
Expected: `200 OK`. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add services/signapps-platform/tests/boot.rs
git commit -m "test(platform): enable boot smoke (passes with identity pilot)"
```

---

## Wave 2 — Batch simple (20 services sans background task)

Les services suivants suivent exactement le même pattern que `signapps-identity` (Tasks 7–9). Chacun reçoit trois étapes concises. La liste est divisée en batches de 5 pour limiter la taille des diffs.

**Services du batch simple** : calendar, mail, docs, contacts, forms, storage, notifications, chat, collab, meet, proxy, media, securelink, metrics, remote, office, social, pxe, it-assets, workforce, vault, org, tenant-config, billing, signatures, gamification, compliance, backup, integrations, collaboration, containers.

### Task 11: Batch #1 — contacts, forms, storage, notifications, chat

**For each service `<svc>` in the list above:**

- [ ] **Step 1: Create `services/signapps-<svc>/src/lib.rs`** using the identity template (Task 7 Step 1), preserving each service's own `AppState` fields and `create_router` body.

Template (replace `<svc>`, `<Svc>`, `<PORT>`):

```rust
//! Public library interface for signapps-<svc>.

// declare internal modules like before
pub mod handlers;
// …

use axum::Router;
use signapps_service::shared_state::SharedState;

#[derive(Clone)]
pub struct AppState {
    // copy existing fields from old main.rs verbatim
}

pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    Ok(create_router(state))
}

async fn build_state(shared: &SharedState) -> anyhow::Result<AppState> {
    Ok(AppState {
        pool: shared.pool.clone(),
        jwt_config: (*shared.jwt).clone(),
        cache: (*shared.cache).clone(),
        keystore: shared.keystore.clone(),
        event_bus: shared.event_bus.clone(),
        // … service-specific in-memory stores keep their `::new()` calls
    })
}

fn create_router(state: AppState) -> Router {
    // body copied verbatim from former main.rs
}
```

- [ ] **Step 2: Replace `src/main.rs`** with the thin legacy binary (same template as Task 7 Step 3, swapping name + port).

- [ ] **Step 3: Update `Cargo.toml`** with `[lib]` + `signapps-service` dep (same as Task 7 Step 4).

- [ ] **Step 4: Add to `services/signapps-platform/src/services.rs`** a matching `spec_<svc>(shared.clone())` call and push it to the vec.

- [ ] **Step 5: Build the whole workspace**

Run: `cargo build --workspace`
Expected: green.

- [ ] **Step 6: Commit once per service**

```bash
git add services/signapps-<svc>/ \
        services/signapps-platform/Cargo.toml \
        services/signapps-platform/src/services.rs
git commit -m "refactor(<svc>): extract router() + wire into signapps-platform"
```

---

### Task 12: Batch #2 — collab, meet, proxy, media, securelink

Apply the exact same 6 steps as Task 11 to: **collab, meet, proxy, media, securelink**.

Notes specific to this batch:

- `signapps-collab` uses WebSocket upgrade — make sure the state carries the CRDT room registry (`Arc<DashMap>`) created in `lib::build_state`.
- `signapps-meet` owns LiveKit SDK state — keep its lazy init inside a `OnceCell` if already present.
- `signapps-proxy` listens on `:3003` but also binds `:80`/`:443` for ACME — the platform must expose both in its `ServiceSpec` (call `run_server_on_addr` twice inside the factory, `try_join` the two).

Commit one service at a time (5 commits).

---

### Task 13: Batch #3 — metrics, remote, office, social, pxe

Same 6 steps as Task 11 applied to: **metrics, remote, office, social, pxe**.

- `signapps-pxe` binds additional TFTP UDP socket; keep that inside the factory by spawning it alongside the Axum server with `tokio::try_join!`.
- `signapps-metrics` exports Prometheus scrape endpoint — no extra wiring required.

Commit one service at a time.

---

### Task 14: Batch #4 — it-assets, workforce, vault, org, tenant-config

Same 6 steps applied to: **it-assets, workforce, vault, org, tenant-config**.

`signapps-vault` uses the keystore heavily — verify that `state.keystore = shared.keystore.clone()` without a fresh `Keystore::init` (important to avoid duplicate unlock).

Commit one per service.

---

### Task 15: Batch #5 — billing, signatures, gamification, compliance, backup, integrations, collaboration, containers, calendar, mail, docs, notifications

Same 6 steps applied to the remaining simple services.

`signapps-calendar`, `signapps-mail` and `signapps-docs` own event-bus subscribers — keep them inside the factory closure so they die with the task.

Commit one per service.

---

## Wave 3 — Services complexes

### Task 16: Gateway — routeur aggregator

**Files:**
- Modify: `services/signapps-gateway/src/lib.rs` (from main.rs)
- Modify: `services/signapps-gateway/src/main.rs`
- Modify: `services/signapps-platform/src/services.rs`

- [ ] **Step 1: Extract `router(shared)` exactly as Task 7**, with `AppState` carrying the aggregated health registry and the proxy target table.

- [ ] **Step 2: Keep proxy targets reading from env** — no change in behaviour.

- [ ] **Step 3: Wire into platform** — declare `spec_gateway(shared.clone())` with port 3099.

- [ ] **Step 4: Build**

Run: `cargo build -p signapps-platform`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add services/signapps-gateway/ services/signapps-platform/src/services.rs
git commit -m "refactor(gateway): extract router() + wire into signapps-platform"
```

---

### Task 17: Scheduler + webhooks (services avec background jobs)

**Files:**
- Modify: `services/signapps-scheduler/src/{lib,main}.rs`
- Modify: `services/signapps-webhooks/src/{lib,main}.rs`
- Modify: `services/signapps-platform/src/services.rs`

- [ ] **Step 1: Apply the Task 7 template** to both services.

- [ ] **Step 2: Move background jobs inside the factory closure**

Example for scheduler (`services/signapps-scheduler/src/lib.rs`):

```rust
pub async fn router(shared: SharedState) -> anyhow::Result<Router> {
    let state = build_state(&shared).await?;
    // background loop must die with the factory — keep handle inside closure
    tokio::spawn(cron_tick_loop(state.clone()));
    Ok(create_router(state))
}
```

- [ ] **Step 3: Wire both into platform**.

- [ ] **Step 4: Build + run `cargo test --workspace`**

Run: `cargo test --workspace --no-run`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add services/signapps-scheduler/ services/signapps-webhooks/ services/signapps-platform/src/services.rs
git commit -m "refactor(scheduler,webhooks): extract router() with supervised background jobs"
```

---

### Task 18: Vérifier que les 33 specs sont déclarés

**Files:**
- Modify: `services/signapps-platform/src/services.rs`
- Create: `services/signapps-platform/tests/service_count.rs`

- [ ] **Step 1: Write assertion test**

Create `services/signapps-platform/tests/service_count.rs`:

```rust
#[test]
fn declare_returns_thirty_three_specs() {
    // `declare` needs `SharedState`, but we only read `len`, so we build a
    // stub via `SharedState::for_tests()` (see Task 18 Step 2).
    let shared = signapps_service::shared_state::SharedState::for_tests();
    let specs = signapps_platform::services::declare(shared);
    assert_eq!(specs.len(), 33, "expected all 33 services declared");
}
```

- [ ] **Step 2: Add `SharedState::for_tests()` helper behind `#[cfg(test)]`**

Append to `crates/signapps-service/src/shared_state.rs`:

```rust
#[cfg(any(test, feature = "test-helpers"))]
impl SharedState {
    /// Produce a dummy state that is only valid for counting / inspection tests.
    pub fn for_tests() -> Self {
        // Intentionally minimal — DB ops will panic if called.
        Self {
            pool: signapps_db::DatabasePool::for_tests(),
            jwt: std::sync::Arc::new(signapps_common::JwtConfig::hs256_from_secret([0u8; 32])),
            keystore: std::sync::Arc::new(signapps_keystore::Keystore::for_tests()),
            cache: std::sync::Arc::new(signapps_cache::CacheService::new(1, std::time::Duration::from_secs(1))),
            event_bus: std::sync::Arc::new(signapps_common::pg_events::PgEventBus::for_tests()),
        }
    }
}
```

(Add matching `for_tests` constructors in `signapps-db::DatabasePool`, `signapps-keystore::Keystore`, `signapps-common::pg_events::PgEventBus` if not already present — each returns a panicking stub marked `#[cfg(any(test, feature = "test-helpers"))]`.)

- [ ] **Step 3: Make `signapps_platform::services` public**

Edit `services/signapps-platform/src/main.rs`:

```rust
pub mod services;
```

(was `mod services;`)

- [ ] **Step 4: Run test**

Run: `cargo test -p signapps-platform --test service_count`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/signapps-platform/tests/service_count.rs \
        services/signapps-platform/src/main.rs \
        crates/signapps-service/src/shared_state.rs
git commit -m "test(platform): assert declare() returns all 33 service specs"
```

---

## Wave 4 — Lazy init `signapps-ai`

### Task 19: Introduire `OnceCell` pour `ProviderRegistry`

**Files:**
- Modify: `services/signapps-ai/src/lib.rs`
- Create: `services/signapps-ai/tests/lazy_init.rs`

- [ ] **Step 1: Write failing test**

Create `services/signapps-ai/tests/lazy_init.rs`:

```rust
use std::time::{Duration, Instant};

use signapps_service::shared_state::SharedState;

#[tokio::test]
#[ignore = "requires postgres + env — run with `cargo test -- --ignored`"]
async fn ai_router_boots_fast_and_initializes_providers_on_first_call() {
    let shared = SharedState::init_once().await.expect("shared state");

    let boot = Instant::now();
    let _router = signapps_ai::router(shared).await.expect("router");
    assert!(
        boot.elapsed() < Duration::from_millis(200),
        "router build must not touch providers ({:?})",
        boot.elapsed()
    );

    let first = Instant::now();
    signapps_ai::providers::ensure_initialized().await.unwrap();
    assert!(first.elapsed() < Duration::from_secs(10));

    let second = Instant::now();
    signapps_ai::providers::ensure_initialized().await.unwrap();
    assert!(second.elapsed() < Duration::from_millis(50));
}
```

- [ ] **Step 2: Wrap `ProviderRegistry` in `OnceCell`**

Edit `services/signapps-ai/src/lib.rs`. Replace eager provider initialization with:

```rust
use tokio::sync::OnceCell;

pub mod providers {
    use super::*;

    static REGISTRY: OnceCell<ProviderRegistry> = OnceCell::const_new();

    /// Lazy accessor.  The first caller pays the provider / GPU / model
    /// manager cost; subsequent callers reuse the same registry.
    pub async fn ensure_initialized() -> anyhow::Result<&'static ProviderRegistry> {
        REGISTRY
            .get_or_try_init(|| async {
                let hw = HardwareProfile::detect()?;
                let models = ModelManager::new(&hw)?;
                let registry = ProviderRegistry::build(models)?;
                Ok::<_, anyhow::Error>(registry)
            })
            .await
    }
}
```

Handlers that need a provider must now call `providers::ensure_initialized().await?` instead of reading a pre-built field on `AppState`. Remove the provider field from `AppState`. Routes that don't use providers stay synchronous.

- [ ] **Step 3: Move GPU detection, model manager, RAG out of `router()` build path**

In `lib.rs::router`, remove all eager calls to `HardwareProfile::detect`, `ModelManager::new`, `ProviderRegistry::build`, `RagPipeline::new`, `IndexPipeline::new`, `tool_registry::init`. Only keep what's needed to answer `GET /health` and basic CRUD routes.

- [ ] **Step 4: Run**

Run: `cargo test -p signapps-ai --test lazy_init -- --ignored`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/signapps-ai/src/lib.rs \
        services/signapps-ai/tests/lazy_init.rs
git commit -m "perf(ai): lazy-init providers via OnceCell (router build < 200 ms)"
```

---

### Task 20: Lazy-initialiser la `tool_registry` de AI

**Files:**
- Modify: `services/signapps-ai/src/tools/mod.rs`

- [ ] **Step 1: Replace the eager registry with `Lazy<…>`**

```rust
use once_cell::sync::Lazy;

pub static TOOL_REGISTRY: Lazy<ToolRegistry> = Lazy::new(|| {
    let mut reg = ToolRegistry::default();
    // … existing 93 registrations …
    tracing::info!(count = reg.len(), "tool registry initialized");
    reg
});
```

Update call sites that used `&state.tool_registry` to use `&*TOOL_REGISTRY`.

- [ ] **Step 2: Build + tests**

Run: `cargo test -p signapps-ai`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add services/signapps-ai/src/tools/mod.rs \
        services/signapps-ai/src/handlers/ # call sites
git commit -m "perf(ai): lazy-build global tool registry"
```

---

### Task 21: Brancher AI au single-binary

**Files:**
- Modify: `services/signapps-platform/src/services.rs`

- [ ] **Step 1: Add the ai spec**

```rust
fn spec_ai(shared: SharedState) -> ServiceSpec {
    ServiceSpec::new("signapps-ai", 3005, move || {
        let shared = shared.clone();
        async move {
            let router = signapps_ai::router(shared).await?;
            run_server_on_addr(router, "0.0.0.0", 3005).await
        }
    })
}
```

Push it into the `declare()` vec.

- [ ] **Step 2: Boot test**

Run: `just db-start && cargo test -p signapps-platform --test boot`
Expected: PASS, `elapsed < 3 s` (AI doesn't stall boot anymore).

- [ ] **Step 3: Commit**

```bash
git add services/signapps-platform/src/services.rs
git commit -m "feat(platform): wire signapps-ai with lazy provider init"
```

---

## Wave 5 — Migrations idempotentes

### Task 22: Créer `migrations/AUDIT.md`

**Files:**
- Create: `migrations/AUDIT.md`

- [ ] **Step 1: Generate the audit report**

Run: `cargo run --manifest-path tools/migrations-audit/Cargo.toml -- migrations/ > migrations/AUDIT.md`
(If the tool doesn't exist yet, add it in Step 2.)

- [ ] **Step 2: If the tool is absent, write it**

Create `tools/migrations-audit/Cargo.toml`:

```toml
[package]
name = "migrations-audit"
version = "0.1.0"
edition = "2021"
publish = false

[[bin]]
name = "migrations-audit"
path = "src/main.rs"

[dependencies]
regex = "1"
walkdir = "2"
```

Create `tools/migrations-audit/src/main.rs`:

```rust
use std::fs;
use std::path::PathBuf;

use regex::Regex;
use walkdir::WalkDir;

fn main() {
    let dir = std::env::args().nth(1).expect("usage: migrations-audit <dir>");
    let re_table = Regex::new(r"(?im)^\s*CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)").unwrap();
    let re_index = Regex::new(r"(?im)^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)").unwrap();
    let re_ct = Regex::new(r"(?im)^\s*ALTER\s+TABLE\s+\S+\s+ADD\s+CONSTRAINT\s+(?!IF\s+NOT\s+EXISTS)")
        .unwrap();
    let re_type = Regex::new(r"(?im)^\s*CREATE\s+TYPE\s+").unwrap();

    println!("# Migration idempotence audit\n");
    println!("| File | Offending pattern | Count |\n|---|---|---|");
    let mut total = 0usize;
    for entry in WalkDir::new(&dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("sql"))
    {
        let path: PathBuf = entry.path().into();
        let text = fs::read_to_string(&path).unwrap_or_default();
        for (label, re) in &[
            ("CREATE TABLE …", &re_table),
            ("CREATE INDEX …", &re_index),
            ("ADD CONSTRAINT …", &re_ct),
            ("CREATE TYPE …", &re_type),
        ] {
            let count = re.find_iter(&text).count();
            if count > 0 {
                println!("| `{}` | {} | {} |", path.display(), label, count);
                total += count;
            }
        }
    }
    println!("\n**Total offending statements:** {total}");
}
```

Add to root `Cargo.toml` workspace members: `"tools/migrations-audit"`.

- [ ] **Step 3: Run and commit report**

Run: `cargo run -p migrations-audit -- migrations/ > migrations/AUDIT.md`
Expected: file generated.

```bash
git add tools/migrations-audit/ migrations/AUDIT.md Cargo.toml
git commit -m "chore(migrations): add idempotence audit tool + initial report"
```

---

### Task 23: Rewrite batch #1 — migrations 001 → 050

**Files:**
- Modify: `migrations/NNN_*.sql` (50 files)

- [ ] **Step 1: Apply sed-style rewrite per file**

For every offending `CREATE TABLE x` → `CREATE TABLE IF NOT EXISTS x`.
For every `CREATE INDEX idx_x ON …` → `CREATE INDEX IF NOT EXISTS idx_x ON …`.
For every `ALTER TABLE t ADD CONSTRAINT c …` → `ALTER TABLE t ADD CONSTRAINT IF NOT EXISTS c …`.
For every `CREATE TYPE t AS ENUM (…)` → wrap in `DO $$ BEGIN CREATE TYPE t AS ENUM (…); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`.

- [ ] **Step 2: Re-run audit**

Run: `cargo run -p migrations-audit -- migrations/ | head -30`
Expected: all 001–050 lines gone.

- [ ] **Step 3: Boot Postgres twice to check**

```bash
just db-stop && just db-start
cargo run -p signapps-platform
# Ctrl+C after boot
cargo run -p signapps-platform  # second boot
```

Expected: zero "already exists" warnings on second boot for migrations 001–050.

- [ ] **Step 4: Commit**

```bash
git add migrations/0[0-4]*.sql migrations/050_*.sql migrations/AUDIT.md
git commit -m "fix(migrations): make files 001-050 idempotent"
```

---

### Task 24: Rewrite batch #2 — migrations 051 → 150

Same 4 steps as Task 23 applied to files `051_*.sql` through `150_*.sql`.
Commit.

### Task 25: Rewrite batch #3 — migrations 151 → 250

Same 4 steps applied to `151_*.sql` through `250_*.sql`.
Commit.

### Task 26: Rewrite batch #4 — migrations 251 → 319

Same 4 steps applied to `251_*.sql` through `319_*.sql`.
Commit.

### Task 27: Vérifier zéro warning au 2e boot

**Files:**
- Create: `services/signapps-platform/tests/migrations_idempotent.rs`

- [ ] **Step 1: Write the test**

```rust
use std::process::Command;

#[test]
#[ignore = "requires clean postgres — run with `cargo test -- --ignored`"]
fn double_boot_emits_no_migration_warnings() {
    for _ in 0..2 {
        let out = Command::new(env!("CARGO_BIN_EXE_signapps-platform"))
            .env("RUST_LOG", "warn")
            .env("SIGNAPPS_PLATFORM_EXIT_AFTER_BOOT", "1")
            .output()
            .expect("run platform");
        let stderr = String::from_utf8_lossy(&out.stderr);
        assert!(
            !stderr.contains("already exists"),
            "migration warning detected:\n{stderr}"
        );
    }
}
```

- [ ] **Step 2: Add the exit-after-boot env flag in `main.rs`**

```rust
if std::env::var("SIGNAPPS_PLATFORM_EXIT_AFTER_BOOT").is_ok() {
    tracing::info!("exit-after-boot flag set, returning");
    return Ok(());
}
```

Place this right after `run_migrations`, before spawning specs.

- [ ] **Step 3: Run**

Run: `cargo test -p signapps-platform --test migrations_idempotent -- --ignored`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add services/signapps-platform/tests/migrations_idempotent.rs \
        services/signapps-platform/src/main.rs
git commit -m "test(platform): assert zero migration warnings across two consecutive boots"
```

---

### Task 28: Retirer `run_migrations` des binaires legacy

**Files:**
- Modify: `services/signapps-*/src/main.rs` (×33)

- [ ] **Step 1: Strip the block**

In every `services/signapps-*/src/main.rs`, remove the
`signapps_db::run_migrations(&shared.pool).await…` call. Only
`signapps-platform` runs migrations.

- [ ] **Step 2: Build + test**

Run: `cargo build --workspace && cargo test --workspace --no-run`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add services/signapps-*/src/main.rs
git commit -m "refactor(services): remove per-service migration calls (now centralized)"
```

---

## Wave 6 — Bascule et docs

### Task 29: Vérifier que `just start` fait le bon chemin

**Files:**
- Modify: `justfile`

- [ ] **Step 1: Add a health-check recipe that hits 3 random ports**

```make
# Smoke check : ping 5 health endpoints
smoke:
    @for port in 3001 3005 3011 3099 8095; do \
        printf ":%s → " $$port; \
        curl -s -o /dev/null -w "%%{http_code}\n" "http://localhost:$$port/health"; \
    done
```

- [ ] **Step 2: Manual verification**

Run: `just start`
Then in another shell: `just smoke`
Expected: all return `200`.

- [ ] **Step 3: Commit**

```bash
git add justfile
git commit -m "build(just): add smoke recipe to probe 5 critical services"
```

---

### Task 30: Mesurer le cold start

**Files:**
- Create: `scripts/bench-coldstart.sh`

- [ ] **Step 1: Write the benchmark**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "[stop]"
powershell.exe -File scripts/stop-test-services.ps1 2>/dev/null || true

echo "[start] single-binary cold"
start=$(date +%s%3N)
nohup target/debug/signapps-platform > /tmp/platform.log 2>&1 &
pid=$!

while ! curl -s -o /dev/null http://localhost:3099/health; do
    sleep 0.05
done
end=$(date +%s%3N)
elapsed=$((end - start))
kill $pid

echo "[result] ready in ${elapsed} ms"
if [ "$elapsed" -lt 3000 ]; then
    echo "[pass] < 3s target met"
else
    echo "[fail] expected < 3000 ms, got $elapsed ms" >&2
    exit 1
fi
```

- [ ] **Step 2: Run**

Run: `chmod +x scripts/bench-coldstart.sh && ./scripts/bench-coldstart.sh`
Expected: `< 3s target met`.

- [ ] **Step 3: Commit**

```bash
git add scripts/bench-coldstart.sh
git commit -m "test(bench): add cold-start benchmark for single-binary"
```

---

### Task 31: Mettre à jour `CLAUDE.md` avec le nouveau modèle

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the "Préférences de développement" section**

In `CLAUDE.md`, replace the "PostgreSQL: `just db-start`" note with:

```markdown
- **PostgreSQL** : `just db-start` (Docker) ou natif
- **Runtime backend** : `just start` → **signapps-platform** (single binary, 33 services en tokio tasks)
- **Runtime legacy** : `just start-legacy` → 33 binaires séparés (debug isolé d'un service)
- **Cold start cible** : < 3 s pour `just start`
```

Update the "Service Pattern" subsection in "Architecture" to mention:

```markdown
Chaque service Rust suit la même structure :
- `lib.rs` – Expose `pub fn router(shared: SharedState) -> Router` pour le single-binary
- `bin/main.rs` – Legacy `#[tokio::main]` conservé pour `just start-legacy`
- …
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document single-binary runtime and legacy fallback"
```

---

### Task 32: Update `docs/single-binary-design.md` → déplacer vers `docs/architecture/`

**Files:**
- Move: `docs/single-binary-design.md` → `docs/architecture/single-binary.md`

- [ ] **Step 1: Move and update status**

```bash
git mv docs/single-binary-design.md docs/architecture/single-binary.md
```

Update header line `Status: Prototype / Evaluation` → `Status: Implemented in Phase D2 P1 (see docs/superpowers/specs/2026-04-18-phase-d2-architectural-perf-design.md)`.

Update service count `19` → `33` throughout the document.

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/single-binary.md
git commit -m "docs(architecture): move single-binary design, update for 33 services"
```

---

## Wave 7 — Finalisation

### Task 33: Test E2E avec le single-binary

**Files:**
- Create: `tests/e2e_single_binary.rs`

- [ ] **Step 1: Write the test**

Create `tests/e2e_single_binary.rs`:

```rust
//! End-to-end test: boot the single-binary, login as admin, fetch /me.

use std::time::Duration;

use reqwest::Client;
use serde_json::json;

#[tokio::test]
#[ignore = "requires clean postgres seeded with admin — `cargo test -- --ignored`"]
async fn login_and_fetch_me_against_single_binary() {
    // Assume `just start` was run in another terminal or spawn here.
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap();

    let login = client
        .post("http://localhost:3001/api/v1/auth/login")
        .json(&json!({"email": "admin@signapps.local", "password": "admin"}))
        .send()
        .await
        .expect("login request")
        .error_for_status()
        .expect("login 200");

    let token = login.json::<serde_json::Value>().await.unwrap()["access_token"]
        .as_str()
        .unwrap()
        .to_string();

    let me = client
        .get("http://localhost:3001/api/v1/auth/me")
        .bearer_auth(&token)
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap();

    assert_eq!(me.status(), 200);
}
```

- [ ] **Step 2: Add to root `Cargo.toml`**

```toml
[[test]]
name = "e2e_single_binary"
path = "tests/e2e_single_binary.rs"
```

- [ ] **Step 3: Run**

Run (with Postgres + admin seeded):
```
just db-start
cargo run --bin seed_db -p signapps-identity &
wait
just start &
sleep 2
cargo test --test e2e_single_binary -- --ignored
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e_single_binary.rs Cargo.toml
git commit -m "test(e2e): login + /me against signapps-platform"
```

---

### Task 34: Créer le debug skill `single-binary-debug`

**Files:**
- Create: `.claude/skills/single-binary-debug/SKILL.md`

- [ ] **Step 1: Write the skill**

Create `.claude/skills/single-binary-debug/SKILL.md`:

```markdown
---
name: single-binary-debug
description: Use when signapps-platform fails to boot, a service task crashes repeatedly, or the supervisor escalates to `failed`. Covers reading supervisor logs, sizing PgPool, detecting port conflicts, and isolating a suspicious service by falling back to `just start-legacy`.
---

# single-binary-debug

## Symptoms & first steps

- **Boot hangs** → run `RUST_LOG=debug cargo run -p signapps-platform 2>&1 | tee platform.log`
  and look for `migration`, `keystore`, `shared state initialized`.
- **One service never reaches `/health`** → `just smoke`, then grep the log
  for `service = "signapps-<svc>"`.
- **Supervisor escalates to failed** → grep the log for
  `crash loop detected — marking service as failed`; read the last 50 lines
  before the escalation for the root cause.

## Commands

- `just start` – run the single-binary (default)
- `just start-legacy` – fall back to 33 binaries to isolate an offender
- `just smoke` – hit 5 critical `/health` endpoints
- `scripts/bench-coldstart.sh` – regression test for cold start
- `cargo run -p signapps-platform -- --help` – future CLI flags

## PgPool sizing

`SharedState::init_once` uses `signapps_db::create_pool` with default
`max_connections = 20`. For 33 services running in-process, raise via
`DB_MAX_CONNECTIONS=120` if you see `PoolTimedOut` errors.

## Port conflicts

Single-binary reuses the same ports as legacy (3001–3034, 8095, 8096,
3099). `netstat -ano | grep :3001` to check what holds a port. Stop
legacy first: `just stop-legacy`.

## Lazy AI init

First call to any `POST /api/v1/ai/*` endpoint loads providers + models
(~5 s). Subsequent calls are fast. If frozen on first call, check
`MODELS_DIR` is writable and GPU detection doesn't panic.

## Related

- `docs/architecture/single-binary.md`
- `docs/superpowers/specs/2026-04-18-phase-d2-architectural-perf-design.md`
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/single-binary-debug/SKILL.md
git commit -m "docs(skill): add single-binary-debug skill"
```

---

### Task 35: Créer la spec produit miroir

**Files:**
- Create: `docs/product-specs/50-perf-architecturale.md`

- [ ] **Step 1: Write the product-facing spec**

Create `docs/product-specs/50-perf-architecturale.md`:

```markdown
# Perf architecturale (single-binary runtime)

## Ce qui change pour l'équipe

- `just start` démarre désormais un **seul process** (`signapps-platform`) qui
  spawn les 33 services comme tokio tasks.  Cold start : **< 3 s** (vs 60 s).
- `just start-legacy` garde l'ancien comportement (33 process séparés) pour
  debug isolé.
- Les endpoints, ports, API et JWT **ne changent pas**. Les frontends et
  clients externes ne voient aucune différence.
- Les migrations SQL deviennent **idempotentes** — zéro warning au 2e boot.

## Ce qui change pour un utilisateur final

- Démarrage plus rapide quand l'admin on-prem redémarre le serveur.
- Première requête IA (chat, OCR, RAG) légèrement plus lente que les
  suivantes — les modèles sont chargés à la demande.
- Empreinte mémoire divisée (un seul process partage le pool Postgres
  et le cache).

## Référence technique

- Design : `docs/superpowers/specs/2026-04-18-phase-d2-architectural-perf-design.md`
- Plan   : `docs/superpowers/plans/2026-04-18-phase-d2-p1-single-binary.md`
- Archi  : `docs/architecture/single-binary.md`
- Skill  : `.claude/skills/single-binary-debug/`
```

- [ ] **Step 2: Commit**

```bash
git add docs/product-specs/50-perf-architecturale.md
git commit -m "docs(product): add perf architecturale product spec"
```

---

### Task 36: CI — ajouter job `cold-start-benchmark`

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the job**

Append to `.github/workflows/ci.yml` `jobs:` section:

```yaml
  cold-start-benchmark:
    runs-on: ubuntu-latest
    needs: [test]
    services:
      postgres:
        image: pgvector/pgvector:pg17
        env:
          POSTGRES_USER: signapps
          POSTGRES_PASSWORD: signapps_dev
          POSTGRES_DB: signapps
        ports: ["5432:5432"]
    env:
      DATABASE_URL: postgres://signapps:signapps_dev@localhost:5432/signapps
      JWT_SECRET: thisisaverylongdevsecretatleast32bytes
      KEYSTORE_MASTER_KEY: "0000000000000000000000000000000000000000000000000000000000000000"
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo build --release -p signapps-platform
      - name: Bench cold start
        run: |
          start=$(date +%s%3N)
          ./target/release/signapps-platform &
          pid=$!
          until curl -sf http://localhost:3099/health; do sleep 0.05; done
          end=$(date +%s%3N)
          kill $pid
          elapsed=$((end - start))
          echo "elapsed=${elapsed}ms"
          test "$elapsed" -lt 3000
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(perf): add cold-start benchmark job (< 3s gate)"
```

---

## Self-Review

### Spec coverage

| Spec section | Task(s) |
|---|---|
| §4.1 structure lib + bin legacy | 7, 11–17 |
| §4.2 SharedState init once | 1 |
| §4.3 Supervisor + lazy AI | 2, 3, 19–21 |
| §4.4 Lazy init AI | 19, 20, 21 |
| §4.5 Migrations idempotentes | 22–27 |
| §4.6 Compat dev (just start, start-legacy) | 6, 29 |
| §4.7 Gateway in-process (reporté P1.5) | explicite: NON fait en P1 |
| §4.8 Tests P1 (boot, supervisor, migrations) | 5, 10, 3, 27 |
| §11 Debug skills + product spec + commits | 34, 35, 31, 32 |

### Placeholder scan

- No "TBD", "TODO", "later" left in steps.
- Batch tasks (11–15, 23–26) reuse a full template inside the task body, not by cross-reference.

### Type consistency

- `SharedState` signature stable across all tasks.
- `ServiceSpec::new(name, port, factory)` signature stable (Tasks 2, 9, 11+).
- `router(shared) -> anyhow::Result<Router>` signature identical for every service.
- `run_server_on_addr(router, host, port)` added once (Task 9) and reused throughout.

### Plan gaps filled inline

- Added `SharedState::for_tests()` helper inside Task 18 to make service-count test hermetic.
- Added `SIGNAPPS_PLATFORM_EXIT_AFTER_BOOT` env flag inside Task 27 to support the double-boot idempotence test.
- Added explicit `run_server_on_addr` helper in `signapps-common` at Task 9 Step 3 to avoid ambiguity.

---

## Execution Handoff

Plan complet et sauvé dans `docs/superpowers/plans/2026-04-18-phase-d2-p1-single-binary.md`. Deux options d'exécution :

**1. Subagent-Driven (recommended)** — un subagent dédié par tâche, revue entre chaque, itération rapide.

**2. Inline Execution** — exécuter les tâches dans cette session via `superpowers:executing-plans`, par batch avec checkpoints.

Quelle approche ?
