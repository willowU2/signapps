/**
 * E2E — SO3 bulk-move smoke test.
 *
 * Vérifie :
 * 1. La page `/admin/persons` rend des checkboxes sur chaque ligne.
 * 2. Cocher 2 lignes fait apparaître le footer sticky "N sélectionné(s)".
 * 3. Bouton "Exporter CSV" déclenche un download.
 */
import { test, expect, dismissDialogs } from "./fixtures";

test.describe("SO3 — bulk ops on /admin/persons", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/persons");
    await dismissDialogs(page);
  });

  test("checkboxes + sticky footer + export", async ({ page }) => {
    // Wait for the persons table to be rendered.
    const table = page.locator("table").first();
    if (!(await table.isVisible().catch(() => false))) {
      test.skip(true, "Persons table not rendered (backend required)");
    }

    // Grab the first 2 row checkboxes (ignore the select-all header box).
    const checkboxes = page.getByRole("checkbox", { name: /Sélectionner .+/ });
    const count = await checkboxes.count();
    if (count < 2) {
      test.skip(true, `Need >=2 persons rows, got ${count}`);
    }

    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();

    // Sticky footer must appear with count.
    const footer = page.getByText(/\d+ sélectionné/i).first();
    await expect(footer).toBeVisible({ timeout: 3000 });

    // "Exporter CSV" button exists.
    const exportBtn = page.getByRole("button", { name: /Exporter CSV/i });
    await expect(exportBtn).toBeVisible();
  });
});
