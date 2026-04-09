---
name: slides-debug
description: Use when debugging, verifying, or extending the Slides (presentations) module of SignApps Platform. Spec at docs/product-specs/09-slides.md. The slides module is bundled inside `signapps-docs` service (not a dedicated service) via `/api/v1/presentation/*` with pptxgenjs for PPTX export. Frontend has 25 components including slide-editor (Fabric.js canvas), dashboard, presenter mode, and live collaboration. 22 smoke E2E tests exist with soft-fail fallbacks, 0 data-testids explicitly on source, tests use inferred selectors.
---

# Slides — Debug Skill

Debug companion for the Slides module. **Editor works** (Fabric.js canvas + pptxgenjs export). **Core CRUD + PPTX/PDF/PNG/SVG export + AI prompt generation implemented**. **~60% spec coverage**. E2E tests exist but use soft-fail fallbacks due to lack of explicit data-testids.

## Source of truth

**`docs/product-specs/09-slides.md`** — 10 categories (creation, editing, elements, animations, presenter mode, collab, AI, import/export, mobile, accessibility).

## Code map

### Backend (Rust)
- **Service**: bundled with `signapps-docs` (not a dedicated service!) — port **3010**
- **Location**: `services/signapps-docs/src/office/presentation/`
  - `mod.rs` — orchestration
  - `export.rs` — 6 endpoints (PPTX, PDF, PNG, SVG, all-PNG, all-SVG)
  - `pptx.rs` (~35KB) — PPTX generation via **pptxgenjs** (MIT)
  - `render.rs` (~12KB) — PNG/SVG canvas rendering
- **Endpoints** (`/api/v1/presentation/`):
  - `POST /export/pptx` → PPTX binary (cached)
  - `POST /export/pdf` → PDF binary (cached)
  - `POST /export/png` → single slide PNG
  - `POST /export/svg` → single slide SVG
  - `POST /export/all/png` → base64-JSON
  - `POST /export/all/svg` → SVG-JSON
  - `GET /info` → service capabilities & version
- **DB**:
  - Migration `058` — adds `'presentation'` to `drive.node_type` enum
  - Migration `234` — adds `'presentation'` to `chk_target_id_presence` constraint
  - **No dedicated presentations table** — presentations are Drive nodes with `target_id` → stored JSON (serialized Fabric.js canvas + metadata)
- **Data structures** (JSON-first):
  - `Presentation { slides: Slide[], theme, master, metadata }`
  - `Slide { id, background, layout, elements: SlideElement[], notes, transitions }`
  - `SlideElement { type: "text"|"image"|"shape"|"chart", props }`

### Frontend
- **Routes**:
  - `client/src/app/slides/page.tsx` — dashboard (listing, templates, AI generate)
  - `client/src/app/slides/editor/[id]/page.tsx` — editor
  - `client/src/app/slides/live/[id]/page.tsx` — live/presenter mode
- **Components** (`client/src/components/slides/` — 25 files, ~450KB):
  | File | Purpose | Size |
  |---|---|---|
  | `slide-editor.tsx` | Main canvas editor (Fabric.js) | 2452 LOC |
  | `dashboard.tsx` | Listing, templates, creation | ~350 |
  | `slide-canvas.tsx` | Canvas render layer | 16KB |
  | `slide-sidebar.tsx` | Slide thumbnails panel | 7KB |
  | `slide-toolbar.tsx` | Insert shapes/text/media | 10KB |
  | `slide-property-panel.tsx` | Element inspector | 29KB |
  | `master-slide-editor.tsx` | Theme/master | 32KB |
  | `ai-layout.tsx` | AI layout suggestions | 12KB |
  | `slide-animations.tsx` | Transitions (Framer Motion) | 12KB |
  | `presentation-mode.tsx` | Fullscreen presenter | 4KB |
  | `live-presentation.tsx` | Realtime collab | 19KB |
  | `pptx-import-dialog.tsx` | PPTX upload | 9KB |
  | `generate-from-prompt.tsx` | AI deck generation | 5KB |
  | `speaker-notes-panel.tsx` | Notes editor | 5KB |
  | `slide-themes.tsx` | Theme gallery | 10KB |
  | `slide-layout-picker.tsx` | Layout templates | 7KB |
  | `slide-sorter.tsx` | Thumbnail sorter | 7KB |
- **Hook**: `use-slides.ts` — Zustand-ish state
- **API**: `client/src/lib/api/office.ts` — 6 export fns
- **Store**: no dedicated store; state in hook

### E2E tests
- `client/e2e/slides.spec.ts` (277 lines, 9 suites, 22 tests) — **soft-fail fallbacks**
- Test groups: page layout, creation, editor (canvas, toolbar, thumbnails), elements (text, shape, image), navigation (keyboard), notes, export menu, themes, presenter mode
- **Relies on inferred selectors** (no explicit `data-testid=` in source); falls back to `getByRole`, class selectors, text
- **No `SlidesPage.ts`** Page Object

## Feature categories (from spec) with status

| Cat | Spec | Status |
|---|---|---|
| Creation | Blank, template, prompt, import PPTX, outline | ✅ except outline |
| Editing | Canvas, grids, layouts, master, undo/redo | ✅ partial |
| Elements | Text, shapes, images, video, tables, charts, SmartArt, icons, equations, code, 3D, embeds | ⚠️ basic only |
| Animations | Element + slide transitions, keyframes, preview | ⚠️ basic |
| Presenter | F5, notes, timer, laser, pen, Q&A, captions | ⚠️ fullscreen + notes only |
| Collab | Real-time, comments, suggestions, versions | ⚠️ infrastructure only |
| AI | Generate deck, design ideas, tone, translation | ⚠️ prompt + layout suggest |
| Import/Export | PPTX, PDF, images, Keynote, Google Slides, MD, HTML | ✅ PPTX/PDF/PNG/SVG |
| Mobile | Native app, swipe, Airplay | ❌ |
| Accessibility | WCAG AA, alt text, keyboard | ⚠️ partial |

## Key data-testids (TO BE ADDED / VERIFIED)

The current E2E spec assumes these selectors exist but they're inferred:

| data-testid | Target |
|---|---|
| `slides-root` | `/slides` page |
| `slides-dashboard-new-button` | New presentation |
| `slides-dashboard-templates-tab` | Templates tab |
| `slides-dashboard-presentation-{id}` | Presentation card in listing |
| `slide-editor-root` | Editor container — `data-presentation-id` |
| `slide-editor-canvas` | Fabric.js canvas |
| `slide-editor-toolbar` | Main toolbar |
| `slide-editor-toolbar-{text\|shape\|image\|chart\|table\|insert}` | Insert buttons |
| `slide-editor-thumbnails` | Sidebar |
| `slide-editor-thumbnail-{index}` | Each thumbnail — `data-slide-id` |
| `slide-editor-add-slide` | Add slide button |
| `slide-editor-present-button` | Enter presenter mode |
| `slide-editor-export-menu` | Export menu |
| `slide-editor-export-{pptx\|pdf\|png\|svg}` | Export format |
| `slide-editor-property-panel` | Right inspector |
| `slide-editor-speaker-notes` | Notes panel |
| `slide-editor-theme-picker` | Theme selector |
| `slide-editor-theme-{id}` | Each theme option |
| `presenter-mode-root` | Fullscreen presenter |
| `presenter-mode-next`, `presenter-mode-prev`, `presenter-mode-exit` | Navigation |

## Key E2E tests (to be modernized)

Current file `slides.spec.ts` should be split into:
- `client/e2e/slides-dashboard.spec.ts` — listing + creation + templates
- `client/e2e/slides-editor.spec.ts` — canvas, toolbar, elements, thumbnails
- `client/e2e/slides-export.spec.ts` — PPTX/PDF/PNG/SVG round-trip
- `client/e2e/slides-presenter.spec.ts` — fullscreen + notes

### 5 key journeys

1. **Create & export** — new presentation → add text + shape → export PPTX → verify file downloaded (size > 0)
2. **From template** — pick template → edit slide 2 → undo → save to Drive
3. **AI-assisted deck** — prompt "5 slides AI in education" → edit text → improve via AI → export PDF
4. **Real-time collab** — two users in same doc → user A adds text → user B sees it
5. **Presenter mode** — F5 fullscreen → space to advance → notes visible → ESC to exit

## Debug workflow

### Step 1: Reproduce
- Which page (dashboard, editor, live)?
- Presentation size (# slides, # elements) — big decks may hit pptxgenjs limits
- Export format (PPTX vs PDF vs PNG)
- Browser (Fabric.js canvas perf varies)

### Step 2: Classify
1. **Editor crash on add element** → `slide-editor.tsx` + Fabric.js version; check for event listener leak
2. **Export missing fonts** → pptxgenjs needs font registered; check server font cache
3. **Collab desync** → `live-presentation.tsx` + websocket; look for CRDT conflicts
4. **PPTX import loses formatting** → `pptx-import-dialog.tsx` → parser in `pptx.rs`
5. **AI generation gives bad output** → `generate-from-prompt.tsx` + `signapps-ai` gateway

### Step 3: Failing E2E first
### Step 4: Trace code
### Step 5: Fix + regression + update spec

## Common bug patterns (pre-populated)

1. **PPTX export cache stale** — cache key should include content hash, not just presentation ID. Check `export.rs` cache.
2. **Fabric.js text box shrinks on paste** — known Fabric bug; use `textbox.initDimensions()` after paste.
3. **Slide order lost on duplicate** — duplicating a slide must copy all element state + increment position.
4. **PDF export fails for large decks** — timeout on headless rendering; add retry + progress.
5. **PPTX import of Keynote-exported file** — PPTX variants differ; Keynote → PPTX has weird z-orders.
6. **Presenter mode black screen on second monitor** — needs multi-display API + user permission.
7. **Fonts not embedded in PPTX** — pptxgenjs doesn't embed by default; must provide font data.
8. **Undo/redo depth lost on slide switch** — editor undo stack is per-slide; save state before switching.
9. **Collab cursor flicker** — throttle awareness updates.
10. **Drive node not updating on save** — `target_id` JSON blob must be PUT, not just update metadata.

## Dependencies check (license compliance)

- **pptxgenjs** — MIT ✅
- **fabric** (Fabric.js) — MIT ✅
- **framer-motion** — MIT ✅
- **pdf-lib** or **jspdf** — MIT ✅ (PDF export)
- **html2canvas** — MIT ✅

### Forbidden
- **LibreOffice Impress** — LGPL/MPL (OK as external binary only)
- **Reveal.js** — MIT ✅ (OK if used)
- **PowerPoint automation via COM** — proprietary

## Cross-module interactions

- **Drive** — presentations are Drive nodes with `target_id` → JSON
- **Docs** — shared editor patterns; `EmbedSlide` extension
- **AI** — `generate-from-prompt`, layout suggestions via `signapps-ai` (port 3005)
- **Storage** — exported PPTX/PDF stored via OpenDAL
- **Identity** — owner + share permissions
- **Calendar** — presentation linked to a meeting event

## Spec coverage checklist

- [ ] All core elements (text, shape, image, chart, table)
- [ ] Full PPTX round-trip (import → edit → export → open in PowerPoint)
- [ ] Speaker notes preserved in export
- [ ] Real-time collab with cursors
- [ ] Presenter mode multi-display
- [ ] data-testids on all editor interactions
- [ ] Export quality validation (not just file size)
- [ ] No forbidden dep

## Historique

- **2026-04-09** : Skill créé. Basé sur spec `09-slides.md` et inventaire (bundled dans signapps-docs, pptxgenjs, 25 components, 22 E2E tests avec soft-fail, 0 data-testids explicites, Fabric.js canvas).
