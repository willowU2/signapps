import { test, expect } from "./fixtures";
import { CrmPage } from "./pages/CrmPage";

/**
 * CRM deals smoke tests — baseline coverage for the deals pipeline module.
 *
 * The CRM module features a Kanban board, list view, forecast, and deal detail
 * pages backed by the signapps-contacts service.
 *
 * Debug skill: .claude/skills/crm-debug/SKILL.md
 */
test.describe("CRM — deals", () => {
  test("CRM page loads", async ({ page }) => {
    const crm = new CrmPage(page);
    await crm.gotoCrm();
    await expect(page.getByTestId("crm-root")).toBeVisible();
  });

  // FIXME: Dialog doesn't close after deal creation — CRM form submit handler issue
  test.fixme("create a new deal", async ({ page }) => {
    const crm = new CrmPage(page);
    await crm.gotoCrm();

    const title = `E2E Deal ${Date.now()}`;
    const company = "E2E Corp";
    await crm.createDeal(title, company, 5000);

    // Verify that at least one deal card is present after creation.
    const count = await crm.dealCount();
    expect(count).toBeGreaterThan(0);
  });

  test("switch between tabs", async ({ page }) => {
    const crm = new CrmPage(page);
    await crm.gotoCrm();

    // Default tab is Kanban — switch to List.
    await crm.switchTab("list");
    await expect(page.getByTestId("crm-tab-list")).toHaveAttribute(
      "data-state",
      "active",
    );

    // Switch to Forecast.
    await crm.switchTab("forecast");
    await expect(page.getByTestId("crm-tab-forecast")).toHaveAttribute(
      "data-state",
      "active",
    );

    // Back to Kanban.
    await crm.switchTab("kanban");
    await expect(page.getByTestId("crm-tab-kanban")).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  // FIXME: Depends on createDeal which is broken (dialog doesn't close)
  test.fixme("open deal detail", async ({ page }) => {
    const crm = new CrmPage(page);
    await crm.gotoCrm();

    // Create a deal so we have something to click.
    const title = `E2E Detail ${Date.now()}`;
    await crm.createDeal(title, "Detail Corp", 1000);

    // Find the first deal card and navigate to its detail page.
    const firstCard = page.locator("[data-testid^='crm-deal-card-']").first();
    await expect(firstCard).toBeVisible();

    const dealId = (await firstCard.getAttribute("data-testid"))!.replace(
      "crm-deal-card-",
      "",
    );
    await crm.openDealDetail(dealId);

    // Verify the detail page loaded with the correct deal ID.
    const detailRoot = page.getByTestId("crm-deal-detail-root");
    await expect(detailRoot).toBeVisible();
    await expect(detailRoot).toHaveAttribute("data-deal-id", dealId);
  });
});
