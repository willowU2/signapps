---
name: tools-debug
description: Debug skill for the Tools module (/tools). Three-tab interface — Spreadsheets (CSV/ODS import/export), PDF Tools (extract text, merge, split, page info), Presentations (PPTX/PDF/PNG/SVG export). Backend via signapps-office port 3018.
---

# Tools — Debug Skill

## Source of truth

**`docs/product-specs/58-tools.md`** — read spec first.

## Code map

### Backend (Rust)
- **Service**: `services/signapps-office/` — port **3018**
- **Spreadsheet endpoints**: `POST /spreadsheet/import` (FormData), `POST /spreadsheet/export?format=csv|ods`
- **PDF endpoints**: `POST /pdf/extract-text`, `POST /pdf/merge`, `POST /pdf/split`, `POST /pdf/info`
- **Presentation endpoints**: `POST /presentation/export/pptx`, `POST /presentation/export/pdf`, `POST /presentation/export/all/png`, `POST /presentation/export/all/svg`
- **Presentation info**: `GET /presentation/info` (service version, supported formats, max slides)

### Frontend (Next.js)
- **Page**: `client/src/app/tools/page.tsx` (single file with inline tab components)
- **Office content**: `client/src/app/tools/office-content.tsx` (may contain additional office UI)
- **API client**: `client/src/lib/api/office.ts` (`getPresentationInfo` and potentially more)
- **API factory**: uses `getServiceBaseUrl(ServiceName.OFFICE)` for direct `fetch` calls
- **Inline components**: `FileDropZone` (drag & drop), `StatusBadge` (loading/success/error), `SpreadsheetsTab`, `PdfToolsTab`, `PresentationsTab`
- **Helper**: `triggerDownload(blob, filename)` — creates temporary `<a>` element for blob download
- **Helper**: `officePost(path, body, asBlob)` — wrapper around fetch for FormData or JSON
- **Deps**: `sonner` (toasts), `lucide-react` icons

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `tools-root` | Tools page container |
| `tools-tab-spreadsheets` | Spreadsheets tab trigger |
| `tools-tab-pdf` | PDF Tools tab trigger |
| `tools-tab-presentations` | Presentations tab trigger |
| `tools-import-dropzone` | Spreadsheet import drop zone |
| `tools-import-btn` | Import button |
| `tools-import-result` | Import result preview |
| `tools-export-data` | CSV data textarea |
| `tools-export-format` | Export format select |
| `tools-export-btn` | Export & Download button |
| `tools-pdf-extract-dropzone` | PDF extract text drop zone |
| `tools-pdf-extract-btn` | Extract Text button |
| `tools-pdf-merge-add-btn` | Add PDFs button |
| `tools-pdf-merge-btn` | Merge button |
| `tools-pdf-split-dropzone` | PDF split drop zone |
| `tools-pdf-split-btn` | Split & Download ZIP button |
| `tools-pdf-info-dropzone` | PDF page info drop zone |
| `tools-pdf-info-btn` | Get Info button |
| `tools-pres-title` | Presentation title input |
| `tools-pres-format` | Presentation export format select |
| `tools-pres-slides-json` | Slides JSON textarea |
| `tools-pres-export-btn` | Export Presentation button |

## Key E2E journeys

1. **Import CSV** — drag or select a CSV file, click Import, verify parsed data displayed in result preview
2. **Export CSV** — paste CSV data in textarea, select CSV format, click Export, verify file downloads
3. **Export ODS** — same as above with ODS format
4. **Extract PDF text** — drop a PDF, click Extract Text, verify text content displayed
5. **Merge PDFs** — add 2+ PDFs, click Merge, verify merged PDF downloads
6. **Split PDF** — drop a PDF, enter page ranges "1-3,4-6", click Split, verify ZIP downloads
7. **PDF Info** — drop a PDF, click Get Info, verify metadata JSON displayed
8. **Export Presentation** — enter title, optionally add slides JSON, select PPTX format, click Export, verify download
9. **Presentation formats** — test all 4 formats (PPTX, PDF, PNG zip, SVG zip)

## Common bug patterns

1. **Raw fetch without auth** — `officePost` and presentation export use raw `fetch` without JWT auth headers; if office service requires auth, all calls will 401
2. **No CORS headers** — direct browser fetch to `localhost:3018` may fail if office service does not set CORS headers
3. **File drop zone single file** — `FileDropZone` only accepts one file via `e.dataTransfer.files[0]`; dropping multiple files silently ignores extras
4. **Merge files ordering** — merge PDFs list order depends on user adding files; no drag-to-reorder implemented despite `GripVertical` icon pattern used elsewhere
5. **JSON parse error in presentations** — invalid JSON in slides textarea throws an error caught generically; the specific "Invalid JSON" message from `buildPayload` is swallowed by the outer catch
6. **Export format extension mismatch** — PNG/SVG presentation exports download as `.zip` but the content-type from backend may not match, causing some browsers to not recognize the file

## Debug checklist

- [ ] Verify office service (port 3018) is running: `curl http://localhost:3018/health`
- [ ] Check CORS configuration on office service for browser requests
- [ ] Test file upload with different file types (CSV, ODS, PDF)
- [ ] Verify blob download works across browsers (Chrome, Firefox)
- [ ] Test with large files to check timeout behavior
- [ ] Check that `getServiceBaseUrl(ServiceName.OFFICE)` returns correct URL
- [ ] Verify presentation slides JSON validation provides user feedback

## Dependencies (license check)

- **Backend**: axum, lopdf, calamine (spreadsheet), pptx-rs — check licenses
- **Frontend**: react, next, lucide-react, sonner — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
