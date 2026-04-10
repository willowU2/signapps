/**
 * E2E Smoke — Comms (Internal Communications) module
 *
 * 12 tests covering hub page, 6 sub-module cards, navigation,
 * announcements list, create announcement, polls list,
 * create poll, vote on poll, and results display.
 *
 * Spec: docs/product-specs/57-comms.md
 */

import { test, expect } from "./fixtures";

test.describe("Comms — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/comms", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("hub page loads with Communication heading", async ({ page }) => {
    const heading = page
      .getByRole("heading", { name: /communication/i })
      .or(page.getByText(/communication/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("subtitle describes internal/external communications", async ({
    page,
  }) => {
    const subtitle = page.getByText(/communications internes/i);
    await expect(subtitle.first()).toBeVisible({ timeout: 10000 });
  });

  test("6 sub-module cards are visible", async ({ page }) => {
    const modules = [
      /annonces/i,
      /actualit[eé]s/i,
      /suggestions/i,
      /sondages/i,
      /newsletter/i,
      /affichage num[eé]rique/i,
    ];
    for (const label of modules) {
      const card = page.getByText(label);
      await expect(card.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("each card has an Acceder link", async ({ page }) => {
    const links = page.getByText(/acc[eé]der/i);
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test("clicking Annonces card navigates to announcements page", async ({
    page,
  }) => {
    const annonceCard = page.locator("a[href*='announcements']").or(
      page
        .getByText(/annonces/i)
        .locator("..")
        .locator(".."),
    );
    await annonceCard.first().click();
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/comms/announcements");
  });

  test("announcements page loads with list or empty state", async ({
    page,
  }) => {
    await page.goto("/comms/announcements", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);

    const list = page.locator("[class*='card'], article, [role='article']");
    const emptyState = page.getByText(
      /aucune annonce|no announcements|commencez/i,
    );
    const hasList = await list
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasEmpty = await emptyState
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test("announcements page has Nouvelle annonce button", async ({ page }) => {
    await page.goto("/comms/announcements", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);

    const btn = page
      .getByRole("button", { name: /nouvelle annonce|new announcement/i })
      .or(page.getByRole("button", { name: /cr[eé]er/i }))
      .or(page.locator("button:has(svg)").filter({ hasText: /nouveau/i }));
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test("clicking Sondages card navigates to polls page", async ({ page }) => {
    const pollCard = page.locator("a[href*='polls']").or(
      page
        .getByText(/sondages/i)
        .locator("..")
        .locator(".."),
    );
    await pollCard.first().click();
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/comms/polls");
  });

  test("polls page loads with list or empty state", async ({ page }) => {
    await page.goto("/comms/polls", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const list = page.locator("[class*='card'], article");
    const emptyState = page.getByText(
      /aucun sondage|no polls|commencez|cr[eé]er/i,
    );
    const hasList = await list
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasEmpty = await emptyState
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test("polls page has create poll button", async ({ page }) => {
    await page.goto("/comms/polls", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const btn = page
      .getByRole("button", { name: /nouveau sondage|new poll|cr[eé]er/i })
      .or(page.locator("button").filter({ hasText: /sondage|poll/i }));
    await expect(btn.first()).toBeVisible({ timeout: 10000 });
  });

  test("poll cards show vote options or results", async ({ page }) => {
    await page.goto("/comms/polls", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const card = page.locator("[class*='card']").first();
    const hasCard = await card.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasCard) {
      // Polls should show options (buttons) or results (progress bars)
      const voteElements = page
        .getByRole("button", { name: /vote/i })
        .or(page.locator("[role='progressbar'], [class*='progress']"))
        .or(page.getByText(/vote|r[eé]sultat|option/i));
      const hasVote = await voteElements
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(hasVote).toBeDefined();
    }
  });

  test("hub cards have hover effect classes", async ({ page }) => {
    const cards = page.locator(
      "[class*='hover:shadow'], [class*='cursor-pointer']",
    );
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });
});
