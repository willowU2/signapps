# Architecture

**Analysis Date:** 2026-02-15

## Pattern Overview

**Overall:** Microservices with Shared Foundational Crates

**Key Characteristics:**
- 9 independent Rust services communicating via REST APIs
- 4 shared crates providing common functionality (auth, DB, cache, runtime)
- Next.js 16 frontend connecting directly to each service
- PostgreSQL as single shared database (multi-schema)
- JWT-based authentication across all services

## Layers

**Middleware Layer:**
- Purpose: Cross-cutting concerns (auth, logging, CORS)
- Contains: JWT validation, admin checks, request ID propagation, tracing
- Location: `crates/signapps-common/src/middleware.rs`
- Used by: All services via `middleware::from_fn_with_state()`

**Handler Layer:**
- Purpose: HTTP request handling and response formatting
- Contains: Route handlers organized by domain (one file per domain)
- Location: `services/signapps-{name}/src/handlers/*.rs`
- Depends on: Repository layer, AppState, Claims from middleware
- Pattern: `pub async fn verb_noun(State, Extension<Claims>, Json<Request>) -> Result<Json<Response>>`

**Repository Layer:**
- Purpose: Data access with compile-time SQL verification
- Contains: Static methods on Repository structs (`UserRepository::find_by_id`)
- Location: `crates/signapps-db/src/repositories/*.rs`
- Depends on: `&PgPool`, model types
- Pattern: `pub async fn method(pool: &PgPool, ...) -> Result<T>`

**Model Layer:**
- Purpose: Data structures mapping 1:1 to PostgreSQL tables
- Contains: Structs with `#[derive(FromRow, Serialize, Deserialize)]`
- Location: `crates/signapps-db/src/models/*.rs`
- Used by: Repositories and handlers

**Service-Specific Logic:**
- Purpose: Domain-specific business logic beyond CRUD
- Contains: Docker client, LLM providers, storage backends, RAG pipeline, DNS server, etc.
- Location: Service-specific modules (e.g., `services/signapps-ai/src/llm/`, `services/signapps-containers/src/docker/`)

## Data Flow

**HTTP Request Lifecycle:**

1. TCP listener accepts connection on service port (3001-3009)
2. `request_id_middleware` injects unique request ID
3. `logging_middleware` starts tracing span
4. CORS layer processes preflight / adds headers
5. `auth_middleware` validates JWT, injects `Claims` into extensions (protected routes)
6. `require_admin` checks role == 0 (admin routes)
7. Handler extracts `State(AppState)`, `Extension(Claims)`, `Json(payload)`
8. Handler calls Repository static methods with `&state.pool`
9. Repository executes sqlx query, maps rows to models
10. Handler returns `Result<Json<Response>>` or `Error` (RFC 7807)

**State Management:**
- Per-service `AppState` struct (Clone-able, injected via Axum `with_state`)
- Database pool shared across all handlers
- In-process cache (moka) for rate limiting and token blacklist
- No inter-service state sharing (each service independent)

## Key Abstractions

**AppState:**
- Purpose: Service-wide shared state
- Examples: `pool`, `jwt_config`, `cache`, `storage`, `docker`, `vectors`, `rag`
- Pattern: Each service defines its own `AppState` implementing `AuthState` trait

**AuthState Trait:**
- Purpose: Decouple JWT config from service-specific state
- Location: `crates/signapps-common/src/middleware.rs`
- Pattern: `trait AuthState: Clone + Send + Sync + 'static { fn jwt_config(&self) -> &JwtConfig; }`

**Repository:**
- Purpose: Data access layer per entity
- Examples: `UserRepository`, `ContainerRepository`, `GroupRepository`, `VectorRepository`
- Pattern: Struct with static async methods accepting `&PgPool`

**CacheService:**
- Purpose: In-process caching (replaces Redis)
- Location: `crates/signapps-cache/src/lib.rs`
- Pattern: TTL-based key-value (moka) + atomic counters (DashMap)

**Error:**
- Purpose: Unified error handling across all services
- Location: `crates/signapps-common/src/error.rs`
- Pattern: `#[derive(Error)]` enum with `IntoResponse` impl (RFC 7807)

## Entry Points

**Rust Services (9):**
- Location: `services/signapps-{name}/src/main.rs`
- Pattern: Load env -> create pool -> run migrations -> init service -> build router -> serve
- Ports: identity=3001, containers=3002, proxy=3003, storage=3004, ai=3005, securelink=3006, scheduler=3007, metrics=3008, media=3009

**Frontend:**
- Location: `client/src/app/layout.tsx` (root layout)
- Pattern: Next.js App Router with auth guards in middleware
- Dev server: `npm run dev` (port 3010)

## Error Handling

**Strategy:** Typed errors with automatic HTTP response mapping (RFC 7807)

**Patterns:**
- `thiserror` for library error types (`crates/signapps-common/src/error.rs`)
- `anyhow` for application-level errors in main.rs
- All handlers return `Result<T, Error>` where Error implements `IntoResponse`
- Validation via `serde` deserialization + custom `.validate()` methods
- 30+ error variants: `InvalidCredentials`, `Unauthorized`, `NotFound`, `Validation`, `Database`, etc.

## Cross-Cutting Concerns

**Logging:**
- `tracing` crate with structured logging
- `tracing-subscriber` with EnvFilter
- `RUST_LOG=info,signapps=debug,sqlx=warn`
- Request/response logging via middleware

**Validation:**
- Serde deserialization at API boundary (automatic via `Json<T>` extractor)
- Value objects with built-in validation: `Email`, `Password`, `Username` (`crates/signapps-common/src/types.rs`)
- Zod schemas on frontend (`client/`)

**Authentication:**
- JWT middleware on all protected routes
- Claims extraction via request extensions
- Token refresh flow (frontend axios interceptor)
- MFA/TOTP support in identity service

**CORS:**
- `tower-http::cors::CorsLayer` with Allow-Origin: Any (dev configuration)
- Applied as outermost layer on all service routers

---

*Architecture analysis: 2026-02-15*
*Update when major patterns change*
