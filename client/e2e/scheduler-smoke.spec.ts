/**
 * E2E Smoke — Scheduler module
 *
 * 4 tests covering page load, KPI cards, new task button,
 * and table headers.
 */

import { test, expect } from "./fixtures";

test.describe("Scheduler — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/scheduler", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("page loads with Planificateur heading", async ({ page }) => {
    const heading = page.getByText(/planificateur/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("KPI cards visible", async ({ page }) => {
    const kpiLabels = [
      /total.*t[aâ]ches/i,
      /t[aâ]ches.*actives/i,
      /ex[eé]cutions.*r[eé]ussies/i,
      /en cours/i,
    ];
    for (const label of kpiLabels) {
      const card = page.getByText(label);
      await expect(card.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("Nouvelle Tache button visible", async ({ page }) => {
    const btn = page
      .getByRole("button", { name: /nouvelle t[aâ]che/i })
      .or(page.getByTestId("new-task-button"));
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test("table headers visible", async ({ page }) => {
    const table = page.locator(
      "table, [role='table'], [data-testid='task-table']",
    );
    const tableVisible = await table
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (tableVisible) {
      const headers = page.locator("th, [role='columnheader']");
      await expect(headers.first()).toBeVisible({ timeout: 5000 });
    } else {
      // Fallback: accept empty state if no tasks exist
      const emptyState = page.getByText(/aucune t[aâ]che|no tasks/i);
      await expect(emptyState.first()).toBeVisible({ timeout: 5000 });
    }
  });
});
