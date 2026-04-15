/**
 * E2E — Admin Deploy UI (Phase 3b)
 *
 * Exercises the 6-tab admin deploy shell:
 *   - Environnements (dashboard)
 *   - Versions
 *   - Feature Flags
 *   - Maintenance
 *   - Runtime Config
 *   - On-premise
 *
 * Auth: relies on the shared `auth.setup.ts` storageState which injects a
 * superadmin JWT + cookies + localStorage for an `admin` user (role 3).
 */

import { test, expect } from "./fixtures";

test.describe("/admin/deploy", () => {
  test("page Environnements affiche le titre et les onglets", async ({
    page,
  }) => {
    await page.goto("/admin/deploy");
    await expect(
      page.getByRole("heading", { name: "Déploiement" }),
    ).toBeVisible();
    // Tab nav
    await expect(
      page.getByRole("link", { name: "Environnements" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Versions" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Feature Flags" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Maintenance" })).toBeVisible();
  });

  test("navigation entre les 6 onglets", async ({ page }) => {
    await page.goto("/admin/deploy");
    const tabs = [
      { label: "Versions", url: /admin\/deploy\/versions/ },
      { label: "Feature Flags", url: /admin\/deploy\/feature-flags/ },
      { label: "Maintenance", url: /admin\/deploy\/maintenance/ },
      { label: "Runtime Config", url: /admin\/deploy\/runtime-config/ },
      { label: "On-premise", url: /admin\/deploy\/on-premise/ },
    ];
    for (const tab of tabs) {
      await page.getByRole("link", { name: tab.label }).click();
      await expect(page).toHaveURL(tab.url);
    }
  });

  test("page Maintenance expose les toggles prod et dev", async ({ page }) => {
    await page.goto("/admin/deploy/maintenance");
    await expect(
      page.getByRole("heading", { name: "Maintenance manuelle" }),
    ).toBeVisible();
    // Each env card has an Activer + Désactiver button
    const activateButtons = page.getByRole("button", { name: "Activer" });
    const disableButtons = page.getByRole("button", { name: "Désactiver" });
    await expect(activateButtons).toHaveCount(2); // prod + dev
    await expect(disableButtons).toHaveCount(2);
  });
});
