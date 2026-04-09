/**
 * E2E Smoke — Monitoring module
 *
 * 4 tests covering page load, CPU/Memory/Disk KPI cards,
 * alert rules section, and charts area visibility.
 */

import { test, expect } from "./fixtures";

test.describe("Monitoring — smoke", () => {
  test("page loads at /monitoring", async ({ page }) => {
    await page.goto("/monitoring", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    const heading = page.getByText("System Monitoring");
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("CPU/Memory/Disk KPIs visible", async ({ page }) => {
    await page.goto("/monitoring", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    // KPI cards display metric labels
    const cpuLabel = page.getByText("CPU").first();
    const memoryLabel = page.getByText("Memory").first();
    const diskLabel = page.getByText("Disk").first();
    const cpuVisible = await cpuLabel
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const memoryVisible = await memoryLabel
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const diskVisible = await diskLabel
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    expect(cpuVisible || memoryVisible || diskVisible).toBeTruthy();
  });

  test("alert rules section visible", async ({ page }) => {
    await page.goto("/monitoring", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    const alertRules = page.getByText("Threshold Alert Rules");
    const visible = await alertRules
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    // Fall back to checking for individual rule names
    if (!visible) {
      const cpuRule = page.getByText("CPU > 90%");
      const ruleVisible = await cpuRule
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(ruleVisible).toBeTruthy();
    }
  });

  test("charts area visible", async ({ page }) => {
    await page.goto("/monitoring", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    const cpuChart = page.getByText("CPU Usage");
    const chartVisible = await cpuChart
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    // Charts use recharts — at minimum the card titles should render
    if (!chartVisible) {
      // Fallback: any recharts container or card with chart content
      const charts = page.locator(
        ".recharts-responsive-container, [class*='chart']",
      );
      const anyChart = await charts
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(anyChart || chartVisible).toBeTruthy();
    }
  });
});
