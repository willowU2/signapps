# SignApps Platform - Codebase Analysis Index

This directory contains comprehensive technology stack and integration analysis for the SignApps Platform microservices infrastructure.

## Generated Documents

### 1. STACK.md (Technology Stack)
**397 lines** - Complete breakdown of the programming languages, frameworks, dependencies, and build tools.

**Key Sections**:
- **Languages & Runtimes**: Rust (2021 ed., MSRV 1.75), TypeScript 5, SQL
- **Package Managers**: Cargo (Rust) + npm (Node.js)
- **Web Frameworks**: Axum 0.7 (backend), Next.js 16 (frontend)
- **Key Dependencies**: 50+ critical packages listed with versions and purposes
- **Database**: PostgreSQL with pgvector extension (384-dim embeddings)
- **Build Tools**: Cargo (release profile with LTO), Next.js with Tailwind CSS 4
- **Code Style**: Rust (100 char limit, clippy), TypeScript (strict mode)
- **Testing**: Playwright E2E, tokio-test for backend
- **Architecture Overview**: 9 microservices + 4 shared crates (1000+ lines of detail)

**Purpose**: Planning dependencies, understanding build processes, identifying tech debt

---

### 2. INTEGRATIONS.md (External Services)
**534 lines** - Detailed external service integrations and API connections.

**Key Sections**:

#### AI & LLM Services
- **5 LLM Providers**: Ollama (local), vLLM, OpenAI, Anthropic, local GGUF (llama-cpp-2)
- **Embeddings**: Ollama or HuggingFace-based
- **Configuration**: All via environment variables (pluggable architecture)

#### Media Processing
- **STT (Speech-to-Text)**: Native whisper-rs or HTTP backend
- **TTS (Text-to-Speech)**: Native piper-rs or HTTP backend
- **OCR (Optical Character Recognition)**: Native ocrs or HTTP backend
- **Audio Formats**: MP3, OGG, FLAC, WAV, AAC support via symphonia

#### Storage & Databases
- **PostgreSQL**: Primary data store + pgvector for vector search
- **Filesystem or S3**: File storage via OpenDAL abstraction
- **RAID Management**: Hardware-level redundancy and monitoring
- **Migrations**: 8 SQL migration files tracked in version control

#### Authentication & Security
- **LDAP/Active Directory**: Enterprise SSO integration
- **JWT**: Access + refresh token flow with auto-refresh
- **TOTP/MFA**: Time-based one-time passwords
- **OAuth2**: Framework for delegated auth
- **Argon2**: Memory-hard password hashing

#### Infrastructure
- **Docker API** (bollard): Container lifecycle management
- **Let's Encrypt**: Automatic TLS certificate provisioning
- **Reverse Proxy**: Route management, load balancing, SmartShield rate limiting
- **Prometheus**: Metrics collection and alerting
- **OpenTelemetry**: Distributed tracing infrastructure

#### Real-Time Communication
- **REST API**: JSON with RFC 7807 error handling
- **WebSocket**: Container logs, voice pipelines, real-time updates
- **Server-Sent Events**: Installation progress, job logs

#### Frontend Integration
- **Zustand**: Lightweight state management
- **React Query**: Server state caching and sync
- **Axios**: HTTP client with interceptors (auto JWT refresh)
- **shadcn/ui + Tailwind CSS**: Component framework

**Purpose**: Planning API integrations, understanding third-party dependencies, identifying security boundaries

---

## Quick Reference Tables

Both documents include **Summary Tables** at the end for quick lookups:
- Technology category → specific tool/version → file reference
- Service → config variables → file location
- Integration type → dependencies → entry points

---

## How to Use These Documents

### For Architecture Planning
1. Start with **STACK.md** - "Summary Table" section
2. Review **Microservices Architecture** to understand service separation
3. Check **External Services & Integrations** for API contracts

### For Dependency Management
1. See **STACK.md** - "Key Dependencies" section
2. Find your technology of interest
3. Note the version, purpose, and file location (`Cargo.toml`, `package.json`)

### For Integration Implementation
1. Open **INTEGRATIONS.md**
2. Find the service you need to integrate (LLM, storage, auth, etc.)
3. Check **Config Variables** and **Source** for `.env.example` documentation
4. Find **Integration Point** files to understand the implementation

### For Security Audit
1. Review **INTEGRATIONS.md** - "Authentication & Security" section
2. Check JWT flow, LDAP setup, TLS configuration
3. Verify HTTPS enforcement and rate limiting via SmartShield

### For DevOps/Infrastructure Planning
1. Check **INTEGRATIONS.md** - "Infrastructure" section
2. Review PostgreSQL setup with pgvector
3. Plan Docker deployment with orchestration
4. Configure environment variables from `.env.example`

### For Frontend Development
1. See **STACK.md** - "Frontend Key Dependencies"
2. Review **INTEGRATIONS.md** - "Backend-to-Frontend Communication"
3. Check Axios client setup and Zustand store patterns
4. Understand React Query caching strategy

---

## File Reference Guide

All file paths in these documents use absolute paths with backticks for clarity:

### Root Configuration
- `Cargo.toml` - Workspace definition, dependency versions
- `.env.example` - Environment variable documentation
- `client/package.json` - Frontend dependencies and scripts
- `client/next.config.ts` - Next.js build configuration

### Key Implementation Files
- `client/src/lib/api.ts` - Frontend API client (Axios setup, all API methods)
- `crates/signapps-common/Cargo.toml` - Shared types and middleware
- `crates/signapps-db/Cargo.toml` - Database repositories and models
- `crates/signapps-runtime/Cargo.toml` - Hardware detection and model management
- `services/signapps-ai/Cargo.toml` - LLM and RAG implementation
- `services/signapps-identity/Cargo.toml` - Authentication services
- `services/signapps-containers/Cargo.toml` - Docker API integration
- `services/signapps-proxy/Cargo.toml` - Reverse proxy and TLS
- `services/signapps-storage/Cargo.toml` - File storage and RAID
- `services/signapps-media/Cargo.toml` - STT, TTS, OCR processing
- `services/signapps-metrics/Cargo.toml` - Monitoring and alerting
- `services/signapps-scheduler/Cargo.toml` - Job scheduling
- `services/signapps-securelink/Cargo.toml` - Tunneling and DNS

### Database
- `migrations/` - SQL migration scripts (8 files)

### Configuration
- `client/tsconfig.json` - TypeScript compiler options
- `client/eslint.config.mjs` - ESLint rules
- `.cargo/config.toml` - Cargo aliases and settings
- `rustfmt.toml` - Rust code formatting rules

---

## Statistics

- **Total Analysis Lines**: 931 lines
- **Services Documented**: 9 microservices + 4 shared crates
- **LLM Providers Supported**: 5 (Ollama, vLLM, OpenAI, Anthropic, local GGUF)
- **Media Backends**: 6 (native STT/TTS/OCR + HTTP alternatives)
- **Storage Modes**: 2 (filesystem, S3-compatible)
- **Authentication Methods**: 4 (local, LDAP/AD, OAuth2, JWT/MFA)
- **Database Migrations**: 8 SQL files
- **Frontend Dependencies**: 30+ packages
- **Backend Crates**: 13 (workspace members)

---

## Key Architectural Insights

### Microservices Communication
- **Inter-service**: REST APIs on dedicated ports (3001-3009)
- **Frontend-Backend**: Axios client with JWT auto-refresh
- **Real-time**: WebSocket for logs/voice, SSE for progress
- **Cache**: In-process moka (no external Redis)

### Deployment Flexibility
- **No Docker Required**: All services run natively
- **LLM Provider Agnostic**: Pluggable via env vars
- **Storage Flexible**: Filesystem or S3 with same API
- **Auth Optional**: LDAP/AD, local, or both

### Data Flow
1. **Frontend** (Next.js) → **REST API** (Axum services)
2. **Services** → **PostgreSQL** (with pgvector for embeddings)
3. **AI Service** → **LLM Provider** (Ollama/OpenAI/etc via async-openai)
4. **Media Service** → **Native processors** (whisper-rs, piper-rs, ocrs)
5. **Storage Service** → **OpenDAL** → (Filesystem or S3)
6. **Proxy Service** → **Docker API** (bollard) → Container routing

---

## Notes for Development Team

1. **Environment Setup**: All external services configured via `.env`; no code changes needed
2. **Feature Flags**: Rust features for optional compilation (native-llm, native-stt, etc.)
3. **Performance**: LTO in release builds, Turbopack for frontend, HNSW indexing for vector search
4. **Security**: Argon2 + JWT + TOTP + LDAP + TLS with auto-renewal via Let's Encrypt
5. **Monitoring**: Prometheus + OpenTelemetry stack ready for integration
6. **Testing**: Playwright E2E for frontend, cargo test for backend

---

Generated: February 16, 2026
Codebase: SignApps Platform (microservices infrastructure management)
Repository: https://github.com/signapps/signapps-platform
