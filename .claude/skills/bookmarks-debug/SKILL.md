---
name: bookmarks-debug
description: Debug skill for the Favoris module (/bookmarks). Cross-module favorites with StarButton component, dual storage (API + localStorage fallback), search, sort, type filters, and entity navigation links.
---

# Favoris (Bookmarks) — Debug Skill

## Source of truth

**`docs/product-specs/51-bookmarks.md`** — read spec first.

## Code map

### Backend (Rust)

- **Service**: `services/signapps-identity/` — port **3001**
- **Endpoints**:
  - `GET /bookmarks` — list bookmarks (supports `entity_type`, `entity_id` query params)
  - `POST /bookmarks` — create bookmark (`entity_type`, `entity_id`, `entity_title`, `entity_url`)
  - `DELETE /bookmarks/{id}` — remove bookmark

### Frontend (Next.js)

- **Page**: `client/src/app/bookmarks/page.tsx` — route wrapper with AppLayout, header, delegates to BookmarksPage
- **Component**: `client/src/components/crosslinks/CrossModuleFavorites.tsx` — contains:
  - **`StarButton`** — reusable star toggle component (API-first with localStorage fallback)
  - **`BookmarksPage`** — full bookmarks list UI with search, sort, type filter
  - **`addLocalBookmark()`** / **`removeLocalBookmark()`** / **`isLocalBookmarked()`** — localStorage helpers
- **API client**: uses `getClient(ServiceName.IDENTITY)` from `client/src/lib/api/factory.ts`
- **Types**: `Bookmark` interface (id, entity_type, entity_id, entity_title, entity_url, created_at, source)
- **localStorage key**: `signapps-bookmarks`

### Entity navigation links (MODULE_HREFS)

| entity_type | URL pattern |
|---|---|
| `document` | `/docs/{id}` |
| `drive_node` | `/drive/{id}` |
| `mail_message` | `/mail/{id}` |
| `calendar_event` | `/calendar/{id}` |
| `contact` | `/contacts/{id}` |
| `task` | `/tasks/{id}` |
| `spreadsheet` | `/sheets/{id}` |
| `presentation` | `/slides/{id}` |

### Dual storage strategy

1. **StarButton.toggle()** tries API first (`POST /bookmarks` or `DELETE /bookmarks/{id}`)
2. On API failure, falls back to localStorage (`addLocalBookmark` / `removeLocalBookmark`)
3. **BookmarksPage.load()** merges API bookmarks + localStorage bookmarks, deduplicates by entity_type+entity_id

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `bookmarks-root` | Bookmarks page container |
| `bookmarks-search` | Search input |
| `bookmarks-sort-toggle` | Sort order toggle button |
| `bookmarks-filter-all` | "All" filter button |
| `bookmarks-filter-{type}` | Entity type filter button |
| `bookmarks-item-{id}` | Bookmark item row |
| `bookmarks-remove-{id}` | Remove bookmark button |
| `bookmarks-open-{id}` | Open entity link |
| `star-button-{type}-{id}` | StarButton component in any module |
| `bookmarks-empty-state` | Empty state indicator |

## Key E2E journeys

1. **Star from module** — open a document, click StarButton, verify star fills yellow, navigate to /bookmarks, verify item appears
2. **Unstar** — click filled star, verify unfilled, verify removed from /bookmarks
3. **Search bookmarks** — type entity title in search, verify filtered results
4. **Sort bookmarks** — toggle sort (newest/oldest/alpha), verify order changes
5. **Filter by type** — select entity type filter, verify only matching bookmarks shown
6. **Navigate to entity** — click bookmark link, verify redirect to correct module page
7. **Offline fallback** — disconnect backend, star an item, verify localStorage fallback toast "(local)"

## Common bug patterns

1. **API + localStorage duplicates** — `BookmarksPage.load()` merges both sources; if API returns a bookmark that also exists in localStorage (from earlier offline session), dedup by entity_type+entity_id must catch it
2. **StarButton initial state race** — `useEffect` queries API for existing bookmark; slow response can show unstarred then flip to starred, causing flicker
3. **localStorage limit** — `signapps-bookmarks` grows unbounded; very heavy users can hit 5MB localStorage limit
4. **Missing MODULE_HREFS entry** — new entity types (e.g., `form_response`, `chat_message`) have icons but no href mapping; clicking "Open" does nothing
5. **Stale star state** — StarButton manages its own local state; if the same entity is starred/unstarred elsewhere (another tab), this instance stays stale until remount
6. **Local bookmark IDs** — `local-${Date.now()}-${random}` format; `removeLocalBookmark` filters by id prefix `local-` to decide storage path, but API bookmarks could theoretically have ids starting with "local-"
7. **Sort state not persisted** — sort order resets to "newest" on page navigation

## Debug checklist

- [ ] Identity service running? `curl http://localhost:3001/api/v1/health`
- [ ] API bookmarks returned? Check `GET /bookmarks` response in Network tab
- [ ] localStorage bookmarks? Check `localStorage.getItem('signapps-bookmarks')` in browser console
- [ ] StarButton mounted? Check component renders in React DevTools for the entity
- [ ] Bookmark created? After starring, verify `POST /bookmarks` returns 200/201
- [ ] Navigation link works? Check `MODULE_HREFS` has entry for the entity_type
- [ ] Dedup working? Compare API + localStorage counts vs displayed count

## Dependencies (license check)

- **Backend**: axum, sqlx — Apache-2.0/MIT
- **Frontend**: react, next, sonner — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
