# External Integrations

**Analysis Date:** 2026-02-15

## APIs & External Services

**LLM Providers (multi-provider architecture):**
- OpenAI API - GPT models via `async-openai`
  - Auth: `OPENAI_API_KEY` env var
  - Config: `OPENAI_MODEL` (default: gpt-4o-mini)
- Anthropic API - Claude models
  - Auth: `ANTHROPIC_API_KEY` env var
  - Config: `ANTHROPIC_MODEL` (default: claude-3-5-sonnet)
- Ollama - Self-hosted LLM inference
  - URL: `OLLAMA_URL` (default: http://localhost:11434)
  - Config: `OLLAMA_MODEL` (default: llama3.2:3b)
- vLLM - GPU-accelerated inference
  - URL: `VLLM_URL` (default: http://localhost:8000)
  - Config: `VLLM_MODEL`
- Native GGUF - llama-cpp-2 (optional feature)
  - Config: `LLAMACPP_MODEL`, `LLAMACPP_GPU_LAYERS`, `LLAMACPP_CONTEXT_SIZE`
  - GPU backends: CUDA, Metal, Vulkan, ROCm

**Embedding Services:**
- Ollama embeddings (nomic-embed-text)
- TEI (Text Embeddings Inference) - HuggingFace
- Config: `EMBEDDINGS_URL`, `EMBEDDINGS_MODEL`

**HuggingFace:**
- Model downloads for STT/TTS/OCR/LLM
- Auth: `HF_TOKEN` env var (optional, for gated models)

## Data Storage

**Databases:**
- PostgreSQL 16+ with pgvector extension - Primary data store
  - Connection: `DATABASE_URL` env var
  - Client: sqlx 0.7 with compile-time query checking
  - Migrations: `migrations/*.sql` (8 files, sqlx-managed)
  - Pool: PgPoolOptions with 20 max connections
  - Schemas: `identity`, `containers`, `proxy`, `storage`, `ai`, `scheduler`, `securelink`, `documents`

**Vector Storage:**
- pgvector (in PostgreSQL) - 384-dim embeddings with HNSW index
  - Table: `ai.document_vectors`
  - Index: cosine similarity (m=16, ef_construction=64)
  - Migration: `migrations/007_pgvector.sql`

**File Storage:**
- OpenDAL abstraction (filesystem or S3)
  - Filesystem mode: `STORAGE_MODE=fs`, root at `STORAGE_FS_ROOT`
  - S3 mode: `STORAGE_MODE=s3` with `STORAGE_S3_ENDPOINT`, `STORAGE_S3_ACCESS_KEY`, etc.
  - Supports: MinIO, AWS S3, Wasabi, DigitalOcean Spaces

**Caching:**
- moka (in-process Rust cache) - No external Redis needed
  - TTL-based cache + atomic counters
  - Used for: JWT blacklist, rate limiting, general caching
  - Crate: `crates/signapps-cache/`

**Model Cache:**
- Directory: `./data/models/` (configurable via `MODELS_DIR`)
- Subdirectories: `stt/`, `tts/`, `ocr/`, `llm/`, `embeddings/`
- Auto-download with progress polling

## Authentication & Identity

**Auth Provider:**
- Custom JWT implementation - `jsonwebtoken` 9
  - Token types: access (15 min) + refresh (7 days)
  - Algorithm: HS256 (secret-based)
  - Auth: `JWT_SECRET` env var (32+ chars)
  - Crate: `crates/signapps-common/src/auth.rs`

**Password Security:**
- Argon2 hashing - `argon2` 0.5
  - Service: `services/signapps-identity/`

**MFA/2FA:**
- TOTP via `totp-rs` 5 with QR code generation
  - Endpoints: `/auth/mfa/setup`, `/auth/mfa/verify`

**LDAP/Active Directory:**
- `ldap3` 0.11 client (currently stub - not fully implemented)
  - Config: `LDAP_URL`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`, `LDAP_BASE_DN`
  - Features planned: user sync, group sync, admin group mapping

**OAuth2:**
- `oauth2` 4 crate integrated in identity service

**RBAC:**
- Role-based: Admin (role 0), User (role 1), Viewer (role 2)
- Middleware: `auth_middleware`, `require_admin`
- Claims: `sub` (UUID), `username`, `role` (i16)

## Media Processing

**Speech-to-Text (STT):**
- Native: whisper-rs (optional feature `native-stt`)
- External: HTTP backend via `STT_URL`
- Stub fallback when unconfigured

**Text-to-Speech (TTS):**
- Native: piper-rs (optional feature `native-tts`)
- External: HTTP backend via `TTS_URL`
- Stub fallback when unconfigured

**OCR:**
- Native: ocrs + rten (optional feature `native-ocr`)
- External: HTTP backend via `OCR_URL`
- Stub fallback when unconfigured

**Audio Codecs:**
- symphonia 0.5 - MP3, OGG, FLAC, WAV, AAC, PCM

## Container Management

**Docker:**
- bollard 0.16 - Docker Daemon API client
  - Features: container lifecycle, image management, stats, log streaming
  - Service: `services/signapps-containers/`

## Network & TLS

**Reverse Proxy:**
- Hyper 1.4 + Tower - HTTP proxying with TLS termination
- SmartShield rate limiting
- Route caching
- Service: `services/signapps-proxy/`

**Certificate Management:**
- Let's Encrypt: `instant-acme` 0.7 (ACME client)
- Self-signed: `rcgen` 0.13
- TLS: `rustls` 0.23 + `tokio-rustls` 0.26
- Config: `ACME_EMAIL` env var

**Web Tunnels (SecureLink):**
- WebSocket tunneling via `tokio-tungstenite` 0.24
- DNS resolution with ad-blocking via `hickory-resolver` 0.24
- Service: `services/signapps-securelink/`

## Monitoring & Observability

**Metrics:**
- Prometheus 0.13 - metrics collection and export
- sysinfo 0.30 - CPU, memory, disk, network monitoring
- Service: `services/signapps-metrics/`

**Tracing:**
- `tracing` + `tracing-subscriber` with JSON output
- Environment filter: `RUST_LOG=info,signapps=debug,sqlx=warn`
- Request ID propagation via middleware

**OpenTelemetry:**
- `opentelemetry` 0.22 + `opentelemetry-otlp` 0.15 (workspace deps, not yet fully wired)

## CI/CD & Deployment

**CI Pipeline** (`.github/workflows/ci.yml`):
- Triggers: push to main/develop, pull requests
- Steps: check, fmt, clippy (-D warnings), test (PostgreSQL 16 + pgvector), audit, coverage
- Coverage: cargo-llvm-cov -> Codecov

**Release Pipeline** (`.github/workflows/release.yml`):
- Triggers: Git tags (v*)
- Builds: 8 Docker images via Docker Buildx
- Registry: GitHub Container Registry (ghcr.io)

## Environment Configuration

**Development:**
- Required: `DATABASE_URL` (or auto-detected PostgreSQL)
- Required: `JWT_SECRET` (falls back to dev default with warning)
- Optional: `LLM_PROVIDER`, `STORAGE_MODE`, `STT_URL`, `TTS_URL`, `OCR_URL`
- Secrets: `.env` file (gitignored)

**Production:**
- Secrets: environment variables (no .env file)
- All services as Docker containers
- PostgreSQL with pgvector required

## Frontend API Integration

**Client** (`client/src/lib/api.ts`, 2100+ lines):
- Axios-based with per-service base URLs
- JWT auto-refresh on 401
- Token stored in localStorage
- Service URLs from `NEXT_PUBLIC_*_URL` environment variables
- Real-time: SSE for install progress, WebSocket for voice pipeline

---

*Integration audit: 2026-02-15*
*Update when adding/removing external services*
