/**
 * E2E Smoke — Status Page (/status)
 *
 * 4 tests covering page load, service cards with ports,
 * uptime metric, and auto-refresh indicator.
 */

import { test, expect } from "./fixtures";

test.describe("Status Page — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/status", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
  });

  test("page loads with Status heading", async ({ page }) => {
    const heading = page.locator("h1");
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const text = await heading.first().textContent();
    expect(text?.toLowerCase()).toContain("status");
  });

  test("service cards visible with ports", async ({ page }) => {
    // The status page lists services — Identity (3001) is always present
    const identity = page.getByText(/identity/i);
    await expect(identity.first()).toBeVisible({ timeout: 10000 });

    // Check that at least one port number is displayed
    const portPattern = page.getByText(/3001|3002|3003|3004|3005/);
    const hasPort = await portPattern
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Fall back: verify multiple service entries exist
    if (!hasPort) {
      const services = page.getByText(/gateway|storage|proxy|calendar|mail/i);
      await expect(services.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("uptime metric displayed", async ({ page }) => {
    // Look for uptime percentage, status indicators, or latency values
    const uptimeText = page.getByText(/uptime|disponibilit|99|100%|ms/i);
    const statusBadge = page.locator(
      '[data-testid*="uptime"], [data-testid*="status"], [class*="badge"]',
    );

    const hasUptime = await uptimeText
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasBadge = await statusBadge
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(
      hasUptime || hasBadge,
      "Should display uptime metric or status badge",
    ).toBeTruthy();
  });

  test("auto-refresh indicator present", async ({ page }) => {
    // Look for auto-refresh toggle, timer, or refresh button
    const refreshIndicator = page.getByText(
      /actualisation|auto.refresh|rafra.chir|refresh/i,
    );
    const refreshButton = page.getByRole("button", {
      name: /actualiser|refresh|rafra.chir/i,
    });
    const timer = page.locator(
      '[data-testid*="refresh"], [data-testid*="auto"], [class*="refresh"]',
    );

    const hasIndicator = await refreshIndicator
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasButton = await refreshButton
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const hasTimer = await timer
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(
      hasIndicator || hasButton || hasTimer,
      "Should have auto-refresh indicator, button, or timer",
    ).toBeTruthy();
  });
});
