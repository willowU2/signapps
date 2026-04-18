# LT-05: Single-Binary Deployment - Design Document

**Status**: Implemented in Phase D2 P1 (see docs/superpowers/specs/2026-04-18-phase-d2-architectural-perf-design.md)
**Date**: 2026-03-22
**Author**: AgentIQ

---

**Implementation delivered:** 2026-04-18. See:
- Spec: `docs/superpowers/specs/2026-04-18-phase-d2-architectural-perf-design.md`
- Plan: `docs/superpowers/plans/2026-04-18-phase-d2-p1-single-binary.md`
- Debug skill: `.claude/skills/single-binary-debug/` (Task 34)

Cold start benchmark: `./scripts/bench-coldstart.sh` — currently ~1.7 s on a dev box (target < 3 s).

---

## 1. Current Architecture

SignApps Platform is a workspace of **33 backend services** (+ `signapps-ai` with lazy providers) + **5 shared crates** + a **Tauri desktop shell** + a **Next.js 16 frontend**:

### Backend Services (separate binaries)

| Service | Port | Description |
|---------|------|-------------|
| `signapps-identity` | 3001 | Auth, users, tenants, RBAC, MFA, LDAP/OAuth2 |
| `signapps-containers` | 3002 | Docker container management (via bollard) |
| `signapps-proxy` | 3003 | Reverse proxy with TLS, ACME, SmartShield WAF |
| `signapps-storage` | 3004 | Files, Drive VFS, RAID, NAS features |
| `signapps-ai` | 3005 | AI orchestration (Ollama/vLLM, RAG, embeddings) |
| `signapps-securelink` | 3006 | Web tunnel VPN, DNS ad-blocking |
| `signapps-scheduler` | 3007 | Cron/job scheduler |
| `signapps-metrics` | 3008 | Observability, Prometheus metrics |
| `signapps-media` | 3009 | Media processing (transcode, thumbnails) |
| `signapps-docs` | 3010 | Document collaboration |
| `signapps-calendar` | 3011 | Calendar, events, CalDAV |
| `signapps-mail` | 3012 | Email service |
| `signapps-collab` | 3013 | Real-time collaboration (WebSocket) |
| `signapps-meet` | 3014 | Video conferencing |
| `signapps-it-assets` | 3015 | IT asset inventory |
| `signapps-pxe` | 3016 | PXE boot / TFTP server |
| `signapps-remote` | 3017 | Remote desktop |
| `signapps-office` | 3018 | Document conversion (DOCX, XLSX, PDF) |
| `signapps-workforce` | 3019 | Workforce management |

### Shared Crates (libraries)

| Crate | Purpose |
|-------|---------|
| `signapps-common` | Bootstrap, middleware, JWT, types, utilities |
| `signapps-db` | Database pool + migrations (SQLx/PostgreSQL) |
| `signapps-cache` | In-process cache (moka) |
| `signapps-runtime` | PostgreSQL lifecycle, GPU detection, model management |
| `signapps-service` | Windows Service support, shutdown signals |

### Frontend

- **Next.js 16** application (port 3000)
- **Tauri** desktop wrapper (`signapps-tauri`)

### Current Deployment Model

Each service is a separate `#[tokio::main]` binary with:
1. Its own `init_tracing()` + `load_env()` call
2. Its own `ServiceConfig::from_env(name, port)` for port binding
3. Its own `DatabasePool` creation (all point to same PostgreSQL)
4. Its own `JwtConfig` instantiation (identical across services)
5. Its own graceful shutdown handling via `signapps_common::bootstrap::run_server()`

Running the platform requires launching 19 processes + Next.js + PostgreSQL.

---

## 2. Proposed Approach: Single Binary via Tokio Tasks

### Core Idea

Replace 19 separate `#[tokio::main]` binaries with a single binary (`signapps-gateway`) that:

1. Initializes shared resources **once** (DB pool, JWT config, tracing)
2. Spawns each service's Axum router as a **tokio task** bound to its own port
3. Embeds the Next.js static export to serve the frontend
4. Provides a unified health endpoint and lifecycle management

### Why Tokio Tasks (Not Processes)

| Aspect | Tokio Tasks | Spawned Processes |
|--------|-------------|-------------------|
| Shared DB pool | Single pool, no per-service overhead | Each process creates its own pool |
| Memory | One process, shared allocator | 19 x process overhead (~5-15 MB each) |
| Startup time | Sub-second (all parallel) | Sequential or complex orchestration |
| Graceful shutdown | Single signal handler, coordinated | Must signal each process individually |
| Deployment | One binary to distribute | 19 binaries + scripts |
| Observability | Unified tracing subscriber | Separate log files or aggregator |
| Error propagation | JoinHandle monitoring | Exit code polling |
| Cross-service calls | Could use in-process channels | HTTP over localhost |

### Architecture Diagram

```
signapps-gateway (single binary)
|
+-- init_tracing() (once)
+-- load_env() (once)
+-- DatabasePool (shared, single connection pool)
+-- JwtConfig (shared)
|
+-- tokio::spawn ── identity router ── :3001
+-- tokio::spawn ── containers router ── :3002
+-- tokio::spawn ── proxy router ── :3003 + :80/:443
+-- tokio::spawn ── storage router ── :3004
+-- tokio::spawn ── ai router ── :3005
+-- tokio::spawn ── securelink ── :3006
+-- tokio::spawn ── scheduler ── :3007
+-- tokio::spawn ── metrics ── :3008
+-- tokio::spawn ── media ── :3009
+-- tokio::spawn ── docs ── :3010
+-- tokio::spawn ── calendar ── :3011
+-- tokio::spawn ── mail ── :3012
+-- tokio::spawn ── collab ── :3013
+-- tokio::spawn ── meet ── :3014
+-- tokio::spawn ── it-assets ── :3015
+-- tokio::spawn ── pxe ── :3016
+-- tokio::spawn ── remote ── :3017
+-- tokio::spawn ── office ── :3018
+-- tokio::spawn ── workforce ── :3019
|
+-- tokio::spawn ── static file server (Next.js export) ── :3000
+-- gateway health ── :3099 (aggregated health from all services)
```

---

## 3. Embedding the Next.js Frontend

### Approach: Static Export + `include_dir!` or `tower-http::ServeDir`

**Option A: Build-time embedding with `include_dir`**
```rust
use include_dir::{include_dir, Dir};
static FRONTEND: Dir = include_dir!("$CARGO_MANIFEST_DIR/../../frontend/out");
```
- Pros: True single file, no external assets needed
- Cons: Large binary (+50-200 MB), slow recompiles during dev, stale assets

**Option B: Runtime static file serving with `tower-http::ServeDir`**
```rust
use tower_http::services::ServeDir;
let frontend = ServeDir::new("./frontend/out").append_index_html_on_directories(true);
```
- Pros: Small binary, hot-reload in dev, decoupled build pipelines
- Cons: Must ship the `out/` directory alongside the binary

**Recommendation**: **Option B for dev/production, Option A as a build flag** for truly portable single-file distribution.

```rust
#[cfg(feature = "embed-frontend")]
fn frontend_service() -> Router {
    // Serve from embedded assets
    Router::new().fallback_service(embedded_frontend())
}

#[cfg(not(feature = "embed-frontend"))]
fn frontend_service() -> Router {
    // Serve from disk
    let path = std::env::var("FRONTEND_DIR").unwrap_or_else(|_| "./frontend/out".into());
    Router::new().fallback_service(ServeDir::new(path).append_index_html_on_directories(true))
}
```

### Next.js Build Pipeline

```bash
cd frontend
npm run build          # Standard Next.js build
npx next export        # Or `output: 'export'` in next.config.js
# Result: frontend/out/ directory with static HTML/JS/CSS
```

For Next.js 16 with App Router, set `output: 'export'` in `next.config.ts`. API routes become client-side fetch calls to backend ports (already the case).

---

## 4. Feature Flags for Service Selection

### Cargo Features

```toml
[features]
default = ["core"]

# Service groups
core = ["identity", "storage", "proxy"]
collaboration = ["docs", "collab", "calendar", "meet"]
infrastructure = ["containers", "metrics", "scheduler", "pxe", "it-assets"]
communication = ["mail", "media", "office"]
security = ["securelink"]
intelligence = ["ai"]
workforce = ["workforce", "remote"]

# Individual services
identity = ["dep:signapps-identity"]
containers = ["dep:signapps-containers"]
proxy = ["dep:signapps-proxy"]
storage = ["dep:signapps-storage"]
ai = ["dep:signapps-ai"]
securelink = ["dep:signapps-securelink"]
scheduler = ["dep:signapps-scheduler"]
metrics = ["dep:signapps-metrics"]
media = ["dep:signapps-media"]
docs = ["dep:signapps-docs"]
calendar = ["dep:signapps-calendar"]
mail = ["dep:signapps-mail"]
collab = ["dep:signapps-collab"]
meet = ["dep:signapps-meet"]
it-assets = ["dep:signapps-it-assets"]
pxe = ["dep:signapps-pxe"]
remote = ["dep:signapps-remote"]
office = ["dep:signapps-office"]
workforce = ["dep:signapps-workforce"]

# Frontend embedding
embed-frontend = ["dep:include_dir"]

# All services
full = ["core", "collaboration", "infrastructure", "communication", "security", "intelligence", "workforce"]
```

### Runtime Configuration (env/config file)

Feature flags control **compile-time** inclusion. Runtime env vars control **whether enabled services actually start**:

```env
# Disable specific compiled-in services at runtime
SIGNAPPS_DISABLE_SERVICES=pxe,remote,containers
# Or enable specific ones (whitelist mode)
SIGNAPPS_ENABLE_SERVICES=identity,storage,proxy,docs,calendar
```

---

## 5. Required Refactoring for Each Service

To make services embeddable as library functions, each service needs:

### Step 1: Extract `create_router()` as a Public Library Function

Each service already has a `create_router(state) -> Router` function. The refactoring:

```rust
// services/signapps-identity/src/lib.rs (NEW - library entry point)
pub mod auth;
pub mod handlers;
pub mod ldap;

pub use crate::AppState;

/// Build the complete identity service router.
/// Called by signapps-gateway or by the standalone binary.
pub fn create_router(state: AppState) -> Router { ... }

/// Initialize service-specific state (DB pool provided externally).
pub async fn init_state(pool: DatabasePool, jwt_config: JwtConfig) -> anyhow::Result<AppState> { ... }
```

```rust
// services/signapps-identity/src/main.rs (EXISTING - thin wrapper)
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing("signapps_identity");
    load_env();
    let config = ServiceConfig::from_env("signapps-identity", 3001);
    let pool = create_pool(&config.database_url).await?;
    let state = signapps_identity::init_state(pool, jwt_config).await?;
    let app = signapps_identity::create_router(state);
    run_server(app, &config).await
}
```

### Step 2: Add `[lib]` Section to Each Service Cargo.toml

```toml
[lib]
name = "signapps_identity"
path = "src/lib.rs"

[[bin]]
name = "signapps-identity"
path = "src/main.rs"
```

### Step 3: Gateway Consumes as Library Dependencies

```toml
[dependencies]
signapps-identity = { path = "../signapps-identity", optional = true }
signapps-storage = { path = "../signapps-storage", optional = true }
# ...
```

### Estimated Effort Per Service

| Task | Time |
|------|------|
| Extract `lib.rs` with `create_router` + `init_state` | 30-60 min |
| Move `AppState` to lib, adjust visibility | 15-30 min |
| Add `[lib]` to Cargo.toml | 5 min |
| Test standalone binary still works | 15 min |
| **Total per service** | **~1-2 hours** |
| **Total for 19 services** | **~20-40 hours** |

---

## 6. Pros and Cons

### Pros

| Benefit | Impact |
|---------|--------|
| **Single binary deployment** | Copy one file, run it. Ideal for SMBs without IT staff |
| **Shared DB pool** | 1 pool instead of 19 = fewer connections, less memory |
| **Unified tracing** | Single log stream, correlated spans across services |
| **Faster startup** | One process init vs. 19 sequential starts |
| **Lower memory footprint** | Shared allocator, single tokio runtime (~50-100 MB saved) |
| **Simpler Windows Service** | One service registration instead of 19 |
| **Atomic updates** | Update one binary = update everything |
| **Feature flags** | Compile only what you need, reducing binary size |
| **Keeps standalone mode** | Each service remains independently runnable |

### Cons

| Drawback | Mitigation |
|----------|------------|
| **Single point of failure** | `tokio::spawn` with panic recovery + process supervisor |
| **Longer compile times** | Feature flags for dev; full builds only in CI |
| **Large binary** | Feature flags: `core` profile = ~30 MB vs `full` = ~80 MB |
| **No independent scaling** | Target audience is SMBs, not hyperscale. Standalone mode still available |
| **Shared runtime contention** | tokio work-stealing scheduler handles this well; monitor with metrics |
| **Complex crash isolation** | `catch_unwind` at task boundaries + restart logic |
| **Memory leak in one service affects all** | Already sharing one PostgreSQL; same risk profile |
| **Version coupling** | All services already version-locked in workspace |

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Panic in one service crashes gateway | Medium | High | `catch_unwind` + task restart |
| Compile time becomes prohibitive | Low | Medium | Feature flags + incremental builds |
| Resource contention under load | Low | Medium | tokio metrics + per-service resource limits |
| Service needs different runtime config | Low | Low | Per-service env overrides still work |

---

## 7. Migration Path (Progressive, Not Big-Bang)

### Phase 1: Foundation (1-2 weeks)

1. Refactor `signapps-identity` to expose `lib.rs` with `create_router` + `init_state`
2. Refactor `signapps-storage` the same way
3. Create `signapps-gateway` POC that spawns these two as tokio tasks
4. Verify standalone binaries still work unchanged
5. Add integration tests: gateway starts, both services respond on their ports

### Phase 2: Core Services (2-3 weeks)

6. Refactor `signapps-proxy` (complex: has its own proxy engine spawning)
7. Refactor `signapps-scheduler`, `signapps-metrics`
8. Add shared resource injection (DB pool, JWT config passed from gateway)
9. Add runtime service enable/disable via env vars
10. Add aggregated `/gateway/health` endpoint

### Phase 3: Collaboration Suite (2-3 weeks)

11. Refactor `signapps-docs`, `signapps-calendar`, `signapps-collab`
12. Refactor `signapps-meet` (WebRTC considerations)
13. Add feature flag groups (`core`, `collaboration`)
14. Test mixed mode: some services in-process, some standalone

### Phase 4: Infrastructure & Communication (2-3 weeks)

15. Refactor remaining services: `containers`, `ai`, `securelink`, `media`, `mail`, `pxe`, `it-assets`, `remote`, `office`, `workforce`
16. Add frontend embedding (static export + `tower-http::ServeDir`)
17. Full single-binary build with all features

### Phase 5: Polish & Production (1-2 weeks)

18. Windows Service integration (single service registration)
19. Graceful shutdown coordination (drain connections, flush caches)
20. Binary size optimization (feature profiles: `core`, `collaboration`, `full`)
21. CI/CD pipeline for multi-profile builds
22. Documentation and deployment guides

### Total Estimated Effort: 8-12 weeks (1 developer)

---

## 8. Key Design Decisions

### 8.1 Port Assignment Strategy

**Keep per-service ports** (not a single multiplexed port). Reasons:
- Frontend already knows service ports (API calls to `:3001`, `:3004`, etc.)
- Existing proxy routes won't break
- Gradual migration: gateway can coexist with standalone services
- Health checks per service remain independent

Future optimization: optional single-port mode where the gateway itself acts as a path-based router (`/api/identity/*`, `/api/storage/*`), delegating to in-process routers without network overhead.

### 8.2 Database Pool Sharing

```rust
// Gateway creates ONE pool
let pool = signapps_db::create_pool(&database_url).await?;

// Passed to each service's init_state
let identity_state = signapps_identity::init_state(pool.clone(), jwt.clone()).await?;
let storage_state = signapps_storage::init_state(pool.clone(), jwt.clone()).await?;
```

Pool configuration:
- `max_connections`: 50 (shared across all services, up from 5-10 per service x 19)
- Net reduction: 95-190 connections down to 50

### 8.3 Crash Isolation

```rust
async fn spawn_service(name: &str, future: impl Future<Output = anyhow::Result<()>> + Send + 'static) {
    let name = name.to_string();
    tokio::spawn(async move {
        loop {
            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                tokio::runtime::Handle::current().block_on(future)
            })) {
                Ok(Ok(())) => {
                    tracing::info!("{} exited cleanly", name);
                    break;
                }
                Ok(Err(e)) => {
                    tracing::error!("{} failed: {}, restarting in 5s", name, e);
                    tokio::time::sleep(Duration::from_secs(5)).await;
                }
                Err(panic) => {
                    tracing::error!("{} panicked: {:?}, restarting in 5s", name, panic);
                    tokio::time::sleep(Duration::from_secs(5)).await;
                }
            }
        }
    });
}
```

### 8.4 Relationship with Existing Crates

- **`signapps-service`**: The gateway becomes THE primary target for Windows Service registration. The existing `ShutdownSignal` is used once at the gateway level.
- **`signapps-runtime`**: PostgreSQL lifecycle management integrates directly into gateway startup (detect/start PostgreSQL before creating the pool).
- **`signapps-common`**: `bootstrap::run_server()` continues to work for standalone binaries. The gateway uses `run_server_with_shutdown()` for each task.

---

## 9. Alternative Approaches Considered

### A. Single Port with Path-Based Routing

Merge all routers into one Axum app on a single port, using path prefixes (`/identity/api/v1/...`, `/storage/api/v1/...`).

**Rejected because**: Requires frontend URL changes, breaks existing API contracts, harder to migrate progressively.

### B. Process Orchestrator (spawn child processes)

A supervisor binary that spawns the 19 existing binaries as child processes.

**Rejected because**: Doesn't reduce memory or connection overhead, more complex than tokio tasks, harder to share resources.

### C. Unix Socket Communication

Services communicate over Unix sockets instead of TCP ports.

**Not rejected but deferred**: Good optimization for Phase 5. In-process communication (direct function calls) would be even better but requires deeper refactoring.

---

## 10. Success Criteria for Full Implementation

1. `cargo build -p signapps-gateway --features full` produces a single binary
2. Running the binary starts all services on their respective ports
3. Each service also compiles and runs as a standalone binary
4. Feature flags allow building subsets: `--features core` for minimal deployment
5. Memory usage is at least 30% lower than running 19 separate processes
6. Startup time is under 5 seconds for all services
7. Windows Service registration works with a single `sc create` command
8. Frontend is optionally embedded with `--features embed-frontend`

---

## 11. POC Scope (This Sprint)

The proof-of-concept at `services/signapps-gateway/` demonstrates:
- Single binary that spawns identity + storage as tokio tasks
- Shared DB pool and JWT config
- Aggregated health check
- Feature flags for optional service inclusion
- Graceful shutdown coordination

See `services/signapps-gateway/src/main.rs` for the implementation.
