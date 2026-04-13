import { test, expect } from "./fixtures";

/**
 * Visual Regression Tests
 *
 * Captures baseline screenshots on first run and compares on subsequent runs.
 * Run with: npx playwright test visual-regression.spec.ts
 * Update baselines with: npx playwright test visual-regression.spec.ts --update-snapshots
 *
 * These tests are skipped by default because baseline screenshots are environment-specific
 * (OS font rendering, resolution, theme state) and produce false positives on CI.
 * Run manually with --update-snapshots to regenerate baselines when needed.
 */

test.describe("Visual Regression", () => {
  // Visual regression snapshots are unstable across different environments,
  // OS versions, and screen resolutions. Skip by default; run manually.
  // To update baselines: npx playwright test visual-regression.spec.ts --update-snapshots
  test.skip();

  test("login page matches snapshot", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("login.png", { maxDiffPixels: 100 });
  });

  test("dashboard page matches snapshot", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("dashboard.png", {
      maxDiffPixels: 100,
    });
  });

  test("docs page matches snapshot", async ({ page }) => {
    await page.goto("/docs");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("docs.png", { maxDiffPixels: 100 });
  });

  test("mail page matches snapshot", async ({ page }) => {
    await page.goto("/mail");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("mail.png", { maxDiffPixels: 100 });
  });

  test("calendar page matches snapshot", async ({ page }) => {
    await page.goto("/calendar");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("calendar.png", { maxDiffPixels: 100 });
  });

  test("social page matches snapshot", async ({ page }) => {
    await page.goto("/social");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("social.png", { maxDiffPixels: 100 });
  });
});
