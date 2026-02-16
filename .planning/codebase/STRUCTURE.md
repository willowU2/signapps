# Codebase Structure

**Analysis Date:** 2026-02-16

## Directory Layout

```
signapps-platform/
├── Cargo.toml                    # Workspace manifest (13 members)
├── Cargo.lock                    # Lock file
├── package.json (in client/)     # Frontend dependencies
│
├── crates/                       # Shared Rust libraries (4 crates)
│   ├── signapps-common/          # Auth, middleware, error types
│   │   ├── src/lib.rs           # Re-exports: auth, config, error, middleware, types
│   │   ├── src/auth.rs          # JWT validation, Claims struct
│   │   ├── src/error.rs         # RFC 7807 AppError type
│   │   └── src/middleware.rs    # auth_middleware, require_admin, logging
│   │
│   ├── signapps-db/              # Database abstraction
│   │   ├── src/lib.rs           # create_pool(), run_migrations()
│   │   ├── src/models/          # Entity structs (User, Group, Container, etc.)
│   │   └── src/repositories/    # 12 repositories (user, group, vector, container, etc.)
│   │
│   ├── signapps-cache/           # TTL cache service (moka + DashMap)
│   │   ├── src/lib.rs           # CacheService: get/set/del/exists/incr/decr
│   │
│   └── signapps-runtime/         # Hardware, models, database detection
│       ├── src/lib.rs           # Exports: HardwareProfile, ModelManager, RuntimeManager
│       ├── src/gpu.rs           # GPU detection (NVIDIA/AMD/Intel/Apple)
│       ├── src/models.rs        # Model download/cache management
│       └── src/postgres.rs      # PostgreSQL auto-detection
│
├── services/                     # 9 Microservices (ports 3001-3009)
│   ├── signapps-identity/        # Auth, users, groups, LDAP, MFA (3001)
│   │   ├── src/main.rs          # Axum setup, router, server startup
│   │   ├── src/handlers/        # 8 handlers: auth, users, groups, ldap, mfa, roles, webhooks, health
│   │   ├── src/auth/            # JWT, LDAP, password, MFA logic
│   │   └── src/ldap/            # LDAP/AD client
│   │
│   ├── signapps-containers/      # Docker management (3002)
│   │   ├── src/main.rs
│   │   ├── src/handlers/        # 10+ handlers: containers, images, compose, store, backups, etc.
│   │   └── src/docker/          # Bollard wrapper
│   │
│   ├── signapps-ai/              # RAG, LLM, embeddings (3005)
│   │   ├── src/main.rs
│   │   ├── src/handlers/        # 8 handlers: chat, collections, index, search, models, providers, health
│   │   ├── src/llm/             # LLM providers (llamacpp, ollama, vllm, openai, anthropic)
│   │   ├── src/rag/             # RAG pipeline: chunker, pipeline, indexer
│   │   ├── src/embeddings/      # Embedding client (Ollama or HF-based)
│   │   ├── src/indexer/         # Indexing pipeline
│   │   ├── src/tools/           # Tool executor & registry
│   │   └── src/vectors/         # pgvector operations
│   │
│   ├── signapps-storage/         # File storage (3004)
│   ├── signapps-proxy/           # Reverse proxy (3003)
│   ├── signapps-media/           # STT/TTS/OCR (3009)
│   ├── signapps-metrics/         # Prometheus (3008)
│   ├── signapps-scheduler/       # CRON jobs (3007)
│   └── signapps-securelink/      # VPN/tunnel (3006)
│
├── client/                       # Next.js 16 Frontend
│   ├── package.json              # Dependencies
│   ├── tsconfig.json             # TypeScript config
│   ├── next.config.ts            # Next.js config
│   ├── playwright.config.ts      # E2E test config
│   │
│   └── src/
│       ├── app/                  # Next.js App Router
│       │   ├── layout.tsx        # Root layout (metadata, fonts, Providers)
│       │   ├── page.tsx          # Home page
│       │   ├── globals.css       # Global styles (Tailwind 4)
│       │   ├── login/            # Login pages
│       │   ├── dashboard/        # Dashboard
│       │   ├── ai/               # AI chat interface
│       │   ├── containers/       # Container management
│       │   ├── storage/          # Storage management
│       │   ├── users/            # User management
│       │   ├── monitoring/       # Metrics dashboard
│       │   ├── scheduler/        # CRON jobs
│       │   └── settings/         # Settings pages
│       │
│       ├── components/           # React components (136+ files)
│       │   ├── layout/           # app-layout, header, sidebar, ai-chat-bar, right-sidebar
│       │   ├── ui/               # shadcn/ui components (buttons, dialogs, cards, etc.)
│       │   ├── auth/             # Login, MFA components
│       │   ├── dashboard/        # Dashboard cards, activity feed, stats
│       │   ├── containers/       # Container cards, logs viewer
│       │   ├── storage/          # Disk, RAID, shares components
│       │   ├── ai/               # Chat interface, tool display, uploads
│       │   ├── monitoring/       # Metrics, alerts, charts
│       │   └── [other domains]/
│       │
│       ├── hooks/                # Custom React hooks (12+ files)
│       │   ├── use-containers.ts    # Container CRUD + updates
│       │   ├── use-users.ts         # User operations
│       │   ├── use-monitoring.ts    # Metrics polling
│       │   ├── use-voice-chat.ts    # Voice AI pipeline
│       │   ├── use-ai-brief.ts      # AI daily brief
│       │   ├── use-ai-search.ts     # AI search operations
│       │   └── [other domain hooks]/
│       │
│       ├── lib/                  # Utilities and API clients
│       │   ├── api.ts            # Axios clients for all 9 services with auth interceptors
│       │   ├── store.ts          # Zustand stores (useAuthStore, useUIStore)
│       │   └── [other utilities]/
│       │
│       └── stores/               # Zustand state management
│           ├── dashboard-store.ts   # Dashboard state
│           └── [other stores]/
│
├── migrations/                   # PostgreSQL migrations (SQLx)
│   ├── 001_initial_schema.sql    # Users, groups, roles, RBAC
│   ├── 002_add_columns.sql
│   ├── 003_app_store.sql         # App installation tracking
│   ├── 004_app_install_groups.sql
│   ├── 005_add_backups.sql       # Backup tracking
│   ├── 006_proxy_certificates.sql
│   ├── 007_pgvector.sql          # Vector extensions (384-dim HNSW)
│   └── 008_collections.sql       # AI knowledge base collections
│
├── data/                         # Runtime data (created at runtime)
│   ├── models/                   # Model cache (STT, TTS, OCR, LLM, embeddings)
│   ├── storage/                  # File storage root (configurable via STORAGE_FS_ROOT)
│
├── .cargo/                       # Cargo configuration
│   └── config.toml               # Aliases: c, t, lint, fmt
│
├── .env.example                  # Environment template
├── .env                          # Active configuration (gitignored)
├── clippy.toml                   # Clippy linter config
├── deny.toml                     # Dependency audit
├── rustfmt.toml                  # Rust formatter config (100 char, 4-space)
├── CLAUDE.md                     # Project instructions for Claude
├── README.md                     # Main documentation
│
└── [.github, .git, target, .next, etc.]
```

## Directory Purposes

**crates/signapps-common:**
- Purpose: Shared middleware, auth, error types, value objects
- Contains: auth.rs, config.rs, error.rs, middleware.rs, types.rs
- Re-exports: Clean API for all services
- Subdirectories: None (flat structure for easy imports)

**crates/signapps-db:**
- Purpose: Database abstraction layer and schema management
- Contains: Connection pool creation, migrations runner, models, repositories
- Models: Entity definitions (User, Group, Container, etc.)
- Repositories: CRUD operations for each entity

**crates/signapps-cache:**
- Purpose: In-process TTL cache (moka-based)
- Contains: CacheService with get/set/del + atomic counters
- Replaces: Redis (native in-process alternative)

**crates/signapps-runtime:**
- Purpose: System management (GPU detection, model manager, DB probe)
- Contains: Hardware detection, model download/cache, PostgreSQL auto-detection
- Used by: signapps-ai for model loading, all services for DB setup

**services/signapps-identity:**
- Purpose: Authentication, user management, LDAP, MFA, RBAC
- Handlers: auth, users, groups, ldap, mfa, roles, webhooks, health
- Port: 3001

**services/signapps-containers:**
- Purpose: Docker container lifecycle management
- Handlers: Containers, images, compose, app store, backups, export, metrics
- Port: 3002

**services/signapps-ai:**
- Purpose: RAG, LLM inference, embeddings, vector search, tool execution
- Handlers: Chat, collections, index, search, models, providers, tools, health
- Subdirs: llm/, rag/, embeddings/, indexer/, tools/, vectors/
- Port: 3005

**services/signapps-storage:**
- Purpose: File storage (filesystem or S3), disk management, RAID, shares
- Handlers: Disk, mount, RAID, external storage, shares, search, preview, quotas, favorites, trash
- Port: 3004

**client/src/app/:**
- Purpose: Page definitions (Next.js App Router)
- Structure: Feature-based (dashboard/, ai/, containers/, storage/, users/, etc.)
- Each directory: Contains page.tsx (+ optional layout.tsx, loading.tsx, error.tsx)

**client/src/components/:**
- Purpose: Reusable React components
- Organization: By domain/feature (layout/, ui/, auth/, dashboard/, containers/, storage/, ai/, monitoring/)
- UI components: shadcn/ui imports from @/components/ui/

**client/src/hooks/:**
- Purpose: Custom React hooks for state and API operations
- Pattern: use{Domain}() returning CRUD functions and state
- Examples: useContainers(), useUsers(), useMonitoring(), useVoiceChat()

**client/src/lib/:**
- Purpose: Utility functions and API clients
- api.ts: Per-service axios instances with JWT interceptors
- store.ts: Zustand stores (useAuthStore, useUIStore)

## Key File Locations

**Entry Points:**
- `services/signapps-identity/src/main.rs` - Port 3001
- `services/signapps-containers/src/main.rs` - Port 3002
- `services/signapps-ai/src/main.rs` - Port 3005
- `services/signapps-storage/src/main.rs` - Port 3004
- `services/signapps-proxy/src/main.rs` - Port 3003
- `services/signapps-media/src/main.rs` - Port 3009
- `client/src/app/layout.tsx` - Frontend root

**Configuration:**
- `Cargo.toml` - Workspace manifest
- `.env.example` - Environment template
- `rustfmt.toml` - Rust formatting rules
- `client/tsconfig.json` - TypeScript config
- `client/next.config.ts` - Next.js config
- `client/playwright.config.ts` - E2E test config

**Core Logic:**
- `crates/signapps-db/src/repositories/` - Database operations
- `services/signapps-ai/src/llm/` - LLM providers
- `services/signapps-ai/src/rag/` - RAG pipeline
- `client/src/hooks/` - Business logic hooks
- `client/src/lib/api.ts` - API client setup

**Migrations:**
- `migrations/` - All SQL migration files (001-008)
- Named sequentially, auto-run by signapps-runtime

## Naming Conventions

**Files:**
- Rust: `snake_case.rs` (user_repository.rs, jwt_config.rs)
- TypeScript: `kebab-case.ts(x)` (command-palette.tsx, use-containers.ts)
- Components: `PascalCase.tsx` (CommandPalette.tsx)

**Directories:**
- Rust: `snake_case/` (services, handlers, repositories)
- TypeScript: `kebab-case/` or `PascalCase/` (components/, hooks/, lib/)
- Plural for collections: `handlers/`, `repositories/`, `components/`

**Special Patterns:**
- `mod.rs` - Module re-exports in Rust
- `index.ts` - Barrel exports in TypeScript
- `*_test.rs` - Inline tests in Rust (via #[cfg(test)])
- `*.spec.ts` - Playwright E2E tests

## Where to Add New Code

**New Service:**
- Entry: `services/signapps-new/src/main.rs`
- Handlers: `services/signapps-new/src/handlers/`
- Config: Add to `Cargo.toml` workspace members, `.env.example`

**New Component:**
- UI component: `client/src/components/[domain]/ComponentName.tsx`
- Hook: `client/src/hooks/use-[domain].ts`
- Tests: `client/e2e/[feature].spec.ts` (Playwright)

**New Database Entity:**
- Model: `crates/signapps-db/src/models/entity.rs`
- Repository: `crates/signapps-db/src/repositories/entity_repository.rs`
- Migration: `migrations/NNN_add_entity.sql`

**New API Endpoint:**
- Handler: `services/signapps-*/src/handlers/domain.rs`
- Route: Register in `services/signapps-*/src/main.rs` router

## Special Directories

**data/models/:**
- Purpose: Model cache (auto-created at runtime)
- Contents: STT, TTS, OCR, LLM, embeddings models
- Source: Auto-downloaded by signapps-runtime
- Committed: No (in .gitignore)

**data/storage/:**
- Purpose: File storage root
- Source: Configurable via STORAGE_FS_ROOT env var
- Committed: No (in .gitignore)

**target/:**
- Purpose: Rust build artifacts
- Source: Created by `cargo build`
- Committed: No (in .gitignore)

**.next/:**
- Purpose: Next.js build output
- Source: Created by `npm run build`
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-02-16*
*Update when directory structure changes*
