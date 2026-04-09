---
name: reports-debug
description: Debug skill for the Report Builder module (/reports). Visual query builder with data source selector, dimension/metric columns, aggregation functions, chart type selection (table/bar/line/pie), execute query, and CSV export. Currently uses mock fallback data.
---

# Reports — Debug Skill

## Source of truth

**`docs/product-specs/59-reports.md`** — read spec first.

## Code map

### Backend (Rust)
- **No dedicated backend service** — the report builder posts to `/api/reports/run` (Next.js API route or gateway), but this endpoint may not exist yet
- **Fallback**: on fetch failure, the component falls back to hardcoded mock data
- **Data sources**: activities, documents, tasks, mail, calendar, users — these correspond to various backend services

### Frontend (Next.js)
- **Page**: `client/src/app/reports/page.tsx` (wrapper that renders `ReportBuilder`)
- **Component**: `client/src/components/reports/ReportBuilder.tsx` (main builder logic)
- **Alternative file**: `client/src/components/reports/report-builder.tsx` (may be a duplicate or older version)
- **No store** — all state is local `useState` within `ReportBuilder`
- **No API client** — raw `fetch('/api/reports/run', ...)` call
- **Types (inline)**: `ReportColumn` (id, field, label, type, aggregation), `ReportConfig` (name, source, columns, chart, filters)
- **Constants**: `SOURCES` (6 data sources), `FIELDS` (per-source field definitions with dimension/metric type)
- **Chart types**: table, bar, line, pie (icons only — no actual chart rendering library)
- **Deps**: `lucide-react` icons, `sonner` (toasts)

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `reports-root` | Reports page container |
| `reports-name-input` | Report name input |
| `reports-source-select` | Data source selector |
| `reports-chart-table` | Table chart type button |
| `reports-chart-bar` | Bar chart type button |
| `reports-chart-line` | Line chart type button |
| `reports-chart-pie` | Pie chart type button |
| `reports-execute-btn` | Execute button |
| `reports-add-column-btn` | Add column button |
| `reports-column-{id}` | Column row in builder |
| `reports-column-field-{id}` | Field selector in column |
| `reports-column-agg-{id}` | Aggregation selector for metric columns |
| `reports-column-remove-{id}` | Remove column button |
| `reports-results-table` | Results table |
| `reports-export-csv-btn` | Export CSV button |
| `reports-empty-columns` | Empty state (no columns added) |

## Key E2E journeys

1. **Build report** — select source (e.g., "Activites"), add dimension column (Module), add metric column (Nombre with count), click Execute
2. **Change source** — switch source from "Activites" to "Taches", verify columns are cleared and field options change
3. **Chart type toggle** — select bar/line/pie chart types, verify button highlights (note: actual chart rendering may not be implemented)
4. **Remove column** — add 2 columns, remove one, verify removed from list
5. **Execute with no columns** — click Execute without adding columns, verify error toast "Ajoutez au moins une colonne"
6. **Export CSV** — execute a report, click "Exporter CSV" on results (note: export may not be wired yet)

## Common bug patterns

1. **Mock data fallback** — the `runReport` catch block always returns hardcoded mock data `[{ Module: "Documents", ... }]`, masking real backend errors. Users see "results" even when the backend is completely broken.
2. **No actual chart rendering** — chart type buttons (bar, line, pie) change `config.chart` state but results are always rendered as a plain HTML table. No chart library (recharts, visx, etc.) is integrated.
3. **Global mutable counter** — `let idCounter = 1` is a module-level mutable variable for generating column IDs. If the component remounts, the counter does not reset, which is fine for uniqueness but unconventional.
4. **Filters not implemented** — `ReportConfig` has a `filters` array but there is no UI to add/edit filters
5. **Export CSV button is inert** — the "Exporter CSV" button in results has no `onClick` handler
6. **Duplicate component files** — both `ReportBuilder.tsx` and `report-builder.tsx` exist in `client/src/components/reports/`; verify which one is actually imported
7. **Source change clears columns** — changing the source resets `columns: []`, which is correct but may surprise users who had a complex setup

## Debug checklist

- [ ] Check if `/api/reports/run` endpoint exists (Next.js API route or gateway proxy)
- [ ] Verify which `ReportBuilder` file is imported (PascalCase vs kebab-case)
- [ ] Test that source change properly resets columns
- [ ] Verify column field options match the selected source
- [ ] Check that metric columns show aggregation selector and dimension columns do not
- [ ] Confirm chart type buttons are visual-only (no chart library renders)
- [ ] Test Export CSV button — likely needs onClick handler wired
- [ ] Check for mock data masking real errors in runReport catch block

## Dependencies (license check)

- **Frontend**: react, next, lucide-react, sonner — MIT
- Verify: `cd client && npm run license-check:strict`
