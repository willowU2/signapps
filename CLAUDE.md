# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SignApps Platform is a microservices-based infrastructure management system. Backend in Rust (Axum/Tokio), frontend in Next.js 16 (React 19, TypeScript). All services communicate via REST APIs with JWT authentication.

All system dependencies (database, cache, storage) run natively — no Docker required for core services. Docker is only used for optional media processing services (Whisper STT, Coqui TTS, PaddleOCR).

## Build & Development Commands

### Rust Backend

```bash
# Check entire workspace
cargo check --workspace --all-features

# Build
cargo build                              # debug build
cargo build --release                    # release build (LTO enabled)
cargo build -p signapps-identity         # single service

# Run a service
cargo run -p signapps-identity
cargo run -p signapps-containers
cargo run -p signapps-storage
# etc.

# Tests
cargo test --workspace --all-features    # all tests
cargo test -p signapps-identity          # single crate tests
cargo test -p signapps-db -- group       # filter tests by name

# Linting & formatting
cargo fmt --all                          # format all
cargo fmt --all -- --check               # check formatting
cargo clippy --workspace --all-features -- -D warnings   # lint (CI uses -D warnings)

# Cargo aliases (defined in .cargo/config.toml)
cargo c       # check
cargo t       # test
cargo lint    # clippy with -D warnings
cargo fmt     # format all
```

### Frontend (client/)

```bash
cd client
npm install
npm run dev                   # dev server (hot reload)
npm run build                 # production build
npm run lint                  # ESLint
npm run test:e2e              # Playwright E2E tests
npm run test:e2e:ui           # Playwright with UI
npm run test:e2e:chromium     # single browser
```

### Infrastructure

```bash
# PostgreSQL: install natively (auto-detected by services)
# No Redis, Qdrant, or MinIO needed — replaced by native alternatives

# Optional: media processing services (Docker)
docker-compose up -d faster-whisper piper surya-ocr

# Start all services (including media Docker containers)
docker-compose up -d

# With AI services (Ollama/vLLM)
docker-compose -f docker-compose.yml -f docker-compose.ai.yml up -d

# AI setup (pulls models)
.\scripts\setup-ai.ps1
```

## Architecture

### Workspace Layout

```
crates/
  signapps-common/    → Shared: JWT auth, middleware, error types, value objects
  signapps-db/        → Database: models, repositories, migrations, PgPool, pgvector
  signapps-cache/     → In-process TTL cache (moka) — replaces Redis
  signapps-runtime/   → PostgreSQL lifecycle: detection, auto-configuration
services/
  signapps-identity/    → Port 3001 – Auth, LDAP/AD, MFA, RBAC, groups
  signapps-containers/  → Port 3002 – Docker container lifecycle (bollard)
  signapps-proxy/       → Port 3003 – Reverse proxy, TLS/ACME, SmartShield
  signapps-storage/     → Port 3004 – File storage (OpenDAL: local FS or S3)
  signapps-ai/          → Port 3005 – RAG, LLM (multi-provider), pgvector, indexing
  signapps-securelink/  → Port 3006 – Web tunnels, DNS with ad-blocking
  signapps-scheduler/   → Port 3007 – CRON job management
  signapps-metrics/     → Port 3008 – System monitoring, Prometheus, alerts
  signapps-media/       → Port 3009 – OCR, TTS, STT
  paddleocr-server/     → Python OCR microservice
client/               → Next.js 16 frontend (App Router)
migrations/           → PostgreSQL schema migrations (including pgvector)
```

### System Dependencies (Native, no Docker)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Database | PostgreSQL (native) + pgvector extension | All data + vector similarity search |
| Cache | moka (in-process, Rust) | Rate limiting, token blacklist (replaces Redis) |
| Storage | OpenDAL (filesystem or S3) | File storage (replaces MinIO) |

### Service Pattern

Every Rust service follows the same structure:
- `main.rs` – Axum router setup, shared state injection, middleware stack
- `handlers/` – Request handlers organized by domain (e.g., `containers.rs`, `images.rs`)
- State is passed via Axum's `Extension` or `State` extractors
- Auth middleware from `signapps-common` validates JWT and injects `Claims`

### Shared Crate Conventions

**signapps-common:**
- `Claims` struct (sub: Uuid, username, role: i16) – extracted by auth middleware
- `AppError` – RFC 7807 Problem Details error type; all handlers return `Result<_, AppError>`
- Middleware: `auth_middleware` (JWT validation), `admin_middleware` (role check), request logging/ID
- Value objects: `Email`, `Password`, `UserId`, `Username` with validation

**signapps-db:**
- Repository pattern: each entity has a `*Repository` with CRUD methods taking `&PgPool`
- Models map 1:1 to PostgreSQL tables in the `identity` schema
- `create_pool(url)` and `run_migrations(pool)` for initialization
- `VectorRepository` for pgvector operations (384-dim embeddings, HNSW index)

**signapps-cache:**
- `CacheService` wrapping `moka::future::Cache` (TTL cache) + `DashMap` (atomic counters)
- Methods: `get/set/del/exists` (TTL-based), `incr/decr/get_counter` (atomic)
- Used by proxy (SmartShield rate limiting) and identity (JWT blacklist)

**signapps-runtime:**
- `RuntimeManager::ensure_database()` — auto-detects PostgreSQL (DATABASE_URL → pg_isready → TCP probe)

### Frontend Architecture

- **State:** Zustand stores (no Redux)
- **API:** Axios client with JWT auto-refresh (`client/src/lib/api.ts`), separate base URLs per service
- **UI:** shadcn/ui components in `components/ui/`, Tailwind CSS 4
- **Routing:** Next.js App Router – pages in `app/`, layouts handle auth guards
- **Forms:** react-hook-form + zod validation
- **Real-time:** xterm.js for container logs, EventSource/SSE for streaming

### API URL Convention

All services expose REST APIs at `/api/v1/...`. The frontend connects directly to each service port in dev mode. Service ports: identity=3001, containers=3002, proxy=3003, storage=3004, ai=3005, securelink=3006, scheduler=3007, metrics=3008, media=3009.

## Code Style

### Rust
- Edition 2021, MSRV 1.75
- Max line width: 100 chars (rustfmt.toml)
- Imports: grouped by std/external/crate, granularity=Crate
- Clippy: cognitive-complexity-threshold=30, too-many-lines=150, too-many-args=8
- Errors: use `thiserror` for library errors, `anyhow` for application errors
- Release profile: LTO + single codegen unit + panic=abort + strip

### TypeScript/Frontend
- Strict TypeScript
- Path alias: `@/*` maps to `./src/*`
- ESLint with next config

## CI Pipeline

GitHub Actions runs on push/PR to main and develop:
1. `cargo check --workspace --all-features`
2. `cargo fmt --all -- --check`
3. `cargo clippy --workspace --all-features -- -D warnings`
4. `cargo test --workspace --all-features` (requires PostgreSQL with pgvector)
5. `cargo audit` (security)
6. `cargo llvm-cov` (coverage → Codecov)

## Key Environment Variables

```
DATABASE_URL=postgres://signapps:password@localhost:5432/signapps  # auto-detected if not set
JWT_SECRET=<32+ chars>
STORAGE_MODE=fs                          # "fs" (default) or "s3"
STORAGE_FS_ROOT=./data/storage           # filesystem root (fs mode)
LLM_PROVIDER=ollama|vllm|openai|anthropic
OLLAMA_URL / VLLM_URL / OPENAI_API_KEY / ANTHROPIC_API_KEY
OCR_URL=http://localhost:8101            # PaddleOCR service
```

See `.env.example` for the full list.
