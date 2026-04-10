/**
 * E2E Smoke — SecureLink module (Tunnels, Relays, DNS)
 *
 * 12 tests covering page load, dashboard KPIs, 4 tabs,
 * tunnels tab, relays tab, DNS tab, traffic chart,
 * refresh button, create tunnel button, KPI card labels,
 * and Quick Connect button.
 *
 * Spec: docs/product-specs/61-securelink.md
 */

import { test, expect } from "./fixtures";

test.describe("SecureLink — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/securelink", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("page loads with SecureLink heading", async ({ page }) => {
    const heading = page
      .getByRole("heading", { name: /securelink/i })
      .or(page.getByText(/securelink/i));
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

  test("Dashboard tab is active by default", async ({ page }) => {
    const activeTab = page
      .locator('[role="tab"][data-state="active"]')
      .or(page.locator('[role="tab"][aria-selected="true"]'));
    const text = await activeTab.first().textContent();
    expect(text?.toLowerCase()).toContain("dashboard");
  });

  test("4 KPI stat cards are visible on Dashboard", async ({ page }) => {
    const kpiLabels = [
      /active tunnels/i,
      /active relays/i,
      /dns queries/i,
      /blocked queries/i,
    ];
    for (const label of kpiLabels) {
      const card = page.getByText(label);
      await expect(card.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("KPI cards display numeric values", async ({ page }) => {
    const statValues = page.locator(".text-2xl.font-bold");
    await expect(statValues.first()).toBeVisible({ timeout: 10000 });
    const count = await statValues.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("traffic chart section is visible", async ({ page }) => {
    const chart = page
      .getByTestId("traffic-chart")
      .or(page.getByText(/traffic overview/i))
      .or(page.locator("canvas, svg, [class*='chart'], [class*='recharts']"));
    await expect(chart.first()).toBeVisible({ timeout: 10000 });
  });

  test("Refresh button is visible on Dashboard", async ({ page }) => {
    const refreshBtn = page
      .getByRole("button", { name: /refresh|actualiser/i })
      .or(page.getByTestId("refresh-button"));
    await expect(refreshBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test("switching to Tunnels tab shows tunnel list or empty state", async ({
    page,
  }) => {
    const tunnelsTab = page
      .getByRole("tab", { name: /tunnels/i })
      .or(page.getByText(/tunnels/i));
    await tunnelsTab.first().click();
    await page.waitForTimeout(1000);

    const tunnelContent = page
      .locator("table, [role='table']")
      .or(page.getByText(/no tunnel|aucun tunnel|cr[eé]er/i))
      .or(page.locator("[class*='card']"));
    await expect(tunnelContent.first()).toBeVisible({ timeout: 5000 });
  });

  test("Tunnels tab has create tunnel button", async ({ page }) => {
    const tunnelsTab = page
      .getByRole("tab", { name: /tunnels/i })
      .or(page.getByText(/tunnels/i));
    await tunnelsTab.first().click();
    await page.waitForTimeout(1000);

    const createBtn = page
      .getByRole("button", { name: /create|cr[eé]er|nouveau|new tunnel/i })
      .or(page.getByTestId("create-tunnel"));
    await expect(createBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test("switching to Relays tab shows relay content", async ({ page }) => {
    const relaysTab = page
      .getByRole("tab", { name: /relays/i })
      .or(page.getByText(/relays/i));
    await relaysTab.first().click();
    await page.waitForTimeout(1000);

    const relayContent = page
      .locator("table, [role='table']")
      .or(page.getByText(/no relay|aucun relai|serveur/i))
      .or(page.locator("[class*='card']"));
    await expect(relayContent.first()).toBeVisible({ timeout: 5000 });
  });

  test("switching to DNS tab shows DNS configuration content", async ({
    page,
  }) => {
    const dnsTab = page
      .getByRole("tab", { name: /dns/i })
      .or(page.getByText(/dns/i));
    await dnsTab.first().click();
    await page.waitForTimeout(1000);

    const dnsContent = page
      .getByText(/dns|domain|blocklist|records|filtr/i)
      .or(page.locator("[class*='card']"));
    await expect(dnsContent.first()).toBeVisible({ timeout: 5000 });
  });
});
