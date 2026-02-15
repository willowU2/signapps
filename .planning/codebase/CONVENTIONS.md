# Coding Conventions

**Analysis Date:** 2026-02-15

## Naming Patterns

**Files (Rust):**
- `snake_case.rs` for all source files
- `mod.rs` for module exports
- `{entity}_repository.rs` for repositories (e.g., `user_repository.rs`)
- `{domain}.rs` for handlers (e.g., `auth.rs`, `containers.rs`)

**Files (TypeScript):**
- `kebab-case.ts` for utilities and hooks (e.g., `use-dashboard.ts`, `api.ts`)
- `PascalCase.tsx` for shadcn/ui components (e.g., `Button.tsx`, `Header.tsx`)
- `page.tsx` / `layout.tsx` for Next.js App Router conventions

**Functions (Rust):**
- `snake_case` for all functions
- Handler pattern: `pub async fn verb_noun(...)` (e.g., `create_user`, `list_containers`)
- Repository pattern: `pub async fn find_by_field(pool, ...)` (e.g., `find_by_id`, `find_by_username`)

**Functions (TypeScript):**
- `camelCase` for functions and variables
- Hook pattern: `export function useFeatureName()` (e.g., `useServiceHealth`, `useDashboard`)
- Handler pattern: `handleEventName` (e.g., `handleClick`, `handleSubmit`)

**Variables (Rust):**
- `snake_case` for variables and struct fields
- `UPPER_SNAKE_CASE` for constants
- No prefix convention for private fields

**Types (Rust):**
- `PascalCase` for structs, enums, traits
- Value objects: `UserId(Uuid)`, `Email`, `Password`, `Username` (`crates/signapps-common/src/types.rs`)
- Request/response: `CreateUser`, `LoginRequest`, `LoginResponse`
- Error: single `Error` enum with `#[derive(Error)]`

**Types (TypeScript):**
- `PascalCase` for interfaces and types
- `interface ComponentNameProps` for component props
- Union types: `'value1' | 'value2'` for string literals

## Code Style

**Formatting (Rust):**
- Tool: rustfmt (`rustfmt.toml`)
- Max line width: 100 characters
- Indentation: 4 spaces
- `fn_args_layout = "Tall"` (multi-line for many args)
- `use_field_init_shorthand = true`
- `use_try_shorthand = true` (use `?` operator)
- `match_block_trailing_comma = true`
- Doc code block width: 80 characters

**Formatting (TypeScript):**
- No Prettier configured (relies on ESLint)
- No explicit line length rule

**Linting (Rust):**
- clippy (`clippy.toml`) with `-D warnings` in CI
- `cognitive-complexity-threshold = 30`
- `too-many-lines-threshold = 150`
- `too-many-arguments-threshold = 8`
- `max-struct-bools = 3`
- Run: `cargo lint` (alias for `cargo clippy --workspace --all-targets --all-features -- -D warnings`)

**Linting (TypeScript):**
- ESLint 9 flat config (`client/eslint.config.mjs`)
- Extends: `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`
- Run: `npm run lint`

## Import Organization

**Rust:**
- Granularity: Crate-level (`imports_granularity = "Crate"`)
- Grouping: `group_imports = "StdExternalCrate"` (std, external, crate)
- Reordered automatically by rustfmt
- Wildcard: Only `crate::prelude::*` allowed

**TypeScript:**
- Path alias: `@/*` maps to `./src/*`
- No strict ordering enforced
- Common pattern: external imports first, then internal, then relative

## Error Handling

**Rust:**
- Unified error type: `signapps_common::Error` (`crates/signapps-common/src/error.rs`)
- `thiserror` for defining error variants (30+ variants)
- All handlers return `Result<T, Error>` (alias: `signapps_common::Result<T>`)
- `Error` implements `IntoResponse` -> RFC 7807 Problem Details JSON
- Use `?` operator for propagation, `.map_err()` for conversion
- `anyhow` in `main.rs` for startup errors only

**TypeScript:**
- Axios interceptor catches 401 -> token refresh -> retry
- Error boundaries for React component errors
- Zod validation for form inputs
- Toast notifications (sonner) for user-facing errors

## Logging

**Framework (Rust):**
- `tracing` crate with structured logging
- `tracing-subscriber` with EnvFilter
- Default: `RUST_LOG=info,signapps=debug,sqlx=warn`

**Patterns:**
- `tracing::info!("message")` for general info
- `tracing::warn!("...")` for degraded state
- `tracing::error!("...")` for failures
- `#[tracing::instrument(skip(pool, ...))]` on handlers for automatic span creation
- Request logging via `logging_middleware` (status + duration)
- No `println!` in committed code

## Comments

**When to Comment (Rust):**
- Module-level docs with `//!` at top of `lib.rs` / `mod.rs`
- Function docs with `///` for public API
- `format_code_in_doc_comments = true` in rustfmt

**TODO Comments:**
- Pattern: `// TODO: description` (no username, use git blame)
- 40+ TODOs in storage service (incomplete features)

## Function Design

**Rust Handlers:**
- Signature: `pub async fn name(State(s): State<AppState>, Extension(claims): Extension<Claims>, Json(p): Json<Req>) -> Result<Json<Res>>`
- Validate input first, then business logic, then response
- Return early on errors with `?`

**Rust Repositories:**
- Static methods: `impl EntityRepository { pub async fn method(pool: &PgPool, ...) -> Result<T> }`
- sqlx compile-time checked queries
- Map rows via `FromRow` derive

**Parameters (Rust):**
- Max 8 (clippy threshold)
- Use struct for complex parameters
- `&PgPool` by reference, not owned

## Module Design

**Rust:**
- One handler file per domain (e.g., `handlers/auth.rs`, `handlers/users.rs`)
- `handlers/mod.rs` re-exports all handler modules
- Service-specific logic in dedicated modules (e.g., `llm/`, `rag/`, `docker/`)

**TypeScript:**
- Components in `components/` with subdirectories by domain
- Hooks in `hooks/` (flat)
- Stores in `stores/` (flat, one per feature)
- All API functions in single `lib/api.ts` (monolithic)

---

*Convention analysis: 2026-02-15*
*Update when patterns change*
