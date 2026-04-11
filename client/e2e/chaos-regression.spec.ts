import { test, expect } from "./fixtures";

test.describe("Chaos Tenant Regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login?auto=admin", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("core pages load without crash", async ({ page }) => {
    const routes = [
      "/docs",
      "/tasks",
      "/cal",
      "/mail",
      "/storage",
      "/keep",
      "/search",
    ];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      const errorPage = page.getByText(
        /erreur critique|500|internal server error/i,
      );
      const hasError = await errorPage
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      expect(hasError, `${route} should not crash`).toBe(false);
    }
  });

  test("admin pages load without crash", async ({ page }) => {
    const routes = [
      "/admin/companies",
      "/admin/mail-server",
      "/admin/org-structure",
      "/admin/persons",
    ];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      const errorPage = page.getByText(/erreur critique|500/i);
      const hasError = await errorPage
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      expect(hasError, `${route} should not crash`).toBe(false);
    }
  });

  test("my-team page loads", async ({ page }) => {
    await page.goto("/my-team", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/mon equipe|aucun rapport/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("portal pages load", async ({ page }) => {
    await page.goto("/portal/client", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const content = page.getByText(/portail|client/i);
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test("status page loads", async ({ page }) => {
    await page.goto("/status", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/status|uptime/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });
});
