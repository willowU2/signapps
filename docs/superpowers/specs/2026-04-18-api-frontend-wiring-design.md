# API & Frontend Wiring — Design Spec

## Summary

Wire the 7 LibreOffice-inspired backend foundations (crates, models, repositories) to API handlers (Axum) and frontend API clients (TypeScript). The backend repositories exist but have zero API exposure. The frontend components exist but can't persist because there are no endpoints.

## Scope

7 API modules, all in existing services (no new services). Each module = Axum handlers + route registration + TypeScript API client.

## Module 1: Filter Pipeline Wiring

**Service:** signapps-docs (port 3010)
**Change:** Replace old DocumentImporter/DocumentConverter with FilterRegistry in existing handlers.

**Endpoints (update existing):**
- `POST /api/v1/import/upload` — use FilterRegistry.import() instead of DocumentImporter
- `POST /api/v1/convert` — use FilterRegistry.export() for output format
- `GET /api/v1/import/info` — return all FilterRegistry.supported_formats()
- `POST /api/v1/export` — **new** — export IntermediateDocument to any format

**Frontend:** Update existing import dialog to show all 9 formats.

## Module 2: Style CRUD API

**Service:** signapps-docs (port 3010)
**Handler file:** `services/signapps-docs/src/handlers/styles.rs`

**Endpoints:**
- `GET /api/v1/styles` — list styles (query: ?type=paragraph&scope=global)
- `GET /api/v1/styles/:id` — get style
- `GET /api/v1/styles/:id/resolved` — get resolved style (cascade merged)
- `POST /api/v1/styles` — create style
- `PUT /api/v1/styles/:id` — update style
- `DELETE /api/v1/styles/:id` — delete (non-builtin only)
- `GET /api/v1/styles/templates/:template_id` — list styles for template

**Frontend:** `client/src/lib/api/styles.ts` + `StylePicker.tsx` component.

## Module 3: Spreadsheet Persistence API

**Service:** signapps-docs (port 3010)
**Handler file:** `services/signapps-docs/src/handlers/sheet_formats.rs`

**Endpoints:**
- `GET /api/v1/sheets/:doc_id/formats` — list cell formats for a sheet
- `PUT /api/v1/sheets/:doc_id/formats/:cell_ref` — upsert cell format
- `DELETE /api/v1/sheets/:doc_id/formats/:cell_ref` — remove format
- `GET /api/v1/sheets/:doc_id/metadata` — get sheet metadata
- `PUT /api/v1/sheets/:doc_id/metadata` — upsert sheet metadata
- `POST /api/v1/sheets/:doc_id/formats/batch` — batch upsert (multiple cells)

**Frontend:** `client/src/lib/api/sheet-formats.ts` — wire into existing spreadsheet.tsx save logic.

## Module 4: Slides Persistence API

**Service:** signapps-docs (port 3010)
**Handler file:** `services/signapps-docs/src/handlers/presentations.rs`

**Endpoints:**
- `POST /api/v1/presentations` — create presentation (seeds default layouts)
- `GET /api/v1/presentations/:doc_id` — get presentation with slides
- `PUT /api/v1/presentations/:doc_id` — update presentation (title, theme)
- `GET /api/v1/presentations/:doc_id/slides` — list slides
- `POST /api/v1/presentations/:doc_id/slides` — create slide
- `PUT /api/v1/presentations/:doc_id/slides/:id` — update slide (elements, notes, transition)
- `DELETE /api/v1/presentations/:doc_id/slides/:id` — delete slide
- `PUT /api/v1/presentations/:doc_id/slides/reorder` — reorder slides

**Frontend:** `client/src/lib/api/presentations.ts` — wire into existing slide-editor.tsx.

## Module 5: Versioning API

**Service:** signapps-docs (port 3010)
**Handler file:** `services/signapps-docs/src/handlers/versions.rs`

**Endpoints:**
- `POST /api/v1/versions/:doc_id/commands` — append command to log
- `GET /api/v1/versions/:doc_id/commands` — list recent commands
- `POST /api/v1/versions/:doc_id/undo` — undo last own command
- `POST /api/v1/versions/:doc_id/snapshots` — create snapshot
- `GET /api/v1/versions/:doc_id/snapshots` — list snapshots
- `GET /api/v1/versions/:doc_id/snapshots/:id` — get snapshot content
- `POST /api/v1/versions/:doc_id/snapshots/:id/restore` — restore snapshot
- `POST /api/v1/versions/:doc_id/snapshots/diff` — diff two snapshots

**Frontend:** `client/src/lib/api/versions.ts` — wire into existing history-panel.tsx.

## Module 6: Automations API

**Service:** signapps-integrations (port 3030)
**Handler file:** `services/signapps-integrations/src/handlers/automations.rs`

**Endpoints:**
- `GET /api/v1/automations` — list automations
- `POST /api/v1/automations` — create automation
- `GET /api/v1/automations/:id` — get automation with steps
- `PUT /api/v1/automations/:id` — update
- `DELETE /api/v1/automations/:id` — delete
- `GET /api/v1/automations/:id/steps` — list steps
- `POST /api/v1/automations/:id/steps` — add step
- `PUT /api/v1/automations/:id/steps/:step_id` — update step
- `DELETE /api/v1/automations/:id/steps/:step_id` — delete step
- `POST /api/v1/automations/:id/run` — trigger manual run
- `GET /api/v1/automations/:id/runs` — run history
- `GET /api/v1/actions` — list action catalog

**Extension endpoints:**
- `GET /api/v1/extensions` — list extensions
- `POST /api/v1/extensions` — install extension
- `PUT /api/v1/extensions/:id/approve` — admin approve
- `DELETE /api/v1/extensions/:id` — uninstall

**Frontend:** `client/src/lib/api/automations.ts` — wire into existing automation/page.tsx.

## Module 7: Drawing API

**Service:** signapps-docs (port 3010)
**Handler file:** `services/signapps-docs/src/handlers/drawing.rs`

**Endpoints:**
- `POST /api/v1/drawing/render/svg` — render primitives to SVG
- `POST /api/v1/drawing/render/png` — render primitives to PNG
- `POST /api/v1/drawing/charts` — generate chart primitives from data

**Frontend:** `client/src/lib/api/drawing.ts` + reusable `DrawingCanvas.tsx`.
