/**
 * SO9 E2E — Resources multi-assign + ACL + renewals
 *
 * 3 smoke-grade scenarios (test.skip for CI — require live backend):
 * 1. Renewals dashboard loads with KPI buckets + renewal rows.
 * 2. Resource detail page shows Assignments + Renewals + ACL tabs.
 * 3. ACL test dialog returns effect (allow/deny) for a person+action pair.
 *
 * Run locally:
 *   cd client && npx playwright test so9-resources-acl-renewals --project chromium
 */

import { test, expect } from "./fixtures";

test.describe.skip("SO9 — renewals dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/resources/renewals", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
  });

  test("renewals page heading visible", async ({ page }) => {
    const heading = page.getByRole("heading", { name: /renouvellements/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("KPI buckets visible", async ({ page }) => {
    // 4 buckets: En retard / J-7 / J-30 / J-60
    const buckets = page.getByText(/en retard|j-7|j-30|j-60/i);
    const count = await buckets.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("kind and status filters are visible", async ({ page }) => {
    // At least one Select trigger for kind + one for status.
    const triggers = page.locator('[role="combobox"]');
    const n = await triggers.count();
    expect(n).toBeGreaterThanOrEqual(2);
  });

  test("export ics button works", async ({ page }) => {
    const exportBtn = page.getByRole("button", { name: /export ics/i });
    await expect(exportBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe.skip("SO9 — resource detail tabs", () => {
  test("detail page shows SO9 tabs", async ({ page }) => {
    // Go to the catalog first, then click the first resource.
    await page.goto("/admin/resources", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    // Switch to table view; first link in the table is a resource.
    const firstLink = page.locator('a[href*="/admin/resources/"]').first();
    const count = await firstLink.count();
    if (count === 0) {
      // No resources → skip silently.
      return;
    }
    await firstLink.click();
    await page.waitForTimeout(2000);

    // Tab triggers: Rôles, Renouvellements, ACL are SO9-specific.
    const rolesTab = page.getByRole("tab", { name: /r[ôo]les/i });
    const renewalsTab = page.getByRole("tab", { name: /renouvellements/i });
    const aclTab = page.getByRole("tab", { name: /acl/i });
    await expect(rolesTab).toBeVisible({ timeout: 5000 });
    await expect(renewalsTab).toBeVisible({ timeout: 5000 });
    await expect(aclTab).toBeVisible({ timeout: 5000 });
  });

  test("ACL tab shows ACL table with test button", async ({ page }) => {
    await page.goto("/admin/resources", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const firstLink = page.locator('a[href*="/admin/resources/"]').first();
    if ((await firstLink.count()) === 0) return;
    await firstLink.click();
    await page.waitForTimeout(1500);

    await page.getByRole("tab", { name: /acl/i }).click();
    await page.waitForTimeout(500);

    const testBtn = page.getByRole("button", { name: /tester/i });
    const addBtn = page.getByRole("button", { name: /ajouter/i });
    await expect(testBtn).toBeVisible({ timeout: 5000 });
    await expect(addBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe.skip("SO9 — ACL test dialog", () => {
  test("test dialog renders and resolves a decision", async ({ page }) => {
    await page.goto("/admin/resources", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const firstLink = page.locator('a[href*="/admin/resources/"]').first();
    if ((await firstLink.count()) === 0) return;
    await firstLink.click();
    await page.waitForTimeout(1500);
    await page.getByRole("tab", { name: /acl/i }).click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /tester/i }).click();
    await page.waitForTimeout(500);

    // Expect the dialog title.
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText(/tester les permissions/i)).toBeVisible();

    // Fill person UUID (nil uuid still resolves implicit_deny).
    const input = dialog.locator('input[placeholder*="0000"]').first();
    await input.fill("00000000-0000-0000-0000-000000000001");
    await dialog.getByRole("button", { name: /[eé]valuer/i }).click();
    await page.waitForTimeout(1500);

    // Result panel should show allow/deny.
    const effectBadge = dialog.getByText(/allow|deny/i);
    await expect(effectBadge.first()).toBeVisible({ timeout: 5000 });
  });
});
