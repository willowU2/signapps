---
description: Security and vulnerabilities audit checklist
---
# Automated Security Audit Workflow

When asked to "check security", "run security audit", or "audit", execute these steps to ensure the application remains secure.

1. **Dependency Audit**:
// turbo-all
   - Rust: Run `cargo audit` to check for crates with reported vulnerabilities. (Suggest installing via `cargo install cargo-audit` if not present).
   - Node: Change to `client/` and run `npm audit` to check JS dependencies.

2. **Backend Authentication & Authorization (Rust)**:
   - Identify any new `axum::Router` routes.
   - **Critical**: Verify they are protected by the `Extension<Claims>` middleware if they handle user data.
   - **Critical**: Check Role-Based Access Control (RBAC). For admin endpoints, does the handler explicitly check `claims.role == 1`?

3. **Database Injection Check (SQLx)**:
   - Search for newly added SQL queries in `crates/signapps-db/src/repositories/`.
   - **Critical**: Ensure ALL queries use `sqlx::query!` or `sqlx::query_as!` macros for automatic parameterized queries.
   - Flag any usage of `format!` or string concatenation directly inside SQL queries.

4. **Frontend Security (Next.js)**:
   - Verify that HTTP calls to the backend include the Authorization Bearer token (via the Axios interceptor in `client/src/lib/api.ts`).
   - Check that `dangerouslySetInnerHTML` is NOT used anywhere in the React components unless strictly sanitized.

5. **Action**:
   - Report findings to the user. Differentiate between "Critical Fixes Needed" and "Best Practice Suggestions".
