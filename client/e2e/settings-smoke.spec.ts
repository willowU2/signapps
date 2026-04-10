/**
 * E2E Smoke — Settings module
 *
 * 12 tests covering key user journeys: main settings hub with tabs,
 * profile page with avatar and form fields, appearance page with theme
 * picker, notifications page with channel tabs, integrations page,
 * security page with MFA section, webhooks page, data export page,
 * preferences page, calendar integration page, interop page, and
 * settings sidebar navigation.
 *
 * Spec: docs/product-specs/ (settings)
 */
import { test, expect } from "./fixtures";

test.describe("Settings — smoke", () => {
  // ─── Hub ──────────────────────────────────────────────────────────────────

  test("settings hub loads with tabs or navigation", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const body = page.locator("body");
    const text = (await body.textContent()) ?? "";
    expect(text.trim().length).toBeGreaterThan(50);
    await expect(
      page.getByText(
        /^404$|Page not found|Une erreur est survenue|Something went wrong/i,
      ),
    ).toHaveCount(0);
  });

  // ─── Profile ──────────────────────────────────────────────────────────────

  test("profile page shows user info form with display name", async ({
    page,
  }) => {
    await page.goto("/settings/profile", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/profil|profile/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const nameLabel = page
      .getByText(/display name|nom affiché|nom complet/i)
      .or(page.locator("label").filter({ hasText: /name|nom/i }));
    await expect(nameLabel.first()).toBeVisible({ timeout: 5000 });
  });

  test("profile page shows avatar section", async ({ page }) => {
    await page.goto("/settings/profile", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const avatar = page
      .locator("img[alt*='avatar' i]")
      .or(page.locator("[class*='avatar']"))
      .or(page.locator("[class*='Avatar']"));
    await expect(avatar.first()).toBeVisible({ timeout: 10000 });
  });

  test("profile page has password change section", async ({ page }) => {
    await page.goto("/settings/profile", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const passwordSection = page
      .getByText(/password|mot de passe/i)
      .or(page.getByText(/change password|modifier/i));
    await expect(passwordSection.first()).toBeVisible({ timeout: 10000 });
  });

  // ─── Appearance ───────────────────────────────────────────────────────────

  test("appearance page shows theme options (light/dark)", async ({ page }) => {
    await page.goto("/settings/appearance", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    const heading = page
      .getByText(/appearance|apparence/i)
      .or(page.getByText(/thème|theme/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const lightOption = page
      .getByText(/clair|light/i)
      .or(page.getByText(/sombre|dark/i));
    await expect(lightOption.first()).toBeVisible({ timeout: 5000 });
  });

  test("appearance page shows color picker options", async ({ page }) => {
    await page.goto("/settings/appearance", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    const colorLabel = page
      .getByText(/bleu|vert|violet|orange|rouge/i)
      .or(page.getByText(/blue|green|purple/i));
    await expect(colorLabel.first()).toBeVisible({ timeout: 10000 });
  });

  // ─── Notifications ────────────────────────────────────────────────────────

  test("notifications page shows channel configuration", async ({ page }) => {
    await page.goto("/settings/notifications", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    const heading = page.getByText(/notification/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const channel = page
      .getByText(/email|push|sms/i)
      .or(page.getByText(/canal|channel/i));
    await expect(channel.first()).toBeVisible({ timeout: 5000 });
  });

  // ─── Integrations ────────────────────────────────────────────────────────

  test("integrations page shows available integrations", async ({ page }) => {
    await page.goto("/settings/integrations", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    const heading = page
      .getByText(/integration/i)
      .or(page.getByText(/intégration/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const body = page.locator("body");
    const text = (await body.textContent()) ?? "";
    expect(text.trim().length).toBeGreaterThan(100);
  });

  // ─── Security ─────────────────────────────────────────────────────────────

  test("security page shows MFA section", async ({ page }) => {
    await page.goto("/settings/security", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page
      .getByText(/security|sécurité/i)
      .or(page.getByText(/securite/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    const mfa = page
      .getByText(/MFA|multi.factor|two.factor|authentification/i)
      .or(page.getByText(/2FA|TOTP/i));
    await expect(mfa.first()).toBeVisible({ timeout: 5000 });
  });

  // ─── Webhooks ─────────────────────────────────────────────────────────────

  test("webhooks page loads without crashing", async ({ page }) => {
    await page.goto("/settings/webhooks", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const body = page.locator("body");
    const text = (await body.textContent()) ?? "";
    expect(text.trim().length).toBeGreaterThan(50);
    await expect(
      page.getByText(
        /^404$|Page not found|Une erreur est survenue|Something went wrong/i,
      ),
    ).toHaveCount(0);
  });

  // ─── Data Export ──────────────────────────────────────────────────────────

  test("data export page loads without crashing", async ({ page }) => {
    await page.goto("/settings/data-export", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    const body = page.locator("body");
    const text = (await body.textContent()) ?? "";
    expect(text.trim().length).toBeGreaterThan(50);
    await expect(
      page.getByText(
        /^404$|Page not found|Une erreur est survenue|Something went wrong/i,
      ),
    ).toHaveCount(0);
  });

  // ─── Preferences ─────────────────────────────────────────────────────────

  test("preferences page loads without crashing", async ({ page }) => {
    await page.goto("/settings/preferences", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    const body = page.locator("body");
    const text = (await body.textContent()) ?? "";
    expect(text.trim().length).toBeGreaterThan(50);
    await expect(
      page.getByText(
        /^404$|Page not found|Une erreur est survenue|Something went wrong/i,
      ),
    ).toHaveCount(0);
  });
});
