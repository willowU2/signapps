---
name: keep-debug
description: Debug skill for the Keep module (notes/sticky notes). Uses signapps-storage port 3004 with localStorage fallback. Covers quick notes, labels, reminders, pinning, and archive.
---

# Keep — Debug Skill

## Source of truth

**`docs/product-specs/40-keep.md`** — read spec first.

## Code map

### Backend (Rust)
- **Storage**: via `signapps-storage/` — port **3004** (OpenDAL FS/S3)
- **Fallback**: localStorage for offline/guest mode
- **DB models**: `crates/signapps-db/src/models/note*.rs` or `keep*.rs`
- **Handlers**: may be in `signapps-storage` or standalone

### Frontend (Next.js)
- **Pages**: `client/src/app/keep/` (grid view, list view, archive)
- **Components**: `client/src/components/keep/` (note card, editor, labels, colors)
- **Store**: `client/src/stores/keep-store.ts` or localStorage
- **API client**: `client/src/lib/api/keep.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `keep-root` | Keep page container |
| `keep-note-{id}` | Note card |
| `keep-create-btn` | Create note button |
| `keep-search` | Search notes input |
| `keep-label-{name}` | Label filter |
| `keep-pin-{id}` | Pin/unpin toggle |
| `keep-archive-{id}` | Archive button |

## Key E2E journeys

1. **Create note** — create note with title + content, verify displayed in grid
2. **Pin & label** — pin a note, add label, verify pinned section and filter works
3. **Archive & restore** — archive note, verify hidden from main view, restore it
4. **Offline mode** — disconnect network, create note, reconnect, verify synced

## Common bug patterns

1. **localStorage vs server sync** — conflict when note edited offline and online simultaneously
2. **Color persistence** — note background color not saved to backend, only in localStorage
3. **Search not indexed** — full-text search missing on note content; only title searched

## Dependencies (license check)

- **Backend**: axum, opendal — Apache-2.0
- **Frontend**: react, next, zustand — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
