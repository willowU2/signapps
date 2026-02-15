# Testing Patterns

**Analysis Date:** 2026-02-15

## Test Framework

**Rust:**
- Runner: cargo test (built-in)
- Async: tokio-test 0.4 for async test runtime
- Config: No dedicated test config file (uses Cargo.toml dev-dependencies)

**Frontend E2E:**
- Runner: Playwright 1.58.2
- Config: `client/playwright.config.ts`
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12)

**Run Commands:**
```bash
# Rust
cargo test --workspace --all-features    # All tests
cargo test -p signapps-identity          # Single crate
cargo test -- test_name                  # Filter by name
cargo t                                  # Alias for cargo test

# Frontend E2E
cd client
npm run test:e2e                         # All browsers
npm run test:e2e:chromium                # Chromium only
npm run test:e2e:ui                      # With UI mode
npm run test:e2e:headed                  # Headed mode
npm run test:e2e:debug                   # Debug mode
npm run test:e2e:report                  # Show HTML report
```

## Test File Organization

**Rust:**
- Location: Inline `#[cfg(test)]` modules within source files
- No separate `tests/` directory convention observed
- Test discovery: `#[test]` or `#[tokio::test]` attributes

**Frontend E2E:**
- Location: `client/e2e/` directory (separate from source)
- Naming: `{feature}.spec.ts` (e.g., `auth.spec.ts`, `containers.spec.ts`, `storage.spec.ts`)
- Setup: `auth.setup.ts` (runs before dependent tests)
- Fixtures: `fixtures.ts` (shared test data and selectors)
- Global: `global.setup.ts`

**Structure:**
```
client/
  e2e/
    auth.setup.ts              # Authentication setup (runs first)
    global.setup.ts            # Global setup
    fixtures.ts                # Test data, selectors, helpers
    auth.spec.ts               # Authentication flow tests
    containers.spec.ts         # Container management tests
    storage.spec.ts            # Storage management tests
    navigation.spec.ts         # Navigation tests
  playwright.config.ts         # Playwright configuration
```

## Test Structure

**E2E Suite Organization:**
```typescript
import { unauthenticatedTest, test, selectors, testData } from './fixtures';

unauthenticatedTest.describe('Authentication Flow', () => {
  unauthenticatedTest('should display login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Welcome Back')).toBeVisible();
  });

  unauthenticatedTest('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill(selectors.loginForm.username, testData.validUser.username);
    await page.fill(selectors.loginForm.password, testData.validUser.password);
    await page.click(selectors.loginForm.submit);
    await page.waitForURL('/dashboard');
  });
});
```

**Patterns:**
- `unauthenticatedTest` for login/public page tests (fresh browser)
- `test` for authenticated tests (uses stored auth state)
- Playwright auto-waits for elements
- Screenshots on failure, video on first retry

## Mocking

**Not heavily used:**
- Rust: No mock framework observed (tests use real DB in CI)
- Frontend: Playwright tests run against live services (not mocked)

**CI Database:**
- PostgreSQL 16 + pgvector service in GitHub Actions
- Fresh database per CI run

## Fixtures and Factories

**E2E Test Data** (`client/e2e/fixtures.ts`):
```typescript
export const testData = {
  validUser: { username: 'admin', password: 'admin123' },
  invalidUser: { username: 'invalid', password: 'wrong' },
  testContainer: { name: 'test-container-e2e', image: 'nginx:alpine' },
  testBucket: { name: 'test-bucket-e2e' },
  testFolder: { name: 'test-folder-e2e' },
};

export const selectors = {
  loginForm: { username: 'input[id="username"]', password: '...', submit: '...' },
  dashboard: { title: 'h1:has-text("Dashboard")' },
};
```

**Auth State Fixture:**
```typescript
// Authenticated test uses stored session
export const test = base.extend({ storageState: authFile });
// Unauthenticated test uses clean session
export const unauthenticatedTest = base.extend({ storageState: { cookies: [], origins: [] } });
```

## Coverage

**Requirements:**
- No enforced coverage target
- Coverage tracked via cargo-llvm-cov -> Codecov

**Configuration:**
- CI: `cargo llvm-cov --workspace --lcov --output-path lcov.info`
- Upload to Codecov with `codecov/codecov-action@v4`

**View Coverage:**
```bash
cargo llvm-cov --workspace --html
# Open target/llvm-cov/html/index.html
```

## Test Types

**Unit Tests (Rust):**
- Inline `#[cfg(test)]` modules
- Test single functions in isolation
- Limited coverage currently (infrastructure-focused codebase)

**Integration Tests (CI):**
- Full test suite with real PostgreSQL + pgvector
- `cargo test --workspace --all-features`
- Validates compile-time SQL queries

**E2E Tests (Playwright):**
- Full browser tests against running services
- Auth flows, container management, storage operations, navigation
- Multi-browser + mobile device testing
- Retry: 2 retries on CI, 0 in dev
- Parallel execution in dev, sequential on CI
- Base URL: `http://localhost:3010`

## CI Pipeline

**GitHub Actions** (`.github/workflows/ci.yml`):
1. `cargo check --workspace --all-features`
2. `cargo fmt --all -- --check`
3. `cargo clippy --workspace --all-features -- -D warnings`
4. `cargo test --workspace --all-features` (with PostgreSQL 16 + pgvector)
5. `cargo audit` (security)
6. `cargo llvm-cov` (coverage -> Codecov)

**Cargo Aliases:**
```toml
t = "test"
lint = "clippy --workspace --all-targets --all-features -- -D warnings"
precommit = ["fmt", "lint", "test"]
```

---

*Testing analysis: 2026-02-15*
*Update when test patterns change*
