/**
 * E2E Smoke — App Store (/apps)
 *
 * 3 tests covering page load, category sections,
 * and search/filter functionality.
 */

import { test, expect } from "./fixtures";

test.describe("App Store — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/apps", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
  });

  test("page loads with app list", async ({ page }) => {
    // The page should render meaningful content (app listings)
    const body = await page.textContent("body");
    expect(
      body?.length,
      "App store should render substantial content",
    ).toBeGreaterThan(200);
    // Look for common app store markers
    const marker = page.getByText(/marketplace|applications|apps/i);
    await expect(marker.first()).toBeVisible({ timeout: 10000 });
  });

  test("category sections visible", async ({ page }) => {
    // App store should display categorized sections
    const categories = page.locator("h2, h3, [data-testid*='category']");
    const count = await categories.count();
    expect(count, "Should have category headings").toBeGreaterThan(0);
  });

  test("search or filter functionality present", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/rechercher|search|filtrer/i);
    const filterButton = page.getByRole("button", {
      name: /filtrer|filter|categ/i,
    });

    const hasSearch = await searchInput
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const hasFilter = await filterButton
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(
      hasSearch || hasFilter,
      "Should have search input or filter button",
    ).toBeTruthy();
  });
});
