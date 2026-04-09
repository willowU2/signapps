import { type Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";
import {
  parseCellRef,
  parseRangeRef,
  toCellRef,
  indexToColLetter,
  dispatchKeyOnSpreadsheet,
  dragRangeSelection,
  dragAutofillHandleTo,
  scrollCellIntoView,
} from "../helpers/spreadsheet";
import { randomUUID } from "crypto";

/**
 * Page Object for the spreadsheet editor at `/sheets/editor?id=<uuid>`.
 *
 * Abstracts the custom-built grid component. All methods use A1-notation
 * ("B3", "A1:C5") by default for readability; raw (r, c) variants are
 * also exposed for generative tests.
 *
 * The grid is virtualized — cells far from the scroll position may not
 * be in the DOM. Methods that target a specific cell transparently scroll
 * it into view first.
 *
 * Entry-point pattern:
 *   const sheet = new SpreadsheetPage(page);
 *   await sheet.gotoNew("MyTest");       // fresh spreadsheet
 *   await sheet.selectCell("A1");
 *   await sheet.enterValue("A1", "42");
 *   await sheet.expectCellValue("A1", "42");
 */
export class SpreadsheetPage extends BasePage {
  get path(): string {
    return "/sheets/editor";
  }

  get readyIndicator(): Locator {
    return this.page.getByTestId("spreadsheet-root");
  }

  // ───────────────────────────── Navigation ──────────────────────────────

  /**
   * Navigate to a fresh spreadsheet with a random id. Returns the id so
   * tests can assert navigation-specific behavior if needed.
   */
  async gotoNew(name = "E2E Test"): Promise<string> {
    const id = randomUUID();
    const query = `id=${id}&name=${encodeURIComponent(name)}`;
    await this.goto(query);
    // The grid is mounted via `dynamic(... { ssr: false })`, so it needs
    // a client-side hydration pass before becoming interactive.
    await expect(this.grid).toBeVisible({ timeout: 15_000 });
    return id;
  }

  /** Navigate to an existing spreadsheet by id. */
  async gotoExisting(id: string, name = ""): Promise<void> {
    const query = `id=${id}&name=${encodeURIComponent(name)}`;
    await this.goto(query);
    await expect(this.grid).toBeVisible({ timeout: 15_000 });
  }

  // ───────────────────────────── Root locators ───────────────────────────

  get root(): Locator {
    return this.page.getByTestId("spreadsheet-root");
  }

  get grid(): Locator {
    return this.page.getByTestId("sheet-grid");
  }

  get formulaBar(): Locator {
    return this.page.getByTestId("sheet-formula-bar");
  }

  get formulaInput(): Locator {
    return this.page.getByTestId("sheet-formula-input");
  }

  get cellRefDisplay(): Locator {
    return this.page.getByTestId("sheet-cell-ref");
  }

  get cellEditor(): Locator {
    return this.page.getByTestId("sheet-cell-editor");
  }

  get selectAllCorner(): Locator {
    return this.page.getByTestId("sheet-select-all");
  }

  get autofillHandle(): Locator {
    return this.page.getByTestId("sheet-autofill-handle");
  }

  // ───────────────────────────── Cell locators ───────────────────────────

  /** Locator for a cell by A1-notation. */
  cell(ref: string): Locator {
    const { r, c } = parseCellRef(ref);
    return this.cellByIndex(r, c);
  }

  /** Locator for a cell by raw (row, col) indices (0-based). */
  cellByIndex(r: number, c: number): Locator {
    return this.page.getByTestId(`sheet-cell-${r}-${c}`);
  }

  colHeader(col: string | number): Locator {
    const index = typeof col === "number" ? col : parseCellRef(`${col}1`).c;
    return this.page.getByTestId(`sheet-col-header-${index}`);
  }

  rowHeader(row: number): Locator {
    // Accept 1-based (UI-visible) row numbers for ergonomics.
    const index = row - 1;
    return this.page.getByTestId(`sheet-row-header-${index}`);
  }

  colResizeHandle(col: string | number): Locator {
    const index = typeof col === "number" ? col : parseCellRef(`${col}1`).c;
    return this.page.getByTestId(`sheet-col-resize-${index}`);
  }

  rowResizeHandle(row: number): Locator {
    return this.page.getByTestId(`sheet-row-resize-${row - 1}`);
  }

  // ───────────────────────────── Selection ───────────────────────────────

  /**
   * Click a cell to make it the active cell. The spreadsheet will update
   * `activeCell` state and the formula bar will display its reference.
   */
  async selectCell(ref: string): Promise<void> {
    const { r, c } = parseCellRef(ref);
    await scrollCellIntoView(this.page, r, c);
    await this.cellByIndex(r, c).click();
    // Wait for state update — activeCell is reflected on the root.
    await expect(this.root).toHaveAttribute("data-active-cell", `${r},${c}`, {
      timeout: 2000,
    });
  }

  /**
   * Drag-select a rectangular range like "A1:C5". Both endpoints must be
   * in view (or at least be renderable by the current scroll position).
   */
  async selectRange(range: string): Promise<void> {
    const { start, end } = parseRangeRef(range);
    await scrollCellIntoView(this.page, start.r, start.c);
    await scrollCellIntoView(this.page, end.r, end.c);
    const startCell = this.cellByIndex(start.r, start.c);
    const endCell = this.cellByIndex(end.r, end.c);
    await dragRangeSelection(this.page, startCell, endCell);
    // Both endpoints should be marked as in-selection
    await expect(startCell).toHaveAttribute("data-in-selection", "true");
    await expect(endCell).toHaveAttribute("data-in-selection", "true");
  }

  /** Click the top-left select-all corner. */
  async selectAll(): Promise<void> {
    await this.selectAllCorner.click();
  }

  /** Click a column header to select the entire column. */
  async selectColumn(col: string | number): Promise<void> {
    await this.colHeader(col).click();
  }

  /** Click a row header to select the entire row (1-based). */
  async selectRow(row: number): Promise<void> {
    await this.rowHeader(row).click();
  }

  // ───────────────────────────── Value entry ─────────────────────────────

  /**
   * Enter a plain value in a cell and commit with Enter.
   *
   * Flow: double-click to enter edit mode → clear existing → type → Enter.
   *
   * Important: do NOT use Ctrl+A to clear. The spreadsheet root's
   * onKeyDown intercepts Ctrl+A even when the cell editor has focus,
   * and it exits edit mode — we've verified this in the source
   * (`handleKeyDown` calls `setIsEditing(false)` on Ctrl+A as a
   * "select all cells" shortcut). Use triple-click or selectText
   * equivalents instead. Here we rely on the fact that double-click
   * places the whole edit value as the selection source text, and a
   * plain `fill()` replaces it atomically without touching the parent's
   * keyboard handler.
   */
  async enterValue(ref: string, value: string): Promise<void> {
    const { r, c } = parseCellRef(ref);
    await scrollCellIntoView(this.page, r, c);
    await this.cellByIndex(r, c).dblclick();
    await expect(this.cellEditor).toBeVisible({ timeout: 2000 });
    // `fill()` replaces the entire input value in one go without
    // dispatching individual keydown events — it bypasses the Ctrl+A
    // exit-edit-mode bug in the root handler.
    await this.cellEditor.fill(value);
    await this.cellEditor.press("Enter");
    // Wait for commit — the data-editing attribute flips back to false.
    await expect(this.cell(ref)).toHaveAttribute("data-editing", "false", {
      timeout: 2000,
    });
  }

  /**
   * Enter a formula starting with `=`. Uses the same flow as enterValue
   * but gives the engine a moment to evaluate the dependency graph
   * before returning. Formula evaluation is synchronous in the engine
   * but triggers a React state update we need to wait for.
   */
  async enterFormula(ref: string, formula: string): Promise<void> {
    const withEquals = formula.startsWith("=") ? formula : `=${formula}`;
    await this.enterValue(ref, withEquals);
    // Give the formula evaluator one microtask to finish and React to re-render.
    await this.page.waitForFunction(
      ({ r, c }) => {
        const el = document.querySelector(
          `[data-testid="sheet-cell-${r}-${c}"]`,
        );
        return el !== null && el.getAttribute("data-has-formula") === "true";
      },
      parseCellRef(ref),
      { timeout: 2000 },
    );
  }

  /**
   * Enter a value via the formula bar (alternative path for testing that
   * the formula bar behaves equivalently to in-cell editing).
   *
   * Uses `fill()` instead of Ctrl+A + type because the spreadsheet root
   * intercepts Ctrl+A to exit edit mode (see `enterValue` for the full
   * explanation).
   */
  async enterViaFormulaBar(ref: string, value: string): Promise<void> {
    await this.selectCell(ref);
    await this.formulaInput.click();
    await this.formulaInput.fill(value);
    await this.formulaInput.press("Enter");
  }

  // ───────────────────────────── Keyboard ────────────────────────────────

  /**
   * Dispatch a key on the spreadsheet root. Use for navigation
   * (ArrowUp/Down/Left/Right), commits (Enter, Tab), clearing (Delete),
   * shortcuts (Ctrl+C, Ctrl+V, Ctrl+Z).
   *
   * Prefer this over `page.keyboard.press()` when the spreadsheet must
   * be the event target — the keyboard handler is attached to the root
   * div's onKeyDown and requires focus on that specific element.
   */
  async pressKey(
    key: string,
    modifiers: {
      shift?: boolean;
      ctrl?: boolean;
      alt?: boolean;
      meta?: boolean;
    } = {},
  ): Promise<void> {
    await dispatchKeyOnSpreadsheet(this.page, key, {
      shiftKey: modifiers.shift,
      ctrlKey: modifiers.ctrl,
      altKey: modifiers.alt,
      metaKey: modifiers.meta,
    });
  }

  // ───────────────────────────── Autofill ────────────────────────────────

  /**
   * Drag the autofill handle from the currently selected cell/range down
   * (or right) to the target reference. The source selection must already
   * be set via selectCell or selectRange.
   *
   * Example: fill A1:A5 with the value of A1:
   *   await sheet.enterValue("A1", "1");
   *   await sheet.selectCell("A1");
   *   await sheet.autofillTo("A5");
   */
  async autofillTo(targetRef: string): Promise<void> {
    const { r, c } = parseCellRef(targetRef);
    await scrollCellIntoView(this.page, r, c);
    await dragAutofillHandleTo(this.page, this.cellByIndex(r, c));
  }

  // ───────────────────────────── Sheet tabs ──────────────────────────────

  get sheetTabs(): Locator {
    return this.page.getByTestId("sheet-tabs");
  }

  get addSheetButton(): Locator {
    return this.page.getByTestId("sheet-tab-add");
  }

  sheetTab(index: number): Locator {
    return this.page.getByTestId(`sheet-tab-${index}`);
  }

  /** Click the "+" button to add a new sheet. */
  async addSheet(): Promise<void> {
    const before = await this.sheetTabs.locator('[role="tab"]').count();
    // Same omni-AI overlay issue as switchToSheet — dispatch click
    // directly on the button.
    await this.addSheetButton.dispatchEvent("click");
    await expect(this.sheetTabs.locator('[role="tab"]')).toHaveCount(
      before + 1,
      { timeout: 2000 },
    );
  }

  /**
   * Click a sheet tab by index to make it active.
   *
   * Uses `dispatchEvent('click')` because the floating omni-AI search
   * bar (`.glass-panel`) is fixed at the bottom of the screen and
   * intercepts all real pointer events on the sheet tabs just above
   * it. Even `force: true` fails because it still synthesizes
   * mousedown/mouseup at the pointer location (which hits the
   * overlay). Dispatching the click event directly on the tab bypasses
   * pointer routing entirely and hands React a clean click.
   */
  async switchToSheet(index: number): Promise<void> {
    await this.sheetTab(index).dispatchEvent("click");
    await expect(this.sheetTab(index)).toHaveAttribute("data-active", "true");
  }

  /**
   * Double-click a sheet tab and type a new name. Commits with Enter.
   *
   * Uses `dispatchEvent('dblclick')` to bypass the omni-AI overlay
   * (same trick as `switchToSheet`). Then types into the rename input
   * via `fill()` to avoid the Ctrl+A exit-edit-mode bug in the root
   * keyboard handler.
   */
  async renameSheet(index: number, newName: string): Promise<void> {
    await this.sheetTab(index).dispatchEvent("dblclick");
    const input = this.page.getByTestId("sheet-tab-rename-input");
    await expect(input).toBeVisible({ timeout: 2000 });
    await input.fill(newName);
    await input.press("Enter");
    await expect(this.sheetTab(index)).toHaveAttribute(
      "data-sheet-name",
      newName,
      { timeout: 2000 },
    );
  }

  /**
   * Delete a sheet by clicking the × button on its tab. Only works for
   * the active sheet (the component only renders the button on the
   * active tab). Switches to the target first.
   *
   * Uses `dispatchEvent('click')` to bypass the omni-AI overlay (same
   * trick as `switchToSheet`).
   */
  async deleteSheet(index: number): Promise<void> {
    await this.switchToSheet(index);
    await this.page
      .getByTestId(`sheet-tab-close-${index}`)
      .dispatchEvent("click");
  }

  // ───────────────────────────── Assertions ──────────────────────────────

  /**
   * Assert a cell's displayed value via the `data-display-value`
   * attribute. This is the post-formatting (number/date/currency)
   * value as the user sees it.
   */
  async expectCellValue(ref: string, expected: string): Promise<void> {
    const { r, c } = parseCellRef(ref);
    await scrollCellIntoView(this.page, r, c);
    await expect(this.cellByIndex(r, c)).toHaveAttribute(
      "data-display-value",
      expected,
    );
  }

  /**
   * Assert a cell contains a formula. The cell's `data-has-formula`
   * attribute should be "true". For exact formula-text assertion,
   * use `expectCellFormulaText`.
   */
  async expectCellHasFormula(ref: string): Promise<void> {
    const { r, c } = parseCellRef(ref);
    await scrollCellIntoView(this.page, r, c);
    await expect(this.cellByIndex(r, c)).toHaveAttribute(
      "data-has-formula",
      "true",
    );
  }

  /**
   * Assert the exact formula text by selecting the cell and reading the
   * formula bar input value.
   */
  async expectCellFormulaText(ref: string, formula: string): Promise<void> {
    await this.selectCell(ref);
    const expected = formula.startsWith("=") ? formula : `=${formula}`;
    await expect(this.formulaInput).toHaveValue(expected);
  }

  /**
   * Assert a cell evaluates to an error (#DIV/0!, #REF!, #NAME?, #N/A).
   * Reads the `data-error` attribute which the source sets based on
   * the formula evaluator's output.
   */
  async expectCellError(ref: string, code?: string): Promise<void> {
    const { r, c } = parseCellRef(ref);
    await scrollCellIntoView(this.page, r, c);
    await expect(this.cellByIndex(r, c)).toHaveAttribute("data-error", "true");
    if (code) {
      await expect(this.cellByIndex(r, c)).toHaveAttribute(
        "data-display-value",
        code,
      );
    }
  }

  /** Assert the active cell reference (reads root attribute, no click needed). */
  async expectActiveCell(ref: string): Promise<void> {
    const { r, c } = parseCellRef(ref);
    await expect(this.root).toHaveAttribute("data-active-cell", `${r},${c}`);
  }

  /** Assert the formula bar shows a specific cell reference. */
  async expectCellRefDisplay(ref: string): Promise<void> {
    await expect(this.cellRefDisplay).toHaveText(ref);
  }

  /** Read the current active cell as A1-notation, or null if none selected. */
  async activeCell(): Promise<string | null> {
    const attr = await this.root.getAttribute("data-active-cell");
    if (!attr) return null;
    const [rStr, cStr] = attr.split(",");
    const r = parseInt(rStr, 10);
    const c = parseInt(cStr, 10);
    if (isNaN(r) || isNaN(c)) return null;
    return toCellRef(r, c);
  }

  /** Expose the col-letter conversion for tests that need it inline. */
  colLetter(index: number): string {
    return indexToColLetter(index);
  }
}
