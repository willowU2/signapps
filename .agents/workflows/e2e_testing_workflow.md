---
description: Step-by-step testing and coverage workflow
---
# Automated Testing Workflow

When asked to "write tests", "run tests", or "increase coverage", execute the following testing procedures.

1. **Backend Unit & Integration Tests (Rust)**:
// turbo-all
   - Command: `cargo test --workspace --all-features`
   - If tests fail, diagnose the output using `rust_debugging_workflow`.
   - Identify the most complex business logic (e.g. `signapps-identity` auth logic, `signapps-storage` data handling) and ensure `#[cfg(test)]` modules exist.

2. **Automated E2E Tests (Playwright)**:
3. **Pre-Requisite Checking (CRITICAL)**:
// turbo-all
   - **ALWAYS** run `.\check_prereqs_and_test.ps1` before attempting to run Playwright tests. This script ensures the Postgres DB, Next.js frontend, and Cargo backend microservices are fully operational.
   - If the script fails, diagnose the missing dependency. Do not run headless tests against a dead server.

4. **Running E2E tests**:
// turbo-all
   - Change directory to `client/`.
   - Command: `npx playwright test` (headless).
   - If adding a new feature, automatically generate the corresponding `.spec.ts` or `.test.ts` file in the Playwright suite.
   - Verify that UI selectors (`getByRole`, `getByTestId`) are resilient.

5. **Creation Strategy & Data Principle (CRITICAL)**:
// turbo-all
   - **NO MOCK DATA ALLOWED**: You must NEVER use mock data or fake API responses for testing.
   - All tests must use real data generated through the actual user interface via standard CRUD (Create, Read, Update, Delete) operations.
   - Ask the user which feature needs tests.
   - Build tests systematically focusing on the "Happy Path" first, then the "Error Cases" (e.g., Invalid login, 404 Not Found, 403 Unauthorized).
