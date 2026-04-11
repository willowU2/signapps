import { test, expect } from "./fixtures";

test.describe("Projects Org-Aware — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login?auto=admin", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("projects page loads with heading", async ({ page }) => {
    await page.goto("/projects", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/projets/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("tasks page loads", async ({ page }) => {
    await page.goto("/tasks", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/tâches|taches/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("my-tasks button visible on tasks page", async ({ page }) => {
    await page.goto("/tasks", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const btn = page
      .getByTestId("tasks-view-selector-my-tasks")
      .or(page.getByText(/mes tâches|mes taches/i));
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test("portal client projects page loads", async ({ page }) => {
    await page.goto("/portal/client/projects", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/mes projets/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("portal supplier projects page loads", async ({ page }) => {
    await page.goto("/portal/supplier/projects", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/mes projets/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("projects page has Gantt tab", async ({ page }) => {
    await page.goto("/projects", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const ganttTab = page
      .getByRole("tab", { name: /gantt/i })
      .or(page.getByText(/gantt/i));
    await expect(ganttTab.first()).toBeVisible({ timeout: 10000 });
  });
});
