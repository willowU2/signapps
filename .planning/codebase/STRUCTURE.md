# Codebase Structure

**Analysis Date:** 2026-02-15

## Directory Layout

```
signapps-platform/
├── crates/                          # Shared foundational libraries
│   ├── signapps-common/             # Auth, middleware, error handling, value objects
│   ├── signapps-db/                 # Database models, repositories, migrations, PgPool
│   ├── signapps-cache/              # In-process TTL cache (moka) + atomic counters
│   └── signapps-runtime/            # Hardware detection, model manager, PostgreSQL lifecycle
├── services/                        # 9 independent microservices
│   ├── signapps-identity/           # Port 3001 - Auth, LDAP, MFA, RBAC, groups
│   ├── signapps-containers/         # Port 3002 - Docker container lifecycle (bollard)
│   ├── signapps-proxy/              # Port 3003 - Reverse proxy, TLS/ACME, SmartShield
│   ├── signapps-storage/            # Port 3004 - File storage (OpenDAL: FS or S3)
│   ├── signapps-ai/                 # Port 3005 - RAG, LLM, pgvector, embeddings
│   ├── signapps-securelink/         # Port 3006 - Web tunnels, DNS with ad-blocking
│   ├── signapps-scheduler/          # Port 3007 - CRON job management
│   ├── signapps-metrics/            # Port 3008 - System monitoring, Prometheus
│   └── signapps-media/             # Port 3009 - Native STT/TTS/OCR, voice pipeline
├── client/                          # Next.js 16 frontend (App Router)
│   └── src/
│       ├── app/                     # Pages (dashboard, containers, storage, ai, etc.)
│       ├── components/              # React components (ui/, layout/, domain-specific)
│       ├── hooks/                   # Custom React hooks
│       ├── lib/                     # API client, utilities
│       ├── stores/                  # Zustand stores
│       └── e2e/                     # Playwright E2E tests
├── migrations/                      # PostgreSQL schema migrations (001-008)
├── data/                            # Runtime data (gitignored)
│   ├── models/                      # AI model cache (stt/, tts/, ocr/, llm/, embeddings/)
│   └── storage/                     # File storage root (fs mode)
├── .github/workflows/               # CI/CD (ci.yml, release.yml)
├── Cargo.toml                       # Workspace manifest
├── .env                             # Local environment (gitignored)
└── CLAUDE.md                        # AI assistant instructions
```

## Directory Purposes

**crates/signapps-common/:**
- Purpose: Shared types, middleware, error handling
- Contains: `auth.rs`, `middleware.rs`, `error.rs`, `types.rs`, `config.rs`
- Key files: `error.rs` (30+ error variants), `middleware.rs` (auth/admin/logging)

**crates/signapps-db/:**
- Purpose: Database access layer
- Contains: `models/*.rs`, `repositories/*.rs`, `lib.rs` (pool + migrations)
- Key files: `lib.rs` (create_pool, run_migrations), `repositories/user_repository.rs`
- Subdirectories: `models/` (entity structs), `repositories/` (CRUD methods)

**crates/signapps-cache/:**
- Purpose: In-process caching (replaces Redis)
- Contains: Single `lib.rs` with CacheService (moka + DashMap)

**crates/signapps-runtime/:**
- Purpose: Runtime infrastructure
- Contains: `postgres.rs`, `hardware.rs`, `models.rs`
- Key files: `hardware.rs` (GPU detection), `models.rs` (model download/cache)

**services/signapps-{name}/:**
- Purpose: Independent microservice
- Contains: `main.rs` (router + AppState), `handlers/` (domain handlers)
- Some services have additional modules: `docker/`, `llm/`, `rag/`, `vectors/`, `dns/`, `tunnel/`, `shield/`, `stt/`, `tts/`, `ocr/`

**client/src/app/:**
- Purpose: Next.js App Router pages
- Contains: `dashboard/`, `containers/`, `storage/`, `ai/`, `users/`, `vpn/`, `proxy/`, `scheduler/`, `metrics/`, `media/`, `login/`
- Pattern: `{feature}/page.tsx` with `layout.tsx` for auth guards

**client/src/components/:**
- Purpose: Reusable React components
- Subdirectories: `ui/` (shadcn/ui), `layout/` (Header, Sidebar), domain-specific folders

**client/src/lib/:**
- Purpose: Core utilities and API client
- Key files: `api.ts` (2100+ lines, all service API functions), `utils.ts` (cn helper)

## Key File Locations

**Entry Points:**
- `services/signapps-{name}/src/main.rs` - Service startup (9 services)
- `client/src/app/layout.tsx` - Frontend root layout

**Configuration:**
- `Cargo.toml` - Workspace manifest with centralized dependencies
- `rustfmt.toml` - Rust formatting rules
- `clippy.toml` - Clippy lint thresholds
- `.cargo/config.toml` - Cargo aliases and env defaults
- `client/tsconfig.json` - TypeScript config
- `client/eslint.config.mjs` - ESLint rules
- `client/next.config.ts` - Next.js config

**Core Logic:**
- `crates/signapps-common/src/` - Shared auth, errors, middleware
- `crates/signapps-db/src/repositories/` - All database operations
- `crates/signapps-db/src/models/` - All entity types
- `client/src/lib/api.ts` - All frontend API calls

**Testing:**
- `client/e2e/` - Playwright E2E tests
- `client/e2e/fixtures.ts` - Test data and selectors
- `.github/workflows/ci.yml` - CI test pipeline

## Naming Conventions

**Files (Rust):**
- `snake_case.rs` for all Rust source files
- `mod.rs` for module declarations
- `main.rs` for service entry points

**Files (TypeScript):**
- `kebab-case.ts` for utilities, hooks, stores
- `PascalCase.tsx` for React components (in `components/ui/`)
- `page.tsx` for Next.js pages
- `layout.tsx` for Next.js layouts

**Directories:**
- `kebab-case` for all directories
- Plural for collections: `handlers/`, `models/`, `repositories/`, `stores/`, `hooks/`

**Special Patterns:**
- `use-{name}.ts` for React hooks
- `{domain}.rs` for handler files (e.g., `auth.rs`, `containers.rs`)
- `{entity}_repository.rs` for repository files
- `{NNN}_{name}.sql` for migrations

## Where to Add New Code

**New Backend Endpoint:**
- Handler: `services/signapps-{service}/src/handlers/{domain}.rs`
- Route: Register in `create_router()` in service `main.rs`
- Repository: `crates/signapps-db/src/repositories/{entity}_repository.rs`
- Model: `crates/signapps-db/src/models/{entity}.rs`
- Migration: `migrations/{NNN}_{name}.sql`

**New Service:**
- Create `services/signapps-{name}/` with `Cargo.toml` + `src/main.rs`
- Add to workspace members in root `Cargo.toml`
- Follow AppState + AuthState trait pattern
- Assign next available port (3010+)

**New Frontend Page:**
- Page: `client/src/app/{feature}/page.tsx`
- Components: `client/src/components/{feature}/`
- API functions: Add to `client/src/lib/api.ts`
- Store: `client/src/stores/{feature}-store.ts`
- Hook: `client/src/hooks/use-{feature}.ts`

**New Shared Functionality:**
- Types/errors: `crates/signapps-common/src/`
- DB operations: `crates/signapps-db/src/`
- Cache patterns: `crates/signapps-cache/src/`

## Special Directories

**data/:**
- Purpose: Runtime data (model cache, file storage)
- Source: Created at runtime by services
- Committed: No (gitignored)

**.next/:**
- Purpose: Next.js build output
- Source: Generated by `npm run build` / `npm run dev`
- Committed: No (gitignored)

**target/:**
- Purpose: Rust build artifacts
- Source: Generated by `cargo build`
- Committed: No (gitignored)

---

*Structure analysis: 2026-02-15*
*Update when directory structure changes*
