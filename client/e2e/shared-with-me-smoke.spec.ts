/**
 * E2E Smoke — Shared With Me module
 *
 * 3 tests covering page load, type filter,
 * and shared items list or empty state.
 */

import { test, expect } from "./fixtures";

test.describe("Shared With Me — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/shared-with-me", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("page loads with shared heading", async ({ page }) => {
    const heading = page.getByText(/partag[eé]s avec moi|shared/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("type filter visible", async ({ page }) => {
    const filter = page
      .getByTestId("type-filter")
      .or(page.getByRole("combobox"))
      .or(page.getByText(/type|filtrer|tous les types/i));
    await expect(filter.first()).toBeVisible({ timeout: 10000 });
  });

  test("shared items list or empty state displayed", async ({ page }) => {
    const items = page
      .getByTestId("shared-item")
      .or(
        page.locator("table tbody tr, [class*='list-item'], [class*='card']"),
      );
    const emptyState = page.getByText(
      /aucun partage|aucun [eé]l[eé]ment|no shared|nothing shared/i,
    );
    const hasItems = await items
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasEmpty = await emptyState
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasItems || hasEmpty).toBeTruthy();
  });
});
