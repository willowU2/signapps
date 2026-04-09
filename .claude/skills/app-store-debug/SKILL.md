---
name: app-store-debug
description: Debug skill for the App Store module (/apps). 189+ self-hosted app catalog from multiple sources, Docker container integration via signapps-containers (port 3002), install/uninstall, source management, category filters, pagination.
---

# App Store — Debug Skill

## Source of truth

**`docs/product-specs/49-app-store.md`** — read spec first.

## Code map

### Backend (Rust)

- **Service**: `services/signapps-containers/` — port **3002** (Docker management via bollard)
- **Store endpoints**: `/store/apps`, `/store/apps/{id}/install`, `/store/categories`, `/store/sources`, `/store/refresh`, `/store/install`, `/store/install-multi`, `/store/check-ports`, `/store/sources/validate`
- **Container endpoints**: `/containers` (list, create, stop, start, remove)
- **Installed detection**: matches `signapps.app.id` label or image base name

### Frontend (Next.js)

- **Page**: `client/src/app/apps/page.tsx` — main store UI (search, category filter, grouped/flat views, pagination)
- **Components**:
  - `client/src/components/apps/app-card.tsx` — card with install/open/stop actions
  - `client/src/components/apps/app-detail-dialog.tsx` — full app details overlay
  - `client/src/components/apps/install-dialog.tsx` — install configuration dialog
  - `client/src/components/apps/install-progress.tsx` — install progress indicator
  - `client/src/components/apps/source-manager.tsx` — manage app sources (add/remove/refresh)
  - `client/src/components/apps/custom-app-dialog.tsx` — install custom Docker image
- **API client**: `client/src/lib/api/containers.ts` — `storeApi` (listApps, install, refreshAll, listSources, addSource, deleteSource, etc.) + `containersApi`
- **Types**: `StoreApp`, `AppDetails`, `ParsedService`, `InstallRequest`, `InstallResponse`, `AppSource`, `PortConflict` — all in `containers.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `apps-root` | App Store page container |
| `apps-search` | Search input |
| `apps-category-{name}` | Category filter button |
| `apps-card-{id}` | App card |
| `apps-install-btn-{id}` | Install button on card |
| `apps-detail-dialog` | App detail dialog |
| `apps-install-dialog` | Install dialog |
| `apps-source-manager` | Source manager dialog |
| `apps-custom-app-btn` | "Ajouter une app" button |
| `apps-refresh-btn` | Refresh all button |
| `apps-pagination` | Pagination controls |

## Key E2E journeys

1. **Browse catalog** — open /apps, verify apps load with categories, scroll through grouped view
2. **Search & filter** — type search term, select category tag, verify filtered results and page reset
3. **Install app** — click install on an app, configure ports/volumes in install dialog, verify container starts
4. **Open installed** — verify installed app shows "Open" button with correct URL based on port mappings
5. **Source management** — open Sources dialog, add a new source URL, validate, refresh, verify apps appear
6. **Custom app** — click "Ajouter une app", enter Docker image, install custom container
7. **Pagination** — filter to show many results, navigate pages, verify correct slice displayed

## Common bug patterns

1. **Deduplication by name** — `deduplicatedApps` uses `app.name.toLowerCase()` as key; same-name apps from different sources are deduplicated (first wins), which can hide newer versions
2. **Installed detection mismatch** — `getInstalledId` matches by `signapps.app.id` label OR image base name; if app uses a different image tag or multi-image compose, detection fails
3. **Container URL derivation** — `getContainerUrl(portMappings)` picks the first port mapping; multi-port apps may show wrong URL
4. **Silent fetch failure** — `fetchApps` and `fetchInstalledContainers` catch and ignore errors; page shows empty state without error indication
5. **Source refresh race** — `handleRefreshAll` calls `storeApi.refreshAll()` then re-fetches; slow sources may not be ready when the second fetch runs
6. **Category extraction** — categories are derived from `app.tags[0]`; apps with empty tags array fall into "Other" category
7. **Page reset on filter change** — `useEffect` resets page to 1 when `search` or `activeCategory` changes, but grouped view ignores pagination entirely
8. **Port conflicts** — `storeApi.checkPorts` exists but may not be called before install, leading to bind failures

## Debug checklist

- [ ] Containers service running? `curl http://localhost:3002/api/v1/health`
- [ ] Docker daemon accessible? Service uses bollard to talk to Docker socket
- [ ] Apps loaded? Check `apps` state length in React DevTools — should be > 0
- [ ] Sources configured? Check `storeApi.listSources()` response
- [ ] Installed map populated? Check `installedMap` state — keys should match app IDs or image names
- [ ] Container labels? Verify installed containers have `signapps.app.id` label
- [ ] Network errors? Check browser DevTools Network tab for 3002 requests
- [ ] Port conflicts? Check `docker ps` for conflicting port bindings

## Dependencies (license check)

- **Backend**: axum, bollard (Docker client) — Apache-2.0/MIT
- **Frontend**: react, next, zustand — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
