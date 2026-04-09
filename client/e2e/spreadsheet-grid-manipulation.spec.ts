import { test, expect } from "./fixtures";
import { SpreadsheetPage } from "./pages/SpreadsheetPage";

/**
 * Spreadsheet — Grid manipulation tests
 *
 * Covers the interaction primitives every subsequent spec relies on:
 *   1. Selection of a single cell (click, focus, active-cell state)
 *   2. Drag-selection of a rectangular range (A1:C5)
 *   3. Whole-column / whole-row selection via headers
 *   4. "Select all" corner button
 *   5. Keyboard navigation (arrows, Enter, Tab, Home, Ctrl+arrow)
 *   6. Double-click to enter edit mode, Escape to cancel
 *   7. The formula bar reflects the active cell reference
 *
 * All tests start from a fresh spreadsheet so state is isolated.
 *
 * Required data-testids (added to src/components/sheets/spreadsheet.tsx):
 *   see e2e/helpers/spreadsheet.ts for the full list.
 */

test.describe("Spreadsheet — Grid manipulation", () => {
  let sheet: SpreadsheetPage;

  test.beforeEach(async ({ page }) => {
    sheet = new SpreadsheetPage(page);
    await sheet.gotoNew("GridManipulationTest");
    // The spreadsheet renders asynchronously (dynamic import, ssr:false).
    // gotoNew already waits for the grid, but we also want at least one
    // cell to be rendered before starting interactions.
    await expect(sheet.cell("A1")).toBeVisible({ timeout: 10_000 });
  });

  // ───────────────────────────── Single-cell selection ───────────────────

  test("clicking a cell makes it the active cell", async () => {
    await sheet.selectCell("B3");
    await sheet.expectActiveCell("B3");
    await expect(sheet.cell("B3")).toHaveAttribute("data-active", "true");
    // The formula bar cell-ref display updates to match.
    await sheet.expectCellRefDisplay("B3");
  });

  test("clicking a different cell moves the active-cell indicator", async () => {
    await sheet.selectCell("A1");
    await sheet.expectActiveCell("A1");

    await sheet.selectCell("D5");
    await sheet.expectActiveCell("D5");
    await expect(sheet.cell("A1")).toHaveAttribute("data-active", "false");
    await expect(sheet.cell("D5")).toHaveAttribute("data-active", "true");
  });

  test("activeCell() returns the correct A1-notation reference", async () => {
    await sheet.selectCell("F12");
    expect(await sheet.activeCell()).toBe("F12");

    await sheet.selectCell("AA1"); // test 2-letter column
    expect(await sheet.activeCell()).toBe("AA1");
  });

  // ───────────────────────────── Range selection ─────────────────────────

  test("drag-selecting A1:C5 marks every cell in the rectangle", async () => {
    await sheet.selectRange("A1:C5");

    // All 15 cells (3 cols × 5 rows) should be in-selection.
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        const ref = `${sheet.colLetter(c)}${r + 1}`;
        await expect(sheet.cell(ref)).toHaveAttribute(
          "data-in-selection",
          "true",
        );
      }
    }
    // A cell just outside the range should NOT be in-selection.
    await expect(sheet.cell("D1")).toHaveAttribute(
      "data-in-selection",
      "false",
    );
    await expect(sheet.cell("A6")).toHaveAttribute(
      "data-in-selection",
      "false",
    );
  });

  test("drag-selecting B2:B2 keeps a single-cell selection", async () => {
    await sheet.selectRange("B2:B2");
    await expect(sheet.cell("B2")).toHaveAttribute("data-in-selection", "true");
    await sheet.expectActiveCell("B2");
  });

  test("selecting a new range replaces the previous one", async () => {
    await sheet.selectRange("A1:B2");
    await expect(sheet.cell("A1")).toHaveAttribute("data-in-selection", "true");

    await sheet.selectRange("D4:E5");
    // The old selection must be cleared.
    await expect(sheet.cell("A1")).toHaveAttribute(
      "data-in-selection",
      "false",
    );
    await expect(sheet.cell("B2")).toHaveAttribute(
      "data-in-selection",
      "false",
    );
    // The new selection is active.
    await expect(sheet.cell("D4")).toHaveAttribute("data-in-selection", "true");
    await expect(sheet.cell("E5")).toHaveAttribute("data-in-selection", "true");
  });

  // ───────────────────────────── Whole-row / whole-col / select-all ──────

  test("clicking a column header selects the entire column", async () => {
    await sheet.selectColumn("C");
    await expect(sheet.colHeader("C")).toHaveAttribute(
      "data-col-selected",
      "true",
    );
    // Cells in column C are marked in-selection.
    await expect(sheet.cell("C1")).toHaveAttribute("data-in-selection", "true");
    await expect(sheet.cell("C5")).toHaveAttribute("data-in-selection", "true");
    // A cell in a different column is not.
    await expect(sheet.cell("B1")).toHaveAttribute(
      "data-in-selection",
      "false",
    );
  });

  test("clicking a row header selects the entire row", async () => {
    await sheet.selectRow(4);
    await expect(sheet.rowHeader(4)).toHaveAttribute(
      "data-row-selected",
      "true",
    );
    await expect(sheet.cell("A4")).toHaveAttribute("data-in-selection", "true");
    await expect(sheet.cell("D4")).toHaveAttribute("data-in-selection", "true");
    await expect(sheet.cell("A3")).toHaveAttribute(
      "data-in-selection",
      "false",
    );
  });

  test("select-all corner selects the whole grid", async () => {
    await sheet.selectAll();
    await expect(sheet.cell("A1")).toHaveAttribute("data-in-selection", "true");
    // B3 and C5 are within the default viewport too.
    await expect(sheet.cell("B3")).toHaveAttribute("data-in-selection", "true");
    await expect(sheet.cell("C5")).toHaveAttribute("data-in-selection", "true");
  });

  // ───────────────────────────── Keyboard navigation ─────────────────────

  test("ArrowRight moves the active cell one column to the right", async () => {
    await sheet.selectCell("B2");
    await sheet.pressKey("ArrowRight");
    await sheet.expectActiveCell("C2");
  });

  test("ArrowDown moves the active cell one row down", async () => {
    await sheet.selectCell("B2");
    await sheet.pressKey("ArrowDown");
    await sheet.expectActiveCell("B3");
  });

  test("ArrowLeft at column A is a no-op (edge clamping)", async () => {
    await sheet.selectCell("A5");
    await sheet.pressKey("ArrowLeft");
    await sheet.expectActiveCell("A5");
  });

  test("ArrowUp at row 1 is a no-op (edge clamping)", async () => {
    await sheet.selectCell("B1");
    await sheet.pressKey("ArrowUp");
    await sheet.expectActiveCell("B1");
  });

  test("Tab key moves the active cell one column to the right", async () => {
    await sheet.selectCell("B2");
    await sheet.pressKey("Tab");
    await sheet.expectActiveCell("C2");
  });

  test("Enter after typing a value moves the active cell down", async () => {
    await sheet.selectCell("A1");
    await sheet.cell("A1").dblclick();
    await expect(sheet.cellEditor).toBeVisible();
    await sheet.cellEditor.fill("hello");
    await sheet.cellEditor.press("Enter");
    // Excel-style: Enter commits and moves down.
    await sheet.expectActiveCell("A2");
    // The value is committed.
    await sheet.expectCellValue("A1", "hello");
  });

  // ───────────────────────────── Edit mode ───────────────────────────────

  test("double-click enters edit mode and shows the cell editor", async () => {
    await sheet.selectCell("A1");
    await sheet.cell("A1").dblclick();
    await expect(sheet.cellEditor).toBeVisible();
    await expect(sheet.cell("A1")).toHaveAttribute("data-editing", "true");
  });

  test("Escape cancels edit without committing the typed value", async () => {
    await sheet.selectCell("A1");
    // Put an initial value so we can verify it's preserved.
    await sheet.enterValue("A1", "keep-me");
    await sheet.expectCellValue("A1", "keep-me");

    await sheet.cell("A1").dblclick();
    await expect(sheet.cellEditor).toBeVisible();
    // Use fill() instead of Ctrl+A — the spreadsheet intercepts Ctrl+A
    // to exit edit mode (select-all shortcut).
    await sheet.cellEditor.fill("DROP-THIS");
    await sheet.cellEditor.press("Escape");
    // The original value is preserved.
    await sheet.expectCellValue("A1", "keep-me");
  });

  test("typing into the cell editor updates the formula bar live", async () => {
    await sheet.selectCell("A1");
    await sheet.cell("A1").dblclick();
    await sheet.cellEditor.type("live preview");
    // The formula bar mirrors the edit value in real time.
    await expect(sheet.formulaInput).toHaveValue("live preview");
    await sheet.cellEditor.press("Enter");
  });

  // ───────────────────────────── Clear / Delete ──────────────────────────

  test("Delete clears the content of the selected cell", async () => {
    await sheet.enterValue("A1", "bye");
    await sheet.expectCellValue("A1", "bye");

    await sheet.selectCell("A1");
    await sheet.pressKey("Delete");
    await sheet.expectCellValue("A1", "");
  });

  test("Delete clears every cell in a selected range", async () => {
    await sheet.enterValue("A1", "a");
    await sheet.enterValue("A2", "b");
    await sheet.enterValue("B1", "c");
    await sheet.enterValue("B2", "d");

    await sheet.selectRange("A1:B2");
    await sheet.pressKey("Delete");

    await sheet.expectCellValue("A1", "");
    await sheet.expectCellValue("A2", "");
    await sheet.expectCellValue("B1", "");
    await sheet.expectCellValue("B2", "");
  });
});
