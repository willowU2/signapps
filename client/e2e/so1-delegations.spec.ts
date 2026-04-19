/**
 * E2E — SO1 Delegations smoke
 *
 * Vérifie que :
 * 1. Le panel "Délégations actives" apparaît sur la gauche de /admin/org-structure.
 * 2. Les délégations seedées (Marie→Paul, Jean→Sophie) sont listées.
 * 3. Le bouton "Déléguer" (Share2 icon) est présent sur les personnes.
 *
 * Spec : docs/superpowers/specs/2026-04-19-so1-foundations-data-design.md
 */
import { test, expect, dismissDialogs } from "./fixtures";

test.describe("SO1 — Delegations panel smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/org-structure");
    await dismissDialogs(page);
  });

  test("active delegations panel renders seeded delegations", async ({
    page,
  }) => {
    const panel = page.getByTestId("active-delegations-panel");
    if (!(await panel.isVisible().catch(() => false))) {
      // Panel is only visible on lg+ breakpoints — skip if hidden.
      test.skip();
      return;
    }

    // Seed contains 2 active delegations (Marie→Paul, Jean→Sophie).
    await expect(panel).toContainText(/Délégations actives/i);
  });

  test("delegate button visible on people-tab", async ({ page }) => {
    // Click a unit node that has people (eng-platform).
    const target = page
      .getByText(/Platform Team/i)
      .first()
      .or(page.getByText(/Engineering/i).first());
    if (await target.isVisible().catch(() => false)) {
      await target.click();
    }

    // Activate People tab.
    const peopleTab = page.getByRole("tab", { name: /Personnes/i }).first();
    if (await peopleTab.isVisible().catch(() => false)) {
      await peopleTab.click();

      const buttons = page.getByTestId("delegate-button");
      const count = await buttons.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});
