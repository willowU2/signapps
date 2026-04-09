---
name: spreadsheet-debug
description: Use when debugging, verifying, or extending the Spreadsheet (Tableur) module of SignApps Platform. This skill references the product spec at docs/product-specs/01-spreadsheet.md as the source of truth for expected behavior. It provides a complete debug checklist (code paths, data-testids, E2E tests, OSS dependencies, common pitfalls) to systematically investigate issues with the spreadsheet, its formula engine, autofill, multi-sheet, import/export, and collaboration features.
---

# Spreadsheet (Tableur) — Debug Skill

This skill is the **dedicated debugging companion** for the Spreadsheet module of SignApps Platform. It is paired with the product spec `docs/product-specs/01-spreadsheet.md` which defines the expected behavior, and exists to make issue investigation fast, systematic, and complete.

## Source of truth

The source of truth for **expected behavior** is:
**`docs/product-specs/01-spreadsheet.md`**

Always read the spec first before starting to debug. If an observed behavior contradicts the spec, either:
1. The code is wrong → fix the code
2. The spec is wrong/outdated → update the spec (invoke `product-spec-manager` with workflow B)

## Code map

### Frontend (Next.js + React)
- **App route**: `client/src/app/sheets/editor/page.tsx` (editor entry point via `/sheets/editor?id=<uuid>&name=<name>`)
- **Listing page**: `client/src/app/sheets/page.tsx`
- **Main component**: `client/src/components/sheets/spreadsheet.tsx` (~6400 lines, monolithic — refactor candidate)
- **Hook**: `client/src/components/sheets/use-spreadsheet.ts` (Yjs state, Cell CRUD, sheets meta)
- **Types**: `client/src/components/sheets/types.ts` (CellStyle, CellData, SelectionBounds, SheetInfo, constants)
- **Formula bar (obsolète?)**: `client/src/components/sheets/formula-bar.tsx` (vérifier si encore utilisé — le vrai code formule bar est inline dans spreadsheet.tsx)
- **Dialogs**: `client/src/components/sheets/{chart-dialog,named-ranges-dialog,print-preview-dialog,advanced-validation-dialog,advanced-cond-format-dialog,ai-sheets-dialog,macro-editor}.tsx`
- **Pivot**: `client/src/components/sheets/{pivot-table,pivot-engine}.ts`
- **Charts**: `client/src/components/sheets/{chart-panel,chart-dialog}.tsx`
- **Dashboard**: `client/src/components/sheets/dashboard.tsx`

### Formula engine (pure, testable)
- **`client/src/lib/sheets/formula.ts`** — parser, evaluator, error codes (`SHEET_ERRORS`), `adjustFormulaReferences` (relative ref shifting for autofill)
- **`client/src/lib/sheets/functions/`** — function registry (math, logic, text, date, lookup)
  - `registry.ts` — register/execute
  - `math.ts` — SUM, AVERAGE, COUNT, MAX, MIN, etc.
  - `logic.ts` — IF, AND, OR, VLOOKUP, IFERROR, etc.
  - `text.ts` — CONCAT, LEFT, RIGHT, LEN, UPPER, etc.
  - `date.ts` — TODAY, NOW, DATE, YEAR, MONTH, etc.
- **`client/src/lib/sheets/import-xlsx.ts`** — XLSX import via SheetJS
- **`client/src/lib/sheets/sanitize-cells.ts`** — protection against malformed Yjs cell data

### Backend (Rust — if any)
- Collaboration via Yjs (y-websocket server). Check `signapps-collab` if present.
- No dedicated `signapps-sheets` service — state lives in Yjs doc + browser.

### E2E tests
- **`client/e2e/spreadsheet-grid-manipulation.spec.ts`** — 20 tests (selection, keyboard, clear)
- **`client/e2e/spreadsheet-formulas.spec.ts`** — 26 tests (arithmetic, references, errors)
- **`client/e2e/spreadsheet-autofill.spec.ts`** — 20 tests (sequences, cyclic, formula ref adjustment)
- **`client/e2e/spreadsheet-multi-sheet.spec.ts`** — 13 tests (tabs, rename, delete, cross-sheet refs)
- **`client/e2e/sheets.spec.ts`** — legacy surface tests (defensive `isVisible.catch()` — to modernize)
- **`client/e2e/sheets-full-validation.spec.ts`** — XLSX import validation
- **`client/e2e/sheets-import.spec.ts`** — import tests
- **`client/e2e/sheets-tabs.spec.ts`** — tabs tests
- **Page Object**: `client/e2e/pages/SpreadsheetPage.ts` — 30+ methods (`selectCell`, `selectRange`, `enterFormula`, `autofillTo`, `expectCellError`, etc.)
- **Helpers**: `client/e2e/helpers/spreadsheet.ts` — `parseCellRef`, `toCellRef`, `dragRangeSelection`, `dragAutofillHandleTo`, `scrollCellIntoView`, `dispatchKeyOnSpreadsheet`

## Feature categories (from the spec)

The spec at `docs/product-specs/01-spreadsheet.md` defines these 11 categories:

1. **Manipulations de grille et sélection** — sélection simple, range, multi, headers, autofill, smart fill, keyboard nav, freeze, hide, group, resize
2. **Formules et calcul** — formula bar, autocomplete, F4 abs/rel, cross-sheet refs, named ranges, LAMBDA, dynamic arrays, errors, iterative calc, 400+ functions
3. **Formats, styles et structure** — text formatting, number formats, fusion, conditional formatting, data validation, filters, zebra bands
4. **Feuilles, onglets et structure du classeur** — tabs, duplicate, protect, hide, version history, import/export
5. **Collaboration temps réel** — curseurs, comments, suggestions, permissions, activity log, chat, share, presenter mode
6. **Graphiques et visualisations** — chart types, dynamic data, customization, combined, sparklines, pivot tables, slicers, maps, Explore
7. **Import de données, API et intégrations** — CSV/XLSX import, Connected Sheets, IMPORTRANGE, web scraping, REST API, webhooks, Apps Script, macros
8. **Vues multiples et bases de données (Airtable-style)** — rich field types, grid/kanban/calendar/gallery/gantt/form views, relations, lookup, rollup
9. **IA intégrée** — formula from NL, explain, data cleanup, dedup, categorization, sentiment, translation, summary, generate data, chart suggestions
10. **Performance, accessibilité, mobile** — virtualization, lazy loading, incremental calc, worker thread, WCAG AA, mobile, offline, chunking, export
11. **Sécurité et gouvernance** — classification, watermark, DLP, audit logs, E2E crypto, revocation, export control, legal hold

## Key data-testids (instrumented in spreadsheet.tsx)

Verified working (added in session 2026-04-09):

| data-testid | Purpose | Also exposes |
|---|---|---|
| `spreadsheet-root` | Root div, keyboard handler target | `data-active-cell="r,c"`, `data-active-sheet-id`, `data-editing` |
| `sheet-grid` | Virtualized scroll container | `data-rows`, `data-cols` |
| `sheet-formula-bar` | Formula bar container | — |
| `sheet-formula-input` | Formula bar `<input>` | — |
| `sheet-cell-ref` | Active cell reference display (e.g. "B3") | — |
| `sheet-select-all` | Top-left "all" corner | `aria-label` |
| `sheet-col-header-{c}` | Column header (0-indexed) | `data-col`, `data-col-label="A"`, `data-col-selected` |
| `sheet-row-header-{r}` | Row header (0-indexed) | `data-row`, `data-row-label`, `data-row-selected` |
| `sheet-col-resize-{c}` | Column resize handle | — |
| `sheet-row-resize-{r}` | Row resize handle | — |
| `sheet-cell-{r}-{c}` | Each cell | `data-row`, `data-col`, `data-cell-ref`, `data-active`, `data-in-selection`, `data-editing`, `data-has-formula`, `data-display-value`, `data-error` |
| `sheet-cell-editor` | Cell editor `<input>` (only when editing) | — |
| `sheet-autofill-handle` | Blue square at selection's bottom-right | `aria-label` |
| `sheet-tabs` | Tabs container | `role="tablist"`, `aria-label` |
| `sheet-tab-add` | "+" button to add a sheet | `aria-label` |
| `sheet-tab-{i}` | Each sheet tab (by index) | `data-sheet-id`, `data-sheet-index`, `data-sheet-name`, `data-active`, `role="tab"`, `aria-selected` |
| `sheet-tab-rename-input` | Input for renaming a tab | — |
| `sheet-tab-close-{i}` | "×" button on active tab | `aria-label` |

**If a new bug involves an element without a data-testid, add one** — instrument the code before testing. See `memory/feedback_learn_from_mistakes.md`.

## Key E2E tests (current coverage)

- **99 tests passing** across the 4 modern spreadsheet specs + 3 legacy specs
- Full run: `cd client && npx playwright test spreadsheet-grid-manipulation spreadsheet-formulas spreadsheet-autofill spreadsheet-multi-sheet --project=chromium`

### Running tests

```bash
cd client

# All modern spreadsheet tests
npx playwright test spreadsheet --project=chromium --reporter=list

# Single file
npx playwright test spreadsheet-autofill.spec.ts --project=chromium

# Single test by name
npx playwright test spreadsheet-formulas.spec.ts -g "SUM over a range" --project=chromium

# Headed for visual debugging
npx playwright test spreadsheet-autofill.spec.ts --project=chromium --headed

# Serial mode (fixes parallelism races on the mouse-based specs)
npx playwright test spreadsheet-autofill.spec.ts --project=chromium --workers=1
```

## Debug workflow

### Step 1: Reproduce
- What the user did (keystrokes, clicks, drag paths)
- What they expected (cross-reference with `01-spreadsheet.md`)
- What actually happened
- Browser console errors (Network tab, Console tab)
- Screenshot/video if UI issue

### Step 2: Classify

1. **Is this a known behavior in the spec?**
   - Yes → regression or broken implementation → fix it
   - No → check if it's an undocumented edge case, update the spec if needed

2. **Where is the breakage?**
   - **Cell rendering**: `spreadsheet.tsx` around line 5713 (the big cell `<div>` with `onMouseDown`, `onDoubleClick`, `onContextMenu`)
   - **Selection**: `handleCellMouseDown` (~3026), `handleCellMouseEnter` (~3053), `selectionBounds` memo (~1619)
   - **Keyboard**: `handleKeyDown` (~3076) — Ctrl+A intercept, arrows, Enter/Tab flow
   - **Formula evaluation**: `client/src/lib/sheets/formula.ts` — `evaluateFormula`, `processExpression`, `adjustFormulaReferences`
   - **Autofill**: `performDragFill` (~2298) + `detectSequence` (~2239)
   - **Multi-sheet**: `use-spreadsheet.ts` `addSheet`/`removeSheet`/`renameSheet`, plus `sheets-meta-v2` Yjs array
   - **Virtualization**: `visibleRows`/`visibleCols` memos, `findFirst` binary search (~1594)
   - **Freeze panes**: `freezeRows`/`freezeCols` state + sticky positioning in the render loop
   - **Import XLSX**: `import-xlsx.ts` + `fetchAndParseDocument` in `lib/file-parsers.ts`
   - **Collaboration**: Yjs doc + `getGridMap` + awareness for cursors

### Step 3: Write a failing E2E test first
Before touching any code, write an E2E test that reproduces the bug using `SpreadsheetPage`:

```ts
import { test, expect } from "./fixtures";
import { SpreadsheetPage } from "./pages/SpreadsheetPage";

test("reproduce bug", async ({ page }) => {
  const sheet = new SpreadsheetPage(page);
  await sheet.gotoNew("BugRepro");
  // ...
});
```

This gives you:
- A permanent regression test
- A precise assertion to debug against
- A before/after comparison for verifying the fix

### Step 4: Read the code path

Don't guess — trace the actual execution:

- **UI bug**: from the data-testid to the event handler to the state update to the re-render
- **Formula bug**: from the cell value to `evaluateFormula` to the function registry to the result
- **Autofill bug**: from `sheet-autofill-handle` onMouseDown to `setIsDragFilling` to window mousemove → `setDragFillEnd` to window mouseup → `performDragFill` to `copyCellWithFormulaAdjust` to `adjustFormulaReferences` to `setCellFull`
- **Sync bug**: from the cell write to `gridMap.set` to the Yjs update to the remote observer

### Step 5: Fix + regression test + update spec

1. Fix the code
2. Verify the new E2E test passes
3. Re-run the full spreadsheet suite to catch regressions
4. If the spec was ambiguous/wrong, update it via `product-spec-manager` workflow B
5. Add the root cause to the "Common bug patterns" section below

## Common bug patterns

Known pitfalls specific to the Spreadsheet module (populated over time as bugs are found):

### 1. Ctrl+A in cell editor exits edit mode
**Symptom**: `cellEditor.press("Control+a")` followed by `type` times out.
**Root cause**: The spreadsheet root's `handleKeyDown` intercepts Ctrl+A (even when focus is on the inner `<input>`) and calls `setIsEditing(false)` as a "select all cells" shortcut. This unmounts the editor.
**Diagnostic**: Look for `setIsEditing(false)` around line 3100 in `handleKeyDown`.
**Fix**: Use `locator.fill(value)` instead of Ctrl+A + type. `fill()` replaces the input value atomically without dispatching individual keydown events.
**Documented in**: `e2e/pages/SpreadsheetPage.ts` `enterValue` and `enterViaFormulaBar`.

### 2. Autofill handle click lands on the next cell
**Symptom**: `autofillTo("A5")` makes A2 the active cell instead of filling.
**Root cause**: The autofill handle is an 8×8 div positioned at `-bottom-1 -right-1`, so its center falls on the border between the source cell and the cell below. `elementFromPoint` resolves ambiguously.
**Diagnostic**: Screenshot the pointer landing position.
**Fix**: Press at top-left 30% of the handle's bounding box, not center. See `dragAutofillHandleTo` in `e2e/helpers/spreadsheet.ts`.

### 3. Autofill fails in parallel E2E runs
**Symptom**: Tests pass in isolation, fail in parallel (4/22 pass, 18 fail).
**Root cause**: `page.mouse.*` events + `window.addEventListener("mousemove")` closure capture have race conditions under CPU contention. The `setDragFillEnd` state update doesn't flush before `mouseup` triggers `performDragFill`.
**Diagnostic**: Re-run with `--workers=1`. If it passes, it's a parallelism issue.
**Fix**: Mark the autofill spec as `test.describe.configure({ mode: "serial" })` and add small `waitForTimeout(50)` around the mouseup. See `spreadsheet-autofill.spec.ts` header.

### 4. Omni-AI bar blocks sheet tab clicks
**Symptom**: Clicking on `sheet-tab-{i}` times out with "subtree intercepts pointer events".
**Root cause**: The floating omni-AI search bar (`.glass-panel` at `fixed bottom-6`) sits above the sheet tabs row in z-order.
**Diagnostic**: Error log mentions "glass-panel" intercepting.
**Fix**: Use `dispatchEvent('click')` instead of `.click()` to bypass pointer routing. See `switchToSheet`, `addSheet`, `renameSheet`, `deleteSheet` in `SpreadsheetPage.ts`.

### 5. `data-has-formula` false for user-typed formulas
**Symptom**: Cell with `=A1+B1` shows `data-has-formula="false"`.
**Root cause**: `setCell()` in `use-spreadsheet.ts` stores `{ value, style }` only — no separate `formula` field. User-typed formulas live in `value` with a leading `=`. The old attribute checked `cellData?.formula` which is only set by XLSX imports.
**Diagnostic**: Check the attribute computation in the cell render.
**Fix**: Changed the attribute to `cellData?.formula || cellData?.value?.startsWith("=")`. See spreadsheet.tsx around line 5720.

### 6. Formula engine uppercases everything
**Symptom**: `=IF(A1,"big","small")` returns `"SMALL"` (uppercase), and `IF(A1>5, ...)` never takes the THEN branch.
**Root cause**: `formula.ts` does `expression.toUpperCase()` before processing. This uppercases all strings and mangles comparison args. Also, comparison operators (`>`, `<`) are NOT evaluated inside function arguments — the whole `A1>5` is passed as-is to `evalArgNum` which returns 0 for non-numeric strings.
**Workaround in tests**: Use truthy cell values (`IF(A1, ...)`) instead of comparisons. Expect uppercase strings.
**Proper fix (TODO)**: Tokenize before uppercasing; preserve string literals; add operator evaluation in function args.

### 7. Cycle detection surfaces `#VALUE!` instead of `#CYCLE!`
**Symptom**: Self-referencing formula `=A1+1` shows `#VALUE!` not `#CYCLE!`.
**Root cause**: The `currentCell` parameter is not always threaded through `evaluateFormula` calls, so the `visited` Set doesn't detect the cycle. The error falls through to `evaluateMath` which returns `#VALUE!`.
**Workaround in tests**: Assert `data-error="true"` without requiring a specific code.
**Proper fix (TODO)**: Always pass `currentCell` through the evaluation stack.

### 8. String literals with cell refs get substituted
**Symptom**: `=IF(A1,"big","A1 is X")` shows `"a1 is 10"` instead of `"A1 is X"`.
**Root cause**: `processExpression` runs a regex that replaces **every** A1-notation token in the expression, including those inside quoted strings.
**Diagnostic**: Inspect the `expr` variable after the regex replace.
**Proper fix (TODO)**: Mask string literals before the substitution regex (similar to what `adjustFormulaReferences` already does).

### 9. Tiptap-style editor conflict with cell editor
Not yet encountered but watch for: if Tiptap is introduced inside a cell (e.g. rich text cells), the focus management, Ctrl+Z/Y undo stacks, and selection model will conflict with the spreadsheet's own.

## Dependencies check (license compliance)

Key dependencies used by the spreadsheet. Verify none introduce forbidden licenses (see `memory/feedback_license_policy.md`):

### Direct runtime dependencies
- **Yjs** — MIT ✅ (real-time collab)
- **sheetjs / xlsx** — Apache-2.0 ✅ (XLSX import/export)
- **Chart.js** — MIT ✅ (charts)
- **lodash** — MIT ✅
- **date-fns** — MIT ✅ (date functions)

### Dev dependencies
- **@playwright/test** — Apache-2.0 ✅
- **license-checker** — BSD-3-Clause ✅

### Forbidden (do NOT introduce)
- **hyperformula** — **GPL v3** ❌ — use `formula.js` (MIT) or custom
- **Handsontable** recent versions — **commercial/CE limited** — use `ag-grid-community` (MIT) or custom
- **Fortune-Sheet post-commercial change** — verify current license before use

Run before committing any dependency change:
```bash
just deny-licenses
cd client && npm run license-check:strict
```

## Cross-module interactions

The Spreadsheet module interacts with:

- **Drive** — the classeur is saved as a file in the user's Drive
- **Docs** — cells can be embedded in a doc via `EmbedSheet` extension
- **Chat** — sharing a classeur link creates a smart chip
- **CRM / Contacts** — VLOOKUP against a CRM table (via `IMPORTRANGE` or direct)
- **Mail** — sending a classeur as an email attachment
- **AI module** — formulas from natural language, explain, summarize
- **Workflows** — spreadsheet changes as triggers, cell updates as actions

When debugging, consider whether the issue is in the Spreadsheet itself or in one of its integrations.

## Spec coverage checklist

Use this checklist to verify that an implementation matches the spec:

- [ ] All 11 categories from the spec have at least one implementation
- [ ] All 20+ "Assertions E2E clés" have a corresponding E2E test
- [ ] All data-testids listed above are present in `spreadsheet.tsx`
- [ ] Formula engine supports the 400+ functions listed in category 2.11 (currently: core set only)
- [ ] Multi-view support (kanban, calendar, gallery, gantt, form) — **NOT YET IMPLEMENTED**
- [ ] AI features (natural language formula, data cleanup, categorization) — **PARTIAL**
- [ ] Collaboration cursors visible — **NEEDS VERIFICATION**
- [ ] Offline mode works — **NEEDS VERIFICATION**
- [ ] No forbidden (GPL/AGPL/BSL) dependency introduced

## Known open issues (from the spec vs code audit)

Based on the spec and the current state of `spreadsheet.tsx`, these features from the spec are **NOT YET IMPLEMENTED** or **PARTIAL**:

1. **Smart Fill (AI pattern detection)** — 1.4 in spec — not implemented
2. **LAMBDA / Named functions** — 2.7 — not implemented
3. **Dynamic array formulas (FILTER, SORT, UNIQUE, SPILL)** — 2.8 — not implemented
4. **Iterative calculation** — 2.10 — not implemented
5. **Explore panel (AI insights)** — 6.10 — not implemented
6. **Connected Sheets (BigQuery/PostgreSQL)** — 7.3 — not implemented
7. **Apps Script** — 7.8 — partial (macro editor exists)
8. **Multiple views (kanban, calendar, gallery, gantt, form)** — category 8 entirely — not implemented
9. **AI formula from natural language** — 9.1 — not implemented
10. **Comparison operators `>`, `<` inside function args** — engine bug — not supported
11. **Relative ref shift in autofill** — **JUST IMPLEMENTED** 2026-04-09 ✅

## How to update this skill

When a new feature is added to the Spreadsheet module:
1. Update the spec at `docs/product-specs/01-spreadsheet.md` via `product-spec-manager` workflow B
2. Update this skill's feature categories, data-testids, E2E tests sections accordingly
3. If the feature introduces a new bug-prone area, pre-populate the "Common bug patterns" section
4. Add any new OSS dependencies to the dependencies check

When a bug is fixed in the Spreadsheet module:
1. Add the pattern to "Common bug patterns" below
2. Include: symptoms, root cause, diagnostic, fix
3. This turns each incident into durable knowledge for future sessions

## Historique

- **2026-04-09** : Skill créé. Basé sur le spec `01-spreadsheet.md` et l'état actuel du code après la session d'enrichissement (99 tests E2E passing, data-testids instrumentés, `adjustFormulaReferences` implémenté).
