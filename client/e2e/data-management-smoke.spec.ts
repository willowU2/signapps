/**
 * E2E Smoke — Data Management module
 *
 * 4 tests covering page load, tab navigation,
 * masking rules table, and add rule button.
 */

import { test, expect } from "./fixtures";

test.describe("Data Management — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/data-management", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("page loads with Data Management heading", async ({ page }) => {
    const heading = page.getByText(/data management|gestion des donn[eé]es/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("4 tabs visible (Masking, GDPR Deletion, PII Detector, Anonymization)", async ({
    page,
  }) => {
    const tabs = [
      /masking/i,
      /gdpr.*deletion/i,
      /pii.*detect/i,
      /anonymi[sz]ation/i,
    ];
    for (const label of tabs) {
      const tab = page
        .getByRole("tab", { name: label })
        .or(page.getByText(label));
      await expect(tab.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("masking rules table visible", async ({ page }) => {
    const table = page
      .locator("table, [role='table']")
      .or(page.getByTestId("masking-rules-table"));
    const tableVisible = await table
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!tableVisible) {
      // Accept empty state if no rules exist yet
      const emptyState = page.getByText(/aucune r[eè]gle|no rules|commencez/i);
      await expect(emptyState.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("Add Rule button visible", async ({ page }) => {
    const btn = page
      .getByRole("button", { name: /add rule|ajouter.*r[eè]gle/i })
      .or(page.getByTestId("add-rule"));
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });
});
