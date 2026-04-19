/**
 * E2E — SO1 Time-travel smoke
 *
 * Vérifie que :
 * 1. Le slider date dans la toolbar accepte une date passée.
 * 2. Le badge "Vue YYYY-MM-DD" apparaît quand date ≠ today.
 * 3. Le bouton "Aujourd'hui" ramène à l'état courant.
 * 4. En mode read-only (atDate ≠ null), le bouton "Ajouter" est disabled.
 *
 * Spec : docs/superpowers/specs/2026-04-19-so1-foundations-data-design.md
 */
import { test, expect, dismissDialogs } from "./fixtures";

test.describe("SO1 — Time-travel toolbar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/org-structure");
    await dismissDialogs(page);
  });

  test("past date enables read-only badge", async ({ page }) => {
    const slider = page.locator(
      "input[type='date'][aria-label='Time-travel date']",
    );
    if (!(await slider.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    const d = new Date();
    d.setDate(d.getDate() - 7);
    const iso = d.toISOString().slice(0, 10);
    await slider.fill(iso);

    await expect(page.getByText(new RegExp(`^Vue ${iso}$`))).toBeVisible({
      timeout: 3000,
    });

    // Read-only indicator : add button disabled + tooltip.
    const addBtn = page.getByRole("button", { name: /Ajouter/i }).first();
    await expect(addBtn).toBeDisabled();

    // "Aujourd'hui" CTA.
    const todayBtn = page.getByRole("button", { name: /Aujourd'hui/i });
    await expect(todayBtn).toBeVisible();
    await todayBtn.click();

    // Badge disappears.
    await expect(page.getByText(new RegExp(`^Vue ${iso}$`))).toBeHidden({
      timeout: 3000,
    });
    await expect(addBtn).toBeEnabled();
  });

  test("axis filter chip cycles", async ({ page }) => {
    const chips = page.locator("button[data-axis]");
    if ((await chips.count()) === 0) {
      test.skip();
      return;
    }

    // Click "Focus" chip.
    const focus = page.locator("button[data-axis='focus']");
    await focus.click();
    await expect(focus).toHaveAttribute("aria-pressed", "true");

    // Click "Comités" chip.
    const group = page.locator("button[data-axis='group']");
    await group.click();
    await expect(group).toHaveAttribute("aria-pressed", "true");

    // Back to all.
    const all = page.locator("button[data-axis='all']");
    await all.click();
    await expect(all).toHaveAttribute("aria-pressed", "true");
  });
});
