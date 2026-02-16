# SignApps Platform - Technology Stack Analysis

## Languages & Runtimes

### Rust
- **Edition**: 2021 - `Cargo.toml`
- **MSRV (Minimum Supported Rust Version)**: 1.75 - `Cargo.toml`
- **Primary Use**: Backend microservices (8 services + 4 shared crates)
- **File Extensions**: `.rs`

### TypeScript/JavaScript
- **Version**: TypeScript 5 - `client/package.json`
- **Runtime**: Node.js (implied by Next.js 16) - `client/package.json`
- **Primary Use**: Frontend web application
- **File Extensions**: `.ts`, `.tsx`

### SQL
- **Database**: PostgreSQL
- **Migrations**: Located in `migrations/` directory (SQL files: `001_initial_schema.sql`, `002_add_columns.sql`, etc.)
- **Extensions**: pgvector (vector similarity search) - `migrations/007_pgvector.sql`

---

## Package Managers & Lockfiles

### Frontend
- **Package Manager**: npm
- **Lockfile**: `client/package-lock.json`
- **Node Version**: Not explicitly pinned (.nvmrc not detected)

### Backend
- **Package Manager**: Cargo (Rust)
- **Lockfile**: `Cargo.lock` (generated from Cargo.toml)
- **Workspace Configuration**: `Cargo.toml` (lines 1-17)

---

## Web Frameworks

### Backend
- **Axum** 0.7 with WebSocket support - `Cargo.toml` (workspace deps)
  - `tower` 0.4 - middleware framework
  - `tower-http` 0.5 - HTTP utilities (CORS, compression, tracing)

### Frontend
- **Next.js** 16.1.6 (App Router) - `client/package.json`
  - `react` 19.2.3 - UI library
  - `react-dom` 19.2.3 - DOM binding

---

## Build Tools & Configuration

### Frontend Build
- **Next.js** via npm scripts: `npm run build`, `npm run dev`
- **TypeScript Config**: `client/tsconfig.json`
  - Target: ES2017
  - Strict mode enabled
  - Path alias: `@/*` → `./src/*`
- **Tailwind CSS** 4 (PostCSS) - `client/package.json`
- **Turbopack** configuration - `client/next.config.ts` (ONNX WASM resolution)

### Backend Build
- **Cargo**: `cargo build --release` (LTO enabled) - `Cargo.toml` profile
  - Single codegen unit for better optimization
  - Panic: abort
  - Strip: enabled

---

## Key Dependencies

### Backend Core

#### Async & Concurrency
- `tokio` 1.36 (with full features) - `Cargo.toml`
- `tokio-stream` 0.1
- `async-trait` 0.1
- `futures` 0.3, `futures-util` 0.3
- `dashmap` 6 (concurrent hashmap)

#### Database & Storage
- `sqlx` 0.7 (async SQL toolkit) - with postgres, uuid, chrono, json features
- `pgvector` 0.3 (vector embeddings) - `Cargo.toml`
- `opendal` 0.51 (filesystem/S3 abstraction) - `Cargo.toml`

#### Authentication & Security
- `jsonwebtoken` 9 - JWT auth
- `argon2` 0.5 - password hashing
- `totp-rs` 5 - MFA/TOTP support
- `oauth2` 4 - OAuth2 client
- `ldap3` 0.11 - LDAP/Active Directory
- `rustls` 0.23 - TLS library
- `rustls-pemfile` 2 - certificate parsing
- `rcgen` 0.13 - certificate generation
- `instant-acme` 0.7 - Let's Encrypt automation

#### Serialization
- `serde` 1.0 (derive macros enabled)
- `serde_json` 1.0
- `serde_yaml` 0.9

#### HTTP & Networking
- `reqwest` 0.12 (async HTTP client with JSON/stream features)
- `hyper` 1.4 (HTTP library, full features)
- `hyper-util` 0.1
- `http-body-util` 0.1
- `arc-swap` 1.7 (atomic reference counting)

#### Container Management
- `bollard` 0.16 (Docker API client) - `Cargo.toml`

#### AI & LLM
- `async-openai` 0.20 (OpenAI-compatible API) - `Cargo.toml`
- `llama-cpp-2` 0.1 (native GGUF inference, optional) - `services/signapps-ai/Cargo.toml`

#### Media Processing
- `whisper-rs` 0.15 (native STT, optional) - `services/signapps-media/Cargo.toml`
- `piper-rs` 0.1 (native TTS, optional) - `services/signapps-media/Cargo.toml`
- `ocrs` 0.11 (native OCR, optional) - `services/signapps-media/Cargo.toml`
- `rten` 0.22, `rten-imageproc` 0.22 (inference runtime for ocrs)
- `image` 0.25 (image processing)
- `symphonia` 0.5 (audio decoding: MP3, OGG, FLAC, WAV)
- `hound` 3.5 (WAV I/O)

#### In-Process Caching
- `moka` 0.12 (TTL cache, replaces Redis) - `Cargo.toml`

#### Observability & Logging
- `tracing` 0.1 (structured logging)
- `tracing-subscriber` 0.3 (with env-filter, json features)
- `prometheus` 0.13 - metrics
- `opentelemetry` 0.22 - observability framework
- `opentelemetry-otlp` 0.15 - OTLP exporter

#### Utilities
- `uuid` 1.7 (v4, v5, serde features)
- `chrono` 0.4 (datetime with serde)
- `dotenvy` 0.15 (environment loading)
- `config` 0.14 (configuration management)
- `validator` 0.16 (field validation)
- `thiserror` 1.0 (error handling)
- `anyhow` 1.0 (error context)
- `base64` 0.22 (encoding)
- `rand` 0.8 (randomness)
- `bytes` 1.5
- `mime_guess` 2 (MIME type detection)
- `sysinfo` 0.30 (system information, CPU/memory/disk)
- `once_cell` 1.19 (lazy initialization)

### Frontend Key Dependencies

#### API & State Management
- `axios` 1.13.5 - HTTP client with interceptors - `client/src/lib/api.ts`
- `zustand` 5.0.11 - lightweight state management (replaces Redux)
- `@tanstack/react-query` 5.90.20 - data fetching/caching

#### UI Components & Styling
- `shadcn` 3.8.4 (component CLI/library)
- `class-variance-authority` 0.7.1 - component variants
- `tailwind-merge` 3.4.0 - Tailwind class merging
- `lucide-react` 0.563.0 - icon library
- `@radix-ui/*` components (alert-dialog, checkbox, popover, progress)
- `radix-ui` 1.4.3 (UI primitives)
- `clsx` 2.1.1 (className utility)

#### Forms & Validation
- `react-hook-form` 7.71.1 - form state management
- `zod` 4.3.6 - TypeScript-first schema validation
- `@hookform/resolvers` 5.2.2 - form validation adapters

#### Voice & Audio
- `@ricky0123/vad-web` 0.0.30 - Voice Activity Detection (Web)
- Uses WASM via `onnxruntime-web` (configured in `client/next.config.ts`)

#### Terminal & Container Logs
- `xterm` 5.3.0 - terminal emulator
- `@xterm/addon-fit` 0.11.0 - fit addon
- `@xterm/addon-web-links` 0.12.0 - web links addon

#### Data Visualization
- `recharts` 3.7.0 - React charting library
- `react-grid-layout` 2.2.2 - draggable grid layout

#### Other UI
- `sonner` 2.0.7 - toast notifications
- `date-fns` 4.1.0 - date utilities
- `qrcode.react` 4.2.0 - QR code generation
- `next-themes` 0.4.6 - theme management

#### Development Tools
- `@playwright/test` 1.58.2 - E2E testing
- `eslint` 9 - linting
- `eslint-config-next` 16.1.6 - Next.js ESLint config
- `@types/node` 20 - TypeScript types
- `@types/react` 19, `@types/react-dom` 19

---

## Database

### PostgreSQL
- **Primary**: `postgres://signapps:password@localhost:5432/signapps`
- **Connection**: Auto-detected via `DATABASE_URL` or tcp probe on localhost:5432
- **Extensions**:
  - **pgvector** 0.3 - vector similarity search for embeddings (384-dim, HNSW index)
  - `uuid-ossp` - UUID generation
- **Migrations**: SQL scripts in `migrations/` directory
  - `001_initial_schema.sql` - Core schema
  - `002_add_columns.sql` - Schema updates
  - `003_app_store.sql` - Application store
  - `004_app_install_groups.sql` - Installation groups
  - `005_add_backups.sql` - Backup system
  - `006_proxy_certificates.sql` - TLS certificates
  - `007_pgvector.sql` - Vector extension
  - `008_collections.sql` - Knowledge base collections

### ORM/Query Approach
- **SQLx** 0.7 - compile-time checked SQL queries (no ORM)
- **Repository Pattern**: Each service has dedicated repository structs

---

## External Services & Integrations

### LLM Providers (Multi-Provider Support)
- **Ollama** (local, CPU-friendly) - Default in `.env.example`
  - Config: `OLLAMA_URL`, `OLLAMA_MODEL=llama3.2:3b`
- **vLLM** (GPU inference server)
  - Config: `VLLM_URL`, `VLLM_MODEL`
- **OpenAI API**
  - Config: `OPENAI_API_KEY`, `OPENAI_MODEL`
- **Anthropic API**
  - Config: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
- **Local GGUF** (llama-cpp-2)
  - Config: `LLAMACPP_MODEL`, `LLAMACPP_GPU_LAYERS`, `LLAMACPP_CONTEXT_SIZE`

See: `services/signapps-ai/Cargo.toml`, `.env.example`

### Embeddings
- **Ollama embeddings**: `EMBEDDINGS_URL`, `EMBEDDINGS_MODEL=nomic-embed-text`
- **Hugging Face models**: `HF_TOKEN` for model downloads

### Media Services

#### Speech-to-Text (STT)
- **Native**: `whisper-rs` (native Whisper.cpp)
  - Model: `STT_MODEL=medium` (base/small/medium/large-v3)
- **Remote**: HTTP backend at `STT_URL=http://localhost:8100`

#### Text-to-Speech (TTS)
- **Native**: `piper-rs` (native ONNX)
  - Voice: `TTS_VOICE=fr_FR-siwis-medium`
- **Remote**: HTTP backend at `TTS_URL=http://localhost:10200`

#### OCR
- **Native**: `ocrs` + `rten` inference
- **Remote**: HTTP backend at `OCR_URL=http://localhost:8101`

See: `services/signapps-media/Cargo.toml`, `.env.example`

### Storage Backends
- **Filesystem**: Default `STORAGE_MODE=fs`, root at `STORAGE_FS_ROOT=./data/storage`
- **S3-Compatible**: MinIO, AWS S3
  - Config: `STORAGE_S3_ENDPOINT`, `STORAGE_S3_ACCESS_KEY`, `STORAGE_S3_SECRET_KEY`, `STORAGE_S3_REGION`, `STORAGE_S3_BUCKET`
- **Implementation**: `opendal` 0.51 abstraction layer

See: `services/signapps-storage/Cargo.toml`, `.env.example`

### Authentication Providers
- **LDAP/Active Directory**
  - Config: `LDAP_URL`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`, `LDAP_BASE_DN`
- **Local Auth**: Argon2 password hashing
- **MFA**: TOTP support

See: `services/signapps-identity/Cargo.toml`, `.env.example`

### TLS/SSL
- **Let's Encrypt**: ACME protocol for automatic certificate management
- **Self-signed**: Certificate generation via `rcgen` 0.13
- **TLS 1.2/1.3**: Configurable minimum version

See: `services/signapps-proxy/Cargo.toml`, `.env.example`

### Hardware Detection & GPU Support
- **sysinfo**: CPU cores, system RAM, disk info
- **GPU Detection**: NVIDIA (CUDA), AMD (ROCm), Intel, Apple (Metal), Vulkan
- **Model Cache**: `MODELS_DIR=./data/models` (configurable)
- **GPU Backend**: `GPU_BACKEND=auto|cuda|rocm|metal|vulkan|cpu`

See: `signapps-runtime` crate, `.env.example`

---

## Configuration Approach

### Environment Variables
- **Method**: `.env` file loading via `dotenvy` 0.15
- **Example Config**: `.env.example` (line-by-line documentation)
- **Service Ports**:
  - Identity (3001), Containers (3002), Proxy (3003), Storage (3004), AI (3005)
  - SecureLink (3006), Scheduler (3007), Metrics (3008), Media (3009)
- **Set via**: `SERVER_PORT=300X cargo run -p signapps-xxx`

### Frontend Configuration
- **Next.js Env**: `process.env.NEXT_PUBLIC_*` variables - `client/src/lib/api.ts`
- **Service Base URLs**:
  - `NEXT_PUBLIC_IDENTITY_URL`, `NEXT_PUBLIC_CONTAINERS_URL`, etc. (defaults to localhost:300X)
  - Direct service routing in `client/src/lib/api.ts`

### Feature Flags
- **Rust Features**: Conditional compilation
  - `native-llm`, `cuda`, `metal`, `vulkan` (for AI)
  - `native-stt`, `native-tts`, `native-ocr` (for Media)

See: Service `Cargo.toml` files

---

## Code Style & Formatting

### Rust
- **Max Line Width**: 100 chars (`rustfmt.toml`)
- **Formatting**: `cargo fmt --all`
- **Linting**: `cargo clippy --workspace --all-features -- -D warnings`
- **Clippy Thresholds**:
  - cognitive-complexity: 30
  - too-many-lines: 150
  - too-many-args: 8

### TypeScript/JavaScript
- **ESLint**: 9 - `client/eslint.config.mjs`
- **Strict TypeScript**: Enabled - `client/tsconfig.json`
- **Imports**: Granular/crate-level organization
- **Path Alias**: `@/*` → `./src/*`

See: `client/eslint.config.mjs`, `client/tsconfig.json`

---

## Testing

### Frontend (E2E)
- **Playwright** 1.58.2 - `client/package.json`
- **Commands**:
  - `npm run test:e2e` - full test suite
  - `npm run test:e2e:ui` - interactive UI
  - `npm run test:e2e:chromium` - single browser

### Backend
- **Framework**: tokio-test 0.4
- **Command**: `cargo test --workspace --all-features`
- **CI**: Runs on GitHub Actions

---

## Microservices Architecture

### 8 Backend Services
1. **signapps-identity** (Port 3001) - Auth, LDAP, MFA, RBAC
2. **signapps-containers** (Port 3002) - Docker lifecycle
3. **signapps-proxy** (Port 3003) - Reverse proxy, TLS/ACME
4. **signapps-storage** (Port 3004) - File storage (FS/S3), RAID
5. **signapps-ai** (Port 3005) - RAG, LLM, pgvector indexing
6. **signapps-securelink** (Port 3006) - Web tunnels, DNS
7. **signapps-scheduler** (Port 3007) - CRON jobs
8. **signapps-metrics** (Port 3008) - Monitoring, Prometheus
9. **signapps-media** (Port 3009) - STT/TTS/OCR, WebSocket voice

### 4 Shared Crates
1. **signapps-common** - JWT auth, middleware, error types
2. **signapps-db** - Database layer, repositories, pgvector
3. **signapps-cache** - In-process TTL cache (moka)
4. **signapps-runtime** - PostgreSQL lifecycle, hardware detection, model manager

---

## Summary Table

| Category | Technology | File Reference |
|----------|-----------|-----------------|
| **Languages** | Rust 2021, TypeScript 5 | `Cargo.toml`, `client/package.json` |
| **Backend Framework** | Axum 0.7 + Tokio | `Cargo.toml` (workspace) |
| **Frontend Framework** | Next.js 16, React 19 | `client/package.json`, `client/next.config.ts` |
| **Database** | PostgreSQL + pgvector | `migrations/`, `.env.example` |
| **Cache** | moka (in-process) | `Cargo.toml` |
| **Package Managers** | Cargo (Rust), npm (Node) | `Cargo.lock`, `client/package-lock.json` |
| **LLM** | Ollama/vLLM/OpenAI/Anthropic/GGUF | `services/signapps-ai/Cargo.toml`, `.env.example` |
| **Media** | whisper-rs, piper-rs, ocrs | `services/signapps-media/Cargo.toml` |
| **Storage** | OpenDAL (FS/S3) | `services/signapps-storage/Cargo.toml` |
| **Auth** | JWT, Argon2, TOTP, LDAP, OAuth2 | `services/signapps-identity/Cargo.toml` |
| **HTTP Client** | Reqwest, Axios | `Cargo.toml`, `client/src/lib/api.ts` |
| **TLS** | Rustls + Let's Encrypt (ACME) | `services/signapps-proxy/Cargo.toml` |
| **State Management** | Zustand | `client/package.json` |
| **UI Components** | shadcn/ui, Radix UI, Tailwind CSS | `client/package.json` |
| **E2E Testing** | Playwright | `client/package.json` |
| **Linting** | cargo clippy, ESLint 9 | `.cargo/config.toml`, `client/eslint.config.mjs` |
