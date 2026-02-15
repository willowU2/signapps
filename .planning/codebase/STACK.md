# Technology Stack

**Analysis Date:** 2026-02-15

## Languages

**Primary:**
- Rust (Edition 2021, MSRV 1.75) - All backend services and shared crates
- TypeScript 5 (strict mode) - Frontend application

**Secondary:**
- SQL (PostgreSQL 16+ with pgvector) - Migrations in `migrations/*.sql`
- JavaScript - Build scripts, config files

## Runtime

**Environment:**
- Rust (tokio async runtime) - 9 backend microservices
- Node.js (Latest LTS) - Next.js 16 frontend
- No browser runtime for backend (server-only)

**Package Managers:**
- Cargo - Rust workspace with centralized dependency versions (`Cargo.toml`)
- npm - Frontend dependencies (`client/package-lock.json`)
- Lockfiles: `Cargo.lock` and `client/package-lock.json` present

## Frameworks

**Core:**
- Axum 0.7 - Web framework for all Rust services
- Tokio 1.36 - Async runtime (full features)
- Next.js 16.1.6 (App Router) - Frontend framework
- React 19.2.3 - UI library

**Testing:**
- cargo test + tokio-test 0.4 - Rust unit/integration tests
- Playwright 1.58.2 - E2E browser tests (Chromium, Firefox, WebKit, mobile)

**Build/Dev:**
- Turbopack - Next.js bundler with WASM aliases
- rustfmt + clippy - Rust formatting and linting
- ESLint 9 (flat config) - TypeScript linting
- cargo-llvm-cov - Code coverage (Codecov integration)

## Key Dependencies

**Critical (Rust):**
- `sqlx` 0.7 - SQL with compile-time checking (postgres, uuid, chrono, json)
- `pgvector` 0.3 - PostgreSQL vector type (384-dim embeddings, HNSW index)
- `jsonwebtoken` 9 - JWT authentication
- `argon2` 0.5 - Password hashing
- `reqwest` 0.12 - HTTP client
- `serde`/`serde_json` 1.0 - Serialization
- `moka` 0.12 - In-process TTL cache (replaces Redis)
- `opendal` 0.51 - Unified storage (filesystem + S3)
- `bollard` 0.16 - Docker API client

**AI/ML (Rust, optional features):**
- `async-openai` 0.20 - OpenAI-compatible API client (vLLM/OpenAI/Ollama)
- `llama-cpp-2` 0.1 - Native GGUF model inference (CUDA/Metal/Vulkan)
- `whisper-rs` 0.15 - Speech-to-text (whisper.cpp bindings)
- `piper-rs` 0.1 - Text-to-speech (Piper ONNX)
- `ocrs` 0.11 + `rten` 0.22 - OCR with neural network inference

**Infrastructure (Rust):**
- `tracing` 0.1 + `tracing-subscriber` 0.3 - Structured logging
- `prometheus` 0.13 - Metrics collection
- `rustls` 0.23 + `instant-acme` 0.7 - TLS + Let's Encrypt
- `ldap3` 0.11 - LDAP/Active Directory
- `totp-rs` 5 - TOTP/MFA
- `hickory-resolver` 0.24 - DNS with ad-blocking

**Critical (Frontend):**
- `zustand` 5.0.11 - State management
- `axios` 1.13.5 - HTTP client with JWT interceptors
- `@tanstack/react-query` 5.90.20 - Server state management
- `react-hook-form` 7.71.1 + `zod` 4.3.6 - Form handling + validation
- `recharts` 3.7.0 - Charts
- `xterm` 5.3.0 - Terminal emulator (container logs)
- `sonner` 2.0.7 - Toast notifications
- `shadcn` 3.8.4 + `radix-ui` 1.4.3 - Component library
- Tailwind CSS 4 - Styling

## Configuration

**Environment:**
- `.env` files loaded via `dotenvy::dotenv()` in all Rust services
- `SERVER_PORT` set per service (not in .env to avoid conflicts)
- Key env vars: `DATABASE_URL`, `JWT_SECRET`, `STORAGE_MODE`, `LLM_PROVIDER`
- Frontend: `NEXT_PUBLIC_*_URL` for per-service API base URLs

**Build:**
- `rustfmt.toml` - Rust formatting (100 char width, crate-level imports)
- `clippy.toml` - Linting thresholds (complexity=30, lines=150, args=8)
- `.cargo/config.toml` - Cargo aliases (`c`, `t`, `lint`, `fmtall`)
- `client/tsconfig.json` - TypeScript (ES2017, strict, `@/*` path alias)
- `client/next.config.ts` - Turbopack WASM aliases
- `client/eslint.config.mjs` - ESLint 9 flat config

## Platform Requirements

**Development:**
- Windows/macOS/Linux with Rust toolchain 1.75+
- PostgreSQL 16+ with pgvector extension
- Node.js LTS for frontend
- Optional: Docker for container management features
- Optional: GPU (NVIDIA/AMD/Intel/Apple) for native AI inference

**Production:**
- GitHub Container Registry (ghcr.io) - 8 Docker images
- Release profile: LTO + single codegen unit + panic=abort + strip
- GitHub Actions CI/CD (`ci.yml`, `release.yml`)

---

*Stack analysis: 2026-02-15*
*Update after major dependency changes*
