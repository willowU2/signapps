/**
 * E2E Smoke — Gamification module
 *
 * 3 tests covering page load, XP & Niveau tab content,
 * and Badges tab accessibility.
 */

import { test, expect } from "./fixtures";

test.describe("Gamification — smoke", () => {
  test("page loads at /gamification", async ({ page }) => {
    await page.goto("/gamification", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    const heading = page.getByText("Progression & Gamification");
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("XP & Niveau tab shows level info", async ({ page }) => {
    await page.goto("/gamification", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    // XP tab is the default
    const xpTab = page.getByText("XP & Niveau");
    await expect(xpTab.first()).toBeVisible({ timeout: 10000 });
    // XpSystemFull component should render within the tab content
    const tabContent = page.locator("[role='tabpanel']");
    const contentVisible = await tabContent
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    expect(contentVisible).toBeTruthy();
  });

  test("badges tab accessible", async ({ page }) => {
    await page.goto("/gamification", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    const badgesTab = page.getByRole("tab", { name: /Badges/i });
    await expect(badgesTab.first()).toBeVisible({ timeout: 10000 });
    await badgesTab.first().click();
    await page.waitForTimeout(2000);
    // Badge tab content should be visible
    const tabContent = page.locator("[role='tabpanel']");
    await expect(tabContent.first()).toBeVisible({ timeout: 5000 });
  });
});
