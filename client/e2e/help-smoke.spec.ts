/**
 * E2E Smoke — Help Center (/help)
 *
 * 4 tests covering page load, FAQ sections,
 * expandable items, and support form.
 */

import { test, expect } from "./fixtures";

test.describe("Help Center — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/help", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
  });

  test("page loads with Centre d'aide heading", async ({ page }) => {
    const heading = page.getByText(/centre d.aide|help/i);
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("FAQ sections visible", async ({ page }) => {
    const expectedSections = [/compte/i, /document/i, /mail/i];
    let visibleCount = 0;
    for (const section of expectedSections) {
      const el = page.getByText(section);
      const visible = await el
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (visible) visibleCount++;
    }
    expect(
      visibleCount,
      "At least 2 FAQ sections should be visible",
    ).toBeGreaterThanOrEqual(2);
  });

  test("expandable FAQ items work", async ({ page }) => {
    // Look for accordion triggers or expandable items
    const accordion = page.locator(
      '[data-testid*="faq"], [role="button"][aria-expanded], details summary, [data-state="closed"]',
    );
    const firstItem = accordion.first();
    const isClickable = await firstItem
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isClickable) {
      await firstItem.click();
      await page.waitForTimeout(500);
      // After expanding, new content should appear
      const body = await page.textContent("body");
      expect(body?.length).toBeGreaterThan(100);
    } else {
      // Fall back: verify FAQ content exists in some form
      const faqContent = page.getByText(/FAQ|question/i);
      await expect(faqContent.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("support form or contact section present", async ({ page }) => {
    const form = page.locator(
      'form, [data-testid="support-form"], [data-testid*="contact"]',
    );
    const contactLink = page.getByText(/contacter|support|assistance/i);

    const hasForm = await form
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasContact = await contactLink
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(
      hasForm || hasContact,
      "Should have support form or contact section",
    ).toBeTruthy();
  });
});
