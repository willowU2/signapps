import { test, expect } from "./fixtures";
import { SpreadsheetPage } from "./pages/SpreadsheetPage";

/**
 * Spreadsheet — Multi-sheet tests
 *
 * Covers the sheet-tab UI and per-sheet data isolation:
 *   1. A fresh spreadsheet starts with exactly one sheet ("Sheet1")
 *   2. Adding a new sheet increments the count and auto-activates it
 *   3. Switching between sheets preserves per-sheet cell data
 *   4. Rename via double-click on a tab
 *   5. Delete via the × button (only visible on the active tab)
 *   6. Sheet-qualified cell references (Sheet1!A1) work from another sheet
 *
 * Backed by `doc.getMap<CellData>(\`grid-${sheetId}\`)` — each sheet
 * has its own Yjs map, so cell state is naturally isolated.
 */

// Sheet lifecycle tests mutate the tab list in sequence; running them
// in parallel against the same page instance would race.
test.describe.configure({ mode: "serial" });

test.describe("Spreadsheet — Multi-sheet", () => {
  let sheet: SpreadsheetPage;

  test.beforeEach(async ({ page }) => {
    sheet = new SpreadsheetPage(page);
    await sheet.gotoNew("MultiSheetTest");
    await expect(sheet.cell("A1")).toBeVisible({ timeout: 10_000 });
  });

  // ───────────────────────────── Initial state ───────────────────────────

  test("fresh spreadsheet shows exactly one tab named Sheet1", async ({
    page,
  }) => {
    const tabs = page.locator('[data-testid^="sheet-tab-"][role="tab"]');
    await expect(tabs).toHaveCount(1);
    await expect(sheet.sheetTab(0)).toHaveAttribute("data-active", "true");
    await expect(sheet.sheetTab(0)).toHaveAttribute(
      "data-sheet-name",
      "Sheet1",
    );
  });

  // ───────────────────────────── Add sheet ───────────────────────────────

  test("addSheet creates a new tab", async ({ page }) => {
    await sheet.addSheet();
    const tabs = page.locator('[data-testid^="sheet-tab-"][role="tab"]');
    await expect(tabs).toHaveCount(2);
  });

  test("addSheet creates a tab named Sheet2 by default", async () => {
    await sheet.addSheet();
    // The default generated name is "Sheet2" (see the add-sheet button
    // in spreadsheet.tsx: `addSheet(\`Sheet${sheets.length + 1}\`)`).
    await expect(sheet.sheetTab(1)).toHaveAttribute(
      "data-sheet-name",
      "Sheet2",
    );
    // Sheet1 remains active — the add button does NOT auto-switch.
    // To switch, tests must call `switchToSheet(1)` explicitly.
    await expect(sheet.sheetTab(0)).toHaveAttribute("data-active", "true");
    await expect(sheet.sheetTab(1)).toHaveAttribute("data-active", "false");
  });

  test("adding a third sheet results in three tabs", async ({ page }) => {
    await sheet.addSheet();
    await sheet.addSheet();
    const tabs = page.locator('[data-testid^="sheet-tab-"][role="tab"]');
    await expect(tabs).toHaveCount(3);
    // Again, Sheet1 stays active — addSheet doesn't auto-switch.
    await expect(sheet.sheetTab(0)).toHaveAttribute("data-active", "true");
  });

  // ───────────────────────────── Switch ──────────────────────────────────

  test("clicking a tab switches the active sheet", async () => {
    await sheet.addSheet();
    // Sheet1 is still active (addSheet doesn't auto-switch). Switch to
    // Sheet2 explicitly.
    await sheet.switchToSheet(1);
    await expect(sheet.sheetTab(1)).toHaveAttribute("data-active", "true");
    await expect(sheet.sheetTab(0)).toHaveAttribute("data-active", "false");

    // And switch back to Sheet1.
    await sheet.switchToSheet(0);
    await expect(sheet.sheetTab(0)).toHaveAttribute("data-active", "true");
    await expect(sheet.sheetTab(1)).toHaveAttribute("data-active", "false");
  });

  // ───────────────────────────── Per-sheet data isolation ───────────────

  test("each sheet has its own isolated cell data", async () => {
    // Put a value in Sheet1 / A1.
    await sheet.enterValue("A1", "from-sheet-1");
    await sheet.expectCellValue("A1", "from-sheet-1");

    // Add Sheet2 (still on Sheet1, need to switch) and put a different value.
    await sheet.addSheet();
    await sheet.switchToSheet(1);
    // Sheet2 is now active; A1 should be empty.
    await sheet.expectCellValue("A1", "");
    await sheet.enterValue("A1", "from-sheet-2");
    await sheet.expectCellValue("A1", "from-sheet-2");

    // Switch back to Sheet1 — its A1 must still be "from-sheet-1".
    await sheet.switchToSheet(0);
    await sheet.expectCellValue("A1", "from-sheet-1");

    // And back to Sheet2 — still "from-sheet-2".
    await sheet.switchToSheet(1);
    await sheet.expectCellValue("A1", "from-sheet-2");
  });

  // ───────────────────────────── Rename ──────────────────────────────────

  test("double-clicking a tab opens the rename input", async ({ page }) => {
    await sheet.sheetTab(0).dblclick();
    const input = page.getByTestId("sheet-tab-rename-input");
    await expect(input).toBeVisible({ timeout: 2000 });
  });

  test("renameSheet updates the tab name", async () => {
    await sheet.renameSheet(0, "Revenues");
    await expect(sheet.sheetTab(0)).toHaveAttribute(
      "data-sheet-name",
      "Revenues",
    );
    await expect(sheet.sheetTab(0)).toContainText("Revenues");
  });

  test("rename survives a tab switch and switch-back", async () => {
    await sheet.renameSheet(0, "Budget");
    await sheet.addSheet();
    await sheet.switchToSheet(0);
    await expect(sheet.sheetTab(0)).toHaveAttribute(
      "data-sheet-name",
      "Budget",
    );
  });

  // ───────────────────────────── Delete ──────────────────────────────────

  test("the close button is only visible on the active tab", async ({
    page,
  }) => {
    await sheet.addSheet();
    await sheet.addSheet();
    // Sheet1 (index 0) is still active since addSheet doesn't auto-switch.
    await expect(sheet.sheetTab(0)).toHaveAttribute("data-active", "true");

    // Only the active tab's close button exists (source code: it's
    // rendered only when `sheets.length > 1 && i === activeSheetIndex`).
    const closeButtons = page.locator('[data-testid^="sheet-tab-close-"]');
    await expect(closeButtons).toHaveCount(1);
  });

  test("deleteSheet removes the target sheet and count decreases", async ({
    page,
  }) => {
    await sheet.addSheet(); // now 2 sheets, Sheet1 still active
    // Delete Sheet1 (index 0, the currently active one). The Page
    // Object's deleteSheet switches to the target first so the close
    // button becomes visible.
    await sheet.deleteSheet(0);

    const tabs = page.locator('[data-testid^="sheet-tab-"][role="tab"]');
    await expect(tabs).toHaveCount(1);
    // The remaining sheet is whatever was previously "Sheet2".
    await expect(sheet.sheetTab(0)).toHaveAttribute(
      "data-sheet-name",
      "Sheet2",
    );
  });

  // ───────────────────────────── Cross-sheet references ────────────────

  test("a formula on Sheet2 can reference Sheet1!A1", async () => {
    // Set A1=42 on Sheet1
    await sheet.enterValue("A1", "42");
    await sheet.expectCellValue("A1", "42");

    // Add Sheet2 and switch to it, then reference Sheet1!A1
    await sheet.addSheet();
    await sheet.switchToSheet(1);
    // Note the engine's cross-sheet reference syntax per formula.ts:
    //   extractSheetPrefix expects /^(?:'([^']+)'|([A-Z][A-Z0-9_]*))!(.+)$/
    // and the whole formula is uppercased during evaluation, so both
    // "Sheet1!A1" and "SHEET1!A1" work — the sheet name match is
    // case-insensitive via the uppercased expression.
    await sheet.enterFormula("B1", "=Sheet1!A1+8");
    await sheet.expectCellValue("B1", "50");
  });

  test("editing a cross-sheet source propagates to the dependent", async () => {
    await sheet.enterValue("A1", "10");
    await sheet.addSheet();
    await sheet.switchToSheet(1);
    await sheet.enterFormula("B1", "=Sheet1!A1*2");
    await sheet.expectCellValue("B1", "20");

    // Switch to Sheet1, change A1, switch back — dependent cell recomputes.
    await sheet.switchToSheet(0);
    await sheet.enterValue("A1", "15");
    await sheet.switchToSheet(1);
    await sheet.expectCellValue("B1", "30");
  });
});
