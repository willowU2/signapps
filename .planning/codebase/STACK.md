# Technology Stack

**Analysis Date:** 2026-02-16

## Languages

**Primary:**
- Rust 1.75+ (Edition 2021, MSRV 1.75) - All backend microservices
- TypeScript 5 (strict mode) - All frontend code

**Secondary:**
- SQL - Database migrations and queries via SQLx
- JavaScript - Build configuration, scripts

## Runtime

**Environment:**
- Tokio 1.36+ - Async runtime for all Rust services
- Node.js (via Next.js 16) - Frontend development and build
- Native OS support (Linux, macOS, Windows) - no Docker required

**Package Manager:**
- Cargo - Rust package management with Cargo.lock
- npm - Frontend with package-lock.json

## Frameworks

**Core:**
- Axum 0.7 - Web server framework for all 9 microservices
- Next.js 16 - Frontend framework with React 19

**Testing:**
- Rust `#[cfg(test)]` + `#[tokio::test]` - Unit tests in-place
- Playwright - E2E tests (`client/e2e/`)

**Build/Dev:**
- Cargo (rustfmt, clippy) - Rust compilation and linting
- TypeScript compiler - Type checking
- Tailwind CSS 4 - Frontend styling
- Turbopack - Frontend build bundler

## Key Dependencies

**Rust Backend:**
- `sqlx 0.7` - Database access with compile-time verification
- `jsonwebtoken 9` - JWT auth with HS256/RS256 support
- `pgvector 0.3` - PostgreSQL vector operations (384-dim HNSW)
- `bollard 0.16` - Docker API client
- `opendal 0.45` - Storage abstraction (FS or S3)
- `whisper-rs 1.3` - Native speech-to-text
- `piper-rs 0.2` - Native text-to-speech
- `ocrs 0.3` - Native OCR with rten
- `llama-cpp-rs 0.2` - Local GGUF model inference
- `moka 0.12` - In-process TTL cache (replaces Redis)

**TypeScript Frontend:**
- `axios 1.6` - HTTP client with auth interceptors
- `zustand 4` - State management with persistence
- `react-hook-form 7` - Form handling
- `zod 3` - Schema validation
- `shadcn/ui` - Component library built on Radix UI
- `next-auth 5` (if configured) - Authentication

## Configuration

**Environment:**
- `.env` / `.env.example` - Environment variables
- `SERVER_PORT` - Service port (via environment, not .env)
- Required configs: DATABASE_URL, JWT_SECRET, LLM_PROVIDER

**Build:**
- `Cargo.toml` - Rust workspace (13 members)
- `rustfmt.toml` - Formatter config (100 char max, 4-space indent)
- `clippy.toml` - Linter config (cognitive=30, lines=150, args=8)
- `.cargo/config.toml` - Cargo aliases (c, t, lint, fmt)
- `client/tsconfig.json` - TypeScript config
- `client/playwright.config.ts` - E2E test config

## Platform Requirements

**Development:**
- Linux/macOS/Windows with native Rust toolchain
- PostgreSQL (auto-detected or DATABASE_URL)
- Optional GPU (auto-detected for model offloading)
- No Docker required

**Production:**
- Linux server/container with native Rust runtime
- PostgreSQL 13+ with pgvector extension
- GPU optional (llama-cpp inference acceleration)

---

*Stack analysis: 2026-02-16*
*Update after major dependency changes*
