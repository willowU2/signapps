/**
 * E2E Smoke — Accounting module
 *
 * 4 tests covering page load, chart of accounts visibility,
 * journal entry sidebar navigation, and balance sheet access.
 */

import { test, expect } from "./fixtures";

test.describe("Accounting — smoke", () => {
  test("page loads at /accounting", async ({ page }) => {
    await page.goto("/accounting", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    const heading = page.getByText("Comptabilité");
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("chart of accounts visible", async ({ page }) => {
    await page.goto("/accounting", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    // Default tab is "Plan comptable" (chart of accounts)
    const tab = page.getByText("Plan comptable");
    await expect(tab.first()).toBeVisible({ timeout: 10000 });
  });

  test("journal entry section accessible via sidebar", async ({ page }) => {
    await page.goto("/accounting", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    const journalBtn = page.getByText("Saisie d'écritures");
    await expect(journalBtn.first()).toBeVisible({ timeout: 10000 });
    await journalBtn.first().click();
    await page.waitForTimeout(2000);
    // Verify the journal entry content area rendered
    await expect(page.locator("main")).toBeVisible();
  });

  test("balance sheet section accessible", async ({ page }) => {
    await page.goto("/accounting", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    const bilanBtn = page.getByText("Bilan & Résultats");
    await expect(bilanBtn.first()).toBeVisible({ timeout: 10000 });
    await bilanBtn.first().click();
    await page.waitForTimeout(2000);
    await expect(page.locator("main")).toBeVisible();
  });
});
