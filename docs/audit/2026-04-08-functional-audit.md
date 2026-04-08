# Functional Audit — 2026-04-08

## Summary

**Overall verdict: ~45% functional end-to-end.**

The platform compiles and most pages exist and render. The gateway routing layer is solid, CORS and cookie-based auth are correctly configured. However, there are 5 critical routing bugs that silently break entire feature areas (Vault, Signatures, CRM, Resources, and the gateway ports for Forms/IT Assets). The most dangerous issue is the missing Next.js middleware file — every route is completely unprotected, so any unauthenticated user can access admin pages. Approximately 15 pages exist only as stubs with no real data. Language is consistently French throughout the frontend.

---

## P0 — Critical (blocks core user journey)

### Issue 1: `middleware.ts` is missing — zero route protection

**What's broken:** The Next.js route protection middleware was renamed to `middleware.ts.bak` and is not active. Every route — including `/admin`, `/vault`, `/billing` — is accessible without authentication in the browser. Any user can navigate directly to protected pages without logging in.

**Where:**
- `/c/Prog/signapps-platform/client/src/middleware.ts.bak` (the backup file)
- `/c/Prog/signapps-platform/client/src/` (no `middleware.ts` exists)

**Evidence:** `ls /c/Prog/signapps-platform/client/src/` shows `middleware.ts.bak` but no `middleware.ts`. The backup file contains a fully functional middleware at line 102: `export function middleware(request: NextRequest): NextResponse`.

**Fix effort:** Small — rename `middleware.ts.bak` back to `middleware.ts`.

---

### Issue 2: Gateway has Forms and IT Assets ports swapped

**What's broken:** `signapps-gateway/src/main.rs` lines 608 and 630 have the default port URLs inverted. `/api/v1/forms` routes to port 3022 (IT Assets) and `/api/v1/it-assets`, `/api/v1/sites`, `/api/v1/resources`, `/api/v1/reservations` route to port 3015 (Forms). Since `.env.local` sets `NEXT_PUBLIC_GATEWAY_URL=http://localhost:3099`, all frontend requests go through the gateway, so the Forms page and IT Assets page both return 404 or wrong data.

**Where:**
- `/c/Prog/signapps-platform/services/signapps-gateway/src/main.rs` lines 608, 630
- `/c/Prog/signapps-platform/client/.env.local` line 12

**Evidence:**
```rust
// Line 608 — WRONG: should be 3015
let forms_url = env_or("FORMS_SERVICE_URL", "http://127.0.0.1:3022");
// Line 630 — WRONG: should be 3022
let it_assets_url = env_or("IT_ASSETS_SERVICE_URL", "http://127.0.0.1:3015");
```
Forms service confirms port 3015 at `signapps-forms/src/main.rs` line 755. IT Assets confirms port 3022 at `signapps-it-assets/src/main.rs` line 21.

**Fix effort:** Small — swap the two default port numbers in gateway `main.rs`.

---

### Issue 3: Vault API client points to wrong service

**What's broken:** `client/src/lib/api/vault.ts` line 14 uses `ServiceName.IDENTITY` (port 3001) as the base client, calling paths like `/vault/keys`, `/vault/items`. The vault was extracted to `signapps-vault` (port 3025) and the gateway correctly routes `/api/v1/vault` to port 3025. But identity has no vault routes (confirmed by `signapps-identity/src/main.rs` line 487-488 comment: "Vault routes moved to signapps-vault service"). All vault operations return 404.

**Where:**
- `/c/Prog/signapps-platform/client/src/lib/api/vault.ts` line 14
- `/c/Prog/signapps-platform/services/signapps-identity/src/main.rs` lines 487-488

**Evidence:**
```ts
const client = getClient(ServiceName.IDENTITY);  // WRONG — should be VAULT_SVC
```
`ServiceName.VAULT_SVC` exists in the factory (line 199-203, port 3025) but is unused by `vault.ts`.

**Fix effort:** Small — change `ServiceName.IDENTITY` to `ServiceName.VAULT_SVC` in `vault.ts`.

---

### Issue 4: Signatures API client routes to identity instead of signatures service

**What's broken:** `client/src/lib/api/crosslinks.ts` line 11 uses `ServiceName.IDENTITY` to call `/signatures/*` endpoints. The signatures service (`signapps-signatures`, port 3028) was extracted from identity. Identity has no signature routes (confirmed by `signapps-identity/src/main.rs` line 307 comment). Gateway correctly routes `/api/v1/signatures` to port 3028. All signature operations (create envelope, send, sign steps) return 404.

**Where:**
- `/c/Prog/signapps-platform/client/src/lib/api/crosslinks.ts` line 11
- `/c/Prog/signapps-platform/services/signapps-identity/src/main.rs` line 307

**Evidence:**
```ts
const client = () => getClient(ServiceName.IDENTITY);  // WRONG
// calls: client().post<SignatureEnvelope>('/signatures', data)  → 404
```
`ServiceName.SIGNATURES_SVC` exists in factory (port 3028) but is unused.

**Fix effort:** Small — change `ServiceName.IDENTITY` to `ServiceName.SIGNATURES_SVC` in `crosslinks.ts`.

---

### Issue 5: CRM and Resources API clients route to identity service instead of correct services

**What's broken:** Two API clients use `ServiceName.IDENTITY` for routes that were extracted to other services:

- `crm.ts` (line 10): Uses identity to call `/api/v1/crm/*`. Gateway routes `/api/v1/crm` to contacts service (port 3021).
- `resources.ts` (line 10): Uses identity to call `/resource-types`, `/resources`, `/reservations`. Gateway routes these to IT assets (port 3022).

Both return 404 on all CRUD operations.

**Where:**
- `/c/Prog/signapps-platform/client/src/lib/api/crm.ts` line 10
- `/c/Prog/signapps-platform/client/src/lib/api/resources.ts` line 10
- `/c/Prog/signapps-platform/services/signapps-identity/src/main.rs` lines 305, 491

**Evidence:**
```ts
// crm.ts:10
const identityClient = getClient(ServiceName.IDENTITY);  // WRONG — should be CONTACTS
// resources.ts:10
const identityClient = getClient(ServiceName.IDENTITY);  // WRONG — should be IT_ASSETS
```

**Fix effort:** Small — change service names in the two API client files.

---

### Issue 6: `/api/v1/sharing` prefix not routed in gateway

**What's broken:** The sharing crate registers global routes at `/api/v1/sharing/templates`, `/api/v1/sharing/audit`, `/api/v1/sharing/bulk-grant`, and `/api/v1/shared-with-me`. These are served by the storage service (port 3004) which merges `sharing_global_routes()`. However, the gateway has no explicit route for `/api/v1/sharing/*`. The only storage prefix in the gateway is `/api/v1/files`, `/api/v1/buckets`, `/api/v1/drive`, `/api/v1/search`, `/api/v1/trash`, etc. — no `/api/v1/sharing`.

The gateway falls through to the identity catch-all (`/api/v1` → identity) for unmatched paths, so sharing template/audit/bulk-grant calls hit identity and return 404.

`/api/v1/shared-with-me` also has no explicit gateway route and falls to identity catch-all.

**Where:**
- `/c/Prog/signapps-platform/services/signapps-gateway/src/main.rs` (no `/api/v1/sharing` or `/api/v1/shared-with-me` in route table)
- `/c/Prog/signapps-platform/crates/signapps-sharing/src/routes.rs` lines 131-143

**Evidence:** Grepping `sharing` in `gateway/src/main.rs` returns zero results. The route table at lines 643-743 has no `/api/v1/sharing` or `/api/v1/shared-with-me` entry.

**Impact:** `shared-with-me` page always returns 404. Admin sharing templates page cannot load, create or delete templates. Sharing audit page cannot load.

**Fix effort:** Small — add two entries to the gateway service map: `("/api/v1/sharing", &storage_url)` and `("/api/v1/shared-with-me", &storage_url)`.

---

## P1 — Important (visible but not blocking)

### Issue 7: `middleware.ts.bak` auth check uses wrong cookie name

**What's broken:** The backed-up middleware (lines 90-96) checks for a cookie named `access_token`. The login page sets a cookie named `auth-storage` with value `{"state":{"isAuthenticated":true}}` (not the actual token). The `access_token` HttpOnly cookie is set by the backend but may not persist across port hops in dev. Even when the middleware is restored, its auth detection logic may incorrectly redirect logged-in users to `/login`.

**Where:**
- `/c/Prog/signapps-platform/client/src/middleware.ts.bak` lines 90-96
- `/c/Prog/signapps-platform/client/src/app/login/page.tsx` lines 157-160

**Evidence:**
```ts
// middleware.ts.bak:90 — checks for 'access_token' cookie
request.cookies.has('access_token')
// login/page.tsx:160 — sets 'auth-storage' cookie (not 'access_token')
document.cookie = `auth-storage=${encodeURIComponent(cookieValue)}; ...`;
```
The middleware should check for `auth-storage` cookie, not `access_token`.

**Fix effort:** Small — update `isAuthenticated()` in the middleware to check for `auth-storage`.

---

### Issue 8: `/calendar` redirects to `/cal` but path case sensitivity

**What's broken:** `client/src/app/calendar/page.tsx` redirects to `/cal`. The `/cal` route exists inside the `(app)` route group at `client/src/app/(app)/cal/`. This works correctly in Next.js App Router since route groups are transparent. However, there is no redirect for users who bookmark `/calendar` specifically — they get a flash redirect every visit.

**Where:** `/c/Prog/signapps-platform/client/src/app/calendar/page.tsx`

**Evidence:** The page only renders "Redirection vers le calendrier..." and immediately calls `router.replace("/cal")`. No actual calendar content loads at `/calendar`.

**Fix effort:** Small — can be left as-is (redirect is functional) or the `/calendar` route can be removed in favor of `/cal` as the canonical URL.

---

### Issue 9: Auto-login (`/login?auto=admin`) does not set auth cookie

**What's broken:** The auto-login flow at lines 208-227 of `login/page.tsx` stores `access_token` and `refresh_token` in localStorage but does NOT set the `auth-storage` cookie that the middleware checks. After auto-login, the user is redirected to `/dashboard` but the middleware (once restored) will see them as unauthenticated and redirect back to `/login`.

**Where:** `/c/Prog/signapps-platform/client/src/app/login/page.tsx` lines 208-227

**Evidence:** The normal login flow (lines 136-168) sets the `auth-storage` cookie at line 160. The auto-login flow (lines 215-219) stores tokens but skips the cookie-setting step.

**Fix effort:** Small — add the cookie-setting line after token storage in the auto-login branch.

---

### Issue 10: Sharing dialog calls `getEffectivePermission` on storage but storage endpoint uses wrong URL path

**What's broken:** `sharing.ts` `getEffectivePermission()` calls `/api/v1/${prefix}/${resourceId}/permissions` — e.g., for a file: `/api/v1/files/{id}/permissions`. The storage service likely has a `/permissions` handler (`handlers/permissions.rs` exists), but it is separate from the sharing engine's `/api/v1/files/{id}/grants`. The storage permissions handler manages ACLs, not sharing grants. The sharing "effective permission" query may return unexpected data or 404.

**Where:**
- `/c/Prog/signapps-platform/client/src/lib/api/sharing.ts` lines 214-224
- `/c/Prog/signapps-platform/services/signapps-storage/src/handlers/permissions.rs`

**Evidence:** The sharing `getEffectivePermission` is mapped to the same service/prefix as grants but uses a `/permissions` suffix that may not be registered in `sharing_routes()`.

**Fix effort:** Medium — needs verification of actual route registration in the sharing crate.

---

### Issue 11: `shared-with-me` page shows UUID fragments, not resource names

**What's broken:** The `GrantItem` component at `shared-with-me/page.tsx` line 97 displays `grant.resource_id.slice(0, 8) + "…"` as the resource name, since the API returns only IDs, not names. The "Ouvrir" link points to `href="#"` (placeholder). Users cannot identify what was shared with them or navigate to the shared resource.

**Where:** `/c/Prog/signapps-platform/client/src/app/shared-with-me/page.tsx` lines 97, 139

**Evidence:**
```tsx
// line 97: shows truncated UUID, not resource name
const shortId = grant.resource_id.slice(0, 8) + "…";
// line 139: non-functional link
<a href="#" ...>Ouvrir</a>
```

**Fix effort:** Medium — requires either a resource name field in the sharing API response or client-side resolution of resource names.

---

### Issue 12: Tasks and Projects pages have no backend service

**What's broken:** `/tasks` and `/projects` pages are listed as "static" frontend-only apps in the gateway discovery function (`static_frontend_apps()` — gateway `main.rs` lines 222-235). There is no `signapps-tasks` or `signapps-projects` service in the backend. The pages have rich UI components (Kanban board, Gantt chart, sprint board) but they call a calendar service (`/api/v1/calendar/tasks`) for data — which may return empty or incorrect data.

**Where:**
- `/c/Prog/signapps-platform/client/src/app/tasks/page.tsx`
- `/c/Prog/signapps-platform/client/src/app/projects/page.tsx`
- `/c/Prog/signapps-platform/services/signapps-gateway/src/main.rs` lines 222-235

**Evidence:** Gateway `static_frontend_apps()` includes tasks and projects with `port: 0, status: "static"`, meaning they have no dedicated backend service.

**Fix effort:** Large — requires either a dedicated tasks/projects service or ensuring the calendar service fully supports task CRUD.

---

### Issue 13: Forms page calls the right service but the gateway port is swapped (P0 overlap)

This is the consequence of Issue 2: forms page (`/forms`) uses `formsApi` → `ServiceName.FORMS` → factory resolves to gateway → gateway sends to port 3022 (IT Assets) → all form CRUD fails with unexpected data or auth errors.

---

## P2 — Polish (cosmetic or nice-to-have)

### Issue 14: `console.warn` in factory printed for every service resolution

**What's broken:** `factory.ts` line 343 runs `console.warn('[API Factory] Resolving ...')` for every API client created when no per-service env var is set. With ~25 services, this floods the browser console on every page load.

**Where:** `/c/Prog/signapps-platform/client/src/lib/api/factory.ts` line 343

**Evidence:**
```ts
console.warn(`[API Factory] Resolving ${service} -> ${finalUrl}`);
```

**Fix effort:** Trivial — remove or change to `console.debug`.

---

### Issue 15: `shared-with-me` page — resource type labels exist but resource type filter includes `vault_entry` type

**What's broken:** `SHARING_RESOURCE_TYPE_LABELS` includes `vault_entry` in the type filter dropdown. But `vault_entry` sharing goes through the identity service (`sharing.ts` line 76), while `sharedWithMe` calls the storage service. Filtering by `vault_entry` will likely return no results even if vault items are shared.

**Where:** `/c/Prog/signapps-platform/client/src/lib/api/sharing.ts` line 76

**Evidence:** The `resolveService()` function maps `vault_entry` to `ServiceName.IDENTITY`, but `sharedWithMe()` always calls the storage service regardless of `resourceType`.

**Fix effort:** Small — either remove `vault_entry` from the shared-with-me filter or route the vault_entry type through the vault service.

---

### Issue 16: Whiteboard, Wiki, Design, Slides — frontend-only stubs

**What's broken:** These apps are declared as `status: "static"` in the gateway discovery with `port: 0`. The pages exist but show placeholder UI with no real backend. Users clicking these apps get stub pages.

**Where:**
- `/c/Prog/signapps-platform/client/src/app/whiteboard/`
- `/c/Prog/signapps-platform/client/src/app/wiki/`
- `/c/Prog/signapps-platform/client/src/app/design/`
- `/c/Prog/signapps-platform/client/src/app/slides/`

**Evidence:** Gateway `static_frontend_apps()` includes all four with `port: 0, status: "static"`.

**Fix effort:** Large — requires new backend services or integration with existing services.

---

### Issue 17: CLAUDE.md for gateway lists port 6048 but service runs on 3099

**What's broken:** `/c/Prog/signapps-platform/services/signapps-gateway/CLAUDE.md` says `Port: 6048` but the actual default port in `main.rs` line 745 is 3099.

**Where:** `/c/Prog/signapps-platform/services/signapps-gateway/CLAUDE.md`

**Evidence:** `main.rs:745`: `let gateway_port: u16 = env_or("GATEWAY_PORT", "3099")`.

**Fix effort:** Trivial — update CLAUDE.md.

---

## What Actually Works Well

**Login flow:** The login page (`/login`) is fully implemented with validation, lockout, LDAP option, and MFA redirect. The identity backend sets HttpOnly cookies. CORS allows credentials from `localhost:3000`. The auth store persists state correctly via Zustand.

**Gateway routing (most services):** 28 of 32 services are correctly routed through the gateway. The route table is well-organized with correct prefixes.

**Dashboard:** The `/dashboard` page loads with a widget grid system, role-based layout, and proper loading/empty states.

**Mail:** The `/mail` page has a full rich client (sidebar, message list, compose, AI assist, account switcher). The mail service (port 3012) is correctly routed.

**Storage/Drive:** The `/storage` page has a complete file manager UI (grid/list view, sidebar, rename, move, preview). Storage service (port 3004) is correctly routed with sharing integration via `signapps-sharing` crate.

**Calendar (`/cal`):** Accessible via the route group, the calendar service (port 3011) is correctly routed.

**Chat:** The `/chat` page has a full channel sidebar, message window, and DM support. Chat service (port 3020) is correctly routed.

**Admin users (`/admin/users`):** Uses `usersApi` from identity which is correctly wired to identity service (port 3001).

**Org structure (`/admin/org-structure`):** Uses `orgApi` which targets `ServiceName.ORG_SVC` (port 3026) — correctly routed in gateway.

**API factory:** Circuit breaker, JWT auto-refresh, human-readable French error messages, and service health tracking are all correctly implemented.

**Sharing crate:** The backend sharing engine is well-implemented with grants, templates, audit, bulk operations, and `shared-with-me`. It just needs the gateway routing fix (Issue 6).

**French language:** UI strings are consistently in French across all audited pages. No mixed-language issues found.

---

## Test Matrix

| Feature | Frontend | API client | Backend | Gateway | Verdict |
|---------|----------|------------|---------|---------|---------|
| Login | ✅ | ✅ (identity) | ✅ | ✅ | **WORKS** |
| Auto-login `/login?auto=admin` | ⚠️ (no cookie set) | ✅ | ✅ | ✅ | **PARTIAL** |
| Route protection | ❌ (no middleware.ts) | — | — | — | **BROKEN** |
| Dashboard | ✅ | ✅ | ✅ | ✅ | **WORKS** |
| Mail | ✅ | ✅ | ✅ | ✅ | **WORKS** |
| Storage/Drive | ✅ | ✅ | ✅ | ✅ | **WORKS** |
| Calendar (`/cal`) | ✅ | ✅ | ✅ | ✅ | **WORKS** |
| Calendar (`/calendar`) | ⚠️ (redirects) | — | — | — | **REDIRECT** |
| Chat | ✅ | ✅ | ✅ | ✅ | **WORKS** |
| Meet | ✅ | ✅ | ✅ | ✅ | **WORKS** |
| Docs | ✅ | ✅ | ✅ | ✅ | **WORKS** |
| Forms | ✅ | ✅ (ServiceName.FORMS=3015) | ✅ (3015) | ❌ (routed to 3022) | **BROKEN (gateway)** |
| IT Assets | ✅ | ✅ (ServiceName.IT_ASSETS=3022) | ✅ (3022) | ❌ (routed to 3015) | **BROKEN (gateway)** |
| Vault | ✅ | ❌ (uses identity:3001) | ✅ (3025) | ✅ | **BROKEN (client)** |
| Signatures | ✅ | ❌ (uses identity:3001) | ✅ (3028) | ✅ | **BROKEN (client)** |
| CRM | ✅ | ❌ (uses identity:3001) | ✅ (3021) | ✅ | **BROKEN (client)** |
| Resources/Reservations | ✅ | ❌ (uses identity:3001) | ✅ (3022) | ✅ | **BROKEN (client)** |
| Shared with me | ✅ | ✅ | ✅ | ❌ (not routed) | **BROKEN (gateway)** |
| Sharing templates (admin) | ✅ | ✅ | ✅ | ❌ (not routed) | **BROKEN (gateway)** |
| Billing | ✅ | ✅ | ✅ | ✅ | **WORKS** |
| Workforce | ✅ | ✅ | ✅ | ✅ | **WORKS** |
| Contacts | ✅ | ✅ | ✅ | ✅ | **WORKS** |
| Org structure | ✅ | ✅ | ✅ | ✅ | **WORKS** |
| Admin users | ✅ | ✅ | ✅ | ✅ | **WORKS** |
| Admin sharing templates | ✅ | ✅ | ✅ | ❌ (not routed) | **BROKEN (gateway)** |
| Admin sharing audit | ✅ | ✅ | ✅ | ❌ (not routed) | **BROKEN (gateway)** |
| Webhooks | ✅ | ✅ (WEBHOOKS_SVC) | ✅ | ✅ | **WORKS** |
| Compliance | ✅ | ✅ (COMPLIANCE_SVC) | ✅ | ✅ | **WORKS** |
| Tasks | ✅ | ✅ (via calendar) | ⚠️ (no dedicated svc) | ✅ | **PARTIAL** |
| Projects | ✅ | ✅ (via calendar) | ⚠️ (no dedicated svc) | ✅ | **PARTIAL** |
| Whiteboard | ✅ (stub) | — | ❌ (no backend) | — | **STUB** |
| Wiki | ✅ (stub) | — | ❌ (no backend) | — | **STUB** |

---

## Fix Priority Summary

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 1 | Restore `middleware.ts` | P0 | Small |
| 2 | Fix gateway port swap (forms/it-assets) | P0 | Small |
| 3 | Fix `vault.ts` → use `VAULT_SVC` | P0 | Small |
| 4 | Fix `crosslinks.ts` → use `SIGNATURES_SVC` | P0 | Small |
| 5 | Fix `crm.ts` → use `CONTACTS`, `resources.ts` → use `IT_ASSETS` | P0 | Small |
| 6 | Add `/api/v1/sharing` + `/api/v1/shared-with-me` to gateway | P0 | Small |
| 7 | Fix middleware auth cookie check (`auth-storage` not `access_token`) | P1 | Small |
| 8 | Fix auto-login missing cookie set | P1 | Small |
| 9 | Fix `shared-with-me` to show resource names + working "Ouvrir" links | P1 | Medium |
| 10 | Remove `console.warn` spam in factory | P2 | Trivial |
