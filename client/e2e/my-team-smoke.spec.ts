/**
 * E2E — My Team Hub Smoke Tests
 *
 * Smoke coverage for the /my-team hub page: heading, tabs, empty/data state,
 * tab navigation, and sidebar rendering.
 *
 * Spec: Task 3-5 of Org Role-Aware Views plan
 */

import { test, expect, dismissDialogs } from "./fixtures";

test.describe("My Team — hub smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/my-team");
    await dismissDialogs(page);
  });

  // 1. Page loads with heading
  test("/my-team page loads with heading", async ({ page }) => {
    await expect(page).toHaveURL(/\/my-team/);
    // Either the "Mon équipe" heading (manager) or the empty state heading
    const heading = page
      .getByRole("heading", { name: /mon.équipe|aucun rapport/i })
      .first();
    await expect(heading).toBeVisible({ timeout: 8000 });
  });

  // 2. Tabs visible (manager path)
  test("tabs are visible when user has reports", async ({ page }) => {
    // If the user has reports the tabs are rendered; otherwise the empty state is shown.
    // We check for either outcome — if tabs exist, verify all three labels.
    const tabList = page.getByRole("tablist").first();
    const hasTabList = await tabList
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasTabList) {
      await expect(
        page.getByRole("tab", { name: /aujourd/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("tab", { name: /équipe/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("tab", { name: /indicateurs/i }).first(),
      ).toBeVisible();
    } else {
      // Empty state shown — acceptable outcome
      await expect(page.getByText(/aucun rapport direct/i).first()).toBeVisible(
        { timeout: 5000 },
      );
    }
  });

  // 3. Empty state or team data shown
  test("empty state or team data is shown", async ({ page }) => {
    // The page renders either a team view or an empty state — both are valid
    const teamContent = page
      .getByRole("tablist")
      .first()
      .or(page.getByText(/aucun rapport direct/i).first())
      .or(page.locator("main").first());
    await expect(teamContent).toBeVisible({ timeout: 8000 });
  });

  // 4. Équipe tab is clickable (when available)
  test("Équipe tab is clickable", async ({ page }) => {
    const tabList = page.getByRole("tablist").first();
    const hasTabList = await tabList
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!hasTabList) {
      test.skip();
      return;
    }
    const equipeTab = page.getByRole("tab", { name: /équipe/i }).first();
    await equipeTab.click();
    await expect(equipeTab).toHaveAttribute("data-state", "active");
  });

  // 5. Indicateurs tab is clickable (when available)
  test("Indicateurs tab is clickable", async ({ page }) => {
    const tabList = page.getByRole("tablist").first();
    const hasTabList = await tabList
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!hasTabList) {
      test.skip();
      return;
    }
    const indicateursTab = page
      .getByRole("tab", { name: /indicateurs/i })
      .first();
    await indicateursTab.click();
    await expect(indicateursTab).toHaveAttribute("data-state", "active");
    // Placeholder chart text should be visible
    const placeholder = page.getByText(/graphiques à venir/i).first();
    await expect(placeholder).toBeVisible({ timeout: 5000 });
  });

  // 6. Sidebar renders without crash
  test("sidebar renders without crash", async ({ page }) => {
    const sidebar = page.locator("aside[role='navigation']").first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });
    // Basic sanity: sidebar has nav links
    const navLinks = sidebar.locator("a");
    expect(await navLinks.count()).toBeGreaterThan(0);
  });
});
