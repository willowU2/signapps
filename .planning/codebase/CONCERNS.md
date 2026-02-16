# Codebase Concerns

**Analysis Date:** 2026-02-16

## Tech Debt

**LDAP/AD Authentication Not Implemented:**
- Issue: All LDAP methods return "not implemented" errors
- File: `services/signapps-identity/src/auth/ldap.rs`
- Impact: LDAP/Active Directory login completely non-functional despite infrastructure
- Fix approach: Implement ldap3 integration, test against real LDAP server

**Storage Service - Massive TODO Backlog:**
- Issue: Six handler files have extensive database operation placeholders
- Files:
  - `services/signapps-storage/src/handlers/quotas.rs` (10+ TODOs)
  - `services/signapps-storage/src/handlers/favorites.rs` (8+ TODOs)
  - `services/signapps-storage/src/handlers/search.rs` (4+ TODOs - full-text search not in DB)
  - `services/signapps-storage/src/handlers/shares.rs` (8+ TODOs)
  - `services/signapps-storage/src/handlers/trash.rs` (8+ TODOs)
  - `services/signapps-storage/src/handlers/preview.rs` (6+ TODOs - thumbnails not generated)
- Impact: File sharing, quotas, trash recovery, search all incomplete
- Fix approach: Implement database schemas and handlers for each feature

**API Client File Size:**
- Issue: `client/src/lib/api.ts` is 2,100+ lines, combines all service clients
- File: `client/src/lib/api.ts`
- Impact: Hard to maintain, no single responsibility principle
- Fix approach: Split into per-service clients (`api/containers.ts`, `api/users.ts`, etc.)

**Large Page Components:**
- Issue: Page components handle too many concerns (1-1.6K LOC)
- Files: `client/src/app/dashboard/page.tsx`, `client/src/app/ai/page.tsx`, etc.
- Impact: Hard to test, multiple responsibilities per component
- Fix approach: Extract sub-components and business logic to hooks

**Dead Code:**
- Issue: 15+ files use `#[allow(dead_code)]` suppression
- Impact: Makes refactoring unsafe, hides unused code
- Fix approach: Remove suppression and clean up actual dead code

## Known Bugs

**Token Storage Security Issue:**
- Symptoms: Tokens accessible via browser DevTools (XSS vulnerability risk)
- File: `client/src/lib/api.ts` (token in localStorage)
- Trigger: Any XSS vulnerability could extract tokens
- Workaround: None (tokens already compromised in case of XSS)
- Root cause: localStorage is accessible to JavaScript
- Fix: Implement httpOnly cookies via secure backend session management

**Token in SSE URL:**
- Symptoms: Tokens exposed in browser history and server logs
- File: `services/signapps-media/src/handlers/voice.rs` (voice pipeline SSE endpoint)
- Trigger: Voice chat feature usage
- Workaround: Clear browser history after use
- Root cause: SSE endpoints require auth, URL-based token passing
- Fix: Use Authorization header for SSE connection, not URL parameter

**JWT Hardcoded in Development:**
- Issue: JWT_SECRET defaults to "dev-secret" in some configs
- Files: `.env.example` shows example value, tests may use hardcoded secrets
- Impact: Production-like secrets in code repository
- Fix approach: Ensure all envs load from actual env vars, no defaults in code

## Security Considerations

**localStorage Token Storage:**
- Risk: XSS attack could steal all tokens from localStorage
- Files: `client/src/lib/api.ts`, `client/src/lib/store.ts`
- Current mitigation: None (tokens stored plaintext in localStorage)
- Recommendations:
  - Move to httpOnly cookies (requires backend session service)
  - Implement CSRF protection if cookies used
  - Add Content Security Policy headers

**Hardcoded SQL Queries:**
- Risk: None detected (SQLx uses compile-time verification)
- Files: `crates/signapps-db/src/repositories/`
- Current mitigation: All queries checked at compile time by SQLx
- Recommendations: Continue using SQLx, avoid string concatenation for queries

**Password Hashing:**
- Risk: Argon2 algorithm is secure
- Files: `services/signapps-identity/src/auth/password.rs` (if exists)
- Current mitigation: Argon2 used for all passwords
- Recommendations: Ensure parameters (iterations, memory) are production-grade

## Performance Bottlenecks

**Vector Embedding Operations:**
- Problem: HNSW index operations on 384-dim vectors
- File: `services/signapps-ai/src/vectors/`
- Measurement: No baseline (not profiled yet)
- Cause: Large dimension count + complex queries
- Improvement path: Profile with realistic data, consider dimension reduction (PCA)

**Database Connection Pool:**
- Problem: Default pool size may be undersized
- File: `crates/signapps-db/src/lib.rs` (create_pool function)
- Measurement: Not measured (use sqlx pool diagnostics)
- Cause: Pool size set to environment default or hardcoded
- Improvement path: Auto-size based on CPU cores, add metrics

**Frontend API Cascade:**
- Problem: Multiple HTTP requests on page load (cascading/waterfall)
- Files: `client/src/app/*/page.tsx` - each component fetches independently
- Measurement: 3-5 second load times on slow networks
- Cause: Sequential API calls instead of parallel
- Improvement path: Use React Suspense for parallel fetching, consolidate queries

## Fragile Areas

**Middleware Order Dependency:**
- File: All services `src/main.rs` (middleware registration)
- Why fragile: 4 different middleware run in specific order (auth → logging → CORS)
- Common failures: Changing middleware order breaks auth, request IDs missing
- Safe modification: Document middleware dependencies, test middleware chain
- Test coverage: Middleware chain not tested in isolation

**Large Match/Switch Statements:**
- Files:
  - `services/signapps-ai/src/handlers/chat.rs` (LLM provider selection)
  - `services/signapps-storage/src/handlers/` (operation routing)
- Why fragile: Adding new branch requires multiple places, easy to miss error case
- Common failures: Forgetting to handle new provider/operation type
- Safe modification: Extract each branch to separate function
- Test coverage: Limited coverage for edge cases

**Unused Code Suppressions:**
- File: Multiple files (15+) with `#[allow(dead_code)]`
- Why fragile: Makes refactoring unsafe, hides incomplete features
- Common failures: Delete used code thinking it's dead, miss code that should be public
- Safe modification: Remove suppressions and clean up actually dead code

## Scaling Limits

**PostgreSQL Connection Pool:**
- Current capacity: Default pool (likely 5-10 connections)
- Limit: Connection exhaustion under heavy load
- Symptoms at limit: Queries queue, timeouts increase, 503 errors
- Scaling path: Increase pool size, add connection pooling middleware (pgbouncer)

**Vector Search Performance:**
- Current capacity: Untested (depends on data size and query complexity)
- Limit: HNSW index performance degrades with corpus size
- Symptoms at limit: Vector similarity queries slow down (>1s)
- Scaling path: Partition vectors by knowledge base, consider approximate algorithms

**In-Process Cache (moka):**
- Current capacity: Depends on available RAM
- Limit: Cache eviction under memory pressure
- Symptoms at limit: Cache miss rate increases, database load increases
- Scaling path: Monitor cache hit rate, increase RAM, implement distributed cache

## Dependencies at Risk

**Outdated Dependencies:**
- Status: Regular dependency updates needed
- Check: Run `cargo outdated`, `npm outdated` regularly
- Risk: Security vulnerabilities in dependencies
- Impact: Broken builds if major versions not compatible
- Mitigation: Weekly dependency audit via `cargo audit`, CI integration

**LDAP Implementation:**
- Risk: ldap3 crate needs evaluation for security/maintenance
- Impact: Cannot use LDAP auth until fully implemented
- Current status: Placeholder only
- Migration plan: Implement ldap3 with proper error handling

## Missing Critical Features

**Quota Management:**
- Problem: No enforcement of storage quotas
- Current workaround: Users can store unlimited data (no limit)
- Blocks: Cannot enforce fair resource usage, storage costs control
- Implementation complexity: High (database schema, quota tracking per user/group)

**Full-Text Search:**
- Problem: File search not implemented in storage service
- Current workaround: Manual file browsing
- Blocks: Cannot find files by name/content, discovery poor UX
- Implementation complexity: Medium (add FTS column to database, query optimization)

**Knowledge Base Collections:**
- Problem: Collections feature added to schema but handler endpoints incomplete
- Current workaround: All documents in single flat list
- Blocks: Cannot organize documents, access control per collection
- Implementation complexity: Medium (collection CRUD, membership tracking)

## Test Coverage Gaps

**Rust Integration Tests:**
- What's not tested: Service-to-service API integration
- Risk: API contracts could break silently
- Priority: High
- Difficulty: Need test database setup, mock external services

**Middleware Chain:**
- What's not tested: Middleware execution order and interactions
- Risk: Middleware bugs (missing request IDs, invalid auth) not caught
- Priority: Medium
- Difficulty: Need to test Axum middleware independently

**Error Paths:**
- What's not tested: Error handling for all failure scenarios
- Risk: Unhandled errors could cause 500s instead of proper errors
- Priority: Medium
- Difficulty: Need to mock failures (network errors, DB errors, etc.)

**E2E Auth Flows:**
- What's not tested: Full authentication flows (login → token refresh → logout)
- Risk: Auth bugs don't surface until production
- Priority: High
- Difficulty: Need Playwright tests with real browser

## Incomplete Features

**Voice Chat WebSocket:**
- Status: Infrastructure in place, streaming partially implemented
- Problem: Voice input processing not complete
- File: `services/signapps-media/src/handlers/voice.rs`, `client/src/hooks/use-voice-chat.ts`
- Impact: Voice feature unavailable to users

**Scheduled Tasks:**
- Status: Scheduler service exists, CRON handler stubbed
- Problem: Job execution and persistence not implemented
- File: `services/signapps-scheduler/src/handlers/`
- Impact: Scheduled operations don't run

**Secure Tunneling:**
- Status: Securelink service exists, WebSocket tunneling framework in place
- Problem: Tunnel routing and packet forwarding not complete
- File: `services/signapps-securelink/src/handlers/`
- Impact: VPN/tunnel feature not functional

---

*Concerns audit: 2026-02-16*
*Update as issues are fixed or new ones discovered*
