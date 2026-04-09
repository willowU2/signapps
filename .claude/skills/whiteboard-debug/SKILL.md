---
name: whiteboard-debug
description: Debug skill for the Whiteboard module. Real-time collaboration via Yjs CRDT + WebSocket through signapps-collab port 3013. Covers infinite canvas, shapes, sticky notes, drawing, and multi-user sync.
---

# Whiteboard — Debug Skill

## Source of truth

**`docs/product-specs/41-whiteboard.md`** — read spec first.

## Code map

### Backend (Rust)
- **Real-time**: `services/signapps-collab/` — port **3013** (Yjs CRDT WebSocket)
- **Storage**: whiteboard documents persisted via `signapps-storage` (3004) or `signapps-docs` (3010)
- **DB models**: `crates/signapps-db/src/models/whiteboard*.rs`

### Frontend (Next.js)
- **Pages**: `client/src/app/whiteboard/` (canvas editor)
- **Components**: `client/src/components/whiteboard/` (canvas, toolbar, shapes, layers)
- **Yjs integration**: y-websocket provider connecting to collab service
- **API client**: `client/src/lib/api/whiteboard.ts`

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `whiteboard-root` | Whiteboard page container |
| `whiteboard-canvas` | Infinite canvas |
| `whiteboard-toolbar` | Drawing toolbar |
| `whiteboard-shape-{type}` | Shape tool (rect, circle, arrow, text) |
| `whiteboard-sticky-{id}` | Sticky note on canvas |
| `whiteboard-zoom` | Zoom controls |
| `whiteboard-export` | Export button |

## Key E2E journeys

1. **Draw shapes** — select rectangle tool, draw on canvas, verify shape created
2. **Add sticky note** — add sticky, type text, move it, verify position persists
3. **Multi-user sync** — two users on same board, one draws, other sees in real-time
4. **Export board** — export as PNG/SVG, verify file contains all elements

## Common bug patterns

1. **Yjs document corruption** — CRDT merge conflict on rapid concurrent edits
2. **Canvas performance** — 100+ objects on canvas causes frame drops; needs virtualization
3. **Zoom/pan desync** — viewport state not synced between collab users

## Dependencies (license check)

- **Yjs** — MIT
- **y-websocket** — MIT
- **tldraw** or **excalidraw** — check license if used (both MIT)
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
