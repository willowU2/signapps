import { type Page, type Locator } from "@playwright/test";

/**
 * Spreadsheet E2E helpers.
 *
 * Low-level utilities for interacting with the custom-built spreadsheet
 * component at `src/components/sheets/spreadsheet.tsx`. The grid is
 * virtualized (only visible cells are in the DOM) and reacts to real
 * mouse/keyboard events via onMouseDown/onKeyDown — not @dnd-kit — so we
 * can use Playwright's `page.mouse.*` directly without synthetic event
 * dispatch workarounds.
 *
 * Cell addressing:
 *   - "r,c" pair is the canonical internal representation (0-indexed)
 *   - A1-notation ("B3", "AA27") is the user-friendly form used by tests
 *   - Conversions are cheap and pure — see `parseCellRef` / `toCellRef`
 *
 * Required source data-testids (added in src/components/sheets/spreadsheet.tsx):
 *   - spreadsheet-root          → root div (tabIndex=0, catches keyboard)
 *   - sheet-grid                → scrolling/virtualization container
 *   - sheet-formula-bar         → formula bar container
 *   - sheet-formula-input       → formula bar <input>
 *   - sheet-cell-ref            → active cell reference display (e.g. "B3")
 *   - sheet-select-all          → top-left corner (Ctrl+A equivalent)
 *   - sheet-col-header-{c}      → column header cell (A, B, ...)
 *   - sheet-row-header-{r}      → row header cell (1, 2, ...)
 *   - sheet-col-resize-{c}      → column resize handle
 *   - sheet-row-resize-{r}      → row resize handle
 *   - sheet-cell-{r}-{c}        → each data cell
 *   - sheet-cell-editor         → the in-cell <input> when editing
 *   - sheet-autofill-handle     → blue square on selection's bottom-right
 *   - sheet-tabs                → sheet tabs container
 *   - sheet-tab-add             → "+" button to add a sheet
 *   - sheet-tab-{i}             → each sheet tab (by index)
 *   - sheet-tab-rename-input    → rename input when editing a tab name
 *   - sheet-tab-close-{i}       → "x" button on the active tab
 *
 * Data attributes exposed on cells for assertions:
 *   - data-row, data-col, data-cell-ref
 *   - data-active, data-in-selection, data-editing
 *   - data-has-formula, data-display-value, data-error
 *
 * On the root: data-active-cell="r,c", data-active-sheet-id, data-editing
 */

// ─────────────────────────── Cell reference conversions ────────────────

/**
 * Convert column letter(s) to 0-based index. "A" → 0, "Z" → 25, "AA" → 26.
 */
export function colLetterToIndex(letter: string): number {
  let idx = 0;
  for (const ch of letter.toUpperCase()) {
    idx = idx * 26 + (ch.charCodeAt(0) - "A".charCodeAt(0) + 1);
  }
  return idx - 1;
}

/** Convert 0-based column index to letter(s). 0 → "A", 25 → "Z", 26 → "AA". */
export function indexToColLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode("A".charCodeAt(0) + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Parse an A1-notation reference like "B3" → { r: 2, c: 1 }. */
export function parseCellRef(ref: string): { r: number; c: number } {
  const m = ref
    .trim()
    .toUpperCase()
    .match(/^([A-Z]+)(\d+)$/);
  if (!m) throw new Error(`parseCellRef: invalid reference "${ref}"`);
  return { r: parseInt(m[2], 10) - 1, c: colLetterToIndex(m[1]) };
}

/** Build an A1-notation reference from 0-based (row, col). */
export function toCellRef(r: number, c: number): string {
  return `${indexToColLetter(c)}${r + 1}`;
}

/** Parse a range ref like "A1:C5" → { start, end }. */
export function parseRangeRef(range: string): {
  start: { r: number; c: number };
  end: { r: number; c: number };
} {
  const [a, b] = range.split(":");
  if (!b) throw new Error(`parseRangeRef: expected "A1:B2", got "${range}"`);
  return { start: parseCellRef(a), end: parseCellRef(b) };
}

// ─────────────────────────── Low-level interactions ────────────────────

/**
 * Dispatch a KeyboardEvent directly on `[data-testid="spreadsheet-root"]`.
 *
 * The spreadsheet's `handleKeyDown` is attached to the root div via React's
 * `onKeyDown` prop, which is a synthetic-event listener. Playwright's
 * `page.keyboard.press()` routes to `document.activeElement` and may not
 * reach the spreadsheet root if focus is elsewhere (dialogs, toolbars).
 *
 * Dispatching on the root element guarantees React receives the event
 * through its synthetic-event delegation without focus races.
 */
export async function dispatchKeyOnSpreadsheet(
  page: Page,
  key: string,
  opts: {
    shiftKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
  } = {},
): Promise<void> {
  await page.evaluate(
    ({ k, o }) => {
      const root = document.querySelector('[data-testid="spreadsheet-root"]');
      if (!root) throw new Error("spreadsheet-root not found");
      (root as HTMLElement).focus();
      const ev = new KeyboardEvent("keydown", {
        key: k,
        bubbles: true,
        cancelable: true,
        shiftKey: o.shiftKey ?? false,
        ctrlKey: o.ctrlKey ?? false,
        altKey: o.altKey ?? false,
        metaKey: o.metaKey ?? false,
      });
      root.dispatchEvent(ev);
    },
    { k: key, o: opts },
  );
}

/**
 * Drag-select a rectangular range by pressing on the start cell and
 * releasing on the end cell. Uses real page.mouse events because the
 * spreadsheet listens on `onMouseDown` / `onMouseEnter` / global
 * `mouseup`, not @dnd-kit's PointerSensor.
 *
 * Both locators must resolve to cells that are currently rendered (not
 * scrolled out of view). Use `scrollCellIntoView` first if needed.
 */
export async function dragRangeSelection(
  page: Page,
  startCell: Locator,
  endCell: Locator,
): Promise<void> {
  const startBox = await startCell.boundingBox();
  const endBox = await endCell.boundingBox();
  if (!startBox || !endBox)
    throw new Error("dragRangeSelection: cell not visible");

  const sx = startBox.x + startBox.width / 2;
  const sy = startBox.y + startBox.height / 2;
  const ex = endBox.x + endBox.width / 2;
  const ey = endBox.y + endBox.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // Intermediate steps so onMouseEnter fires on cells along the path —
  // the spreadsheet's selection tracking relies on entering cells.
  await page.mouse.move((sx + ex) / 2, (sy + ey) / 2, { steps: 10 });
  await page.mouse.move(ex, ey, { steps: 10 });
  await page.mouse.up();
}

/**
 * Grab the autofill handle (small blue square at the selection's
 * bottom-right corner) and drag it to the target cell. Only works when
 * a cell/range is currently selected AND the cell is not in edit mode.
 *
 * Implementation notes:
 *   - The handle is 8x8 px positioned at -bottom-1 -right-1 of the
 *     source cell, so its center is near the cell corner. We press
 *     with a small offset toward the top-left of the handle to avoid
 *     falling on the adjacent cell underneath (which would be picked
 *     up by `elementFromPoint` instead).
 *   - The source's onMouseDown sets `isDragFilling=true` with
 *     stopPropagation. After that, a window-level mousemove handler
 *     tracks `dragFillEnd` based on `e.clientX/Y` → grid coords, and
 *     the window-level mouseup handler triggers `performDragFill()`.
 *   - The final mousemove must be *inside* the target cell, not on its
 *     edge, so `findFirst(colOffsets/rowOffsets)` returns the target
 *     index and not the previous one.
 */
export async function dragAutofillHandleTo(
  page: Page,
  targetCell: Locator,
): Promise<void> {
  const handle = page.getByTestId("sheet-autofill-handle");
  const handleBox = await handle.boundingBox();
  const targetBox = await targetCell.boundingBox();
  if (!handleBox || !targetBox)
    throw new Error("dragAutofillHandleTo: handle or target not visible");

  // Press at the top-left quarter of the handle (not the center) to
  // ensure we land on the 8x8 handle element, not the cell underneath.
  const hx = handleBox.x + handleBox.width * 0.3;
  const hy = handleBox.y + handleBox.height * 0.3;
  // Release inside the target cell with a 4px inset so we don't land
  // on the cell border and cause `findFirst` to return the wrong row/col.
  const tx = targetBox.x + targetBox.width / 2;
  const ty = targetBox.y + Math.max(4, targetBox.height / 2);

  await page.mouse.move(hx, hy);
  await page.mouse.down();
  // Wait a beat so React commits `isDragFilling=true` before the first
  // window-level mousemove. Without this, the first move can fire
  // before the useEffect closure captures the new state.
  await page.waitForTimeout(50);
  // Small intermediate movement (>4px) so the window mousemove handler
  // fires and starts tracking `dragFillEnd`.
  await page.mouse.move(hx + 6, hy + 6, { steps: 5 });
  await page.mouse.move((hx + tx) / 2, (hy + ty) / 2, { steps: 15 });
  await page.mouse.move(tx, ty, { steps: 15 });
  // Give the last mousemove time to set dragFillEnd before mouseup
  // triggers performDragFill. The handler is synchronous but relies on
  // state flushed on the previous mousemove.
  await page.waitForTimeout(50);
  await page.mouse.up();
  // performDragFill is called synchronously in the mouseup handler,
  // but the resulting setCellFull calls go through Yjs → React render.
  await page.waitForTimeout(100);
}

/**
 * Scroll a specific cell into view by computing its offset from the grid
 * origin. Used when a test needs to interact with a cell that would be
 * virtualized out (far from current scroll position).
 *
 * The grid is scrollable via `[data-testid="sheet-grid"]` which tracks
 * rowOffsets/colOffsets internally. We approximate by seeking the data
 * attributes we exposed on cells, but if the cell is not rendered we
 * fall back to scrolling the grid directly.
 */
export async function scrollCellIntoView(
  page: Page,
  r: number,
  c: number,
): Promise<void> {
  const cell = page.getByTestId(`sheet-cell-${r}-${c}`);
  const count = await cell.count();
  if (
    count > 0 &&
    (await cell
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    await cell.first().scrollIntoViewIfNeeded();
    return;
  }
  // Fallback: approximate scroll position (21px row height, 100px col width default)
  await page.evaluate(
    ({ row, col }) => {
      const grid = document.querySelector(
        '[data-testid="sheet-grid"]',
      ) as HTMLElement | null;
      if (!grid) return;
      const approxTop = row * 21;
      const approxLeft = col * 100;
      grid.scrollTo({ top: approxTop, left: approxLeft });
    },
    { row: r, col: c },
  );
  // Give the virtualizer a tick to re-render
  await page.waitForTimeout(100);
}
