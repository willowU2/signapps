import { test, expect } from "@playwright/test";

test.describe("P2 cold compile bench (Turbopack)", () => {
  test("dashboard first-hit TTFB is under 2 s in dev", async ({ page }) => {
    // Playwright spawns its own dev server via playwright.config.ts — this
    // test assumes that server is warm (recently started) but the /dashboard
    // route has NOT been visited yet in this run.
    const start = Date.now();
    const response = await page.goto("http://localhost:3000/dashboard", {
      waitUntil: "domcontentloaded",
      timeout: 10_000,
    });
    const elapsed = Date.now() - start;

    expect(response?.status()).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  });

  test("sheets/editor first-hit TTFB is under 2 s in dev", async ({ page }) => {
    const start = Date.now();
    const response = await page.goto("http://localhost:3000/sheets/editor", {
      waitUntil: "domcontentloaded",
      timeout: 10_000,
    });
    const elapsed = Date.now() - start;

    expect(response?.status()).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  });
});
