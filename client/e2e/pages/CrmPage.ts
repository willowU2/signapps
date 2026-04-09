import { type Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * CrmPage — Page Object for the CRM (deals pipeline) module.
 *
 * Covers:
 *  - Deal listing at `/crm` (Kanban, List, Forecast tabs)
 *  - Create deal dialog
 *  - Deal detail at `/crm/deals/[id]`
 *
 * Relies on data-testids instrumented in:
 *  - client/src/app/crm/page.tsx
 *  - client/src/app/crm/deals/[id]/page.tsx
 *  - client/src/components/crm/deal-card.tsx
 *
 * Debug skill: .claude/skills/crm-debug/SKILL.md
 */
export class CrmPage extends BasePage {
  get path(): string {
    return "/crm";
  }

  get readyIndicator(): Locator {
    return this.page.getByTestId("crm-root");
  }

  /** Navigate to the CRM page and wait for it to be ready. */
  async gotoCrm(): Promise<void> {
    await this.goto();
  }

  // ---- New deal dialog ---------------------------------------------------

  /** Click the "Nouvelle opportunite" button to open the new deal dialog. */
  async openNewDealDialog(): Promise<void> {
    await this.page.getByTestId("crm-new-deal-button").click();
    await expect(this.page.locator('[role="dialog"]')).toBeVisible();
  }

  /**
   * Create a new deal via the dialog.
   * @param title  — deal title (required)
   * @param company — company name (required)
   * @param value  — deal value in EUR (optional, defaults to 0)
   */
  async createDeal(
    title: string,
    company: string,
    value?: number,
  ): Promise<void> {
    await this.openNewDealDialog();
    await this.page.getByTestId("crm-deal-title-input").fill(title);
    await this.page.getByTestId("crm-deal-company-input").fill(company);
    if (value !== undefined) {
      await this.page.getByTestId("crm-deal-value-input").fill(String(value));
    }
    // Click submit and wait for the API response before checking dialog state.
    const [response] = await Promise.all([
      this.page
        .waitForResponse(
          (r) =>
            r.url().includes("/api/v1/crm/deals") &&
            r.request().method() === "POST",
          { timeout: 15000 },
        )
        .catch(() => null),
      this.page.getByTestId("crm-deal-submit-button").click(),
    ]);
    if (response && !response.ok()) {
      throw new Error(
        `Deal creation API failed: ${response.status()} ${response.url()}`,
      );
    }
    // Wait for the dialog to close after the API call completes.
    await expect(this.page.locator('[role="dialog"]')).toBeHidden({
      timeout: 10000,
    });
  }

  // ---- Deal cards --------------------------------------------------------

  /** Locator for a specific deal card by deal ID. */
  dealCard(id: string): Locator {
    return this.page.getByTestId(`crm-deal-card-${id}`);
  }

  /** Count of deal cards currently visible in the kanban view. */
  async dealCount(): Promise<number> {
    return this.page.locator("[data-testid^='crm-deal-card-']").count();
  }

  // ---- Tabs --------------------------------------------------------------

  /** Switch between CRM tabs (kanban, list, forecast, etc.). */
  async switchTab(
    tab:
      | "kanban"
      | "list"
      | "forecast"
      | "billing-report"
      | "billing-forecast"
      | "quotas"
      | "calendar"
      | "import",
  ): Promise<void> {
    await this.page.getByTestId(`crm-tab-${tab}`).click();
  }

  // ---- Deal detail -------------------------------------------------------

  /** Click a deal card link to navigate to the deal detail page. */
  async openDealDetail(id: string): Promise<void> {
    const card = this.dealCard(id);
    await card.locator("a").first().click();
    await expect(this.page.getByTestId("crm-deal-detail-root")).toBeVisible({
      timeout: 10_000,
    });
  }
}
