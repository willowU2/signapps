/**
 * E2E Smoke — Bookmarks (/bookmarks)
 *
 * 3 tests covering page load, tab navigation,
 * and empty state rendering.
 */

import { test, expect } from "./fixtures";

test.describe("Bookmarks — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/bookmarks", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
  });

  test("page loads with Favoris heading", async ({ page }) => {
    const heading = page.getByText(/favoris/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("Recent and Tous tabs visible", async ({ page }) => {
    const recentTab = page.getByText(/r.cent/i);
    const allTab = page.getByText(/tous/i);

    const hasRecent = await recentTab
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasAll = await allTab
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasRecent, "Recent tab should be visible").toBeTruthy();
    expect(hasAll, "Tous tab should be visible").toBeTruthy();
  });

  test("empty state or bookmark items displayed", async ({ page }) => {
    const emptyState = page.getByText(
      /aucun favori|pas de favori|aucun .l.ment/i,
    );
    const bookmarkItems = page.locator(
      '[data-testid="bookmark-item"], [data-testid*="bookmark"], [class*="card"]',
    );

    const hasEmpty = await emptyState
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasItems = (await bookmarkItems.count()) > 0;

    expect(
      hasEmpty || hasItems,
      "Should show empty state or bookmark items",
    ).toBeTruthy();
  });
});
