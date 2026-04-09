/**
 * E2E Smoke — SecureLink module
 *
 * 4 tests covering page load, tab navigation,
 * KPI cards, and traffic chart.
 */

import { test, expect } from "./fixtures";

test.describe("SecureLink — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/securelink", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("page loads with SecureLink heading", async ({ page }) => {
    const heading = page.getByText(/securelink/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("4 tabs visible (Dashboard, Tunnels, Relays, DNS)", async ({ page }) => {
    const tabs = [/dashboard/i, /tunnels/i, /relays/i, /dns/i];
    for (const label of tabs) {
      const tab = page
        .getByRole("tab", { name: label })
        .or(page.getByText(label));
      await expect(tab.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("KPI cards visible", async ({ page }) => {
    const cards = page
      .getByTestId("kpi-card")
      .or(page.locator("[class*='card']"));
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("traffic chart visible", async ({ page }) => {
    const chart = page
      .getByTestId("traffic-chart")
      .or(page.locator("canvas, svg, [class*='chart'], [class*='recharts']"));
    await expect(chart.first()).toBeVisible({ timeout: 10000 });
  });
});
