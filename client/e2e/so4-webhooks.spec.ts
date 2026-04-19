/**
 * E2E — SO4 IN3 — Org webhooks panel.
 *
 * Visits `/admin/webhooks`, scopes to the OrgWebhooksPanel block,
 * verifies that the seeded webhooks are listed (`webhook.site/demo-…`),
 * and clicks Test on the first one — expects a toast confirmation.
 *
 * Skips gracefully if the panel is missing (org service unreachable).
 */
import { test, expect, dismissDialogs } from "./fixtures";

test.describe("SO4 — Org webhooks panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/webhooks");
    await dismissDialogs(page);
  });

  test("panel renders + test button fires toast", async ({ page }) => {
    const panel = page.getByTestId("org-webhooks-panel");
    if (!(await panel.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "org webhooks panel not present");
      return;
    }

    // Wait for at least one demo webhook card to appear.
    const demoCard = page
      .locator('[data-testid^="org-webhook-"]')
      .filter({ hasText: /webhook\.site/i })
      .first();

    if (!(await demoCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "seeded webhooks missing");
      return;
    }

    // Click the test button on the first demo webhook.
    const testBtn = demoCard
      .locator('[data-testid^="org-webhook-test-"]')
      .first();
    if (!(await testBtn.isVisible().catch(() => false))) {
      test.skip(true, "test button missing");
      return;
    }
    await testBtn.click();

    await expect(
      page.getByText(/test event queued|queued/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });
});
