---
name: design-debug
description: Debug skill for the Design module (graphic design canvas). Bundled in signapps-docs port 3010 using Fabric.js. Covers canvas editor, templates, layers, export, and collaboration.
---

# Design — Debug Skill

## Source of truth

**`docs/product-specs/25-design.md`** — read spec first.

## Code map

### Backend (Rust)
- **Service**: bundled in `services/signapps-docs/` — port **3010**
- **Handlers**: `services/signapps-docs/src/handlers/design*`
- **DB models**: `crates/signapps-db/src/models/design*.rs`
- **Migrations**: `migrations/*design*`

### Frontend (Next.js)
- **Pages**: `client/src/app/design/` (editor, templates, gallery)
- **Components**: `client/src/components/design/` (canvas, toolbar, layers, properties panel)
- **API client**: `client/src/lib/api/design.ts`
- **Core**: Fabric.js canvas integration

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `design-canvas` | Fabric.js canvas container |
| `design-toolbar` | Main toolbar |
| `design-layer-panel` | Layers panel |
| `design-properties` | Properties sidebar |
| `design-export-btn` | Export button |
| `design-template-{id}` | Template card |
| `design-save-btn` | Save button |

## Key E2E journeys

1. **Create from template** — pick template, customize text/colors, save
2. **Freeform design** — add shapes, text, images; arrange layers; export PNG
3. **Layer management** — add 3 objects, reorder layers, lock/unlock, group
4. **Export formats** — export as PNG, SVG, PDF; verify file downloaded
5. **Collaborative edit** — two users on same design via Yjs

## Common bug patterns

1. **Fabric.js canvas scaling** — DPI mismatch between edit and export resolutions
2. **Z-index desync** — layer panel order not matching canvas rendering order
3. **Large image OOM** — importing high-res images without downscaling crashes browser

## Dependencies (license check)

- **fabric** (Fabric.js) — MIT
- **Backend**: axum, sqlx — MIT/Apache-2.0
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
