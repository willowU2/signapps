# LibreOffice-Inspired Platform Enhancement — Design Spec

## Summary

Enhance SignApps by applying 7 architectural patterns from LibreOffice — **patterns only, no code reuse**. The design follows a foundations-first execution order: shared infrastructure (Filter Pipeline, Drawing Layer, Style Inheritance) before feature modules (Sheets, Slides, Undo/Versioning, Automations/SDK).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Execution order | Foundations first (B) | Filter Pipeline + Drawing Layer are reused by Sheets, Slides, and export |
| Drawing strategy | Hybrid (C) | tldraw for Whiteboard standalone; custom drawing engine for shapes in Docs/Sheets/Slides |
| Scripting scope | Visual automations + SDK (A+C) | No-code for business users, TypeScript SDK for power users/admins |
| Format coverage | DOCX, XLSX, PPTX, ODT/ODS/ODP, CSV, PDF, MD, HTML | Full office interop |
| Style model | Cascade inheritance (platform → org → template → document) | Like CSS; one change updates everything downstream |
| Versioning | Event sourcing with command log + periodic snapshots | Per-user collaborative undo, server-side history |

## Execution Order

1. **Filter Pipeline** — crate `signapps-filters` (foundation)
2. **Drawing Layer** — crate `signapps-drawing` (foundation)
3. **Style Inheritance** — tables + resolver in `signapps-db-shared` (foundation)
4. **Spreadsheet enrichi** — dependency graph, cell format, charts, 50+ functions
5. **Slides complet** — master/layout/slide, canvas shapes, presenter view
6. **Undo/Versioning** — command log, snapshots, diff view
7. **Automations + SDK** — visual builder + TypeScript extension SDK

---

## Chantier 1: Filter Pipeline

### Problem

Import/export scattered across `signapps-docs/src/office/` and frontend. No PPTX/ODP. Each format hard-wired.

### Architecture

```
Bytes in → FormatDetector (magic bytes + ext + MIME)
         → FilterRegistry.find(format) → dyn FilterTrait
         → filter.import(bytes) → IntermediateDocument
         → IntermediateDocument → Tiptap JSON / Sheet JSON / Slide JSON
```

### New crate: `signapps-filters`

| Module | Responsibility |
|--------|---------------|
| `detector.rs` | Format detection (magic bytes, extension, MIME) |
| `registry.rs` | Filter registry, lookup by format |
| `traits.rs` | `FilterTrait { detect(), import(), export(), fidelity() }` |
| `intermediate.rs` | Intermediate document model (blocks, styles, metadata) |
| `filters/docx.rs` | DOCX filter (migrated from office service) |
| `filters/xlsx.rs` | XLSX filter (migrated from office service) |
| `filters/pptx.rs` | PPTX filter (**new**) |
| `filters/odt.rs` | ODT/ODS/ODP filter (**new**) |
| `filters/pdf.rs` | PDF export (migrated from office service) |
| `filters/csv.rs` | CSV import/export (**new**) |
| `filters/markdown.rs` | Markdown filter (migrated from office service) |

### Intermediate Document Model

A typed node tree (paragraph, table, image, cell, slide) with resolved styles. Each filter converts to/from this model. Adding a new format = implement one `FilterTrait`, no other changes needed.

---

## Chantier 2: Drawing Layer

### Problem

Basic SVG canvas in whiteboard, tldraw scoped to meetings, no shapes in Docs/Sheets/Slides.

### Architecture: Primitive Decomposition

```
Shape (rect, ellipse, arrow, group, text-box, image, connector)
    → decompose() → Vec<DrawPrimitive>
    → Processor::render(target)
        ├── SvgProcessor  → SVG string (frontend inline)
        ├── CanvasProcessor → Canvas2D commands (frontend perf)
        ├── PdfProcessor  → PDF drawing ops (export)
        └── ThumbnailProcessor → PNG (preview/cache)
```

### New crate: `signapps-drawing`

| Module | Responsibility |
|--------|---------------|
| `primitives.rs` | Enum `DrawPrimitive` (line, rect, path, fill, text, image, group) |
| `shapes.rs` | High-level shapes → decomposition into primitives |
| `styles.rs` | Fill, stroke, shadow, opacity, transforms |
| `processor.rs` | Trait `RenderProcessor` + SVG/PDF/PNG implementations |
| `tree.rs` | Ordered display list (z-index, grouping, layers) |

### Frontend components

| Component | Role |
|-----------|------|
| `DrawingCanvas.tsx` | SVG/Canvas renderer consuming primitive tree JSON |
| `ShapeToolbar.tsx` | Shape tools (rect, ellipse, arrow, text, image) |
| `ShapeProperties.tsx` | Properties panel (fill, stroke, shadow, transform) |

### Integration

- **Docs**: inline shapes via Tiptap `drawing-block` extension
- **Sheets**: charts rendered as shapes (chart → primitives → SVG)
- **Slides**: each slide = a canvas of primitives
- **Whiteboard**: tldraw unchanged (standalone)
- **PDF export**: `PdfProcessor` reused by Filter Pipeline (chantier 1)

---

## Chantier 3: Style Inheritance

### Problem

Styles inline in Tiptap JSON. Templates are static HTML blobs. No "change all headings" in one click.

### Architecture: Cascade Chain

```
base-style (platform defaults)
    → org-style (company branding: fonts, colors)
    → template-style (specific document template)
    → local-override (user formatting in document)
```

### Database

```sql
core.style_definitions (
    id UUID, tenant_id UUID,
    name TEXT,            -- "Heading 1", "Body", "Code Block"
    style_type TEXT,      -- 'paragraph' | 'character' | 'cell' | 'slide'
    parent_id UUID,       -- inheritance: points to parent style
    properties JSONB,     -- { fontFamily, fontSize, color, lineHeight, ... }
    is_builtin BOOLEAN,   -- non-deletable default styles
    scope TEXT            -- 'global' | 'template' | 'document'
)

core.template_styles (
    template_id UUID, style_id UUID
)
```

### Resolution (Rust, `signapps-db-shared`)

`resolve_style(style_id)` → walk parent chain → merge properties → flat resolved style. Closest child property wins. Undefined properties bubble up to parent.

### Frontend

| Component | Role |
|-----------|------|
| `StylePicker.tsx` | Dropdown "Heading 1 / Body / Quote..." in Docs toolbar |
| `StyleEditor.tsx` | Admin panel for org-wide style editing |
| `StylePreview.tsx` | Live preview with resolved cascade |

### Impact

- **Docs**: Tiptap styles map to `style_definitions` instead of inline
- **Sheets**: cell styles (number, currency, date, percentage) follow same chain
- **Slides**: master slide = inherited style set per slide
- **Templates**: template = document + associated style set

---

## Chantier 4: Spreadsheet Enrichment

### Problem

Solid formula engine (30+ functions) but minimal UI, no cell formatting, no charts, no sort/filter.

### Backend enhancements

| Component | Addition |
|-----------|----------|
| Dependency graph | Directed graph of inter-cell references. When A1 changes, only dependents recalculate (topological sort). Replaces full recalc. |
| Cell formatting | `cell_format JSONB`: font, colors, borders, number format (`#,##0.00`, dates, percentages, currency). Per-cell, inheritable via cell styles (chantier 3). |
| Conditional formatting | Rules `if value > X → style Y`. Evaluated server-side, sent as style overrides. |
| Sort/Filter/Freeze | Column-level metadata: sort order, filter expression, frozen panes. |
| 50+ new functions | VLOOKUP, HLOOKUP, INDEX, MATCH, SUMIF, COUNTIF, AVERAGEIF, OFFSET, INDIRECT, and more. |

### Charts via Drawing Layer

```
Sheet data selection → ChartDefinition { type, data_range, options }
    → chart_to_primitives() → Vec<DrawPrimitive>
    → DrawingCanvas.tsx (inline or fullscreen)
```

Chart types: bar, line, pie, scatter, area, donut, stacked. Each type = a function `→ Vec<DrawPrimitive>` in `signapps-drawing`.

### Frontend

| Component | Role |
|-----------|------|
| `CellFormatBar.tsx` | Formatting toolbar (font, colors, borders, number format) |
| `FormulaBar.tsx` | Formula bar with function + reference autocomplete |
| `ColumnHeader.tsx` | Resize, sort, filter, freeze via right-click |
| `ConditionalFormatDialog.tsx` | Conditional formatting rule editor |
| `ChartWizard.tsx` | Type + range selection → live preview → insert |
| `SheetTabs.tsx` | Multi-sheet tabs within one workbook |

### Recalculation

- User modifies a cell
- Frontend sends delta via WebSocket (Yjs)
- Backend Rust recalculates only dirty cells (dependency graph)
- Push changed values to frontend via WebSocket
- Target latency: < 50ms for a 10,000-cell workbook

---

## Chantier 5: Slides Complete

### Problem

Near-stub — basic slide management, no layouts, no media, no animations, Yjs observer not wired.

### Data model

```
Presentation
  ├── MasterSlide (branding: background, palette, default fonts)
  │     → inherits styles (chantier 3)
  ├── SlideLayout[] (placeholder disposition)
  │     - "Title Slide": centered title + subtitle
  │     - "Title + Content": title + body zone
  │     - "Two Columns": title + 2 side-by-side zones
  │     - "Blank": no placeholders
  │     - "Section Header": centered fullscreen title
  │     - "Image + Text": image left + text right
  │     → instantiates
  └── Slide[] (actual content)
        ├── shapes[] (DrawPrimitive from chantier 2)
        ├── text_blocks[] (rich text Tiptap per placeholder)
        ├── media[] (images, videos, embeds)
        ├── transition (type + duration + trigger)
        └── speaker_notes (markdown text)
```

### Backend (`signapps-docs` enrichment)

| Module | Role |
|--------|------|
| `slide_model.rs` | Structs Presentation/MasterSlide/SlideLayout/Slide |
| `slide_export.rs` | Slide → PPTX via Filter Pipeline (chantier 1) |
| `slide_render.rs` | Slide → PDF/PNG via Drawing Layer (chantier 2) |
| `slide_templates.rs` | 6 built-in layouts + custom templates |

### Frontend

| Component | Role |
|-----------|------|
| `SlideCanvas.tsx` | Main canvas — renders shapes via `DrawingCanvas` from chantier 2 |
| `ThumbnailPanel.tsx` | Side panel with drag-and-drop miniatures for reordering |
| `LayoutPicker.tsx` | Layout selector on "+" click or right-click |
| `MasterEditor.tsx` | Admin editor for master slide (colors, fonts, background) |
| `TransitionPanel.tsx` | Transition choice (fade, slide, zoom, none) + duration |
| `SpeakerNotes.tsx` | Notes zone at editor bottom |
| `PresenterView.tsx` | Presentation mode: current slide + notes + timer + next slide |
| `SlideToolbar.tsx` | Insert shapes, images, text, video (reuses `ShapeToolbar` from chantier 2) |

### Presentation mode

- Browser fullscreen (Fullscreen API)
- Keyboard navigation (←→, Space, Esc)
- Presenter view on second screen/tab (BroadcastChannel API)
- Integrated timer
- CSS transitions between slides

### Collaboration

- Yjs sync at slide level (each slide = a Y.Map)
- Collaborative cursors on canvas
- Optimistic locking per shape (visual indicator when someone is editing)

---

## Chantier 6: Undo/Versioning via Event Sourcing

### Problem

Version history in localStorage (max 10 versions, client-only). No server snapshots. Undo limited to Tiptap/Yjs Ctrl+Z.

### Architecture

```
User action (edit cell, move shape, format text)
    → Command { type, target, before, after, user_id, timestamp }
    → CommandLog (append-only, PostgreSQL)
    → Undo: pop last own command → apply inverse
    → Version snapshot: compact N commands → snapshot JSONB
    → Diff view: compare 2 snapshots → visual changes
```

### Database

```sql
core.document_commands (
    id BIGSERIAL,
    document_id UUID NOT NULL,
    user_id UUID NOT NULL,
    command_type TEXT,         -- 'insert_text', 'delete_node', 'format_cell', 'move_shape'
    target_path TEXT,          -- JSONPath to modified element
    before_value JSONB,        -- state before (for inverse)
    after_value JSONB,         -- state after
    created_at TIMESTAMPTZ DEFAULT NOW()
)

core.document_snapshots (
    id UUID,
    document_id UUID NOT NULL,
    version INT NOT NULL,
    content JSONB NOT NULL,    -- full document at this point
    label TEXT,                -- "v1.0", "Before review", auto-generated
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### Compaction rules

- Auto snapshot every 50 commands or 30 minutes of inactivity
- Commands before last snapshot are archivable
- Max 100 snapshots per document, FIFO rotation beyond

### Backend (`signapps-docs` + `signapps-db-shared`)

| Module | Role |
|--------|------|
| `command_log.rs` | Append, query, compact commands |
| `undo_stack.rs` | Per-user undo/redo in collaborative context |
| `snapshot.rs` | Create/restore snapshots |
| `diff.rs` | Diff between 2 snapshots → typed change list |

### Frontend

| Component | Role |
|-----------|------|
| `VersionHistory.tsx` | Side panel: snapshot timeline, click → preview, restore |
| `DiffViewer.tsx` | Side-by-side or inline change view between 2 versions |
| `AutoSaveIndicator.tsx` | "Saved" / "Saving..." badge in header |

Applies to: Docs, Sheets, Slides, Forms (anything with an editable document).

---

## Chantier 7: Visual Automations + Extension SDK

### Problem

No user-facing automation. No macro or extension capability. Workflows are hardcoded.

### Architecture: Unified Action API

```
┌─────────────────────────────────────────────┐
│  User Interface                              │
│  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Automation Builder│  │ Extension Editor │ │
│  │ (no-code, visual) │  │ (TypeScript SDK) │ │
│  └────────┬─────────┘  └────────┬─────────┘ │
│           ▼                      ▼           │
│  ┌──────────────────────────────────────┐   │
│  │         SignApps Action API          │   │
│  │  (unified interface for both)        │   │
│  └──────────────────┬───────────────────┘   │
│    ┌────────────────┼────────────────┐       │
│    ▼                ▼                ▼       │
│  Mail API      Drive API       Sheets API   │
│  Calendar API  Forms API       Contacts API  │
│  Chat API      Billing API     ... all       │
└─────────────────────────────────────────────┘
```

### Part A: Visual Automations (no-code)

**Model:** Trigger → Conditions → Actions

```sql
core.automations (
    id UUID, tenant_id UUID,
    name TEXT,
    trigger_type TEXT,      -- 'form_submitted', 'email_received', 'file_uploaded',
                            -- 'calendar_event_created', 'contact_updated', 'schedule'
    trigger_config JSONB,   -- { form_id, folder_id, cron: "0 9 * * MON" }
    is_active BOOLEAN,
    created_by UUID
)

core.automation_steps (
    id UUID, automation_id UUID,
    step_order INT,
    step_type TEXT,         -- 'condition', 'action', 'delay', 'loop'
    action_type TEXT,       -- 'send_email', 'create_task', 'update_sheet',
                            -- 'move_file', 'notify', 'call_webhook', 'run_script'
    config JSONB,
    condition JSONB         -- { field, operator, value } for branches
)

core.automation_runs (
    id UUID, automation_id UUID,
    status TEXT,            -- 'running', 'completed', 'failed'
    trigger_payload JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT
)
```

**Frontend:**

| Component | Role |
|-----------|------|
| `AutomationBuilder.tsx` | Visual drag-and-drop editor: trigger → steps → actions |
| `TriggerPicker.tsx` | Trigger selector with contextual config |
| `ActionPicker.tsx` | Action catalog grouped by module |
| `ConditionEditor.tsx` | Condition builder (if/else branching) |
| `RunHistory.tsx` | Execution history with status and logs |

**Example automations:**
- "When a form is submitted → create a contact → send welcome email"
- "Every Monday at 9am → export timesheet to PDF → email to manager"
- "When a file is uploaded to /contracts → notify legal team"

### Part B: Extension SDK (TypeScript)

Extensions are TypeScript scripts executed in a sandbox (Web Worker + restricted API). They access the same actions as visual automations, plus UI hooks.

```sql
core.extensions (
    id UUID, tenant_id UUID,
    name TEXT,
    description TEXT,
    entry_point TEXT,        -- URL of JS bundle (stored in Drive)
    permissions TEXT[],      -- ['mail:read', 'drive:write', 'sheets:read']
    hooks JSONB,             -- { "toolbar:docs": true, "sidebar:sheets": true }
    is_active BOOLEAN,
    installed_by UUID
)
```

**SDK API (exposed in Worker):**

```typescript
interface SignAppsSDK {
  mail: { send(to, subject, body): Promise<void>; list(folder): Promise<Email[]> }
  drive: { upload(file): Promise<FileRef>; list(path): Promise<FileRef[]> }
  sheets: { getCell(range): Promise<CellValue>; setCell(range, value): Promise<void> }
  contacts: { find(query): Promise<Contact[]>; create(data): Promise<Contact> }
  calendar: { createEvent(event): Promise<Event> }
  ui: { showToast(msg): void; openPanel(component): void; addToolbarButton(config): void }
}
```

**Security:**
- Execution in isolated Web Worker (no DOM access)
- Permissions declared at install, verified at each API call
- Timeout (30s max per execution)
- Rate limiting per extension (100 calls/min)
- Admin approves extension installation

### Backend (`signapps-integrations` extended)

| Module | Role |
|--------|------|
| `action_registry.rs` | Registry of available actions (send_email, create_task, etc.) |
| `automation_engine.rs` | Pipeline executor: trigger → steps → actions |
| `scheduler.rs` | Already exists — extended for automation cron triggers |
| `extension_api.rs` | API proxy for SDK calls from extensions |
| `sandbox.rs` | Permission validation + rate limiting |

---

## Summary

| Chantier | New crate/module | Files est. | Depends on |
|----------|-----------------|-----------|------------|
| 1. Filter Pipeline | `signapps-filters` | ~15 Rust | — |
| 2. Drawing Layer | `signapps-drawing` | ~10 Rust + ~5 TSX | — |
| 3. Style Inheritance | `signapps-db-shared` ext. | ~5 Rust + ~3 TSX | — |
| 4. Sheets enrichi | `signapps-db` + client | ~10 Rust + ~8 TSX | 2, 3 |
| 5. Slides complet | `signapps-docs` + client | ~8 Rust + ~10 TSX | 1, 2, 3 |
| 6. Undo/Versioning | `signapps-db-shared` + client | ~6 Rust + ~3 TSX | — |
| 7. Automations + SDK | `signapps-integrations` + client | ~8 Rust + ~6 TSX | — |
