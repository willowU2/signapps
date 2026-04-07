# signapps-docs

**Port**: 3010
**API Prefix**: /api/v1

Merged service: absorbs `signapps-collab` (port 3013) and `signapps-office` (port 3018).

## Routes

### Core document handlers (`src/handlers/`)
- health.rs
- collab.rs — `/api/v1/collab/ws/:doc_id` (formerly signapps-collab port 3013)
- classify.rs
- designs.rs
- macros.rs
- notes.rs
- persistence.rs
- templates.rs
- types/ (text, sheet, slide, board, chat)
- websocket.rs — `/api/v1/docs/:doc_type/:doc_id/ws`

### Office sub-service (`src/office/handlers/`)
Stateless document conversion/import/export (formerly signapps-office port 3018):
- conversion.rs — `/api/v1/convert/*`
- import.rs — `/api/v1/import/*`
- spreadsheet.rs — `/api/v1/spreadsheet/*`
- pdf.rs — `/api/v1/pdf/*`
- presentation.rs — `/api/v1/presentation/*`
- data_import.rs — `/api/v1/data/import/*`
- data_export.rs — `/api/v1/data/export/*`
- report.rs — `/api/v1/reports/*`
- jobs.rs — `/api/v1/office/jobs/*`

## Database
No migrations found

## Dependencies
- signapps-common
- signapps-db
- signapps-cache
- signapps-sharing
