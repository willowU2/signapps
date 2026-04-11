import { test, expect } from "./fixtures";

test.describe("Mail Org-Aware — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login?auto=admin", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("admin mail-server page loads", async ({ page }) => {
    await page.goto("/admin/mail-server", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/serveur mail|mail server|configuration/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("naming rules tab visible", async ({ page }) => {
    await page.goto("/admin/mail-server", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const tab = page
      .getByRole("tab", { name: /nommage|naming/i })
      .or(page.getByText(/regles de nommage|naming rules/i));
    await expect(tab.first()).toBeVisible({ timeout: 10000 });
  });

  test("distribution lists tab visible", async ({ page }) => {
    await page.goto("/admin/mail-server", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const tab = page
      .getByRole("tab", { name: /distribution|listes/i })
      .or(page.getByText(/listes de distribution|distribution/i));
    await expect(tab.first()).toBeVisible({ timeout: 10000 });
  });

  test("shared mailboxes tab visible", async ({ page }) => {
    await page.goto("/admin/mail-server", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const tab = page
      .getByRole("tab", { name: /partagees|shared/i })
      .or(page.getByText(/boites partagees|shared mailboxes/i));
    await expect(tab.first()).toBeVisible({ timeout: 10000 });
  });

  test("portal client messages page loads", async ({ page }) => {
    await page.goto("/portal/client/messages", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/messages|messagerie/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("portal supplier messages page loads", async ({ page }) => {
    await page.goto("/portal/supplier/messages", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/messages|messagerie/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("portal messages compose button visible", async ({ page }) => {
    await page.goto("/portal/client/messages", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    const btn = page
      .getByRole("button", { name: /nouveau|compose|ecrire/i })
      .or(page.getByText(/nouveau message/i));
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });
});
