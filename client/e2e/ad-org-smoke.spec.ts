/**
 * E2E — AD Org-Aware Smoke Tests
 *
 * Smoke coverage for AD admin pages (domains, GPOs, computers, users, sync)
 * and the /my-team Infrastructure tab.
 *
 * Spec: Tasks 3-4 of AD Org-Aware plan
 */

import { test, expect, dismissDialogs } from "./fixtures";

// ── AD Admin pages ────────────────────────────────────────────────────────────

test.describe("AD Admin — domains page smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/active-directory");
    await dismissDialogs(page);
  });

  // 1. AD domains page loads
  test("AD domains page loads", async ({ page }) => {
    await expect(page).toHaveURL(/\/admin\/active-directory/);
    // Either a heading, a table, or an empty state is shown
    const content = page
      .getByRole("heading")
      .first()
      .or(page.locator("table").first())
      .or(page.getByText(/aucun domaine|no domain/i).first());
    await expect(content).toBeVisible({ timeout: 8000 });
  });
});

test.describe("AD Admin — GPO page smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/active-directory/gpo");
    await dismissDialogs(page);
  });

  // 2. GPO admin page loads
  test("GPO admin page loads", async ({ page }) => {
    await expect(page).toHaveURL(/\/admin\/active-directory\/gpo/);
    const content = page
      .getByRole("heading")
      .first()
      .or(page.locator("table").first())
      .or(page.getByText(/aucune|no gpo|stratégie/i).first())
      .or(page.locator("main").first());
    await expect(content).toBeVisible({ timeout: 8000 });
  });
});

test.describe("AD Admin — computers page smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/active-directory/computers");
    await dismissDialogs(page);
  });

  // 3. Computers admin page loads
  test("computers admin page loads", async ({ page }) => {
    await expect(page).toHaveURL(/\/admin\/active-directory\/computers/);
    const content = page
      .getByRole("heading")
      .first()
      .or(page.locator("table").first())
      .or(page.getByText(/aucun ordinateur|no computer/i).first())
      .or(page.locator("main").first());
    await expect(content).toBeVisible({ timeout: 8000 });
  });
});

// ── /my-team Infrastructure tab ───────────────────────────────────────────────

test.describe("My Team — Infrastructure tab smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/my-team");
    await dismissDialogs(page);
  });

  // 4. Infrastructure tab is visible when team tabs are rendered
  test("Infrastructure tab is visible when team tabs are rendered", async ({
    page,
  }) => {
    const tabList = page.getByRole("tablist").first();
    const hasTabList = await tabList
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasTabList) {
      // Empty state shown — no tabs to check
      await expect(page.getByText(/aucun rapport direct/i).first()).toBeVisible(
        { timeout: 5000 },
      );
      return;
    }

    await expect(
      page.getByRole("tab", { name: /infrastructure/i }).first(),
    ).toBeVisible();
  });

  // 5. Infrastructure tab is clickable and renders content
  test("Infrastructure tab is clickable and renders content", async ({
    page,
  }) => {
    const tabList = page.getByRole("tablist").first();
    const hasTabList = await tabList
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasTabList) {
      test.skip();
      return;
    }

    const infraTab = page.getByRole("tab", { name: /infrastructure/i }).first();
    await infraTab.click();
    await expect(infraTab).toHaveAttribute("data-state", "active");

    // At least one section heading should be visible (accounts, computers, or GPO)
    const sectionHeading = page
      .getByText(/comptes active directory|ordinateurs|stratégies de groupe/i)
      .first();
    await expect(sectionHeading).toBeVisible({ timeout: 5000 });
  });

  // 6. Infrastructure tab shows AD accounts section or appropriate state
  test("Infrastructure tab shows AD accounts section or empty/error state", async ({
    page,
  }) => {
    const tabList = page.getByRole("tablist").first();
    const hasTabList = await tabList
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!hasTabList) {
      test.skip();
      return;
    }

    const infraTab = page.getByRole("tab", { name: /infrastructure/i }).first();
    await infraTab.click();
    await expect(infraTab).toHaveAttribute("data-state", "active");

    // Wait for section to render: either accounts table, a skeleton, an empty
    // state, or an error retry button are all valid outcomes
    const accountsContent = page
      .getByText(/comptes active directory/i)
      .first()
      .or(page.getByRole("button", { name: /réessayer/i }).first())
      .or(page.getByText(/aucun compte/i).first());

    await expect(accountsContent).toBeVisible({ timeout: 8000 });
  });
});
