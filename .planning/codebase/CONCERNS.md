# Codebase Concerns

**Analysis Date:** 2026-02-15

## Tech Debt

**Storage service incomplete implementations (40+ TODOs):**
- Issue: Trash, shares, search, quotas, preview, favorites handlers are stubs returning placeholder data
- Files: `services/signapps-storage/src/handlers/trash.rs`, `shares.rs`, `search.rs`, `quotas.rs`, `preview.rs`, `favorites.rs`
- Why: Features were scaffolded but never completed
- Impact: API endpoints exist but return empty/fake data; user confusion
- Fix approach: Either complete implementations or remove from router; add feature flags

**LDAP authentication not implemented:**
- Issue: All LDAP methods return "not implemented" errors
- File: `services/signapps-identity/src/auth/ldap.rs` (lines 42-75)
- Why: Feature scaffolded during initial architecture
- Impact: Users attempting LDAP login will fail
- Fix approach: Complete implementation or remove from API; mark as "coming soon" in UI

**Monolithic API client file:**
- Issue: `client/src/lib/api.ts` is 2100+ lines containing all API functions for all services
- Impact: Hard to maintain, slow IDE performance, merge conflicts
- Fix approach: Split into per-service modules (`api/identity.ts`, `api/containers.ts`, etc.)

**Large frontend page files:**
- Issue: Several page.tsx files exceed 1000 lines
- Files: `client/src/app/vpn/page.tsx` (1688 lines), `client/src/app/ai/page.tsx` (1517 lines), `client/src/app/users/page.tsx` (1410 lines)
- Impact: Hard to maintain, poor code organization
- Fix approach: Extract components into domain-specific folders

## Security Considerations

**Default JWT secrets in services:**
- Risk: Services fall back to weak defaults (`dev_secret_change_in_production_32chars`) if JWT_SECRET not set
- Files: `services/signapps-identity/src/main.rs` (line 46), `services/signapps-containers/src/main.rs` (line 54), `services/signapps-storage/src/main.rs` (line 59), `services/signapps-ai/src/main.rs` (line 74)
- Current mitigation: Services log warnings when using defaults
- Recommendations: Make JWT_SECRET required with `.expect()` in production; fail fast on startup

**Skip TLS verify in LDAP:**
- Risk: `skip_tls_verify` option allows LDAP connections without certificate validation
- Files: `crates/signapps-db/src/models/ldap.rs` (line 23), `services/signapps-identity/src/auth/ldap.rs`
- Current mitigation: Option exists but must be explicitly enabled
- Recommendations: Only allow in dev; log warnings when enabled

## Performance Bottlenecks

**Prometheus metrics initialization:**
- Problem: 30+ `.unwrap()` calls during registry initialization; any failure crashes entire metrics service
- File: `services/signapps-metrics/src/metrics/prometheus.rs` (lines 51-154)
- Cause: Metric registration wrapped in unwrap() instead of Result
- Improvement path: Return Result from initialization; validate metric names before registration

**DNS server no rate limiting:**
- Problem: Spawns async task per incoming DNS query without rate limiting
- File: `services/signapps-securelink/src/dns/server.rs` (lines 70-100)
- Cause: Simple implementation without protection
- Improvement path: Add request rate limiting; connection pooling for responses

## Fragile Areas

**Middleware request ID parsing:**
- Why fragile: Uses `.unwrap()` on request ID header parsing
- File: `crates/signapps-common/src/middleware.rs` (lines 189, 195)
- Common failures: Malformed headers could panic
- Safe modification: Replace with `.unwrap_or_default()` or proper error handling

**Tunnel client HTTP creation:**
- Why fragile: HTTP client created with `.expect()` without retry logic
- File: `services/signapps-securelink/src/tunnel/client.rs` (lines 62-75)
- Common failures: Transient network issues cause panic
- Safe modification: Implement lazy initialization with retry

**Restic backup command execution:**
- Why fragile: Command arguments built from user config inputs
- File: `services/signapps-containers/src/backup/restic.rs` (lines 144-156)
- Common failures: Config with special characters could break
- Safe modification: Validate all config values; use shell-safe escaping

## Dependencies at Risk

**sqlx-postgres future incompatibility:**
- Risk: Compiler warns "code will be rejected by a future version of Rust"
- Impact: Will require update when Rust version enforces new rules
- Migration plan: Update sqlx to latest version when available

## Test Coverage Gaps

**Storage service handlers:**
- What's not tested: Trash, shares, quotas, search, preview, favorites
- Risk: Since these are stubs, tests would fail anyway
- Priority: Medium - complete implementations first, then add tests

**LDAP authentication:**
- What's not tested: Entire LDAP flow (bind, search, group sync)
- Risk: Feature marked as unimplemented
- Priority: Low - implement first, then add integration tests

**AI RAG pipeline:**
- What's not tested: Document indexing, vector search, LLM query flow
- Risk: Complex multi-step pipeline could break silently
- Priority: High - critical user-facing feature

**Media processing:**
- What's not tested: STT, TTS, OCR native backends
- Risk: Model loading, audio processing could fail
- Priority: Medium - currently working but no regression protection

## Code Quality

**Dead code suppression:**
- Issue: 20+ files use `#[allow(dead_code)]` to suppress warnings
- Files: Multiple storage handlers, incomplete features
- Impact: Suggests abandoned or incomplete features mixed with production code
- Recommendation: Remove dead code or complete features

**Excessive `.clone()` usage:**
- Pattern: Multiple `.clone().unwrap_or_*` chains
- Files: `services/signapps-containers/src/store/manager.rs`, `store/parser.rs`
- Impact: Unnecessary memory allocation
- Recommendation: Use borrowed references where possible

---

*Concerns audit: 2026-02-15*
*Update as issues are fixed or new ones discovered*
