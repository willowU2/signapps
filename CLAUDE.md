# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SignApps Platform is a microservices-based infrastructure management system. Backend in Rust (Axum/Tokio), frontend in Next.js 16 (React 19, TypeScript). All services communicate via REST APIs with JWT authentication.

All dependencies run natively — no Docker required. Media processing (STT, TTS, OCR) uses native Rust engines (whisper-rs, piper-rs, ocrs). LLM inference supports native GGUF models via llama-cpp-2 alongside cloud providers.

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
# No Docker required — all services and dependencies run natively
# AI models (STT, TTS, OCR, LLM, embeddings) are downloaded automatically on first use
# Model cache: ./data/models/ (override with MODELS_DIR env var)
```

## Architecture

### Workspace Layout

```
crates/
  signapps-common/    → Shared: JWT auth, middleware, error types, value objects
  signapps-db/        → Database: models, repositories, migrations, PgPool, pgvector
  signapps-cache/     → In-process TTL cache (moka) — replaces Redis
  signapps-runtime/   → PostgreSQL lifecycle, hardware detection, model manager
services/
  signapps-identity/      → Port 3001 – Auth, LDAP/AD, MFA, RBAC, groups
  signapps-containers/    → Port 3002 – Docker container lifecycle (bollard)
  signapps-proxy/         → Port 3003 – Reverse proxy, TLS/ACME, SmartShield
  signapps-storage/       → Port 3004 – File storage (OpenDAL: local FS or S3)
  signapps-ai/            → Port 3005 – AI Gateway: RAG, LLM, Vision, ImageGen, VideoGen, AudioGen, Reranking
  signapps-securelink/    → Port 3006 – Web tunnels, DNS with ad-blocking
  signapps-scheduler/     → Port 3007 – CRON job management
  signapps-metrics/       → Port 3008 – System monitoring, Prometheus, alerts
  signapps-media/         → Port 3009 – Native STT/TTS/OCR, voice WebSocket pipeline
  signapps-docs/          → Port 3010 – Document editing (Tiptap collaborative)
  signapps-calendar/      → Port 3011 – Calendar & scheduling
  signapps-mail/          → Port 3012 – Email service
  signapps-collab/        → Port 3013 – Real-time collaboration (CRDT)
  signapps-meet/          → Port 3014 – Video conferencing
  signapps-forms/         → Port 3015 – Form builder & submissions
  signapps-pxe/           → Port 3016 – PXE network boot
  signapps-remote/        → Port 3017 – Remote desktop access
  signapps-office/        → Port 3018 – Office suite (import/export/reports)
  signapps-social/        → Port 3019 – Social media management
  signapps-chat/          → Port 3020 – Team messaging & channels
  signapps-workforce/     → Port 3019 – HR & workforce management (shares port with social via SERVER_PORT)
  signapps-it-assets/     → Port 3015 – IT asset management (shares port with forms via SERVER_PORT)
  signapps-contacts/      → Port 3014 – Contact management
  signapps-notifications/ → Port 8095 – Push notifications
  signapps-billing/       → Port 8096 – Billing & invoicing
  signapps-gateway/       → Port 3099 – API gateway (aggregator proxy)
scripts/              → start-all.ps1/sh, stop, pg-backup, log rotation
client/               → Next.js 16 frontend (App Router), port 3000
migrations/           → PostgreSQL schema migrations (including pgvector)
```

### System Dependencies (Native, no Docker)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Database | PostgreSQL (native) + pgvector extension | All data + vector similarity search |
| Cache | moka (in-process, Rust) | Rate limiting, token blacklist |
| Storage | OpenDAL (filesystem or S3) | File storage |
| STT | whisper-rs (native) or HTTP backend | Speech-to-text transcription |
| TTS | piper-rs (native) or HTTP backend | Text-to-speech synthesis |
| OCR | ocrs + rten (native) or HTTP backend | Optical character recognition |
| LLM | llama-cpp-2 (native GGUF) + cloud APIs | Language model inference |
| Vision | llama.cpp multimodal / HTTP / cloud (GPT-4o) | Image analysis, VQA |
| Image Gen | candle (SD/FLUX) / HTTP (ComfyUI) / cloud (DALL-E) | Text-to-image generation |
| Video | HTTP / cloud (Gemini, Replicate) | Video understanding + generation |
| Audio Gen | candle (MusicGen) / HTTP / cloud (Replicate) | Music + SFX generation |
| Reranking | ONNX Runtime (bge-reranker) / HTTP (TEI) / cloud (Cohere) | Search result reranking |
| MM Embeddings | ONNX Runtime (SigLIP) / HTTP / cloud (OpenAI) | Cross-modal search (text↔image) |
| Hardware | sysinfo + GPU probes | Auto-detect GPU/VRAM for model selection |

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
- `VectorRepository` for pgvector operations (384-dim text embeddings, HNSW index)
- `MultimodalVectorRepository` for 1024-dim SigLIP multimodal embeddings
- `ConversationRepository` for AI chat history persistence
- `GeneratedMediaRepository` for tracking AI-generated media outputs

**signapps-cache:**
- `CacheService` wrapping `moka::future::Cache` (TTL cache) + `DashMap` (atomic counters)
- Methods: `get/set/del/exists` (TTL-based), `incr/decr/get_counter` (atomic)
- Used by proxy (SmartShield rate limiting) and identity (JWT blacklist)

**signapps-runtime:**
- `RuntimeManager::ensure_database()` — auto-detects PostgreSQL (DATABASE_URL → pg_isready → TCP probe)
- `HardwareProfile::detect()` — auto-detects GPU (NVIDIA/AMD/Intel/Apple), VRAM, CPU cores
- `ModelManager` — downloads, caches, and manages AI models (STT/TTS/OCR/LLM/Embeddings)
- Model cache: `data/models/{stt,tts,ocr,llm,embeddings}/` (configurable via `MODELS_DIR`)

### Frontend Architecture

- **State:** Zustand stores (no Redux)
- **API:** Axios client with JWT auto-refresh (`client/src/lib/api.ts`), separate base URLs per service
- **UI:** shadcn/ui components in `components/ui/`, Tailwind CSS 4
- **Routing:** Next.js App Router – pages in `app/`, layouts handle auth guards
- **Forms:** react-hook-form + zod validation
- **Real-time:** xterm.js for container logs, EventSource/SSE for streaming

### AI Gateway Architecture (signapps-ai)

signapps-ai is a unified AI gateway with trait-based workers:

```
gateway/         → Router (Native>Http>Cloud), QualityAdvisor, capability registry
workers/         → 10 capability workers, each with native/http/cloud backends
  ├── llm/         LLM chat (Ollama, vLLM, OpenAI, Anthropic, Gemini, llama.cpp)
  ├── vision/      Image analysis, VQA (vLLM multimodal, GPT-4o Vision)
  ├── imagegen/    Text-to-image (ComfyUI/A1111, DALL-E 3, candle SD/FLUX)
  ├── videogen/    Video generation (HTTP, Replicate)
  ├── video_understand/  Video analysis (HTTP, Gemini 1.5 Pro)
  ├── audiogen/    Music/SFX generation (HTTP, Replicate)
  ├── reranker/    Search reranking (TEI, Cohere, ONNX bge-reranker)
  ├── embeddings_mm/  Multimodal embeddings (SigLIP HTTP, OpenAI, ONNX native)
  └── docparse/    Document parsing (ocrs native, Azure Doc Intelligence)
rag/             → Multimodal RAG: dual-space indexer, RRF fusion search, circular pipeline
memory/          → Conversation memory, context builder, auto-summarizer
models/          → Multi-GPU model orchestrator with LRU eviction, hardware profiles
```

**Key patterns:**
- `AiWorker` base trait + specialized traits (VisionWorker, ImageGenWorker, etc.)
- `GatewayRouter` routes to best worker: Native > Http > Cloud (unless cloud quality >> local)
- `ModelOrchestrator` manages VRAM across GPUs with LRU eviction
- Dual-space pgvector: text 384d (nomic-embed) + multimodal 1024d (SigLIP)
- Circular pipeline: generated outputs are auto-indexed back into RAG

**Feature flags for native backends:**
```
native-reranker    → ONNX bge-reranker
native-embedmm    → ONNX SigLIP
native-vision     → llama.cpp multimodal
native-imagegen   → candle Stable Diffusion / FLUX
native-all        → all native backends
gpu-rocm / gpu-cuda / gpu-metal / gpu-vulkan
```

### API URL Convention

All services expose REST APIs at `/api/v1/...`. The frontend connects directly to each service port in dev mode.

**Service ports (complete):**

| Port | Service | Description |
|------|---------|-------------|
| 3000 | frontend | Next.js dev server |
| 3001 | identity | Auth, LDAP/AD, MFA, RBAC |
| 3002 | containers | Docker container lifecycle |
| 3003 | proxy | Reverse proxy, TLS/ACME |
| 3004 | storage | File storage (OpenDAL) |
| 3005 | ai | AI Gateway (RAG, LLM, Vision, ImageGen) |
| 3006 | securelink | Web tunnels, DNS |
| 3007 | scheduler | CRON job management |
| 3008 | metrics | System monitoring, Prometheus |
| 3009 | media | STT/TTS/OCR processing |
| 3010 | docs | Document editing (Tiptap) |
| 3011 | calendar | Calendar & scheduling |
| 3012 | mail | Email service |
| 3013 | collab | Real-time collaboration |
| 3014 | meet | Video conferencing |
| 3015 | forms | Form builder & submissions |
| 3016 | pxe | PXE network boot |
| 3017 | remote | Remote desktop access |
| 3018 | office | Office suite (import/export) |
| 3019 | social | Social media management |
| 3020 | chat | Team messaging & channels |
| 3099 | gateway | API gateway (aggregator) |
| 8095 | notifications | Push notifications |
| 8096 | billing | Billing & invoicing |

Note: `workforce` (3019), `it-assets` (3015), and `contacts` (3014) share ports with other services. Use `SERVER_PORT` env var to run them simultaneously on different ports.

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

## Automatic Tool Usage

Claude MUST automatically invoke the following tools when the situation matches. This is MANDATORY, not optional.

### BMAD Workflows (via `_bmad/` system)

| Situation | Action | Command |
|-----------|--------|---------|
| New major feature or project | Create Product Brief | `/bmad CB` |
| Need detailed specifications | Create PRD | `/bmad CP` |
| Architecture decisions needed | Create Architecture | `/bmad CA` |
| Break down into implementable stories | Create Epics & Stories | `/bmad CE` |
| Rapid development without ceremony | Quick Dev | `/bmad QD` |
| Code review needed | Code Review | `/bmad CR` |
| Brainstorming ideas needed | Brainstorm Project | `/bmad BP` |
| Multi-agent collaboration | Party Mode | `/bmad party` |

### Superpowers Plugin Skills

| Situation | Skill to Invoke |
|-----------|-----------------|
| **Before** creating any new feature, component, or functionality | `superpowers:brainstorming` |
| Encountering any bug, test failure, or unexpected behavior | `superpowers:systematic-debugging` |
| Implementing any feature or bugfix | `superpowers:test-driven-development` |
| Multi-step implementation task | `superpowers:writing-plans` |
| 2+ independent tasks that can run in parallel | `superpowers:dispatching-parallel-agents` |
| About to claim work is complete, fixed, or passing | `superpowers:verification-before-completion` |
| After completing major feature implementation | `superpowers:requesting-code-review` |
| Receiving code review feedback | `superpowers:receiving-code-review` |

### Local Skills (`.agents/skills/`)

These skills provide project-specific guidance. Read the relevant SKILL.md before implementing:

- `agent_planning_workflow` - Architect role workflow before complex changes
- `ai_self_refinement` - Auto-update conventions when detecting drift
- `rust_api_endpoint` - Creating Rust API endpoints
- `nextjs_component` - Creating Next.js components
- `db_migrations` - Database migrations with sqlx
- `rust_debugging_workflow` - Rust debugging patterns
- `playwright_e2e_testing` - E2E testing setup

### Priority Order

1. **Superpowers** skills for methodology (brainstorming, TDD, debugging)
2. **BMAD** workflows for structured project work (PRD, architecture, stories)
3. **Local skills** for implementation patterns specific to this codebase

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
LLM_PROVIDER=ollama|vllm|openai|anthropic|llamacpp
OLLAMA_URL / VLLM_URL / OPENAI_API_KEY / ANTHROPIC_API_KEY
LLAMACPP_MODEL=                          # native GGUF model (name or path)
MODELS_DIR=./data/models                 # model cache directory
GPU_BACKEND=auto                         # auto|cuda|rocm|metal|vulkan|cpu
STT_URL=                                 # empty = native whisper-rs
TTS_URL=                                 # empty = native piper-rs
OCR_URL=                                 # empty = native ocrs
AI_URL=http://localhost:3005/api/v1      # AI service URL for voice pipeline

# AI Multimodal Gateway (signapps-ai)
RERANKER_URL=                            # TEI reranking endpoint
COHERE_API_KEY=                          # Cohere cloud reranker
MULTIMODAL_EMBED_URL=                    # SigLIP/CLIP HTTP service
VISION_URL=                              # vLLM/Ollama multimodal endpoint
IMAGEGEN_URL=                            # ComfyUI/A1111 API endpoint
VIDEOGEN_URL=                            # Video generation service
VIDEO_UNDERSTAND_URL=                    # Video analysis service
AUDIOGEN_URL=                            # Audio generation service
REPLICATE_API_KEY=                       # Replicate (video gen, audio gen)
GEMINI_API_KEY=                          # Gemini (video understanding)
AZURE_DOC_ENDPOINT=                      # Azure Document Intelligence
AZURE_DOC_KEY=                           # Azure Document Intelligence key
```

See `.env.example` for the full list including native model paths.

## Préférences de développement

- **Frontend port**: Le serveur de développement frontend doit TOUJOURS être lancé sur le port 3000
- **Authentification Locale**: Pour se connecter rapidement (bypass login manuel ou bugs de session), utilisez l'URL `http://localhost:3000/login?auto=admin`. Il est souvent nécessaire de charger cette URL une première fois, d'attendre environ 2 secondes, puis de la recharger une deuxième fois pour que la session soit bien validée.
