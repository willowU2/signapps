/**
 * E2E Smoke — Comms (Internal Communications) module
 *
 * 3 tests covering page load, sub-module cards visibility,
 * and "Acceder" links on cards.
 */

import { test, expect } from "./fixtures";

test.describe("Comms — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/comms", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("page loads with Communication heading", async ({ page }) => {
    const heading = page.getByText(/communication/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("6 sub-module cards visible", async ({ page }) => {
    const modules = [
      /annonces/i,
      /actualit[eé]s/i,
      /suggestions/i,
      /sondages/i,
      /newsletter/i,
      /affichage num[eé]rique/i,
    ];
    for (const label of modules) {
      const card = page.getByText(label);
      await expect(card.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("cards have Acceder links", async ({ page }) => {
    const links = page
      .getByRole("link", { name: /acc[eé]der/i })
      .or(page.getByText(/acc[eé]der/i));
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
