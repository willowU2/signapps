---
project_name: 'signapps-platform'
user_name: 'Etienne'
date: '2026-03-10'
status: 'complete'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
existing_patterns_found: 15
generated_by: 'BMAD Generate Project Context v6.0.4'
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Backend (Rust Workspace)
- **Rust**: Edition 2021, MSRV 1.75
- **Tokio**: 1.36 (runtime async)
- **Axum**: 0.7 (framework web avec WebSocket, multipart)
- **SeaORM**: 0.12 (ORM principal - remplace SQLx)
- **SQLx**: 0.7 (legacy, migration en cours)
- **PostgreSQL**: pgvector 0.3 (embeddings 384-dim, HNSW index)
- **Tauri**: 2.2 (app desktop)
- **Moka**: 0.12 (cache in-process, remplace Redis)

### Frontend (Next.js)
- **Next.js**: 16.1.6 (App Router)
- **React**: 19.2.3
- **TypeScript**: 5.x (strict mode)
- **Tailwind CSS**: 4.x
- **Zustand**: 5.0.11 (state management)
- **TanStack Query**: 5.90.20 (data fetching)
- **TipTap**: 2.26+ (rich text)
- **Yjs**: 13.6.8 (collaboration temps réel)
- **Playwright**: 1.58.2 (E2E tests)

### Services (Ports)
| Service | Port |
|---------|------|
| Identity | 3001 |
| Containers | 3002 |
| Proxy | 3003 |
| Storage | 3004 |
| AI | 3005 |
| SecureLink | 3006 |
| Scheduler | 3007 |
| Metrics | 3008 |
| Media | 3009 |

### Version Constraints (Critical)
- pgvector embeddings: **384 dimensions** (NOT 1536) - uses all-MiniLM-L6-v2
- SeaORM 0.12 cohabits with SQLx 0.7 - do not mix in same handler
- Moka replaces Redis - cache is in-process, not distributed
- Tauri 2.2 wraps Next.js 16 - @tauri-apps/api available client-side

### NEVER DO (Anti-patterns)
- Never suggest Docker/docker-compose - everything runs natively
- Never hardcode GPU backend - signapps-runtime auto-detects
- Never use ports outside 3001-3009 range for services
- Never assume Redis - use Moka cache patterns
- Never use 1536-dim embeddings - project uses 384-dim

---

## Critical Implementation Rules

### Rust Rules

#### Error Handling (Critical)
- All handlers return `Result<Json<T>, AppError>` - never `anyhow::Error` directly
- Use `thiserror` for library crates, `anyhow` with `.context()` for services
- Never use `.unwrap()` - use `?` with context or explicit error handling
- JWT Claims extracted via auth middleware - never parse JWT manually

#### Repository Pattern
- SeaORM: `async fn method(db: &DatabaseConnection, ...) -> Result<T>`
- SQLx legacy: `async fn method(pool: &PgPool, ...) -> Result<T>`
- Never mix SeaORM and SQLx in the same handler function

#### Imports & Style
- Group: std → external → workspace crates
- Line width: 100 chars (rustfmt.toml enforced)
- Clippy: deny unwrap_used in services

### TypeScript/Frontend Rules

#### Type Safety (Critical)
- `strict: true` - no implicit any, no any casts
- Use `satisfies` for type validation without widening
- Zod schemas must match TypeScript types 1:1
- Discriminated unions over optional properties for states

#### State Management
- Zustand: one store per domain (authStore, storageStore, etc.)
- TanStack Query for all server state
- Never create a global mega-store

#### API Client Pattern (Critical)
- Always use `@/lib/api/*.ts` modules
- Never call axios directly with hardcoded URLs
- Share response types via `@/types/api/`

---

### Axum (Backend)

#### Handler Pattern
- Extract: `State<Arc<AppState>>`, `Extension<Claims>`
- Return: `Result<Json<T>, AppError>` or `impl IntoResponse`
- WebSocket: `WebSocketUpgrade` with `on_upgrade()` callback

#### AppState Structure (Critical)
```rust
pub struct AppState {
    pub db: DatabaseConnection,  // SeaORM
    pub cache: CacheService,     // Moka
    pub config: Arc<Config>,
}
```
- Always wrap in `Arc<AppState>` for State extractor

#### Router Organization
- `main.rs`: router + middleware stack
- `handlers/*.rs`: one file per domain
- Nested: `.nest("/api/v1/resource", routes())`

### Next.js 16 (Frontend)

#### App Router (Critical)
- Server components default - add `"use client"` only when needed
- Every route needs: `page.tsx`, `loading.tsx`, `error.tsx`
- NO Server Actions - all mutations go to Rust APIs

#### Layout Pattern
- `(authenticated)/layout.tsx` wraps protected routes
- `WorkspaceShell` is the main layout component (sidebar + header)
- Auth redirect via `redirect('/login')` from next/navigation

#### Data Fetching
- Server components: direct await
- Client components: TanStack Query with strict key convention
- Query keys: `['domain', 'resource', params]`

### Tauri 2.2 (Desktop)

#### IPC Commands
- Define in `src-tauri/src/main.rs` with `#[tauri::command]`
- Call via `invoke<T>('command_name', { args })`
- Always type the response generically

### Real-time Collaboration

#### Yjs + TipTap Pattern
- WebsocketProvider connects to collab service (port varies)
- Document ID = unique identifier for shared doc
- Cursor sync via collaboration-cursor extension

---

### Testing Philosophy (Critical)

#### NO MOCKS - Real Data Only
- All test data lives in database via seed scripts
- Never use `mockall` for database/API operations
- Never hardcode test data in Rust/TypeScript files
- Never mock API responses in E2E tests

### Rust Testing

#### Test Database Setup
- `TEST_DATABASE_URL` separate from dev database
- Migrations + seed data applied before test suite
- Each test uses transaction rollback for isolation

#### Transaction Rollback Pattern (Required)
```rust
#[tokio::test]
async fn test_create_user_succeeds() {
    let db = get_test_db().await;
    let tx = db.begin().await.unwrap();

    // All operations use &tx
    let result = UserRepository::create(&tx, data).await;
    assert!(result.is_ok());

    tx.rollback().await.unwrap(); // Always rollback
}
```

#### Fixtures for Complex Tests
- `tests/fixtures/mod.rs` - shared setup functions
- Fixtures create real DB records, not mock structs
- Reusable across integration tests

#### Test Naming Convention
```
test_<action>_<scenario>_<expected_result>
```

### Seed Data

#### UUID Convention for Test Data
- Test UUIDs: `00000000-0000-0000-0000-00000000XXXX`
- Easy to identify and clean up
- Deterministic for assertions

#### Standard Test Users
| UUID (suffix) | Username | Role |
|---------------|----------|------|
| ...0001 | test_admin | admin (1) |
| ...0002 | test_user | user (2) |
| ...0003 | test_guest | guest (3) |

### Playwright E2E

#### Real Backend Testing
- Tests hit real Rust services with seeded DB
- Auth uses real test credentials
- One test user per Playwright worker (parallel isolation)

#### Auth Setup
```typescript
// e2e/auth.setup.ts
await page.goto('/login');
await page.fill('[name=username]', 'test_user');
await page.fill('[name=password]', 'Test123!');
await page.click('button[type=submit]');
```

---

### Code Quality & Style

#### Rust Formatting (rustfmt.toml)
- Max line width: 100 chars
- Imports: grouped (std → external → workspace)
- Edition: 2021

#### Clippy Rules
- `cognitive-complexity-threshold = 30`
- `too-many-lines-threshold = 150`
- `too-many-arguments-threshold = 8`
- CI runs with `-D warnings` (deny all warnings)

#### Rust Documentation
- Public APIs: doc comments required (`///`)
- Internal code: minimal comments, self-documenting names
- No TODO comments in main branch

#### TypeScript/ESLint
- Strict TypeScript rules
- No unused imports
- No `console.log` in production code

#### File Naming Convention
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Hooks | camelCase + use | `useAuth.ts` |
| Utils | camelCase | `formatDate.ts` |
| API modules | camelCase | `storage.ts` |

#### Component Structure Order
```tsx
// 1. Imports (grouped: react, external, internal)
// 2. Types/interfaces
// 3. Component function
export function MyComponent({ prop }: Props) {
  // hooks first
  // derived state
  // handlers
  // render
}
```

---

### Development Workflow

#### Git Branch Naming
- `feature/<description>` - nouvelles fonctionnalités
- `fix/<description>` - corrections de bugs
- `refactor/<description>` - refactoring
- `chore/<description>` - maintenance, dépendances

#### Commit Message Format
```
type(scope): description

Types: feat, fix, refactor, chore, docs, test
Scope: service name or module
Example: feat(storage): add folder sharing endpoint
```

#### PR Requirements
- All CI checks must pass
- Code review required
- No direct push to main/develop

#### CI Pipeline (GitHub Actions)

**Rust Checks (in order):**
1. `cargo check --workspace --all-features`
2. `cargo fmt --all -- --check`
3. `cargo clippy --workspace --all-features -- -D warnings`
4. `cargo test --workspace --all-features`
5. `cargo audit` (security)
6. `cargo llvm-cov` (coverage)

**Frontend Checks:**
1. `npm run lint`
2. `npm run build`
3. `npm run test:e2e`

#### Local Development
```powershell
# Start all services
.\start_windows.ps1

# Quick checks before commit
cargo fmt --all && cargo clippy --workspace
cd client && npm run lint
```

---

### CRITICAL - Never Do (Anti-patterns)

#### Infrastructure
- ❌ Never suggest Docker/docker-compose - everything runs natively
- ❌ Never assume Redis - use Moka (in-process cache)
- ❌ Never hardcode GPU backend - signapps-runtime auto-detects
- ❌ Never use ports outside 3001-3009 for services
- ❌ Never call services via localhost in production - use proxy

#### Database & Async
- ❌ Never use 1536-dim embeddings - project uses 384-dim
- ❌ Never mix SeaORM and SQLx in the same handler
- ❌ Never create new DB connections in handlers - use AppState
- ❌ Never block async runtime - use spawn_blocking for CPU work
- ❌ Never use std::fs in async - use tokio::fs

#### Code Patterns
- ❌ Never use `.unwrap()` in production code
- ❌ Never return `anyhow::Error` from handlers - use `AppError`
- ❌ Never parse JWT manually - use auth middleware
- ❌ Never call axios directly - use `@/lib/api/*.ts` modules
- ❌ Never use Server Actions - all mutations via Rust APIs

#### Testing
- ❌ Never use mock data in code - all test data in database
- ❌ Never use fixed timeouts (`waitForTimeout`) - use explicit waits
- ❌ Never share test users across parallel workers

#### Security
- ❌ Never log passwords, tokens, or PII
- ❌ Never return internal error stack traces to client
- ❌ Never skip input sanitization

#### Performance
- ❌ Never load all records without pagination (default: 50, max: 100)
- ❌ Never N+1 queries - use eager loading with SeaORM

---

### CRITICAL - Always Do

#### Before Writing Code
- ✅ Check existing patterns in similar services/components
- ✅ Verify port assignments for new services
- ✅ Ensure seed data exists for new models

#### Error Handling
- ✅ All handlers: `Result<Json<T>, AppError>`
- ✅ Use `.context()` with anyhow for meaningful errors
- ✅ Return RFC 7807 Problem Details format

#### Frontend Data Fetching
- ✅ Always use TanStack Query for server state
- ✅ Handle loading/error states explicitly
- ✅ Use query key convention: `['domain', 'resource', params]`

#### BMAD Workflow Triggers
- ✅ New major feature → `/bmad-bmm-create-product-brief`
- ✅ Bug or unexpected behavior → `superpowers:systematic-debugging`
- ✅ Before claiming done → `superpowers:verification-before-completion`

---

## Usage Guidelines

### How to Use This Document

**For AI Agents:**
1. Read this file at the start of every coding session
2. Refer to the "CRITICAL - Never Do" section before making changes
3. Follow the patterns in "Critical Implementation Rules" exactly
4. When uncertain, check existing code in similar services/components

**For Humans:**
1. Keep this document updated when stack versions change
2. Add new anti-patterns when discovered during code review
3. Update testing conventions when test infrastructure evolves

### Quick Reference Commands

```bash
# Rust development
cargo check --workspace --all-features
cargo clippy --workspace -- -D warnings
cargo test -p <service-name>

# Frontend development
cd client && npm run dev
npm run lint && npm run build

# Start all services
.\start_windows.ps1
```

### Document Maintenance

This document should be updated when:
- Major dependency versions change
- New services are added (update port table)
- New anti-patterns are discovered
- Testing conventions evolve

---

_Generated by BMAD Generate Project Context workflow on 2026-03-10_
