# Coding Conventions

**Analysis Date:** 2026-02-16

## Naming Patterns

**Files:**
- Rust: `snake_case.rs` - All Rust source files (user_repository.rs, jwt_config.rs, main.rs)
- TypeScript: `kebab-case.ts` or `kebab-case.tsx` - All TypeScript files (use-containers.ts, command-palette.tsx)
- React components: `PascalCase.tsx` - Components and containers
- Test files: `*.test.rs` (Rust inline), `*.spec.ts` (Playwright E2E)
- Index files: `mod.rs` (Rust), `index.ts` (TypeScript) for re-exports

**Functions:**
- Rust: `snake_case` - All functions (find_by_id, create_user, validate_token)
- TypeScript: `camelCase` - All functions (handleClick, formatBytes, parseJSON)
- Async functions: No special prefix in either language
- Event handlers: `handleEventName` in React (handleSubmit, handleChange)

**Variables:**
- Rust: `snake_case` - All variables (user_id, auth_token)
- TypeScript: `camelCase` - All variables (userId, authToken)
- Constants: `UPPER_SNAKE_CASE` - Both languages (MAX_RETRIES, JWT_SECRET, API_BASE_URL)
- Private/internal: No prefix (TypeScript uses module scope)

**Types:**
- Interfaces: `PascalCase`, no `I` prefix (User, not IUser; UserRepository, not IUserRepository)
- Type aliases: `PascalCase` (AuthResponse, ContainerStatus)
- Enums: `PascalCase` for name, `UPPER_CASE` for values (Status::ACTIVE, Role::ADMIN)
- Generics: Single letter `T`, `E`, `R` for common patterns; descriptive for complex (ItemType)

## Code Style

**Formatting:**
- Rust: `rustfmt` with `rustfmt.toml` config (100 char max, 4-space indent, force_explicit_abi)
- TypeScript: Prettier (via npm scripts, no separate config)
- Line length: 100 characters (Rust), 80-100 (TypeScript)
- Indentation: 4 spaces (Rust), 2 spaces (TypeScript)
- Semicolons: Required in both languages
- Quotes: Single quotes for strings (TypeScript), double quotes in Rust

**Linting:**
- Rust: `clippy` with `-D warnings` enforced
  - Config: `clippy.toml` (cognitive=30, lines=150, args=8)
  - Run: `cargo clippy --workspace --all-features -- -D warnings`
- TypeScript: ESLint with eslint.config.mjs
  - Config: `client/eslint.config.mjs`
  - Run: `npm run lint` in client/

**Formatting Run:**
- Rust: `cargo fmt --all` or `cargo fmt --all -- --check` (pre-commit)
- TypeScript: `npm run format` (in client/)

## Import Organization

**Order (Rust):**
1. Standard library imports (std::*)
2. External crate imports (axum, sqlx, tokio, etc.)
3. Internal crate imports (use crate::handlers, crate::models)
4. Type imports (use crate::types::{User, Error})

**Order (TypeScript):**
1. External packages (react, next, axios, zustand)
2. Path aliases (@/* imports)
3. Relative imports (./components, ../lib)
4. Type imports (import type { User })

**Grouping:**
- Blank line between groups
- Alphabetical within each group
- Derive macros/decorators: Group by purpose (derive, attributes)

**Path Aliases:**
- TypeScript: `@/*` maps to `./src/*` (tsconfig.json)
- Rust: None (use workspace crate names directly)

## Error Handling

**Patterns:**
- Rust: Return `Result<T, AppError>` from all fallible functions
  - Handlers automatically convert via `IntoResponse`
  - Log errors with context before returning
- TypeScript: Try/catch for async operations, error toasts for UI
  - API client interceptor handles 401 → refresh → retry
  - Components display errors via UI toast notifications

**Custom Errors:**
- Rust: Use `signapps_common::Error` (implements RFC 7807)
  - No custom error types (centralized error handling)
  - Include cause chain in error messages
- TypeScript: Throw Error with descriptive message or custom error class

**Async/Await:**
- Rust: Use `#[tokio::test]` for async tests, `.await?` for propagation
- TypeScript: `async/await` with try/catch, no `.catch()` chains

## Logging

**Framework:**
- Rust: `tracing` crate via middleware (integrated into tower-http)
- TypeScript: `console.log`/`error` (stdout captured by deployment platform)

**Patterns:**
- Rust: Middleware logs all requests with request ID and timing
  - Use tracing!(), debug!(), info!(), warn!(), error!() macros
  - Log at service boundaries, not in utilities
- TypeScript: Log errors to console, user-facing messages via toast

**When to Log:**
- Request/response entry/exit (middleware)
- Database operations (repository level)
- External API calls
- Errors and exceptions
- Avoid: Logging sensitive data (tokens, passwords)

## Comments

**When to Comment:**
- Explain **why**, not **what** (code shows what)
- Document business rules and constraints
- Explain non-obvious algorithms or workarounds
- Avoid obvious comments: `// increment counter` not needed

**JSDoc/TSDoc:**
- Rust: Doc comments (///) for pub items
  - Use `///` for function/type documentation
  - Example: `/// User authentication via JWT token`
- TypeScript: JSDoc for public functions
  - Example: `/** Fetch user by ID @param id User UUID @returns User object */`

**TODO Comments:**
- Format (Rust): `// TODO: description` (no username)
- Format (TypeScript): `// TODO: description` with issue link if exists
- Track: Use GitHub issues, link in comment if critical

## Function Design

**Size:**
- Keep under 50 lines (extract complex logic to helpers)
- One level of abstraction per function
- Clear responsibility

**Parameters:**
- Max 3 parameters (use struct for more)
- Destructure objects in parameter list
- No `bool` flags; use enums or separate functions

**Return Values:**
- Explicit return statements
- Return early for guard clauses
- Use `Result<T, E>` for expected failures

**Example (Rust):**
```rust
/// Find user by email and validate password
async fn authenticate(email: &str, password: &str, repo: &UserRepository) -> Result<User> {
    // Guard: validate inputs
    let user = repo.find_by_email(email).await?;

    // Business logic
    verify_password(password, &user.password_hash)?;

    Ok(user)
}
```

## Module Design

**Exports:**
- Rust: Use `pub use` in `mod.rs` to re-export public API
  - Keep internal helpers private
  - Create clear public boundaries
- TypeScript: Named exports preferred, default exports for React components

**Barrel Files:**
- Rust: `mod.rs` re-exports public API (`pub use crate::handlers::*;`)
- TypeScript: `index.ts` re-exports from `./component` or direct exports

**Dependencies:**
- Avoid circular dependencies (import specific modules if needed)
- Unidirectional dependency flow (handlers → services → repositories)

## Architecture Patterns

**Repository Pattern (Rust):**
```rust
// Each entity has dedicated repository
pub struct UserRepository { /* fields */ }

impl UserRepository {
    pub async fn find_by_id(&self, id: Uuid) -> Result<User> { /* */ }
    pub async fn create(&self, user: NewUser) -> Result<User> { /* */ }
}
```

**Handler Pattern (Rust):**
```rust
// Extract state and validate input
async fn create_user(
    State(state): State<AppState>,
    Json(payload): Json<CreateUserPayload>,
) -> Result<Json<User>> {
    // Call repository via state
    state.user_repo.create(payload).await.map(Json)
}
```

**Hooks Pattern (TypeScript):**
```typescript
// Custom hook wrapping API calls
export function useContainers() {
    const [containers, setContainers] = useState([]);

    const fetchContainers = async () => {
        const data = await api.containers.list();
        setContainers(data);
    };

    return { containers, fetchContainers };
}
```

**Store Pattern (TypeScript - Zustand):**
```typescript
// Centralized state with persist
export const useAuthStore = create<AuthState>(
    persist((set) => ({
        user: null,
        setUser: (user) => set({ user }),
    }), { name: 'auth-store' })
);
```

---

*Convention analysis: 2026-02-16*
*Update when patterns change*
