# Testing Patterns

**Analysis Date:** 2026-02-16

## Test Framework

**Rust Testing:**
- Runner: Built-in `cargo test` with `#[cfg(test)]` modules
- Async: `#[tokio::test]` for async test functions
- Assertions: Standard `assert!()`, `assert_eq!()`, expect-style with `Result`
- Location: Inline in source files (same file as code under test)

**TypeScript E2E Testing:**
- Runner: Playwright test runner (`npx playwright test`)
- Config: `client/playwright.config.ts`
- Browsers: Chromium, Firefox, WebKit
- Run commands:
  ```bash
  npm run test:e2e              # Run all E2E tests
  npm run test:e2e:ui           # Interactive UI
  npm run test:e2e:debug        # Debug mode
  ```

## Test File Organization

**Rust Test Location:**
- Inline: `src/lib.rs` or `src/handlers/users.rs`
- Module: `#[cfg(test)] mod tests { ... }`
- Pattern: Co-located with source code

**TypeScript E2E Location:**
- Directory: `client/e2e/` (separate from source)
- Files: `auth.spec.ts`, `containers.spec.ts`, `navigation.spec.ts`, `storage.spec.ts`
- Shared: `client/e2e/fixtures.ts` (test data, selectors)
- Setup: `client/e2e/global.setup.ts`

## Test Structure

**Rust Pattern:**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validation() {
        // Arrange
        let input = "test";

        // Act
        let result = validate(input);

        // Assert
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_async_operation() {
        let db = setup_test_db().await;
        let user = create_test_user(&db).await;
        assert_eq!(user.email, "test@example.com");
    }
}
```

**TypeScript (Playwright) Pattern:**
```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Dashboard', () => {
    test('loads with user data', async ({ page }) => {
        // Arrange
        await loginAs(page, 'admin');

        // Act
        await page.goto('/dashboard');

        // Assert
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
        await expect(page.locator('text=Welcome')).toContainText('Welcome');
    });
});
```

## Mocking

**Rust (None currently used):**
- Tests use real database (via test fixtures)
- No mock libraries (prefer integration tests)

**TypeScript (Playwright):**
- No mocking library (tests against real API)
- Can use `page.route()` for API interception if needed
- Fixtures: Shared test data in `client/e2e/fixtures.ts`

**Example (TypeScript - intercepting API):**
```typescript
test('handles API error gracefully', async ({ page }) => {
    // Intercept API and return error
    await page.route('**/api/*/users', (route) => {
        route.abort('failed');
    });

    await page.goto('/users');
    await expect(page.locator('text=Error')).toBeVisible();
});
```

## Fixtures and Factories

**Rust Test Helpers:**
- Create test data inline or in helper functions
- Example: `create_test_user()`, `setup_test_db()`
- Location: Same test module or separate test utilities module

**TypeScript Test Fixtures:**
```typescript
// client/e2e/fixtures.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
    authenticatedPage: async ({ page }, use) => {
        await page.goto('/login');
        await page.fill('input[name="email"]', 'admin@example.com');
        await page.fill('input[name="password"]', 'password');
        await page.click('button:has-text("Login")');
        await page.waitForNavigation();
        await use(page);
    },
});

export async function loginAs(page, role) {
    // Reusable login helper
    await page.goto('/login');
    await page.fill('input[name="email"]', `${role}@example.com`);
    // ... continue login
}
```

## Coverage

**Requirements:**
- No hard target (tracked for awareness)
- Focus: Critical paths (authentication, data operations)
- Current: Unit test coverage for core utilities and services

**View Coverage:**
- Rust: `cargo tarpaulin` (if installed) or `cargo llvm-cov`
- TypeScript E2E: Coverage not applicable (end-to-end tests)

## Test Types

**Unit Tests (Rust):**
- Scope: Single function or method in isolation
- Mocking: Use real dependencies (database, etc.)
- Speed: <1s per test
- Location: `#[cfg(test)]` modules inline
- Examples: `crates/signapps-cache/src/lib.rs` (lines 156-222)

**Integration Tests (TypeScript - Playwright):**
- Scope: Full user flows (login → action → verify)
- Mocking: None (tests against real API)
- Setup: Global auth setup in `global.setup.ts`
- Location: `client/e2e/` directory
- Examples: `auth.spec.ts`, `containers.spec.ts`

**Manual Testing:**
- E2E scenarios not covered by Playwright
- Local development with real services
- GPU/hardware-specific scenarios

## Common Patterns

**Async Testing (Rust):**
```rust
#[tokio::test]
async fn test_database_operation() {
    let pool = create_test_db_pool().await;
    let result = fetch_user(&pool, user_id).await;
    assert!(result.is_ok());
}
```

**Error Testing (Rust):**
```rust
#[test]
fn test_validation_error() {
    let result = validate_email("");
    assert!(result.is_err());
}

#[tokio::test]
async fn test_async_error() {
    let result = fetch_non_existent_user().await;
    assert!(matches!(result, Err(AppError::NotFound(_))));
}
```

**Error Testing (TypeScript):**
```typescript
test('shows error message on invalid input', async ({ page }) => {
    await page.goto('/login');
    await page.click('button:has-text("Login")');

    // Email validation error appears
    await expect(page.locator('text=Email is required')).toBeVisible();
});
```

**Authentication Testing (TypeScript):**
```typescript
test('requires login for protected routes', async ({ page }) => {
    // Navigate to protected page without auth
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Should redirect to login
    expect(page.url()).toContain('/login');
});
```

## Run Commands

**Rust:**
```bash
cargo test --workspace              # All tests
cargo test -p signapps-cache       # Specific crate
cargo test test_name               # Filter by name
cargo test -- --test-threads=1     # Single threaded
cargo test -- --nocapture          # Show output
```

**TypeScript:**
```bash
npm run test:e2e                    # All E2E tests
npm run test:e2e:chromium          # Single browser
npm run test:e2e:ui                # Interactive mode
npm run test:e2e:debug             # Debug with inspector
npx playwright test auth.spec.ts   # Single file
npx playwright test -g "login"     # Match test name
```

## CI/CD Testing

**Pre-commit (Local):**
- `cargo fmt --all -- --check` - Formatting
- `cargo clippy --workspace --all-features -- -D warnings` - Linting
- `cargo test --workspace --all-features` - Unit tests (requires PostgreSQL)

**CI Pipeline (.github/workflows/):**
1. `cargo check --workspace --all-features`
2. `cargo fmt --all -- --check`
3. `cargo clippy --workspace --all-features -- -D warnings`
4. `cargo test --workspace --all-features`
5. `cargo audit` - Dependency security check
6. `cargo llvm-cov` - Coverage report → Codecov

**E2E in CI:**
- Playwright tests run against deployed test environment
- Screenshots/videos saved on failure

---

*Testing analysis: 2026-02-16*
*Update when test patterns change*
