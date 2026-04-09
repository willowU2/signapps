---
name: collaboration-debug
description: Debug skill for the Collaboration module (mind maps, shared workspaces). Currently MOCK data — backend implementation needed. Spec covers mind maps, shared canvases, and real-time collaboration.
---

# Collaboration — Debug Skill

## Source of truth

**`docs/product-specs/32-collaboration.md`** — read spec first.

**Status**: MOCK data — backend not yet implemented.

## Code map

### Backend (Rust)
- **Service**: TBD — may use `signapps-collab` port **3013** (CRDT service)
- **Real-time**: Yjs CRDT via `signapps-collab` WebSocket
- **DB models**: to be created in `crates/signapps-db/src/models/collaboration*.rs`
- **Migrations**: to be created

### Frontend (Next.js)
- **Pages**: `client/src/app/collaboration/` (mind maps, shared spaces)
- **Components**: `client/src/components/collaboration/`
- **Mock data**: hardcoded MOCK_* constants — to be replaced by real API calls
- **API client**: `client/src/lib/api/collaboration.ts` (stub or missing)

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `collab-root` | Collaboration page container |
| `mindmap-canvas` | Mind map canvas |
| `mindmap-node-{id}` | Mind map node |
| `collab-workspace-{id}` | Shared workspace |
| `collab-invite-btn` | Invite collaborator |
| `collab-presence-{userId}` | User presence indicator |

## Key E2E journeys

1. **Create mind map** — create new map, add 3 nodes, connect them
2. **Real-time collab** — two users edit same mind map, verify sync
3. **Workspace management** — create workspace, add members, share content
4. **Export mind map** — export as image or JSON

## Common bug patterns

1. **MOCK data stale** — UI works with mocks but breaks when backend connected (schema mismatch)
2. **CRDT conflict** — concurrent edits on same node produce unexpected merge result
3. **WebSocket reconnect** — collab session lost on network hiccup

## Dependencies (license check)

- **Yjs** — MIT (CRDT library)
- **reactflow** or similar mind map lib — check license
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
