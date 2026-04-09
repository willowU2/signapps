/**
 * E2E Smoke — Trash (/trash)
 *
 * 3 tests covering page load, empty state,
 * and filter button visibility.
 */

import { test, expect } from "./fixtures";

test.describe("Trash — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/trash", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
  });

  test("page loads with Corbeille heading", async ({ page }) => {
    const heading = page.getByText(/corbeille/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("empty state message when no items", async ({ page }) => {
    // Either there are trashed items or an empty state is shown
    const emptyState = page.getByText(
      /aucun|vide|pas d.+.l.ment|corbeille est vide/i,
    );
    const itemList = page.locator(
      '[data-testid="trash-item"], [data-testid*="trash"], table tbody tr',
    );

    const hasEmpty = await emptyState
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasItems = (await itemList.count()) > 0;

    expect(
      hasEmpty || hasItems,
      "Should show empty state or trash items",
    ).toBeTruthy();
  });

  test("filter button visible", async ({ page }) => {
    const filterBtn = page.getByRole("button", {
      name: /filtrer|filter|trier|sort|type/i,
    });
    const dropdown = page.locator(
      '[data-testid="trash-filter"], select, [role="combobox"]',
    );

    const hasFilter = await filterBtn
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasDropdown = await dropdown
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(
      hasFilter || hasDropdown,
      "Should have a filter button or dropdown",
    ).toBeTruthy();
  });
});
