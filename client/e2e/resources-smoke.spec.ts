/**
 * E2E Smoke — Resources module
 *
 * 3 tests covering page load, type filter dropdown,
 * and resource cards or empty state.
 */

import { test, expect } from "./fixtures";

test.describe("Resources — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/resources", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("page loads with resources heading", async ({ page }) => {
    const heading = page.getByText(/ressources|reserver une ressource/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("type filter dropdown visible", async ({ page }) => {
    const filter = page
      .getByTestId("resource-type-filter")
      .or(page.getByRole("combobox"))
      .or(page.getByText(/type|filtrer|catégorie/i));
    await expect(filter.first()).toBeVisible({ timeout: 10000 });
  });

  test("resource cards or empty state displayed", async ({ page }) => {
    const cards = page
      .locator("[data-testid='resource-card']")
      .or(page.locator("[class*='card']"));
    const emptyState = page.getByText(
      /aucune ressource|no resources|commencez par/i,
    );
    const hasCards = await cards
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasEmpty = await emptyState
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasCards || hasEmpty).toBeTruthy();
  });
});
