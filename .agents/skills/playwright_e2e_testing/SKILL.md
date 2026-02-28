---
name: playwright_e2e_testing
description: Guidelines for writing and maintaining Playwright E2E tests
---
# E2E Testing with Playwright

1. **Location**: Tests are typically located in `e2e/` or `client/e2e/`.
2. **Commands**: Ensure you use `npx playwright test` to run the test suite.
3. **Selectors**: 
   - Prefer user-facing attributes such as text content, labels, or testing IDs (`data-testid`).
   - Avoid relying on structural CSS classes (e.g., Tailwind classes) which may change frequently.
4. **Authentication**: Use state storage features (like `authFile` fixtures) to bypass repetitive login UI flows when testing authenticated areas.
5. **Fixtures**: Extend the base tests with custom fixtures for a cleaner test setup. For example: `export const authenticatedTest = base.extend({ storageState: authFile });`.
