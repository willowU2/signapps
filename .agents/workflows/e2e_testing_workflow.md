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
// turbo-all
   - Change directory to `client/`.
   - Command: `npx playwright test` (headless).
   - If adding a new feature, automatically generate the corresponding `.spec.ts` or `.test.ts` file in the Playwright suite.
   - Verify that UI selectors (`getByRole`, `getByTestId`) are resilient.

3. **Creation Strategy**:
   - Ask the user which feature needs tests.
   - Build tests systematically focusing on the "Happy Path" first, then the "Error Cases" (e.g., Invalid login, 404 Not Found, 403 Unauthorized).
