# Testing Practices & Guidelines

## Test Frameworks & Tools

### Rust Testing

**Framework:** Built-in `#[cfg(test)]` modules with `tokio::test` runtime

**Tools & Dependencies:**
- `tokio-test` - Tokio test utilities
- `cargo test` - Built-in test runner
- `sqlx` - Query testing via compile-time checks

**Running Tests:**
```bash
# All tests
cargo test --workspace --all-features

# Single crate
cargo test -p signapps-identity

# Filter by name
cargo test -p signapps-db -- group

# With backtrace
RUST_BACKTRACE=1 cargo test

# Verbose output
cargo test -- --nocapture
```

**Test Configuration:**
Located in `.cargo/config.toml` - tests run with:
- `RUST_BACKTRACE=1` (enabled by default)
- `RUST_LOG=info,signapps=debug,sqlx=warn`

---

### TypeScript/JavaScript Testing

**E2E Testing Framework:** Playwright

**Tools & Dependencies:**
- `@playwright/test` - E2E testing framework
- Playwright config: `client/playwright.config.ts`
- Test setup: `client/e2e/` directory

**Commands:**
```bash
cd client
npm run test:e2e           # Run all E2E tests
npm run test:e2e:ui        # UI mode (interactive)
npm run test:e2e:headed    # Run with browser visible
npm run test:e2e:debug     # Debug mode
npm run test:e2e:chromium  # Single browser
npm run test:e2e:report    # Show test report
```

**Configuration** (`client/playwright.config.ts`):
- Test directory: `./e2e`
- Base URL: `http://localhost:3010`
- Parallel execution: enabled
- Retries on CI: 2, locally: 0
- Screenshots: on failure
- Videos: on first retry
- Traces: on first retry
- HTML reporter: saved to `playwright-report/`

---

## Test Organization

### Rust Test Structure

**Location:** Inline with source code in `#[cfg(test)]` modules

**Pattern:** All tests are co-located with implementation

```rust
// File: crates/signapps-cache/src/lib.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_set_and_get() {
        let cache = CacheService::default_config();
        cache.set("key1", "value1", Duration::from_secs(60)).await;
        let val = cache.get_checked("key1").await;
        assert_eq!(val, Some("value1".to_string()));
    }

    #[tokio::test]
    async fn test_del() {
        let cache = CacheService::default_config();
        cache.set("key1", "value1", Duration::from_secs(60)).await;
        cache.del("key1").await;
        let val = cache.get_checked("key1").await;
        assert_eq!(val, None);
    }

    #[test]
    fn test_health_check() {
        let cache = CacheService::default_config();
        assert!(cache.health_check());
    }
}
```

**File:** `crates/signapps-cache/src/lib.rs` (lines 156-222)

**Key Points:**
- Tests are in `mod tests` block with `#[cfg(test)]` attribute
- Async tests use `#[tokio::test]`
- Sync tests use `#[test]`
- Tests import using `use super::*;`
- Each test is a separate async function

---

### TypeScript E2E Test Structure

**Location:** `client/e2e/` directory

**Files:**
- `auth.spec.ts` - Authentication flow tests
- `containers.spec.ts` - Containers page tests
- `navigation.spec.ts` - Navigation tests
- `storage.spec.ts` - Storage page tests
- `fixtures.ts` - Custom test fixtures and helpers
- `auth.setup.ts` - Authentication setup for tests
- `global.setup.ts` - Global setup (runs once)

**Pattern:** Describe-based organization with custom fixtures

```typescript
// File: client/e2e/auth.spec.ts

import { unauthenticatedTest, expect, testData, selectors } from './fixtures';

/**
 * Authentication E2E Tests
 * Tests login flow, logout, and route protection
 */

unauthenticatedTest.describe('Authentication Flow', () => {
  unauthenticatedTest.describe('Login Page', () => {
    unauthenticatedTest('should display login form with all elements', async ({ page }) => {
      await page.goto('/login');

      // Check page title and description
      await expect(page.getByText('Welcome Back')).toBeVisible();
      await expect(page.getByText('Sign in to your SignApps account')).toBeVisible();

      // Check form elements
      await expect(page.getByLabel('Username')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
    });

    unauthenticatedTest('should toggle password visibility', async ({ page }) => {
      await page.goto('/login');
      const passwordInput = page.getByLabel('Password');
      await expect(passwordInput).toHaveAttribute('type', 'password');

      // Toggle visibility...
      await expect(passwordInput).toHaveAttribute('type', 'text');
    });
  });
});
```

**Test Fixtures** (`client/e2e/fixtures.ts`):

```typescript
// Custom fixture for authenticated tests
export const test = base.extend({
  storageState: authFile,
});

// Custom fixture for unauthenticated tests
export const unauthenticatedTest = base.extend({
  storageState: { cookies: [], origins: [] },
});

// Shared test data
export const testData = {
  validUser: {
    username: 'admin',
    password: 'admin123',
  },
  testContainer: {
    name: 'test-container-e2e',
    image: 'nginx:alpine',
  },
};

// Page selectors (for maintainability)
export const selectors = {
  loginForm: {
    username: 'input[id="username"]',
    password: 'input[id="password"]',
    submitButton: 'button[type="submit"]',
  },
};
```

---

## Test Types & Coverage

### Rust: Unit Tests

**Location:** `crates/signapps-cache/src/lib.rs` (lines 156-222)

**Examples:**
1. **Cache operations** - Set, get, delete, exists
2. **Counter operations** - Increment, decrement, reset
3. **TTL/Expiry** - Expired entries are removed
4. **Health checks** - Service availability

```rust
#[tokio::test]
async fn test_expired_entry() {
    let cache = CacheService::default_config();
    cache.set("expired", "val", Duration::from_secs(0)).await;
    tokio::time::sleep(Duration::from_millis(10)).await;
    let val = cache.get_checked("expired").await;
    assert_eq!(val, None);  // Should be expired
}

#[tokio::test]
async fn test_counters() {
    let cache = CacheService::default_config();
    assert_eq!(cache.get_counter("hits"), 0);
    assert_eq!(cache.incr("hits"), 1);
    assert_eq!(cache.incr("hits"), 2);
    assert_eq!(cache.decr("hits"), 1);
}
```

**Current Coverage:** Limited but growing
- Cache operations: basic set/get/delete/exists
- Counter operations: incr/decr/reset
- TTL management: expiry validation
- Health checks: basic availability

**Test File:** `crates/signapps-cache/src/lib.rs`

---

### TypeScript: E2E Tests

**Location:** `client/e2e/` directory

**Test Categories:**

#### 1. Authentication Tests (`auth.spec.ts`)
- Login form display
- Password visibility toggle
- Login with valid credentials
- Login failure with invalid credentials
- Route protection
- Logout flow
- MFA verification

#### 2. Navigation Tests (`navigation.spec.ts`)
- Sidebar navigation
- Top navigation
- Route transitions
- Command palette functionality

#### 3. Containers Tests (`containers.spec.ts`)
- Container list display
- Filter buttons (all, running, stopped)
- Search functionality
- Container cards/empty state
- Container actions (start, stop, restart)
- Container details viewing
- Log viewing
- Terminal access

#### 4. Storage Tests (`storage.spec.ts`)
- File browsing
- Bucket operations
- Upload/download
- Delete operations
- Search and filtering

**Example Test Structure:**

```typescript
test.describe('Containers Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/containers');
  });

  test.describe('Container List Display', () => {
    test('should display containers page with title', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Containers' })).toBeVisible();
    });

    test('should display action buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /new container/i })).toBeVisible();
    });

    test('should filter containers by status', async ({ page }) => {
      await page.getByRole('button', { name: 'Running' }).click();
      const runningButton = page.getByRole('button', { name: 'Running' });
      await expect(runningButton).toHaveAttribute('data-state', 'active');
    });
  });
});
```

**Files:**
- `client/e2e/auth.spec.ts`
- `client/e2e/navigation.spec.ts`
- `client/e2e/containers.spec.ts`
- `client/e2e/storage.spec.ts`

---

## Test Setup & Fixtures

### Rust Test Setup

**Database:** Tests require PostgreSQL with pgvector extension

```bash
# Run with database (CI requirement)
cargo test --workspace --all-features
```

**Async Runtime:** Tests use Tokio's async runtime

```rust
#[tokio::test]
async fn test_async_operation() {
    // Test implementation
}
```

**Test Helpers:** Create temporary instances for testing

```rust
#[tokio::test]
async fn test_cache_service() {
    let cache = CacheService::default_config();
    // Test the instance
}
```

---

### TypeScript Test Setup

**Global Setup** (`client/e2e/global.setup.ts`):
- Creates auth directory once before all tests
- Initializes placeholder auth file for storage state

```typescript
setup('create auth directory', async () => {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const authFile = path.join(authDir, 'user.json');
  if (!fs.existsSync(authFile)) {
    const defaultState = { cookies: [], origins: [] };
    fs.writeFileSync(authFile, JSON.stringify(defaultState, null, 2));
  }
});
```

**Auth Setup** (`client/e2e/auth.setup.ts`):
- Authenticates test user once
- Saves authentication state for reuse across tests

**Custom Fixtures** (`client/e2e/fixtures.ts`):

```typescript
// Authenticated test fixture
export const test = base.extend({
  storageState: authFile,  // Reuse saved auth state
});

// Unauthenticated test fixture (for login testing)
export const unauthenticatedTest = base.extend({
  storageState: { cookies: [], origins: [] },  // Fresh context
});
```

**Base URL:** Configured to `http://localhost:3010`

---

## Running Tests in CI/CD

### Rust Tests (GitHub Actions)

Located in `.github/workflows/` (referenced in CI pipeline):

```bash
# Full check before commit (from .cargo/config.toml)
cargo precommit  # runs: fmt → lint → test

# Or individually:
cargo fmt --all -- --check
cargo clippy --workspace --all-features -- -D warnings
cargo test --workspace --all-features
cargo audit
```

**Requirements:**
- PostgreSQL running locally
- pgvector extension installed
- DATABASE_URL environment variable set

---

### TypeScript Tests (Playwright)

**Prerequisites:**
1. Frontend dev server running: `npm run dev` (port 3010)
2. Backend services running (identity, containers, storage, ai, media, etc.)
3. Playwright browsers installed

**Running Tests:**

```bash
cd client

# Install dependencies and Playwright browsers
npm install

# Run E2E tests
npm run test:e2e

# View results in HTML report
npm run test:e2e:report

# Run with UI (interactive)
npm run test:e2e:ui

# Debug specific test
npm run test:e2e -- auth.spec.ts
```

**CI Configuration** (in `client/playwright.config.ts`):
```typescript
retries: process.env.CI ? 2 : 0,       // Retry on CI
workers: process.env.CI ? 1 : undefined, // Single worker on CI
forbidOnly: !!process.env.CI,          // Fail if test.only is present
```

---

## Test Data & Fixtures

### Shared Test Data

**Location:** `client/e2e/fixtures.ts`

```typescript
export const testData = {
  validUser: {
    username: 'admin',
    password: 'admin123',
  },
  invalidUser: {
    username: 'invalid_user',
    password: 'wrong_password',
  },
  testContainer: {
    name: 'test-container-e2e',
    image: 'nginx:alpine',
  },
  testBucket: {
    name: 'test-bucket-e2e',
  },
  testFolder: {
    name: 'test-folder-e2e',
  },
};
```

### Shared Selectors

**Location:** `client/e2e/fixtures.ts`

```typescript
export const selectors = {
  loginForm: {
    username: 'input[id="username"]',
    password: 'input[id="password"]',
    submitButton: 'button[type="submit"]',
    errorMessage: '.bg-destructive\\/10',
    rememberMe: 'button[id="remember"]',
  },
  dashboard: {
    title: 'h1:has-text("Dashboard")',
    statCards: '[class*="StatCard"]',
    refreshButton: 'button:has-text("Refresh")',
  },
  sidebar: {
    container: 'aside',
    navLinks: 'nav a',
    logo: 'a:has-text("SignApps")',
    collapseButton: 'aside button',
  },
};
```

---

## Testing Best Practices

### Rust

1. **Use `#[tokio::test]` for async tests**
   ```rust
   #[tokio::test]
   async fn test_async_operation() { }
   ```

2. **Use descriptive test names**
   ```rust
   #[tokio::test]
   async fn test_expired_entry()  // Good
   #[tokio::test]
   async fn test_ttl()            // Less clear
   ```

3. **Test one concern per test**
   ```rust
   #[tokio::test]
   async fn test_set_and_get() { }  // OK for related operations
   ```

4. **Use assertions appropriately**
   ```rust
   assert_eq!(val, expected);
   assert!(condition);
   assert!(cache.health_check());
   ```

5. **Create test helpers for setup**
   ```rust
   let cache = CacheService::default_config();
   ```

---

### TypeScript

1. **Use describe blocks for organization**
   ```typescript
   test.describe('Feature', () => {
     test.describe('Subfeature', () => {
       test('should do something', async ({ page }) => { });
     });
   });
   ```

2. **Use beforeEach for common setup**
   ```typescript
   test.beforeEach(async ({ page }) => {
     await page.goto('/containers');
   });
   ```

3. **Use appropriate selectors**
   ```typescript
   // Good - semantic
   await page.getByRole('button', { name: /refresh/i }).click();
   await page.getByLabel('Username').fill('admin');

   // Avoid - brittle
   await page.click('button.refresh-btn');
   ```

4. **Use custom fixtures for state management**
   ```typescript
   export const test = base.extend({
     storageState: authFile,  // Authenticated context
   });
   ```

5. **Test user interactions, not implementation**
   ```typescript
   // Good - what user sees
   await expect(page.getByText('Containers')).toBeVisible();

   // Avoid - internal details
   await expect(page.locator('.container-list')).toHaveCount(5);
   ```

6. **Use test data constants**
   ```typescript
   await page.getByLabel('Username').fill(testData.validUser.username);
   ```

---

## Coverage Goals

### Current Status

**Rust:**
- Limited unit test coverage
- Core cache operations tested (`crates/signapps-cache/src/lib.rs`)
- Database operations have compile-time guarantees via sqlx

**TypeScript:**
- E2E tests for main user journeys
- Auth flow covered (login, logout, MFA)
- Container operations covered
- Navigation tested
- Storage operations covered

### Target Coverage

**Rust:**
- Repository layer: Increase coverage for CRUD operations
- Service layer: Add integration tests
- Handler layer: Add request/response tests
- Error cases: Test error paths

**TypeScript:**
- Feature completeness: Cover all major user flows
- Edge cases: Error states, loading states
- Accessibility: Semantic HTML and screen reader compatibility
- Performance: Critical rendering path timing

---

## Continuous Integration

### CI Pipeline

Defined in `.github/workflows/` (summarized from CLAUDE.md):

1. **Format Check:** `cargo fmt --all -- --check`
2. **Linting:** `cargo clippy --workspace --all-features -- -D warnings`
3. **Testing:** `cargo test --workspace --all-features`
4. **Security:** `cargo audit`
5. **Coverage:** `cargo llvm-cov` → Codecov

**Database Requirement:**
- PostgreSQL must be running
- pgvector extension required
- DATABASE_URL configured

**Run Tests Locally Before Commit:**
```bash
cargo precommit  # From .cargo/config.toml
```

---

## Test Configuration Files

| File | Purpose |
|------|---------|
| `Cargo.toml` | Workspace test dependencies (tokio-test) |
| `.cargo/config.toml` | Test environment, aliases (precommit) |
| `client/playwright.config.ts` | Playwright E2E configuration |
| `client/e2e/fixtures.ts` | Custom test fixtures and data |
| `client/e2e/global.setup.ts` | Global test setup |
| `client/e2e/auth.setup.ts` | Authentication setup |
| `client/package.json` | NPM test scripts |

---

## Summary Table

| Aspect | Rust | TypeScript |
|--------|------|-----------|
| **Framework** | Built-in `#[cfg(test)]` + tokio-test | Playwright |
| **Test Location** | Inline with source code | `client/e2e/` directory |
| **Async Support** | `#[tokio::test]` | `async ({ page }) => { }` |
| **Fixtures** | Manual setup (CacheService::default_config) | Custom fixtures in `fixtures.ts` |
| **Setup/Teardown** | `beforeEach` (via test harness) | `test.beforeEach`, `global.setup.ts` |
| **Assertions** | `assert_eq!`, `assert!` | `await expect()` |
| **Selectors** | N/A | Playwright locators |
| **Test Data** | Hardcoded in tests | `testData` constant |
| **Coverage** | Basic (cache, counters) | E2E (auth, containers, storage, nav) |
| **CI Integration** | `cargo test --workspace` | `npm run test:e2e` |
| **Retry Strategy** | None (local), N/A | 0 (local), 2 (CI) |
| **Parallel Execution** | Yes | Yes (default) |
