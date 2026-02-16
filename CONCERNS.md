# Technical Debt, Issues & Concerns

## Executive Summary

This document catalogs technical debt, known issues, and areas of concern in the SignApps Platform codebase. The codebase is generally well-structured with modern patterns (Rust with Axum/Tokio, Next.js 16/React 19), good error handling, and proper use of authentication/JWT. However, there are significant areas of incomplete implementation, code marked for future work, and some architectural concerns around dead code and unimplemented features.

---

## 1. Unimplemented Features & TODO Items

### 1.1 LDAP/Active Directory Authentication (Critical)

**Files affected:**
- `services/signapps-identity/src/auth/ldap.rs` - All LDAP methods return "not implemented"
- `services/signapps-identity/src/handlers/auth.rs:101` - TODO: LDAP bind verification not implemented
- `services/signapps-identity/src/ldap/service.rs` - LDAP service module exists but marked with `#[allow(dead_code)]`

**Details:**
The entire LDAP/Active Directory integration is stubbed out. All authentication flows return errors:
- `LdapClient::authenticate()` - Not implemented (returns error)
- `LdapClient::test_connection()` - Not implemented
- `LdapClient::search_groups()` - Not implemented
- `LdapClient::sync_users()` - Not implemented

**Impact:** Users cannot authenticate via LDAP/Active Directory. The frontend has LDAP config endpoints and login UI, but backend refuses the requests.

---

### 1.2 Storage Service - Extensive Placeholders

The storage service has numerous handlers with TODO comments indicating unimplemented database operations:

**Quotas Handler** (`services/signapps-storage/src/handlers/quotas.rs`):
- Line 102: `get_my_quota()` - "TODO: Fetch from database and calculate"
- Line 126: `get_admin_quota()` - "TODO: Fetch from database"
- Line 151: `set_quota()` - "TODO: Store in database"
- Line 162: `delete_quota()` - "TODO: Delete from database"
- Line 173: `check_quota()` - "TODO: Calculate based on usage vs limits"
- Line 180-183: Quota validation logic - Multiple TODOs for database checks
- Line 195: `update_quota_after_upload()` - "TODO: Increment in database"
- Line 207: `update_quota_after_delete()` - "TODO: Decrement in database"
- Line 218: `recalculate_quota()` - "TODO: Scan all files and recalculate"

**Favorites Handler** (`services/signapps-storage/src/handlers/favorites.rs`):
- Line 104: `add_favorite()` - "TODO: Get next sort order"
- Line 107: "TODO: Store in database"
- Line 125: `list_favorites()` - "TODO: Query from database"
- Line 139: `get_favorite()` - "TODO: Fetch from database"
- Line 150: `update_favorite()` - "TODO: Update in database"
- Line 160: `remove_favorite()` - "TODO: Delete from database"
- Line 182: `reorder_favorites()` - "TODO: Update sort_order"
- Line 193: `is_favorite()` - "TODO: Check in database"

**Search Handler** (`services/signapps-storage/src/handlers/search.rs`):
- Line 165: `search()` - "TODO: Implement actual search"
- Line 220: `quick_search()` - "TODO: Quick search in storage object listing"
- Line 236: `recent_files()` - "TODO: Get recent files from access history"
- Line 247: `suggestions()` - "TODO: Suggest based on usage patterns"

**Preview Handler** (`services/signapps-storage/src/handlers/preview.rs`):
- Line 101-102: `get_thumbnail()` - Caching and generation not implemented
- Line 144: Image resizing - Not implemented
- Line 149: PDF rendering - Not implemented
- Line 154: Video frame extraction - Not implemented
- Line 159: Waveform generation - Not implemented
- Line 164: Document conversion - Not implemented
- Line 213: `FilePreview` - "TODO: Extract from PDF metadata"

**Trash Handler** (`services/signapps-storage/src/handlers/trash.rs`):
- Line 184: `move_to_trash()` - "TODO: Store trash metadata in database"
- Line 206: `list_trash()` - "TODO: Query from database"
- Line 220: `trash_stats()` - "TODO: Calculate from database"
- Line 264-266: `restore_trash_item()` - "TODO: Fetch and restore from database"
- Line 292: `empty_trash()` - "TODO: Delete all trash items for user"
- Line 302-304: `delete_trash_item()` - "TODO: Delete from database"
- Line 315: `get_trash_item()` - "TODO: Fetch from database"

**Shares Handler** (`services/signapps-storage/src/handlers/shares.rs`):
- Line 118: `create_share()` - "TODO: Extract from JWT claims"
- Line 135: "TODO: Store share in database"
- Line 162: `list_shares()` - "TODO: Query shares from database"
- Line 178-179: `get_share()` - "TODO: Fetch from database"
- Line 189: `update_share()` - "TODO: Update in database"
- Line 199: `delete_share()` - "TODO: Delete from database"
- Line 211-215: `access_share()` - Multiple database/validation TODOs
- Line 228-229: `download_share()` - "TODO: Stream file directly"

**Impact:** Storage quota management, favorites, search, file preview generation, trash recovery, and file sharing are all non-functional. These are marked with `#![allow(dead_code)]` at the file level.

---

### 1.3 AI Service Indexing

**File:** `services/signapps-ai/src/handlers/index.rs:103`

**Details:**
- `get_stats()` - "TODO: Track last indexed timestamp"
- The `last_indexed` field is always `None`

**Impact:** Users cannot see when documents were last indexed.

---

### 1.4 Media Service Jobs

**File:** `services/signapps-media/src/handlers/jobs.rs:37`

**Details:**
- "TODO: Fetch job status from database"
- Job status tracking appears incomplete

---

### 1.5 Container Listing Filter

**File:** `services/signapps-containers/src/main.rs:348`

**Details:**
- "TODO: Filter by user" - Container listing endpoint does not filter by user

**Impact:** Users may see containers belonging to other users.

---

## 2. Dead Code & Incomplete Implementations

### 2.1 Modules with `#[allow(dead_code)]`

Entire modules are suppressing dead code warnings, suggesting incomplete or placeholder implementations:

- `services/signapps-ai/src/handlers/chat.rs` - Some fields marked
- `services/signapps-ai/src/handlers/search.rs` - Some fields marked
- `services/signapps-ai/src/llm/llamacpp.rs` - GPU layers field unused
- `services/signapps-ai/src/llm/types.rs` - Multiple response types marked
- `services/signapps-ai/src/rag/chunker.rs` - Entire module marked with `#![allow(dead_code)]`
- `services/signapps-containers/src/docker/types.rs` - Image pull progress type unused
- `services/signapps-containers/src/handlers/containers.rs` - Some fields marked
- `services/signapps-containers/src/store/types.rs` - Multiple app/service types marked
- `services/signapps-identity/src/auth/ldap.rs` - Entire module marked `#![allow(dead_code)]`
- `services/signapps-identity/src/handlers/users.rs` - Some response types marked
- `services/signapps-identity/src/ldap/service.rs` - Entire LDAP service module marked
- `services/signapps-storage/src/handlers/quotas.rs` - Entire file marked with `#![allow(dead_code)]`
- `services/signapps-storage/src/handlers/favorites.rs` - Handlers marked
- `services/signapps-storage/src/handlers/search.rs` - Handlers marked
- `services/signapps-storage/src/handlers/trash.rs` - Entire file marked with `#![allow(dead_code)]`
- `services/signapps-storage/src/handlers/shares.rs` - Handlers marked
- `services/signapps-storage/src/handlers/preview.rs` - Handlers marked

**Impact:** Core functionality is suppressed rather than removed or implemented. This masks genuine dead code from appearing in CI lints.

---

## 3. Security Concerns

### 3.1 Hardcoded JWT Defaults

**Files:**
- `services/signapps-ai/src/main.rs:77` - Uses "dev-secret-change-me" if JWT_SECRET not set
- `services/signapps-containers/src/main.rs:53-56` - Uses "dev_secret_change_in_production_32chars" with warning

**Details:**
Default JWT secrets are used in development mode. While warnings are logged, these could be accidentally deployed to production.

**Recommendation:** Require JWT_SECRET as a mandatory environment variable or fail startup.

---

### 3.2 Token Storage in localStorage

**File:** `client/src/lib/api.ts`

**Details:**
- Access tokens stored in browser localStorage (lines 46, 58, 64)
- Refresh tokens also stored in localStorage (lines 44, 58, 64)
- No HTTP-only cookie mechanism used

**Impact:** Tokens are vulnerable to XSS attacks. Any compromise of JavaScript context can steal tokens.

**Note:** This is common in SPAs but represents a known security tradeoff.

---

### 3.3 Token Extraction from URL Parameters

**File:** `client/src/lib/api.ts:198-199` (in `getInstallProgressUrl()`)

**Details:**
```typescript
const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';
return `${base}/api/v1/store/install/${installId}/progress?token=${encodeURIComponent(token)}`;
```

**Impact:** Access tokens are exposed in URL query parameters for SSE endpoints. Tokens may leak in:
- Browser history
- Proxy logs
- Referrer headers
- Server access logs

**Recommendation:** Use Authorization header with SSE or Bearer token in query parameter with expiring short-lived tokens.

---

### 3.4 Minimal Type Casting Issues

**Files:**
- `client/src/app/apps/page.tsx` - Uses `as any[]` cast
- `client/src/app/settings/profile/page.tsx` - Uses `as any` cast
- `client/src/components/containers/container-terminal.tsx` - Uses `@ts-ignore`

**Impact:** Small number of TypeScript type casting issues that could mask real type errors.

---

## 4. Error Handling Gaps

### 4.1 Extensive Console.error Usage Without Proper Error UI

**Files affected:**
- `client/src/app/ai/page.tsx` - Multiple `console.error()` calls (8+ places)
- `client/src/app/media/page.tsx` - Multiple `console.error()` calls
- `client/src/app/scheduler/page.tsx` - Multiple `console.error()` calls
- `client/src/app/settings/page.tsx` - `console.error()` for LDAP config/groups
- Various other page components

**Example from `client/src/app/ai/page.tsx`:**
```typescript
.catch((error) => {
  console.error('Failed to fetch AI stats:', error);
});
```

**Impact:** Errors logged to console but may not show user-facing toast/alert notifications consistently. Users may not know operations failed.

---

### 4.5 HTTP Client Error Handling in Frontend

**File:** `client/src/lib/api.ts`

**Details:**
Token refresh logic catches errors but uses generic `Promise.reject()`. Error types/messages not standardized.

---

## 5. Code Complexity & Size

### 5.1 Large Files

Several files exceed recommended complexity thresholds:

**Rust files:**
- `services/signapps-containers/src/handlers/store.rs` - 989 lines
- `services/signapps-containers/src/docker/client.rs` - 927 lines
- `services/signapps-ai/src/llm/providers.rs` - 820 lines
- `services/signapps-ai/src/tools/registry.rs` - 705 lines
- `crates/signapps-runtime/src/models.rs` - 701 lines
- `services/signapps-containers/src/handlers/containers.rs` - 689 lines

**TypeScript files:**
- `client/src/lib/api.ts` - 2,106 lines (API client definitions)
- `client/src/app/vpn/page.tsx` - 1,688 lines (page component)
- `client/src/app/ai/page.tsx` - 1,565 lines (page component)
- `client/src/app/users/page.tsx` - 1,410 lines (page component)
- `client/src/components/routes/route-dialog.tsx` - 1,105 lines (dialog component)

**Recommendation:** Consider breaking down large files into smaller modules. `api.ts` especially could be split by service (aiApi, storageApi, etc.).

---

### 5.2 Complex Frontend Components

Large page components (1500+ LOC) handle multiple concerns:
- Data fetching
- State management (Zustand)
- Form handling (react-hook-form)
- UI rendering
- Error handling

**Example:** `client/src/app/ai/page.tsx` - Handles chat UI, model management, knowledge base CRUD, document upload, and voice chat all in one component.

**Recommendation:** Extract sub-components for better reusability and testability.

---

## 6. Performance Concerns

### 6.1 Potential N+1 Query Patterns

While no obvious N+1 patterns found with `.map(await)` loops, there are areas where database queries could be optimized:

- `services/signapps-storage/src/handlers/search.rs` - Full implementation TODO
- `services/signapps-storage/src/handlers/quotas.rs` - No batch operations defined
- Trash restore operations may need per-item queries

---

### 6.2 Frontend API Call Patterns

**File:** `client/src/lib/api.ts` - 2,106 lines

**Details:**
- No request deduplication/caching visible for repeated calls
- Token refresh logic may cause multiple concurrent requests
- No exponential backoff in retry logic

**Recommendation:** Implement React Query (already in dependencies) for request caching and deduplication.

---

## 7. Architecture Concerns

### 7.1 Token Refresh Race Conditions

**File:** `client/src/lib/api.ts:40-61`

**Details:**
```typescript
if (error.response?.status === 401 && !originalRequest._retry) {
  originalRequest._retry = true;
  // ... refresh token logic
}
```

**Issue:** Multiple concurrent requests hitting 401 will each attempt token refresh independently, causing multiple refresh requests.

**Recommendation:** Use a refresh token lock/queue pattern to ensure only one refresh happens.

---

### 7.2 Raw Error Propagation to Frontend

**File:** `services/signapps-ai/src/main.rs:88`

**Details:**
```rust
Err(e) => tracing::warn!("Migration warning (non-fatal): {}", e),
```

Migrations failing silently (non-fatal) could cause schema mismatches between frontend expectations and backend implementation.

---

## 8. Documentation Gaps

### 8.1 Complex Code Without Comments

**Files:**
- `services/signapps-containers/src/docker/client.rs` - 927 lines with minimal inline documentation
- `services/signapps-ai/src/llm/providers.rs` - 820 lines handling multiple provider types with limited comments
- `services/signapps-ai/src/tools/registry.rs` - 705 lines for tool registry with sparse comments
- `services/signapps-ai/src/tools/executor.rs` - 505 lines for tool execution logic

---

### 8.2 Environment Variables Not Validated at Startup

**File:** `services/signapps-containers/src/main.rs:52`

**Details:**
```rust
let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
```

Only DATABASE_URL is explicitly required. Other critical variables like `JWT_SECRET` have defaults.

**Recommendation:** Validate and log all required env vars at startup to fail fast.

---

## 9. Testing Gaps

### 9.1 Limited Test Coverage for Critical Paths

- No tests visible for LDAP authentication (entire module not implemented anyway)
- No tests for token refresh logic in frontend
- Storage quota logic has no tests (all functionality is TODO)
- Trash/favorites/shares - all unimplemented with no test structure

---

### 9.2 End-to-End Tests Exist

**Note:** Playwright E2E tests are configured (`npm run test:e2e`), which is good for integration testing.

---

## 10. Dependency Management

### 10.1 Dependency Versions

**Rust workspace dependencies** (from `Cargo.toml`):
- All dependencies appear modern and well-maintained
- tokio 1.36, axum 0.7, sqlx 0.7, serde 1.0 are current
- No obvious security issues identified

**Frontend dependencies** (from `package.json`):
- Next.js 16.1.6 (latest)
- React 19.2.3 (latest)
- TypeScript 5 (current)
- All major dependencies up to date

**No outdated dependencies identified.** Regularly audit with `cargo audit` and `npm audit`.

---

## 11. Known Issues from Recent Commits

Based on git history, recent fixes have addressed:
- Infinite loops in AI frontend (commit 0367e32)
- Provider health probes (commit 0367e32)
- Media backends made optional with fallbacks (commit 0c14ae6)
- Model download async with progress (commit 1298a50)
- Remove Docker infrastructure, use native backends (commit 6def80f)

These indicate the codebase is actively maintained and issues are being fixed.

---

## Summary of Critical Issues

| Priority | Issue | File | Status |
|----------|-------|------|--------|
| **CRITICAL** | LDAP authentication stub | `services/signapps-identity/src/auth/ldap.rs` | Not implemented |
| **CRITICAL** | Storage quotas unimplemented | `services/signapps-storage/src/handlers/quotas.rs` | Todo |
| **HIGH** | Token in URL parameters | `client/src/lib/api.ts:198` | Security risk |
| **HIGH** | Tokens in localStorage | `client/src/lib/api.ts` | XSS risk |
| **MEDIUM** | Large unimplemented handlers | `services/signapps-storage/` | 6 handler files |
| **MEDIUM** | Dead code suppressed | Multiple services | Architecture |
| **MEDIUM** | Token refresh race condition | `client/src/lib/api.ts:40` | Concurrency |
| **LOW** | Large component files | `client/src/app/ai/page.tsx` | Maintainability |
| **LOW** | Console errors without UI | Multiple frontend files | UX |

---

## Recommendations

1. **Implement LDAP** - Either complete the implementation or remove LDAP-related UI
2. **Implement Storage Quotas** - These handlers are wired up but non-functional
3. **Secure Token Storage** - Consider moving to HTTP-only cookies or use Authorization header for SSE
4. **Remove Dead Code Suppression** - Either implement or delete placeholder handlers
5. **Refactor Large Components** - Break down page components into smaller, reusable parts
6. **Add Error Toasts** - Ensure all `console.error()` calls show user-facing notifications
7. **Validate Environment** - Fail fast if critical env vars are missing
8. **Add Comments** - Document complex logic in provider, tool, and handler implementations
9. **Fix Token Refresh** - Implement request lock to prevent concurrent refresh attempts
10. **Test Critical Paths** - Add unit/integration tests for quota, trash, and sharing logic

---

## Notes

- Codebase follows good patterns overall (Rust error handling, TypeScript types, middleware architecture)
- No `panic!()` or `unsafe` blocks found in Rust code (good)
- No `unwrap()` or `expect()` calls found (good error handling)
- Architecture is sound with clear separation of concerns
- Main issues are incomplete implementations and TODO markers rather than bugs

