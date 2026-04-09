/**
 * E2E Smoke — Reports module
 *
 * 4 tests covering page load, source dropdown,
 * execute button, and add column button.
 */

import { test, expect } from "./fixtures";

test.describe("Reports — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/reports", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("page loads with report builder heading", async ({ page }) => {
    const heading = page.getByText(/constructeur de rapports|reports/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("source dropdown visible", async ({ page }) => {
    const dropdown = page
      .getByTestId("report-source")
      .or(page.getByRole("combobox"))
      .or(page.getByText(/source/i));
    await expect(dropdown.first()).toBeVisible({ timeout: 10000 });
  });

  test("Executer button visible", async ({ page }) => {
    const btn = page
      .getByRole("button", { name: /ex[eé]cuter/i })
      .or(page.getByTestId("execute-report"));
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test("Ajouter column button visible", async ({ page }) => {
    const btn = page
      .getByRole("button", { name: /ajouter/i })
      .or(page.getByTestId("add-column"));
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });
});
