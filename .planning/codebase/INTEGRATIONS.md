# External Integrations

**Analysis Date:** 2026-02-16

## APIs & External Services

**LLM Providers (Multi-Pluggable):**
- Ollama - Local/remote LLM inference (optional)
  - SDK: HTTP client in `services/signapps-ai/src/llm/ollama.rs`
  - Config: OLLAMA_URL env var
  - Used for: Chat, completions, embeddings

- vLLM - High-performance LLM serving
  - SDK: HTTP client in `services/signapps-ai/src/llm/vllm.rs`
  - Config: VLLM_URL env var
  - Used for: Batch inference

- OpenAI API - Cloud-based LLM
  - SDK: reqwest HTTP client
  - Config: OPENAI_API_KEY env var
  - Used for: GPT-4, GPT-3.5 inference

- Anthropic API - Claude models
  - SDK: reqwest HTTP client
  - Config: ANTHROPIC_API_KEY env var
  - Used for: Claude model inference

- Local GGUF - Native GGUF model support
  - SDK: llama-cpp-rs
  - Config: LLAMACPP_MODEL (name or path)
  - Used for: On-device inference without external service

**Media Processing:**
- Whisper (Native via whisper-rs) - Speech-to-text
  - SDK: whisper-rs crate
  - Config: Empty STT_URL = use native, else HTTP fallback
  - Used in: `services/signapps-media/src/main.rs`

- Piper (Native via piper-rs) - Text-to-speech
  - SDK: piper-rs crate
  - Config: Empty TTS_URL = use native, else HTTP fallback
  - Used in: `services/signapps-media/src/main.rs`

- OCRS (Native) - Optical character recognition
  - SDK: ocrs + rten crate
  - Config: Empty OCR_URL = use native, else HTTP fallback
  - Used in: `services/signapps-media/src/main.rs`

## Data Storage

**Databases:**
- PostgreSQL 13+ - Primary data store
  - Connection: DATABASE_URL env var (auto-detected if not set)
  - Client: SQLx 0.7 with compile-time query verification
  - Migrations: `migrations/` directory (8 migration files)
  - Extensions: pgvector 0.3 for vector similarity search

**File Storage:**
- Filesystem (default) or S3-compatible storage
  - SDK: OpenDAL abstraction layer
  - Config: STORAGE_MODE (fs or s3), STORAGE_FS_ROOT or S3_* vars
  - Used in: `services/signapps-storage/src/main.rs`

**Vector Storage:**
- PostgreSQL with pgvector extension
  - Config: Automatic (pgvector installed in migrations)
  - Dimensions: 384-dim embeddings
  - Index: HNSW for similarity search
  - Used in: `services/signapps-ai/src/vectors/` for embeddings storage

**Caching:**
- moka in-process TTL cache (replaces Redis)
  - Config: In-memory, no external service
  - Used in: `crates/signapps-cache/src/lib.rs`
  - Purpose: JWT blacklist, rate limiting counters

## Authentication & Identity

**Local Auth:**
- Argon2 password hashing
  - Implementation: `crates/signapps-common/src/auth.rs`
  - Used for: User registration, login

**LDAP/Active Directory:**
- SDK: ldap3 crate (configured but not fully implemented)
  - Config: LDAP_SERVER, LDAP_BIND_DN, LDAP_BASE_DN env vars
  - Status: Handler stubbed, requires completion
  - Used in: `services/signapps-identity/src/auth/ldap.rs`

**JWT Authentication:**
- HS256 or RS256 signing
  - Config: JWT_SECRET env var
  - Tokens: Stored in localStorage (frontend), httpOnly cookies (server)
  - Refresh: Auto-refresh on 401 via `client/src/lib/api.ts`

**MFA/TOTP:**
- Time-based One-Time Password
  - Implementation: `services/signapps-identity/src/auth/mfa.rs`
  - Used for: Second-factor authentication

## Container Management

**Docker API:**
- Bollard 0.16 - Docker client
  - Config: DOCKER_HOST env var (default: unix socket)
  - Used in: `services/signapps-containers/src/main.rs`
  - Operations: Container lifecycle, image management, compose

## Monitoring & Observability

**Metrics:**
- Prometheus 0.13 - Metrics collection
  - Config: Service exposes metrics at `/metrics`
  - Used in: `services/signapps-metrics/src/main.rs`

**Tracing:**
- OpenTelemetry 0.22 - Distributed tracing
  - Config: Via tower-http TraceLayer middleware
  - Used in: All service `main.rs` files

**Logging:**
- Structured logging to stdout
  - Format: JSON-compatible (parse via logging aggregators)
  - Used in: All services via tracing middleware

## TLS & Security

**ACME (Let's Encrypt):**
- Automatic SSL certificate provisioning
  - SDK: rustls 0.23 + ACME client
  - Config: ACME_EMAIL env var
  - Used in: `services/signapps-proxy/src/main.rs`

**Rate Limiting:**
- SmartShield (custom implementation)
  - Config: In `services/signapps-proxy/src/main.rs`
  - Backend: moka cache for counter storage

## Environment Configuration

**Development:**
- Required env vars: DATABASE_URL, JWT_SECRET, LLM_PROVIDER
- Mock services: Local PostgreSQL, Ollama, local GGUF models
- Secrets location: `.env` file (gitignored)
- Model cache: `./data/models/` (auto-created)

**Staging:**
- Separate PostgreSQL instance
- Same external service configs as production
- Optional: Reduced rate limits for testing

**Production:**
- Secrets: Environment variables in deployment platform
- Database: Managed PostgreSQL with backups
- Object storage: S3-compatible if configured
- Models: Cached in persistent `/data/models/` volume

## Webhooks & Callbacks

**Incoming (AI Service):**
- Document processing webhooks (placeholder)
  - Endpoint: `POST /api/v1/webhooks/documents`
  - Format: JSON payload with document metadata
  - Used in: `services/signapps-ai/src/handlers/` (stubbed)

## Hardware Acceleration

**GPU Detection:**
- Auto-detection of NVIDIA, AMD, Intel, Apple GPU
- Config: GPU_BACKEND env var (auto|cuda|rocm|metal|vulkan|cpu)
- Used in: `crates/signapps-runtime/src/gpu.rs`
- Impact: LLM model quantization and offloading

---

*Integration audit: 2026-02-16*
*Update when adding/removing external services*
