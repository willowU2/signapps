# Architecture

**Analysis Date:** 2026-02-16

## Pattern Overview

**Overall:** Microservices Architecture with Shared Library Model

**Key Characteristics:**
- Workspace monorepo (Cargo workspace, 13 members: 9 services + 4 shared crates)
- Independent services communicating via REST APIs on ports 3001-3009
- Shared foundation (signapps-common, signapps-db, signapps-cache, signapps-runtime)
- JWT authentication with optional refresh tokens
- PostgreSQL + pgvector as central data store
- Native runtime (no Docker required for core services)

## Layers

### Backend (Rust) - 4-Tier Model

**API Layer (Handlers):**
- Purpose: HTTP request handling and response serialization
- Contains: Route handlers organized by domain (`services/signapps-*/src/handlers/`)
- Depends on: Business logic layer for data operations
- Used by: Axum router and middleware pipeline
- Pattern: Handlers extract AppState, call service methods, return responses

**Business Logic Layer:**
- Purpose: Domain-specific operations and service logic
- Contains: Services, RAG pipeline, LLM providers, Docker client wrappers
- Examples: `services/signapps-ai/src/llm/`, `services/signapps-ai/src/rag/`
- Depends on: Data access layer (repositories)
- Used by: Handlers for core functionality

**Data Access Layer (Repositories):**
- Purpose: Database interaction and query abstraction
- Contains: Repository pattern implementations (`crates/signapps-db/src/repositories/`)
- Examples: `UserRepository`, `GroupRepository`, `VectorRepository`, `ContainerRepository`
- Depends on: PostgreSQL connection pool and SQLx
- Used by: Business logic for CRUD operations

**Infrastructure Layer:**
- Purpose: Cross-cutting concerns and shared utilities
- Contains: Middleware, auth, error types, value objects, caching, runtime management
- Locations: `crates/signapps-common/`, `crates/signapps-cache/`, `crates/signapps-runtime/`
- Depends on: External libraries only
- Used by: All other layers

### Frontend (React) - 3-Tier Model

**Pages (App Router):**
- Purpose: Route definitions and top-level layout
- Contains: `client/src/app/*/page.tsx` organized by feature
- Examples: dashboard, containers, ai, storage, users, settings
- Depends on: Components and custom hooks

**Components & Hooks:**
- Purpose: UI rendering and business logic encapsulation
- Contains: `client/src/components/` and `client/src/hooks/`
- Hooks: `useContainers()`, `useUsers()`, `useMonitoring()`, `useVoiceChat()`, etc.
- Depends on: API client and state management

**State Management & API:**
- Purpose: Centralized state and API communication
- Contains: Zustand stores (`client/src/stores/`) and axios clients (`client/src/lib/api.ts`)
- Pattern: Per-service axios instances with JWT interceptors
- Handles: Token refresh, error handling, request/response transformation

## Data Flow

**HTTP Request Lifecycle:**

1. **Browser/Client** - User interaction or page load
2. **next/lib/api.ts** - Axios instance with request interceptor
   - Injects JWT from localStorage
   - On 401: Calls refresh endpoint, retries original request
3. **Service Port 300X/api/v1/...** - Route matches in Axum
4. **Middleware Pipeline:**
   - logging_middleware - logs request info
   - request_id_middleware - adds request ID header
   - TraceLayer - distributed tracing
   - CorsLayer - CORS handling
5. **auth_middleware** - JWT validation from signapps-common
   - Extracts and validates token
   - Injects Claims into request
   - Rejects if invalid
6. **Handler** - Business logic execution
   - Extracts State<AppState>
   - Validates input from request body/params
   - Calls repository methods for data access
   - Transforms response to JSON
7. **Repository** - Database query execution
   - SQLx compiled queries (type-safe)
   - Executes against PostgreSQL
   - Returns Result<T, Error>
8. **Response** - JSON serialized back to client

**State Management:**

- **Frontend state**: Zustand stores with localStorage persistence
- **Backend state**: Stateless - request context contained in JWT claims
- **Shared state**: PostgreSQL database (source of truth)
- **Cache state**: moka in-process TTL cache (JWT blacklist, rate limits)

## Key Abstractions

**Repository Pattern:**
- Purpose: Encapsulate database access
- Examples: `UserRepository`, `GroupRepository`, `VectorRepository` in `crates/signapps-db/`
- Pattern: Each entity has dedicated repo with CRUD methods
- Usage: `repository.find_by_id(id).await?` returns `Result<T>`

**Middleware Stack:**
- Purpose: Cross-cutting concerns (auth, logging, tracing)
- Examples: `auth_middleware`, `require_admin`, `logging_middleware` in `crates/signapps-common/`
- Pattern: Tower middleware composed with `MiddlewareLayer::new()`

**Error Handling (RFC 7807):**
- Purpose: Unified error responses
- Type: `signapps_common::Error` implements `IntoResponse`
- Pattern: All handlers return `Result<T, AppError>`, Axum converts to HTTP response
- Example: 401 unauthorized, 400 bad request, 500 server error

**State Injection:**
- Purpose: Pass shared state to handlers
- Pattern: Each service defines `AppState` implementing `AuthState` trait
- Contents: `pool`, `jwt_config`, service-specific components
- Method: Axum `Extension<AppState>` or `State<AppState>` extractor

**Zustand Stores (Frontend):**
- Purpose: React state management with persistence
- Examples: `useAuthStore` (user, token), `useUIStore` (theme, sidebar)
- Pattern: Single store per domain, export hooks for components
- Persistence: Auto-sync to localStorage

## Entry Points

**Rust Services:**
- Location: `services/signapps-*/src/main.rs`
- Pattern: `#[tokio::main]` async fn main()
- Responsibilities: Initialize db pool, migrate schema, setup JWT config, create Axum router, listen on port

**Frontend (App Router):**
- Location: `client/src/app/layout.tsx`
- Triggers: Server startup, requests to any route
- Responsibilities: Load providers (auth, UI), render layout, pass state to children

## Error Handling

**Strategy:** Unified error type propagated up, caught by middleware/handler

**Patterns:**
- Services throw `signapps_common::Error` with context
- Handlers catch via `Result` type, Axum auto-converts to JSON response
- Status codes: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 500 (server)
- Error format: RFC 7807 Problem Details with title, detail, type

**Frontend:**
- Axios interceptor catches errors on 401, attempts refresh
- Components display error toasts via UI state
- Global error boundary for unhandled exceptions

## Cross-Cutting Concerns

**Logging:**
- Approach: Structured logging via tracing middleware
- Format: Stdout JSON format (pick up by log aggregators)
- Levels: Debug, info, warn, error
- Context: Request ID included in all logs

**Validation:**
- Approach: Handler-level validation on request body
- Pattern: Deserialize with serde, optional validation via `thiserror`
- Example: Email format, password strength, required fields

**Authentication:**
- Approach: JWT middleware validates token, injects Claims
- Pattern: Extract Claims from request, pass to handler
- Refresh: Axios interceptor handles 401 → refresh → retry
- Roles: Optional `require_admin` middleware for RBAC

---

*Architecture analysis: 2026-02-16*
*Update when major patterns change*
