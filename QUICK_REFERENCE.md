# Quick Reference: Code Conventions & Testing

A quick lookup guide for the most common conventions in SignApps Platform.

## Rust Quick Reference

### File & Function Naming
```rust
// File: src/handlers/users.rs (snake_case)
// Function: find_by_id (snake_case)
pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>> { }

// Struct: UserRepository (PascalCase)
pub struct UserRepository;

// Constant: MAX_CONNECTIONS (SCREAMING_SNAKE_CASE)
const MAX_CONNECTIONS: u32 = 20;
```

### File Organization Pattern
```rust
//! User management module.
//! Provides CRUD operations for users.

use ...;

/// Main struct documentation.
pub struct UserRepository;

impl UserRepository {
    /// Method documentation.
    pub async fn find_by_id(...) -> Result<Option<User>> { }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_find_by_id() {
        // Test implementation
    }
}
```

### Common Patterns
```rust
// Error handling
let user = repo.find_by_id(id)
    .await?
    .ok_or(Error::NotFound("User not found".to_string()))?;

// Repository methods
pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>>
pub async fn find_by_username(pool: &PgPool, username: &str) -> Result<Option<User>>
pub async fn list(pool: &PgPool, limit: i64, offset: i64) -> Result<Vec<User>>
pub async fn count(pool: &PgPool) -> Result<i64>
pub async fn create(pool: &PgPool, user: CreateUser) -> Result<User>
pub async fn update(pool: &PgPool, id: Uuid, user: UpdateUser) -> Result<User>
pub async fn delete(pool: &PgPool, id: Uuid) -> Result<()>

// Test patterns
#[tokio::test]
async fn test_async_operation() { }

#[test]
fn test_sync_operation() { }
```

### Running Tests
```bash
cargo test --workspace --all-features     # All tests
cargo test -p signapps-cache              # Single crate
cargo test --lib                          # Library tests only
RUST_BACKTRACE=1 cargo test               # With backtrace
cargo precommit                           # Check before commit
```

### Formatting & Linting
```bash
cargo fmt --all                           # Format
cargo fmt --all -- --check                # Check only
cargo lint                                # Lint with -D warnings
cargo clippy --workspace --all-features -- -D warnings  # Full lint
```

---

## TypeScript Quick Reference

### File & Function Naming
```typescript
// File: components/command-palette.tsx (kebab-case)
// Hook: use-containers.ts (kebab-case with use- prefix)

// Component: CommandPalette (PascalCase)
export function CommandPalette() { }

// Function: handleClick (camelCase)
const handleClick = () => { };

// Interface: CommandItem (PascalCase)
interface CommandItem {
  id: string;
  name: string;
}

// Constant: MAX_RETRIES or maxRetries (context-dependent)
const MAX_RETRIES = 3;
```

### Component Pattern
```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useContainers } from '@/hooks/use-containers';

interface ComponentProps {
  id: string;
  onAction?: () => void;
}

export function MyComponent({ id, onAction }: ComponentProps) {
  const [state, setState] = useState(false);
  const { data: containers } = useContainers();

  const handleClick = () => {
    setState(!state);
  };

  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### Hook Pattern
```typescript
// File: hooks/use-containers.ts

export interface Container {
  id: string;
  name: string;
  status: string;
}

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
```

### Store Pattern
```typescript
// File: lib/store.ts

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
    { name: 'auth-storage' }
  )
);
```

### E2E Test Pattern
```typescript
// File: e2e/auth.spec.ts

import { unauthenticatedTest, expect, testData } from './fixtures';

unauthenticatedTest.describe('Authentication Flow', () => {
  unauthenticatedTest.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  unauthenticatedTest('should display login form', async ({ page }) => {
    await expect(page.getByText('Welcome Back')).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
  });

  unauthenticatedTest('should login with valid credentials', async ({ page }) => {
    await page.getByLabel('Username').fill(testData.validUser.username);
    await page.getByLabel('Password').fill(testData.validUser.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard|login\/verify)/);
  });
});
```

### Running Tests
```bash
npm run test:e2e                    # Run all E2E tests
npm run test:e2e:ui                # Interactive UI
npm run test:e2e:headed            # Visible browser
npm run test:e2e:chromium          # Single browser
npm run test:e2e:report            # Show report
npm run lint                       # ESLint
```

---

## Common Conventions Table

| Aspect | Rust | TypeScript |
|--------|------|-----------|
| **Max Line Width** | 100 chars | Unbounded |
| **Indentation** | 4 spaces | 2 spaces |
| **File Naming** | snake_case | kebab-case |
| **Function Naming** | snake_case | camelCase |
| **Type Naming** | PascalCase | PascalCase |
| **Constants** | SCREAMING_SNAKE_CASE | SCREAMING_SNAKE_CASE or camelCase |
| **Tests** | `#[cfg(test)]` inline | `client/e2e/*.spec.ts` |
| **Comments** | `//!` `///` `//` | `/** */` `//` |
| **Error Handling** | `Result<T, Error>` | try-catch, error states |
| **Async** | `.await?` | `async/await` |
| **State** | Extension<T> | Zustand stores |
| **Data Fetching** | sqlx | React Query / Axios |

---

## Testing Command Reference

### Rust
```bash
# Run all tests
cargo test --workspace --all-features

# Run specific crate tests
cargo test -p signapps-identity

# Filter tests by name
cargo test -p signapps-db -- group

# With output
cargo test -- --nocapture

# Setup before commit
cargo precommit  # runs: fmt → lint → test
```

### TypeScript
```bash
# E2E tests
npm run test:e2e

# With browser visible
npm run test:e2e:headed

# Interactive UI mode
npm run test:e2e:ui

# Single browser
npm run test:e2e:chromium

# View report
npm run test:e2e:report

# Linting
npm run lint
```

---

## Code Examples by Use Case

### Repository Query (Rust)
```rust
pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<User>> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM identity.users WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?;
    Ok(user)
}
```

### Handler Endpoint (Rust)
```rust
pub async fn list_users(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<UserResponse>>> {
    let users = UserRepository::list(&state.pool, query.limit.unwrap_or(10), 0).await?;
    let response: Vec<UserResponse> = users.into_iter().map(|u| u.into()).collect();
    Ok(Json(response))
}
```

### API Client (TypeScript)
```typescript
const identityApi = createApiClient(IDENTITY_URL);

const response = await identityApi.post('/auth/login', {
  username: 'admin',
  password: 'password',
});

const { access_token, refresh_token } = response.data;
localStorage.setItem('access_token', access_token);
```

### Component with Hook (TypeScript)
```typescript
export function ContainersList() {
  const { data: containers = [], isLoading } = useContainers();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() =>
    containers.filter(c => c.name.includes(search)),
    [containers, search]
  );

  if (isLoading) return <Skeleton />;

  return (
    <div>
      <Input
        placeholder="Search containers..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.map(container => (
        <ContainerCard key={container.id} container={container} />
      ))}
    </div>
  );
}
```

### E2E Test (TypeScript)
```typescript
test('should create a container', async ({ page }) => {
  await page.goto('/containers');
  await page.getByRole('button', { name: /new container/i }).click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  await page.getByLabel('Container Name').fill(testData.testContainer.name);
  await page.getByLabel('Image').fill(testData.testContainer.image);
  await page.getByRole('button', { name: /create/i }).click();

  await expect(page.getByText(testData.testContainer.name)).toBeVisible();
});
```

---

## Files to Reference

**Conventions/Patterns:**
- `rustfmt.toml` - Rust formatting rules
- `.cargo/config.toml` - Cargo aliases and environment
- `client/tsconfig.json` - TypeScript strict settings
- `client/eslint.config.mjs` - ESLint configuration
- `crates/signapps-common/src/auth.rs` - Type definitions
- `crates/signapps-common/src/error.rs` - Error handling
- `crates/signapps-db/src/repositories/user_repository.rs` - Repository pattern
- `services/signapps-identity/src/handlers/users.rs` - Handler pattern
- `client/src/lib/store.ts` - Zustand stores
- `client/src/lib/api.ts` - API clients
- `client/src/hooks/use-containers.ts` - Custom hooks

**Testing:**
- `crates/signapps-cache/src/lib.rs` (lines 156-222) - Rust unit tests
- `client/e2e/fixtures.ts` - Test fixtures and data
- `client/e2e/global.setup.ts` - Global setup
- `client/e2e/auth.spec.ts` - Auth tests
- `client/playwright.config.ts` - Playwright configuration

---

## Quick Lint & Format

```bash
# Rust: Before commit
cargo precommit

# Rust: Manual steps
cargo fmt --all
cargo clippy --workspace --all-features -- -D warnings
cargo test --workspace --all-features

# TypeScript: Before commit
npm run lint
npm run test:e2e

# Full check
cargo precommit && cd client && npm run lint && npm run test:e2e
```

---

## Key Takeaways

1. **Rust:** 100 char max, 4 spaces, snake_case files, strict clippy, tests inline
2. **TypeScript:** 2 spaces, kebab-case files, camelCase functions, PascalCase components
3. **Testing:** Rust = inline `#[cfg(test)]` modules, TypeScript = Playwright E2E
4. **Naming:** Functions snake_case (Rust) / camelCase (TS), Types always PascalCase
5. **Files:** Always snake_case (Rust), kebab-case (TypeScript)
6. **Hooks:** Always use `use*` prefix with kebab-case filenames
7. **Imports:** Use `@/` path alias in TypeScript, group imports in Rust
8. **Error Handling:** `Result<T, Error>` in Rust, error states in TypeScript
9. **Comments:** Doc comments for public items, keep comments simple
10. **Tests:** Run `cargo precommit` and `npm run test:e2e` before committing

For detailed information, see:
- `CONVENTIONS.md` - Comprehensive code style guide
- `TESTING.md` - Detailed testing frameworks and practices
