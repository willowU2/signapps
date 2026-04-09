---
name: shared-with-me-debug
description: Debug skill for the Shared With Me module (/shared-with-me). Cross-module shared resources aggregator. Uses the unified sharing API (sharingApi.sharedWithMe) routed through signapps-storage port 3004. Currently returns 404 because the backend endpoint is not implemented.
---

# Shared With Me — Debug Skill

## Source of truth

**`docs/product-specs/62-shared-with-me.md`** — read spec first.

## Code map

### Backend (Rust)

- **Endpoint**: `GET /api/v1/shared-with-me?resource_type={type}` — hosted on **signapps-storage** port **3004**
- **Status**: **NOT IMPLEMENTED** — returns 404. The frontend API client calls this endpoint but the backend route does not exist yet.
- **Sharing grant tables**: managed per-service (storage, calendar, docs, forms, contacts, chat, it-assets, identity)
- **Required implementation**: a handler in signapps-storage that queries the `sharing_grants` table filtering by `grantee_id = current_user` (or group/org/everyone) across all resource types

### Frontend (Next.js)

- **Page**: `client/src/app/shared-with-me/page.tsx` — full implementation with type filter, grouped cards, loading skeleton, empty state, error state
- **API client**: `client/src/lib/api/sharing.ts` — `sharingApi.sharedWithMe(resourceType?)` calls `GET /api/v1/shared-with-me`
- **Types**: `client/src/types/sharing.ts` — `SharingGrant`, `SharingResourceType`, `SharingRole`, `SharingGranteeType`, display label maps
- **Key components in page**:
  - `SharedWithMeSkeleton` — loading placeholder (3 skeleton cards)
  - `GrantItem` — individual grant row (icon, truncated resource_id, shared date, expiry, role badge)
  - Filter `Select` — dropdown with all 10 resource types + "Tous les types"
  - Grouped `Card` list — grants grouped by `resource_type` with count badges
- **Store**: none — uses local `useState` + `useEffect` with cancel token pattern
- **Routing**: sharing API factory resolves `ServiceName.STORAGE` for the shared-with-me endpoint

### Sharing system architecture

- 10 resource types: file, folder, calendar, event, document, form, contact_book, channel, asset, vault_entry
- Each backend service owns its own `/api/v1/{prefix}/:resource_id/grants` CRUD
- The shared-with-me query is a **tenant-wide aggregation** endpoint on storage (port 3004)
- Roles: viewer, editor, manager, deny
- Grantee types: user, group, org_node, everyone

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `shared-with-me-root` | Page container |
| `shared-with-me-filter` | Resource type filter Select |
| `shared-with-me-skeleton` | Loading skeleton |
| `shared-with-me-error` | Error card |
| `shared-with-me-empty` | Empty state container |
| `shared-with-me-group-{type}` | Grouped card for a resource type |
| `shared-grant-{id}` | Individual grant row |
| `shared-grant-role-{id}` | Role badge on a grant |
| `shared-grant-open-{id}` | Open resource link |

## Key E2E journeys

1. **Load shared resources** — navigate to /shared-with-me, verify grants load grouped by type (currently blocked by 404)
2. **Filter by type** — select "Fichier" from dropdown, verify only file grants display
3. **Empty state** — when no grants exist, verify empty state message "Aucun element partage avec vous"
4. **Error state** — when backend returns error, verify red error card displays the message
5. **Role badges** — verify viewer=muted, editor=blue, manager=green, deny=red badge colors

## Common bug patterns

1. **Backend 404** — the `GET /api/v1/shared-with-me` endpoint is not implemented on signapps-storage. The page always shows an error card. **This is the primary issue to fix.**
2. **Resource ID display** — `GrantItem` only shows truncated UUID (`shortId = grant.resource_id.slice(0, 8) + "..."`). No resource name resolution — need to join with resource metadata.
3. **"Ouvrir" link is placeholder** — the open link href is `#`, does not navigate to the actual resource. Needs routing logic per resource_type (e.g. `/drive/{id}`, `/docs/{id}`, `/calendar/{id}`).
4. **Filter resets on navigation** — `filterType` state is not persisted in URL query params. Navigating away and back resets to "all".
5. **No pagination** — loads all grants at once. Will be slow for users with many shared resources.
6. **Date formatting locale** — hardcoded to `fr-FR`. Should use user locale preference.
7. **Cancel race condition** — uses `cancelled` boolean pattern which is correct, but the loading state may flicker if filter changes rapidly.

## Debug checklist

- [ ] Navigate to `/shared-with-me` — check if page renders (expect error card due to 404)
- [ ] Check browser Network tab for `GET /api/v1/shared-with-me` — confirm 404 from storage service
- [ ] Verify storage service is running on port 3004: `curl http://localhost:3004/health`
- [ ] Check that `client/src/lib/api/sharing.ts` resolves to `ServiceName.STORAGE` for sharedWithMe
- [ ] Test the type filter dropdown — verify all 10 resource types are listed
- [ ] Verify error state renders with red destructive card styling
- [ ] Check console for unhandled promise rejections from the failed API call
- [ ] To fix: implement `GET /api/v1/shared-with-me` handler in signapps-storage that queries `sharing_grants` WHERE grantee matches current user

## Dependencies (license check)

- **Backend**: axum, sqlx, signapps-common, signapps-db — MIT/Apache-2.0
- **Frontend**: react, next, axios (via factory), lucide-react — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
