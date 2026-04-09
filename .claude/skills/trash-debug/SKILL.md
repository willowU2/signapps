---
name: trash-debug
description: Debug skill for the Corbeille globale (/trash). Cross-module unified trash with restore, purge, purge-all, retention/expiration policies, and entity type filters. Uses identity service (port 3001) for the /trash API.
---

# Corbeille globale — Debug Skill

## Source of truth

**`docs/product-specs/50-trash.md`** — read spec first.

## Code map

### Backend (Rust)

- **Service**: `services/signapps-identity/` — port **3001**
- **Endpoints**:
  - `GET /trash` — list all soft-deleted items for the current user/tenant
  - `POST /trash/{id}/restore` — restore a specific item
  - `DELETE /trash/{id}` — permanently purge a specific item
  - `DELETE /trash` — purge all items (empty trash)
- **DB**: soft-delete records with `entity_type`, `entity_id`, `entity_title`, `deleted_by`, `deleted_at`, `expires_at`

### Frontend (Next.js)

- **Page**: `client/src/app/trash/page.tsx` — route wrapper with AppLayout, header, delegates to UnifiedTrash
- **Component**: `client/src/components/crosslinks/UnifiedTrash.tsx` — full trash UI
  - Entity type filter buttons (dynamic from loaded items)
  - Per-item restore and purge buttons
  - "Vider la corbeille" purge-all with AlertDialog confirmation
  - Expiration warning badge (orange) when `expires_at` is within 7 days
  - ScrollArea with `h-[calc(100vh-300px)]`
- **API client**: uses `getClient(ServiceName.IDENTITY)` from `client/src/lib/api/factory.ts`
- **Types**: `SuppriméItem` interface defined inline in UnifiedTrash.tsx

### Module type mappings

| entity_type | Icon | Label |
|---|---|---|
| `document` | :page_facing_up: | Document |
| `drive_node` | :file_folder: | Fichier |
| `mail_message` | :email: | Email |
| `calendar_event` | :date: | Evenement |
| `contact` | :bust_in_silhouette: | Contact |
| `task` | :white_check_mark: | Tache |
| `form_response` | :memo: | Formulaire |
| `chat_message` | :speech_balloon: | Message |

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `trash-root` | Trash page container |
| `trash-filter-all` | "Tout" filter button |
| `trash-filter-{type}` | Entity type filter button |
| `trash-item-{id}` | Trash item row |
| `trash-restore-{id}` | Restore button per item |
| `trash-purge-{id}` | Purge button per item |
| `trash-purge-all` | "Vider la corbeille" button |
| `trash-confirm-dialog` | AlertDialog confirmation |
| `trash-empty-state` | Empty state indicator |

## Key E2E journeys

1. **View deleted items** — navigate to /trash, verify items load with type badges and dates
2. **Filter by type** — click entity type filter (e.g., "Document"), verify only matching items shown
3. **Restore item** — click "Restaurer" on an item, verify it disappears from trash, verify toast success
4. **Purge single item** — click purge (trash icon) on an item, verify permanent deletion
5. **Purge all** — click "Vider la corbeille", confirm in AlertDialog, verify all items removed
6. **Expiration warning** — verify items with `expires_at` within 7 days show orange warning badge

## Common bug patterns

1. **Silent API failure** — `load()` catches errors and sets `items` to empty array; no error UI shown to user, looks like empty trash
2. **Stale item list after restore** — `restore()` removes item from local state via filter, but if the API call fails after optimistic removal, item is lost from UI without actual restoration
3. **Expiration calculation timezone** — `daysUntil()` compares `new Date(date).getTime()` with `Date.now()`; timezone differences between server and browser can show wrong day count
4. **Purge-all confirmation UX** — `purgeAll` sends `DELETE /trash` before the AlertDialog fully closes; rapid double-click could fire twice
5. **Missing entity types** — if backend returns a new `entity_type` not in `MODULE_ICONS` or `MODULE_LABELS`, it renders the raw type string and a generic trash icon
6. **ScrollArea fixed height** — `h-[calc(100vh-300px)]` assumes fixed header height; if header content changes, scroll area may clip or leave gaps
7. **No pagination** — loads all trash items at once; large trash can cause slow rendering

## Debug checklist

- [ ] Identity service running? `curl http://localhost:3001/api/v1/health`
- [ ] Auth token valid? Trash API requires authentication; check JWT in request headers
- [ ] Items in database? Check `trash` or `soft_deletes` table in PostgreSQL
- [ ] API returns data? Check browser DevTools Network tab for `GET /trash` response
- [ ] Filter state: inspect `filter` state in React DevTools (should be 'all' or entity_type string)
- [ ] Expiration dates: verify `expires_at` field is populated by backend for retention policy

## Dependencies (license check)

- **Backend**: axum, sqlx — Apache-2.0/MIT
- **Frontend**: react, next, sonner (toast) — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
