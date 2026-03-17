# SignApps Platform

> Self-hosted enterprise workspace suite with native AI capabilities

[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)

## Overview

SignApps Platform is a comprehensive, self-hosted infrastructure management system designed for enterprises. It provides a unified workspace combining document editing, file storage, scheduling, containerization, AI assistance, and real-time collaboration.

**Key Features:**
- **Native AI** - STT, TTS, OCR, LLM inference without external dependencies
- **No Docker Required** - All services run natively on your infrastructure
- **Multi-tenant** - Full tenant isolation with custom branding
- **Real-time Collaboration** - Yjs CRDT-based document editing
- **Enterprise Security** - RBAC, MFA, LDAP/AD integration

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 16)                       │
│                   React 19 • TypeScript • Tailwind               │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Rust Microservices                         │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────┤
│ Identity │ Storage  │ Calendar │ AI       │ Office   │ Collab  │
│ :3001    │ :3004    │ :3011    │ :3005    │ :3018    │ :3013   │
├──────────┼──────────┼──────────┼──────────┼──────────┼─────────┤
│Containers│ Proxy    │ Scheduler│ Metrics  │ Media    │ Mail    │
│ :3002    │ :3003    │ :3007    │ :3008    │ :3009    │ :3012   │
└──────────┴──────────┴──────────┴──────────┴──────────┴─────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL + pgvector                         │
│              Native execution • In-process cache                 │
└─────────────────────────────────────────────────────────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| **signapps-identity** | 3001 | Authentication, RBAC, MFA, LDAP/AD |
| **signapps-containers** | 3002 | Docker container lifecycle (bollard) |
| **signapps-proxy** | 3003 | Reverse proxy, TLS/ACME, SmartShield |
| **signapps-storage** | 3004 | File storage (OpenDAL: local FS or S3) |
| **signapps-ai** | 3005 | RAG, LLM, pgvector embeddings |
| **signapps-scheduler** | 3007 | CRON job management |
| **signapps-metrics** | 3008 | System monitoring, Prometheus |
| **signapps-media** | 3009 | Native STT/TTS/OCR |
| **signapps-calendar** | 3011 | Events, resources, scheduling |
| **signapps-mail** | 3012 | Email management |
| **signapps-collab** | 3013 | Real-time collaboration (Yjs) |
| **signapps-office** | 3018 | Document conversion (DOCX/PDF/XLSX) |

## Tech Stack

### Backend (Rust)
- **Framework**: Axum + Tokio async runtime
- **Database**: PostgreSQL with pgvector extension
- **Cache**: Moka (in-process, no Redis needed)
- **Storage**: OpenDAL (filesystem or S3-compatible)
- **AI/ML**: whisper-rs, piper-rs, ocrs, llama-cpp-2

### Frontend (TypeScript)
- **Framework**: Next.js 16 (App Router)
- **UI**: shadcn/ui + Tailwind CSS 4
- **State**: Zustand
- **Editor**: Tiptap (rich text)
- **Real-time**: Yjs CRDT

## Quick Start

### Prerequisites

- Rust 1.75+
- Node.js 20+
- PostgreSQL 15+ with pgvector extension
- (Optional) NVIDIA GPU for accelerated AI

### Setup

```bash
# Clone the repository
git clone https://github.com/willowU2/signapps.git
cd signapps

# Copy environment template
cp .env.example .env
# Edit .env with your configuration

# Build backend
cargo build --release

# Install frontend dependencies
cd client
npm install

# Start a service
cargo run -p signapps-identity

# Start frontend (in another terminal)
cd client
npm run dev
```

### Environment Variables

```bash
# Required
DATABASE_URL=postgres://user:password@localhost:5432/signapps
JWT_SECRET=your_jwt_secret_minimum_32_characters

# Storage
STORAGE_MODE=fs  # or "s3"
STORAGE_FS_ROOT=./data/storage

# AI (optional - enables native AI features)
LLM_PROVIDER=ollama  # or openai, anthropic, llamacpp
OLLAMA_URL=http://localhost:11434
```

See [.env.example](.env.example) for all configuration options.

## Development

```bash
# Backend
cargo check --workspace          # Type check
cargo test --workspace           # Run tests
cargo clippy --workspace         # Lint
cargo fmt --all                  # Format

# Frontend
cd client
npm run dev                      # Dev server
npm run build                    # Production build
npm run lint                     # ESLint
npm run test:e2e                 # Playwright tests
```

## Project Structure

```
signapps/
├── crates/
│   ├── signapps-common/     # Shared: JWT, middleware, errors
│   ├── signapps-db/         # Database: models, repositories
│   ├── signapps-cache/      # In-process TTL cache (moka)
│   └── signapps-runtime/    # PostgreSQL lifecycle, hardware detection
├── services/
│   ├── signapps-identity/   # Auth service
│   ├── signapps-storage/    # File storage
│   ├── signapps-ai/         # AI/RAG service
│   └── ...                  # Other microservices
├── client/                  # Next.js frontend
│   ├── src/app/             # App Router pages
│   ├── src/components/      # React components
│   └── src/lib/             # Utilities & API clients
└── migrations/              # PostgreSQL migrations
```

## Features

### Document Suite
- Rich text editor (Tiptap-based)
- Export to DOCX, PDF, Markdown, HTML
- Import from DOCX, Markdown, HTML
- Real-time collaboration (planned)

### Storage
- File browser with drag & drop
- Folder sharing with permissions
- Version history
- S3-compatible backend support

### Calendar & Scheduling
- Event management
- Resource booking
- iCal import/export
- Recurring events

### AI Assistant
- Multi-provider LLM support (OpenAI, Anthropic, Ollama, local GGUF)
- Native speech-to-text (Whisper)
- Native text-to-speech (Piper)
- Native OCR (ocrs)
- RAG with pgvector embeddings

### Administration
- Multi-tenant management
- User & group management
- Role-based access control
- Audit logging
- Custom branding per tenant

## LDAP/Active Directory

SignApps supports native Active Directory authentication:

```bash
LDAP_URL=ldap://your-dc.domain.local:389
LDAP_BIND_DN=CN=service,OU=Services,DC=domain,DC=local
LDAP_BIND_PASSWORD=your_password
LDAP_BASE_DN=DC=domain,DC=local
```

## Roadmap

- [ ] Tiptap v3 Migration
- [ ] Comments System
- [ ] Track Changes
- [ ] Spreadsheet Import/Export
- [ ] PDF Operations (merge, split)
- [ ] Enhanced Real-time Collaboration

See [nextstep.md](nextstep.md) for detailed planning.

## License

Proprietary - All rights reserved.

---

Built with Rust and Next.js
