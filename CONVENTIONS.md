# Code Conventions & Patterns

## Code Style

### Rust

**Formatting & Tools:**
- `rustfmt.toml` configuration enforces consistent formatting
- Edition: 2021, MSRV: 1.75
- Max line width: 100 chars
- Hard tabs: false, tab spaces: 4
- Newline style: Auto
- Cargo aliases configured in `.cargo/config.toml`:
  - `cargo c` - check
  - `cargo t` - test
  - `cargo lint` - clippy with -D warnings
  - `cargo fmt` - format all
  - `cargo precommit` - full check before commit (fmt → lint → test)

**Import Organization** (`rustfmt.toml`):
- Granularity: Crate-level imports
- Group style: StdExternalCrate (standard library → external crates → internal crates)
- Auto-reordered, auto-organized modules

**Formatting Rules** (in `rustfmt.toml`):
- `fn_args_layout = "Tall"` - function arguments on separate lines when wrapping
- `struct_lit_single_line = true` - keep struct literals on one line when possible
- `control_brace_style = "AlwaysSameLine"` - opening brace on same line as control flow
- `match_block_trailing_comma = true` - trailing comma in match blocks
- `match_arm_blocks = true` - wrap match arms in blocks
- `use_field_init_shorthand = true` - use `field` instead of `field: field`
- `use_try_shorthand = true` - use `?` instead of `try!()`

**Naming Conventions:**
- File naming: `snake_case` (e.g., `user_repository.rs`, `jwt_config.rs`)
- Module naming: `snake_case`
- Function naming: `snake_case` (e.g., `find_by_id`, `create_with_hash`)
- Struct/Type naming: `PascalCase` (e.g., `UserRepository`, `Claims`, `CreateUser`)
- Constant naming: `SCREAMING_SNAKE_CASE`
- Abbreviations in filenames: expand to full names or use domain context (e.g., `llm.rs`, `rag.rs`)

**Comment Style:**
- Module docs: `//!` with description and examples
- Item docs: `///` with description
- Code comments: `//` for inline comments
- Doc comment code blocks formatted at 80 chars width
- Comments are NOT normalized (preserve developer intent)

**Examples:**
```rust
// File: crates/signapps-common/src/auth.rs
/// JWT claims for access tokens.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: Uuid,
    /// Username
    pub username: String,
    /// User role
    pub role: i16,
}

// File: crates/signapps-db/src/repositories/user_repository.rs
/// Repository for user operations.
pub struct UserRepository;

impl UserRepository {
    /// Find user by ID.
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>> {
        // ...
    }
}
```

---

### TypeScript/JavaScript (Frontend)

**Configuration:**
- `tsconfig.json` - Strict TypeScript with ES2017 target
- `eslint.config.mjs` - ESLint 9+ with Next.js config and TypeScript support
- `next.config.ts` - Next.js 16 with Turbopack configuration
- No dedicated Prettier config (uses Next.js defaults)

**TypeScript Settings** (in `tsconfig.json`):
- `strict: true` - Full strict type checking
- `skipLibCheck: true` - Skip type checking of declaration files
- `moduleResolution: "bundler"` - Modern module resolution
- Path alias: `@/*` maps to `./src/*`
- `isolatedModules: true` - Each file is compiled independently
- `jsx: "react-jsx"` - New JSX transform

**Naming Conventions:**
- **Files:** `kebab-case` for all files
  - Components: `component-name.tsx` (e.g., `command-palette.tsx`, `container-dialog.tsx`)
  - Hooks: `use-hook-name.ts` (e.g., `use-containers.ts`, `use-ai-brief.ts`)
  - Utils/libs: `module-name.ts` (e.g., `api.ts`, `store.ts`)
  - Page routes: `page.tsx` (Next.js App Router convention)
  - Special files: `layout.tsx`, `loading.tsx`, `error.tsx`

- **Variables/Functions:** `camelCase` (e.g., `const searchInput`, `function handleClick`)
- **Types/Interfaces:** `PascalCase` (e.g., `interface UserResponse`, `type AiBriefResult`)
- **Constants:** `SCREAMING_SNAKE_CASE` or `camelCase` depending on scope
- **React Components:** `PascalCase` when exported (e.g., `export function CommandPalette`)
- **Enum values:** `SCREAMING_SNAKE_CASE` or `camelCase` (context-dependent)

**Code Style:**
- Line ending: LF (Unix style)
- Indentation: 2 spaces (standard for JavaScript/TypeScript)
- Quotes: Single quotes preferred (enforced by linter config)
- Semicolons: Required (enforced)
- Trailing commas: Yes, where valid (arrays, objects, parameters)
- Null/undefined checks: Prefer optional chaining (`?.`) and nullish coalescing (`??`)

**Import Organization:**
- Group imports: React/third-party → internal modules → styles
- Use path aliases (`@/...`) for internal imports
- Avoid relative paths in imports (use `@/` prefix)

**Examples:**
```typescript
// File: client/src/components/command-palette.tsx
'use client';

interface CommandItem {
  id: string;
  name: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuthStore();

  const handleCommand = () => {
    // ...
  };
}

// File: client/src/lib/store.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist((set) => ({ /* ... */ }))
);

// File: client/src/hooks/use-ai-brief.ts
export interface AiBriefResult {
  summary: string;
  generatedAt: number;
}

export function useAiBrief(data?: DashboardData) {
  return useQuery<AiBriefResult>({ /* ... */ });
}
```

---

## Function/Variable Naming Patterns

### Rust Functions

| Pattern | Purpose | Example |
|---------|---------|---------|
| `find_*` | Search/retrieve single item | `find_by_id`, `find_by_username` |
| `list_*` or just `list` | Retrieve multiple items with pagination | `list`, `list_by_group` |
| `create_*` | Create new resource | `create`, `create_with_hash` |
| `update_*` | Update existing resource | `update` |
| `delete_*` | Remove resource | `delete` |
| `count_*` | Count items | `count` |
| `health_*` | Health check | `health_check` |
| `build_*` | Construct/assemble | `build_router` |
| `is_*` / `has_*` | Boolean predicates | `is_expired`, `has_token` |

### TypeScript Hooks & Functions

| Pattern | Purpose | Example |
|---------|---------|---------|
| `use*` | React custom hooks | `useContainers`, `useAuthStore`, `useAiBrief` |
| `handle*` | Event handlers | `handleClick`, `handleSubmit`, `handleChange` |
| `set*` | State setters (in functions) | `setOpen`, `setSearch`, `setFilter` |
| `fetch*` | Data fetching | `fetchContainers` (internal to hooks) |
| `format*` | Data formatting | `formatBytes`, `formatDate` |
| `validate*` / `is*` | Validation/checks | `validateEmail`, `isExpired` |
| `create*` | Factory functions | `createApiClient` |

---

## Documentation Style

### Rust Documentation

All public items should have doc comments:

```rust
/// Module-level documentation at the top of the file.
//!
//! Describes what this module does and provides context.

/// Brief description of the item.
///
/// More detailed explanation can follow with examples:
///
/// ```
/// let result = find_by_id(pool, id).await?;
/// ```
pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>> {
    // ...
}
```

**Rules:**
- Use `//!` for module documentation (at top of file)
- Use `///` for item documentation
- Use `//` for inline code comments
- Avoid markdown formatting in comments (keep simple)
- Doc tests can be included in triple-backtick code blocks
- Format doc comment code at ~80 chars width

### TypeScript Documentation

```typescript
/**
 * Custom fixtures for SignApps E2E tests
 */
export const test = base.extend({
  storageState: authFile,
});

/**
 * Authenticated test fixture
 * Uses stored authentication state for tests that require login
 */
export const authenticatedTest = base.extend({
  storageState: authFile,
});

// Inline comments for complex logic
const expires_at = std::time::SystemTime::now()
  .duration_since(std::time::UNIX_EPOCH)
  .unwrap()
  .as_secs()
  + ttl.as_secs();
```

**Rules:**
- Use JSDoc (`/** ... */`) for exported functions/components
- Use `//` for inline comments
- Keep comments concise and actionable
- Document component props via TypeScript interfaces
- Include examples in JSDoc when helpful

---

## Architecture Patterns

### Repository Pattern (Rust)

All data access is through repository structs:

```rust
pub struct UserRepository;

impl UserRepository {
    pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>> {
        // Implementation using sqlx
    }

    pub async fn create(pool: &PgPool, user: CreateUser) -> Result<User> {
        // Implementation
    }
}
```

**Location:** `crates/signapps-db/src/repositories/`
**Files:**
- `user_repository.rs`
- `container_repository.rs`
- `group_repository.rs`
- `certificate_repository.rs`
- `device_repository.rs`
- etc.

### Handler Pattern (Rust)

HTTP handlers are organized by domain:

```rust
pub struct ListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    // ... fields
}

pub async fn list_users(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<UserResponse>>> {
    // Handler implementation
}
```

**Location:** `services/*/src/handlers/`
**Pattern:**
- Request DTOs: `*Request` with `#[derive(Deserialize, Validate)]`
- Response DTOs: `*Response` with `#[derive(Serialize)]`
- Pagination: `ListQuery` with `limit` and `offset`
- Convert DB models → Response DTOs using `impl From`

### Error Handling (Rust)

All handlers return `Result<T, AppError>` where `AppError` implements RFC 7807:

```rust
use signapps_common::{Error, Result};

pub enum Error {
    InvalidCredentials,
    NotFound(String),
    Unauthorized,
    Validation(String),
    Database(String),
    // ... more variants
}

// In handlers:
let user = UserRepository::find_by_id(&pool, id)
    .await?
    .ok_or(Error::NotFound("User not found".to_string()))?;
```

---

## Zustand Store Pattern (TypeScript)

State management uses Zustand with persistence:

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) =>
        set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

**Location:** `client/src/lib/store.ts`

---

## React Hooks Pattern (TypeScript)

Custom hooks follow naming convention and use React Query:

```typescript
export function useContainers() {
  return useQuery({
    queryKey: ['containers'],
    queryFn: async () => {
      const res = await containersApi.get<Container[]>('/');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAiBrief(data?: DashboardData) {
  return useQuery<AiBriefResult>({
    queryKey: ['ai-brief', data?.containers],
    queryFn: async () => {
      const res = await aiApi.chat(prompt);
      return { summary: res.data.answer };
    },
    enabled: !!data,
    staleTime: 5 * 60 * 1000,
  });
}
```

**Location:** `client/src/hooks/`
**Pattern:**
- Use `use` prefix for all hooks
- File naming: `use-hook-name.ts`
- Export types alongside hooks
- Use React Query for data fetching
- Set appropriate `staleTime` based on data volatility

---

## Component Structure (TypeScript)

Components follow React 19 with Server Components:

```typescript
'use client'; // Only if interactive

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Container } from '@/components/ui/container';
import { useContainers } from '@/hooks/use-containers';

interface ComponentProps {
  id: string;
  onAction?: () => void;
}

export function MyComponent({ id, onAction }: ComponentProps) {
  const [state, setState] = useState(false);
  const { data } = useContainers();

  return (
    <Container>
      {/* JSX */}
    </Container>
  );
}
```

**Rules:**
- Use `'use client'` directive only when needed (interactivity, hooks)
- Props as typed interfaces
- Event handlers use `handle*` naming
- Use `@/` path aliases for imports
- Prefer composition over deep nesting

---

## Type Safety Rules

### Rust

- Use `Result<T, Error>` for all fallible operations
- Leverage `Option<T>` for nullable values
- Use unit struct pattern for marker types (e.g., `pub struct UserRepository;`)
- Derive `Debug`, `Clone`, `Serialize`, `Deserialize` on public types
- Use `#[serde(skip_serializing)]` to hide sensitive fields (passwords, tokens)

### TypeScript

- Enable strict mode (enforced in `tsconfig.json`)
- Type function parameters and return types explicitly
- Use interfaces for object shapes, types for unions/intersections
- Avoid `any` type; use `unknown` if necessary
- Use discriminated unions for complex state

---

## File Organization

### Rust Workspace Structure

```
crates/
  signapps-common/src/        ← Shared types, middleware, error handling
  signapps-db/src/
    models/                   ← Entity types (user.rs, container.rs, etc.)
    repositories/             ← Data access (user_repository.rs, etc.)
  signapps-cache/src/         ← TTL cache service
  signapps-runtime/src/       ← DB lifecycle, hardware detection, models

services/
  signapps-identity/src/
    handlers/                 ← HTTP handlers (auth.rs, users.rs, etc.)
    auth.rs                   ← Auth logic
  signapps-containers/src/handlers/
  signapps-ai/src/
    handlers/                 ← HTTP endpoints
    embeddings/               ← Embedding logic
    llm/                      ← LLM providers
    indexer/                  ← RAG indexing
```

### TypeScript (Next.js) Structure

```
client/src/
  app/                        ← Next.js App Router pages (page.tsx)
    containers/page.tsx
    dashboard/page.tsx
    login/page.tsx
  components/
    layout/                   ← Shared layouts
    containers/               ← Feature components
    ai/
    ui/                       ← Shadcn UI components
  hooks/                      ← Custom React hooks (use-*.ts)
  lib/
    api.ts                    ← Axios clients
    store.ts                  ← Zustand stores
    utils.ts                  ← Utilities
  styles/                     ← Global CSS
```

---

## Linting & Formatting

### Rust

**Clippy Lints:**
- Strict mode: `-D warnings` enforced in CI
- Cognitive complexity threshold: 30
- Too many lines: 150
- Too many args: 8

**Command:** `cargo lint` (or `cargo clippy --workspace --all-features -- -D warnings`)

**Format Check:** `cargo fmt --all -- --check`

### TypeScript

**ESLint Config:** `client/eslint.config.mjs`
- Uses `eslint-config-next` with core web vitals
- TypeScript support enabled
- Next.js-specific rules

**Command:** `npm run lint` (runs ESLint)

**No Prettier Config:** Project relies on Next.js default formatting

---

## Summary Table

| Aspect | Rust | TypeScript |
|--------|------|-----------|
| **Formatter** | rustfmt | Next.js default |
| **Linter** | Clippy (-D warnings) | ESLint 9+ |
| **Max Line Width** | 100 | Unbounded |
| **Indentation** | 4 spaces | 2 spaces |
| **File Naming** | snake_case | kebab-case |
| **Function Naming** | snake_case | camelCase (functions), PascalCase (components) |
| **Type Naming** | PascalCase | PascalCase |
| **Imports** | Grouped StdExternalCrate | Group by category, use @/ alias |
| **Error Handling** | `Result<T, Error>` | try-catch, error states |
| **Async** | `.await?` | `async/await` |
| **State** | Shared via Extension | Zustand stores |
| **Testing** | #[cfg(test)] modules | Playwright E2E, Jest (if added) |
