/**
 * E2E Smoke — Tools module
 *
 * 4 tests covering page load, tab navigation,
 * file drop zone, and export format selector.
 */

import { test, expect } from "./fixtures";

test.describe("Tools — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("page loads with Tools heading", async ({ page }) => {
    const heading = page.getByText(/tools|outils/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("3 tabs visible (Spreadsheets, PDF Tools, Presentations)", async ({
    page,
  }) => {
    const tabs = [/spreadsheets/i, /pdf/i, /presentations/i];
    for (const label of tabs) {
      const tab = page
        .getByRole("tab", { name: label })
        .or(page.getByText(label));
      await expect(tab.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("file drop zone visible", async ({ page }) => {
    const dropZone = page
      .getByTestId("file-drop-zone")
      .or(page.locator("[class*='dropzone'], [class*='drop-zone']"))
      .or(page.getByText(/d[eé]poser|glisser|drag.*drop|drop.*file/i));
    await expect(dropZone.first()).toBeVisible({ timeout: 10000 });
  });

  test("export format selector visible", async ({ page }) => {
    const selector = page
      .getByTestId("export-format")
      .or(page.getByRole("combobox"))
      .or(page.getByText(/format.*export|exporter/i));
    await expect(selector.first()).toBeVisible({ timeout: 10000 });
  });
});
