# SignApps Platform - External Integrations & Services

## LLM & AI Inference

### Primary LLM Providers
All providers are configured via environment variables and runtime selection in `services/signapps-ai/Cargo.toml` and `services/signapps-ai/src/main.rs`.

#### 1. Ollama (Local, CPU-friendly)
- **Type**: Local inference server
- **Config Variables**:
  - `OLLAMA_URL=http://localhost:11434`
  - `OLLAMA_MODEL=llama3.2:3b`
  - `LLM_PROVIDER=ollama`
- **Default**: Yes (recommended for development)
- **Features**: Works on CPU, fast iteration
- **Source**: `.env.example` (lines 26-30)
- **Backend Integration**: `services/signapps-ai/Cargo.toml` uses `async-openai` 0.20 for OpenAI-compatible API

#### 2. vLLM (GPU Inference Server)
- **Type**: High-performance LLM serving (GPU-required)
- **Config Variables**:
  - `VLLM_URL=http://vllm:8000`
  - `VLLM_MODEL=meta-llama/Llama-3.2-3B-Instruct`
  - `LLM_PROVIDER=vllm`
- **Use Case**: Production deployments with GPU
- **Source**: `.env.example` (lines 32-35)

#### 3. OpenAI API (Cloud)
- **Type**: Commercial API
- **Config Variables**:
  - `OPENAI_API_KEY=sk-...`
  - `OPENAI_MODEL=gpt-4o-mini`
  - `LLM_PROVIDER=openai`
- **Use Case**: Production with managed service
- **Source**: `.env.example` (lines 37-39)

#### 4. Anthropic API (Cloud)
- **Type**: Commercial API
- **Config Variables**:
  - `ANTHROPIC_API_KEY=sk-ant-...`
  - `ANTHROPIC_MODEL=claude-3-5-sonnet-20241022`
  - `LLM_PROVIDER=anthropic`
- **Use Case**: Production with Anthropic models
- **Source**: `.env.example` (lines 41-43)

#### 5. Local GGUF (llama-cpp-2)
- **Type**: Native local inference
- **Config Variables**:
  - `LLAMACPP_MODEL=` (model name or path to GGUF file)
  - `LLAMACPP_GPU_LAYERS=auto` (number of GPU layers, or "auto")
  - `LLAMACPP_CONTEXT_SIZE=4096` (context window size)
- **Features**: Native performance, no external service required
- **Source**: `.env.example` (lines 62-65)
- **Dependency**: `llama-cpp-2` 0.1 (optional feature) - `services/signapps-ai/Cargo.toml` line 39

### Embeddings Service
- **Config**: `EMBEDDINGS_URL=http://localhost:11434`, `EMBEDDINGS_MODEL=nomic-embed-text`
- **Default**: Ollama (same as LLM provider)
- **Alternative**: External TEI (Text Embeddings Inference)
- **Purpose**: 384-dimensional vector embeddings for RAG/vector search
- **Storage**: pgvector extension in PostgreSQL
- **Source**: `.env.example` (lines 29-30)

### Model Downloads & HuggingFace
- **HuggingFace Token**: `HF_TOKEN=your_huggingface_token`
- **Purpose**: Download models from HuggingFace Hub for vLLM
- **Source**: `.env.example` (line 23)

**Integration Point**: `services/signapps-ai/src/main.rs` and `services/signapps-ai/src/rag/pipeline.rs`

---

## Media Processing Services

### Speech-to-Text (STT)

#### Native Backend
- **Engine**: `whisper-rs` 0.15 (Whisper.cpp bindings)
- **Config Variable**: `STT_URL=` (leave empty to use native)
- **Model Selection**: `STT_MODEL=medium` (options: base, small, medium, large-v3)
- **Default**: Native whisper-rs
- **Feature Flag**: `native-stt` - `services/signapps-media/Cargo.toml` line 84
- **GPU Support**: CUDA and Metal via feature flags
- **Source**: `services/signapps-media/Cargo.toml` (line 67), `.env.example` (lines 48-56)

#### Remote Backend
- **Config**: `STT_URL=http://localhost:8100` (when set, uses HTTP backend)
- **API Format**: Expects OpenAI-compatible transcribe endpoint
- **Source**: `.env.example` (line 50 comment)

### Text-to-Speech (TTS)

#### Native Backend
- **Engine**: `piper-rs` 0.1 (ONNX-based TTS)
- **Config Variable**: `TTS_URL=` (leave empty to use native)
- **Voice Selection**: `TTS_VOICE=fr_FR-siwis-medium` (language-specific voices)
- **Default**: Native piper-rs
- **Feature Flag**: `native-tts` - `services/signapps-media/Cargo.toml` line 85
- **Source**: `services/signapps-media/Cargo.toml` (line 74), `.env.example` (lines 56)

#### Remote Backend
- **Config**: `TTS_URL=http://localhost:10200` (when set, uses HTTP backend)
- **Source**: `.env.example` (line 51 comment)

### Optical Character Recognition (OCR)

#### Native Backend
- **Engine**: `ocrs` 0.11 + `rten` 0.22 (inference runtime)
- **Config Variable**: `OCR_URL=` (leave empty to use native)
- **Default**: Native ocrs
- **Feature Flag**: `native-ocr` - `services/signapps-media/Cargo.toml` line 86
- **Image Support**: Handled via `image` 0.25 crate
- **Source**: `services/signapps-media/Cargo.toml` (lines 77-80), `.env.example` (line 52)

#### Remote Backend
- **Config**: `OCR_URL=http://localhost:8101` (when set, uses HTTP backend)
- **Source**: `.env.example` (line 52 comment)

### Audio Format Support
- **Decoding**: `symphonia` 0.5 (MP3, OGG, FLAC, WAV, PCM, AAC)
- **WAV I/O**: `hound` 3.5
- **Purpose**: Normalize audio formats to PCM for processing
- **Source**: `services/signapps-media/Cargo.toml` (lines 70-71)

### Media Processing Integration
- **Voice WebSocket Pipeline**: AI service communicates with media service via WebSocket
- **Config**: `AI_URL=http://localhost:3005/api/v1` (voice pipeline endpoint)
- **Streaming**: xterm.js on frontend + Server-Sent Events for progress
- **Source**: `services/signapps-media/src/main.rs`, `client/src/components/layout/ai-chat-bar.tsx`

**Integration Point**: `services/signapps-media/src/main.rs`, `services/signapps-ai/src/handlers/chat.rs`

---

## Database & Vector Storage

### PostgreSQL
- **Connection**: `DATABASE_URL=postgres://signapps:password@localhost:5432/signapps`
- **Auto-detection**: Checked via pg_isready if DATABASE_URL not set
- **Features**:
  - Full ACID compliance
  - Native JSON support
  - UUID type support
  - Transactions with savepoints

**Integration Point**: All services via `signapps-db` crate

### pgvector Extension
- **Version**: Via `pgvector` 0.3 Rust crate
- **Dimensions**: 384-dim embeddings (standard for embeddings)
- **Index Type**: HNSW (Hierarchical Navigable Small World) for fast similarity search
- **Schema**: Created in migration `migrations/007_pgvector.sql`
- **Purpose**: Store and query embeddings for RAG (knowledge base)
- **Collections**: Knowledge base collections per `migrations/008_collections.sql`

**Integration Point**: `services/signapps-ai/src/rag/pipeline.rs`, `crates/signapps-db/repositories.rs`

### Database Migrations
All migrations are SQL scripts in `migrations/` directory, run automatically on service startup:
1. `001_initial_schema.sql` - Core tables (users, groups, containers, etc.)
2. `002_add_columns.sql` - Schema extensions
3. `003_app_store.sql` - Application marketplace
4. `004_app_install_groups.sql` - Multi-service installations
5. `005_add_backups.sql` - Backup metadata
6. `006_proxy_certificates.sql` - TLS certificates
7. `007_pgvector.sql` - Vector embeddings
8. `008_collections.sql` - Knowledge base collections

**Integration Point**: `crates/signapps-runtime/src/db.rs` - `ensure_database()` and `run_migrations()`

---

## File Storage

### Filesystem (Default)
- **Mode**: `STORAGE_MODE=fs`
- **Root Directory**: `STORAGE_FS_ROOT=./data/storage`
- **Provider**: OpenDAL filesystem backend
- **Use Case**: Development, single-server deployments

**Integration Point**: `services/signapps-storage/src/main.rs`, configured via `opendal` 0.51

### S3-Compatible Storage
- **Mode**: `STORAGE_MODE=s3`
- **Config Variables**:
  - `STORAGE_S3_ENDPOINT=http://localhost:9000` (MinIO, AWS S3, etc.)
  - `STORAGE_S3_ACCESS_KEY=signapps`
  - `STORAGE_S3_SECRET_KEY=your_s3_secret`
  - `STORAGE_S3_REGION=us-east-1`
  - `STORAGE_S3_BUCKET=signapps`
- **Use Case**: Scalable, multi-server, cloud deployments
- **Supported Services**: MinIO, AWS S3, DigitalOcean Spaces, etc.

**Integration Point**: `services/signapps-storage/src/main.rs`, configured via `opendal` 0.51

### RAID Management
- **Hardware Detection**: Via `sysinfo` 0.30
- **SMART Data**: Health monitoring
- **Supported Levels**: RAID0, RAID1, RAID5, RAID6, RAID10, RAIDZ, RAIDZ2
- **Purpose**: Data protection and performance
- **API Endpoints**: `/raid/arrays`, `/raid/disks`, `/raid/health`

**Integration Point**: `services/signapps-storage/src/handlers/raid.rs`, `client/src/lib/api.ts`

---

## Authentication & Authorization

### Local Authentication
- **Password Hashing**: `argon2` 0.5 (memory-hard, slow-by-design)
- **Credential Validation**: Username + password
- **Storage**: PostgreSQL (hashed passwords)

**Integration Point**: `services/signapps-identity/src/handlers/auth.rs`

### LDAP / Active Directory
- **Protocol**: LDAP v3
- **Config Variables**:
  - `LDAP_URL=ldap://your-dc.domain.local:389`
  - `LDAP_BIND_DN=CN=service,OU=Services,DC=domain,DC=local`
  - `LDAP_BIND_PASSWORD=your_ldap_password`
  - `LDAP_BASE_DN=DC=domain,DC=local`
  - Optional: `LDAP_USER_FILTER`, `LDAP_GROUP_FILTER`, `LDAP_ADMIN_GROUPS`, `LDAP_USE_TLS`, `LDAP_SKIP_TLS_VERIFY`, `LDAP_SYNC_INTERVAL_MINUTES`
- **Client Library**: `ldap3` 0.11
- **Use Case**: Enterprise SSO, directory sync
- **Features**: User filter, group mapping, admin groups, TLS optional, periodic sync

**Integration Point**: `services/signapps-identity/src/handlers/ldap.rs`, `client/src/lib/api.ts`

### OAuth2
- **Library**: `oauth2` 4
- **Supported Flows**: Authorization Code (implicit)
- **Purpose**: Delegated authentication to third-party providers
- **Scope**: Can integrate with GitHub, Google, Azure AD, etc.

**Integration Point**: `services/signapps-identity/src/handlers/oauth.rs` (if implemented)

### JWT (JSON Web Tokens)
- **Library**: `jsonwebtoken` 9
- **Config**: `JWT_SECRET=your_jwt_secret_32_chars_minimum` (32+ characters)
- **Token Components**: `sub` (user UUID), `username`, `role` (i16)
- **Refresh Tokens**: Stored in PostgreSQL, blacklist in moka cache
- **Extraction**: Via `Claims` struct in auth middleware
- **Flow**:
  1. Login → Access token + Refresh token
  2. API requests → Bearer token in Authorization header
  3. Token expiry → Refresh endpoint (axios interceptor handles auto-refresh)
  4. Logout → Token blacklist

**Integration Points**:
- Backend: `crates/signapps-common/src/auth.rs` (middleware)
- Frontend: `client/src/lib/api.ts` (lines 14-76, interceptors)

### Multi-Factor Authentication (MFA)
- **Type**: TOTP (Time-based One-Time Password)
- **Library**: `totp-rs` 5 (with QR code generation)
- **Flow**:
  1. `/auth/mfa/setup` → Returns secret + QR code + backup codes
  2. User scans QR in authenticator app (Google Authenticator, Authy, etc.)
  3. Login with MFA → Receive MFA session token
  4. `/auth/mfa/verify` → Verify TOTP code → Get auth tokens
- **Backup Codes**: Generated for account recovery

**Integration Point**: `services/signapps-identity/src/handlers/mfa.rs`

**Frontend Integration**: `client/src/lib/api.ts` (lines 105-108)

---

## Container Management

### Docker API
- **Client Library**: `bollard` 0.16 (async Docker daemon client)
- **Features**:
  - List/inspect containers
  - Create/start/stop/restart/remove
  - Logs streaming (tail support)
  - Stats collection (CPU, memory, network)
  - Image pull/remove
  - Health checks
  - Volume management
  - Network configuration
- **Communication**: Docker daemon socket (unix or TCP)
- **Auto-update**: Check for new image digests

**Integration Point**: `services/signapps-containers/src/handlers/containers.rs`

### Docker Compose Parsing
- **Library**: `serde_yaml` 0.9
- **Purpose**: Parse docker-compose.yml files for app store
- **Features**: Multi-service parsing, environment variables, port mapping, volume binding
- **Use Case**: App store installs from compose files

**Integration Point**: `services/signapps-containers/src/handlers/compose.rs`

### Container Monitoring
- **Stats Collection**: CPU %, memory usage, network I/O
- **Frontend**: Real-time display via `recharts` for visualization

**Integration Point**: `services/signapps-containers/src/handlers/stats.rs`

---

## Reverse Proxy & TLS

### Let's Encrypt (ACME)
- **Library**: `instant-acme` 0.7 (async ACME client)
- **Config**: `ACME_EMAIL=admin@yourdomain.com`
- **Features**:
  - Automatic certificate provisioning
  - Certificate renewal (handles lifecycle)
  - Wildcard certificate support
  - ACME challenge handling
- **Use Case**: Zero-cost HTTPS for exposed routes
- **Integration**: Integrated with `services/signapps-proxy`

**Integration Point**: `services/signapps-proxy/src/handlers/certificates.rs`

### TLS/SSL Configuration
- **Library**: `rustls` 0.23 (modern TLS)
- **Features**:
  - Self-signed certificate generation via `rcgen` 0.13
  - Certificate parsing via `rustls-pemfile` 2
  - Configurable TLS versions (1.2/1.3 minimum)
  - Force HTTPS redirect
- **Storage**: PostgreSQL
- **Per-Route**: TLS can be enabled/disabled per route

**Integration Point**: `services/signapps-proxy/src/handlers/tls.rs`, `services/signapps-proxy/src/http_server.rs`

### Reverse Proxy Routing
- **Purpose**: Route external requests to internal services
- **Features**:
  - Path-based routing
  - Host-based routing
  - Load balancing (multiple targets)
  - Header modification
  - Static file serving
  - Request/response rewriting
- **SmartShield**: Rate limiting + geo-blocking
  - `moka` cache for rate limit tracking
  - Country code filtering

**Integration Point**: `services/signapps-proxy/src/handlers/routes.rs`

---

## Monitoring & Metrics

### Prometheus
- **Library**: `prometheus` 0.13
- **Metrics Types**: Counter, Gauge, Histogram, Summary
- **Endpoint**: `/metrics` (standard Prometheus format)
- **Scrape Interval**: Configurable (default 15s recommended)
- **Use Case**: Long-term metric storage + Grafana dashboards

**Integration Point**: `services/signapps-metrics/src/handlers/metrics.rs`

### OpenTelemetry
- **Library**: `opentelemetry` 0.22 + `opentelemetry-otlp` 0.15
- **Exporters**: OTLP (OpenTelemetry Protocol)
- **Signals**: Traces, metrics, logs
- **Use Case**: Distributed tracing, centralized observability

**Integration Point**: `services/signapps-metrics/src/main.rs`

### System Metrics
- **CPU Usage**: Per-core utilization
- **Memory**: Total, used, available, swap
- **Disk**: Per-mount-point utilization
- **Network**: Bytes sent/received, packets
- **Uptime**: System boot time
- **Hardware**: Via `sysinfo` 0.30

**Integration Point**: `services/signapps-metrics/src/handlers/system.rs`

### Alerts
- **Types**: CPU, memory, disk, network thresholds
- **Conditions**: Above/below threshold for X seconds
- **Actions**: Email, webhook, browser notification
- **State**: Triggered, acknowledged, resolved
- **History**: Stored in PostgreSQL

**Integration Point**: `services/signapps-metrics/src/handlers/alerts.rs`

---

## Job Scheduling

### CRON Scheduler
- **Purpose**: Schedule container backups, cleanups, health checks
- **Features**:
  - CRON expressions (standard format)
  - Per-job enable/disable
  - Manual trigger
  - Execution history with logs
  - Target: Container or host command
- **Execution**: Tokio async runtime

**Integration Point**: `services/signapps-scheduler/src/handlers/jobs.rs`

---

## DNS & Tunneling

### SecureLink (Web Tunnels)
- **Purpose**: Expose local services securely without VPN
- **Features**:
  - Local address → public subdomain mapping
  - Multiple relay support
  - Traffic statistics
  - Persistent connections (auto-reconnect)

**Integration Point**: `services/signapps-securelink/src/handlers/tunnels.rs`

### DNS Management
- **Features**:
  - Custom DNS records (A, AAAA, CNAME, TXT)
  - Ad-blocking via blocklists
  - Query statistics
  - Upstream resolver configuration
- **Blocklists**: Updatable via URL, entry counts tracked

**Integration Point**: `services/signapps-securelink/src/handlers/dns.rs`

---

## Backend-to-Frontend Communication

### REST API
- **Format**: JSON + standard HTTP methods
- **Status Codes**: RFC 7807 Problem Details
- **Auth**: JWT Bearer tokens in Authorization header
- **Error Format**: `{ type, title, detail, status, instance }`

**Clients**: `client/src/lib/api.ts` (Axios-based)

### Server-Sent Events (SSE)
- **Purpose**: Server-to-client streaming (one-way)
- **Use Cases**:
  - Container installation progress
  - Job execution logs
  - Real-time statistics
- **Implementation**: EventSource API on client

**Integration Point**: `client/src/hooks/use-sse.ts`

### WebSocket
- **Protocol**: ws:// / wss://
- **Use Cases**:
  - Container terminal logs (xterm.js)
  - Real-time metrics
  - Voice input/output (media service)
- **Library**: `axum` with `ws` feature

**Integration Point**: Voice pipeline in `services/signapps-media/src/main.rs`

---

## Caching & Rate Limiting

### In-Process Cache (moka)
- **Library**: `moka` 0.12
- **Purpose**: Token blacklist, rate limit tracking, session cache
- **TTL-based**: Automatic expiration
- **Features**: Atomic counters, concurrent access
- **Benefits**: No external Redis dependency

**Integration Points**:
- JWT blacklist: `services/signapps-identity/src/cache.rs`
- Rate limiting: `services/signapps-proxy/src/shield.rs`

---

## Frontend State Management

### Zustand
- **Library**: `zustand` 5.0.11
- **Stores**: Auth, containers, routes, storage, AI chat
- **Persistence**: localStorage integration
- **Selectors**: Optimized re-renders

**Integration Point**: `client/src/lib/store.ts`, `client/src/hooks/*.ts`

### React Query (@tanstack/react-query)
- **Library**: `@tanstack/react-query` 5.90.20
- **Purpose**: Server state caching + synchronization
- **Features**: Automatic refetch, background updates, optimistic updates
- **Integration**: Works with axios client in `client/src/lib/api.ts`

**Integration Point**: `client/src/app/dashboard/page.tsx`, `client/src/components/dashboard/*.tsx`

---

## Frontend UI Framework

### Tailwind CSS + shadcn/ui
- **Framework**: Tailwind CSS 4 + PostCSS
- **Component Library**: shadcn/ui (Radix UI primitives)
- **Icon Library**: lucide-react
- **Features**: Dark mode via `next-themes`, responsive grid layout

**Integration Point**: `client/src/components/`, `client/styles/globals.css`

---

## Summary Integration Matrix

| Category | Service/Provider | Config Key(s) | File Reference |
|----------|-----------------|---|---|
| **LLM** | Ollama | OLLAMA_URL, OLLAMA_MODEL | `.env.example`, `services/signapps-ai/Cargo.toml` |
| **LLM** | vLLM | VLLM_URL, VLLM_MODEL | `.env.example` |
| **LLM** | OpenAI | OPENAI_API_KEY, OPENAI_MODEL | `.env.example` |
| **LLM** | Anthropic | ANTHROPIC_API_KEY, ANTHROPIC_MODEL | `.env.example` |
| **LLM** | Local GGUF | LLAMACPP_MODEL, LLAMACPP_GPU_LAYERS | `.env.example`, `services/signapps-ai/Cargo.toml` |
| **Embeddings** | Ollama/TEI | EMBEDDINGS_URL, EMBEDDINGS_MODEL | `.env.example` |
| **STT** | whisper-rs (native) | STT_MODEL | `.env.example`, `services/signapps-media/Cargo.toml` |
| **STT** | Remote HTTP | STT_URL | `.env.example` |
| **TTS** | piper-rs (native) | TTS_VOICE | `.env.example`, `services/signapps-media/Cargo.toml` |
| **TTS** | Remote HTTP | TTS_URL | `.env.example` |
| **OCR** | ocrs (native) | (none, auto-detect) | `services/signapps-media/Cargo.toml` |
| **OCR** | Remote HTTP | OCR_URL | `.env.example` |
| **Database** | PostgreSQL | DATABASE_URL | `.env.example`, all services |
| **Vector DB** | pgvector | (via DATABASE_URL) | `migrations/007_pgvector.sql`, `services/signapps-ai/Cargo.toml` |
| **Storage** | Filesystem | STORAGE_MODE, STORAGE_FS_ROOT | `.env.example`, `services/signapps-storage/Cargo.toml` |
| **Storage** | S3 | STORAGE_S3_* | `.env.example`, `services/signapps-storage/Cargo.toml` |
| **Auth** | LDAP/AD | LDAP_* | `.env.example`, `services/signapps-identity/Cargo.toml` |
| **Auth** | JWT | JWT_SECRET | `.env.example`, all services |
| **Auth** | TOTP/MFA | (none, auto-enable) | `services/signapps-identity/Cargo.toml`, `client/src/lib/api.ts` |
| **TLS** | Let's Encrypt | ACME_EMAIL | `.env.example`, `services/signapps-proxy/Cargo.toml` |
| **Container** | Docker | (daemon socket) | `services/signapps-containers/Cargo.toml` |
| **Monitoring** | Prometheus | (standard endpoint) | `services/signapps-metrics/Cargo.toml` |
| **Metrics** | System | (via sysinfo) | `services/signapps-metrics/Cargo.toml` |
| **Voice** | WebSocket | AI_URL | `.env.example`, `services/signapps-media/Cargo.toml` |
