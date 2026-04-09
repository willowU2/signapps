import { type Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * MailPage — Page Object for the Mail module.
 *
 * Covers:
 *  - Inbox listing at `/mail`
 *  - Compose dialog (rich)
 *  - (Future) folder navigation, search, labels, bulk actions
 *
 * Relies on data-testids instrumented in:
 *  - client/src/app/mail/page.tsx (mail-root, mail-compose-button, mail-compose-ai-button)
 *  - client/src/components/mail/compose-rich-dialog.tsx (mail-compose-dialog, mail-compose-to)
 *
 * This PO is intentionally minimal (smoke-level). The Mail module has 40+ components
 * but zero data-testids previously — see `.claude/skills/mail-debug/SKILL.md` for the
 * full list of testids to add for richer coverage (list, threading, search, labels, rules).
 *
 * Debug skill: .claude/skills/mail-debug/SKILL.md
 * Spec: docs/product-specs/04-mail.md
 */
export class MailPage extends BasePage {
  get path(): string {
    return "/mail";
  }

  get readyIndicator(): Locator {
    return this.page.getByTestId("mail-root");
  }

  /** Navigate to the mail page and wait for it to be ready. */
  async gotoInbox(): Promise<void> {
    await this.goto();
  }

  /** Click the "Nouveau message" compose button and wait for the dialog. */
  async openCompose(): Promise<void> {
    // The expanded compose button lives in the sidebar. If the sidebar is
    // collapsed (narrow viewport), fall back to clicking via title attribute.
    const expandedBtn = this.page.getByTestId("mail-compose-button");
    if (await expandedBtn.isVisible().catch(() => false)) {
      await expandedBtn.click();
    } else {
      // Collapsed sidebar fallback — uses title="Nouveau message".
      await this.page.getByTitle("Nouveau message").first().click();
    }
    await expect(this.page.getByTestId("mail-compose-dialog")).toBeVisible();
  }

  /** Click the "Rédiger avec l'IA" button. */
  async openComposeAi(): Promise<void> {
    await this.page.getByTestId("mail-compose-ai-button").click();
  }

  /** Fill the recipient field in an open compose dialog. */
  async setRecipient(email: string): Promise<void> {
    await this.page.getByTestId("mail-compose-to").fill(email);
  }

  /** Close the compose dialog by pressing Escape. */
  async closeCompose(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.page.getByTestId("mail-compose-dialog")).toBeHidden();
  }

  // ---- TODO (future instrumentation needed) -----------------------------
  // The following helpers are scaffolded but rely on data-testids that
  // still need to be added to the source code. See mail-debug SKILL.md.

  /** @todo instrument folder buttons with mail-folder-{name} */
  async switchFolder(
    _folder: "inbox" | "sent" | "drafts" | "trash" | "spam" | "archive",
  ): Promise<void> {
    throw new Error(
      "Not implemented — folder data-testids missing. See mail-debug SKILL.md.",
    );
  }

  /** @todo instrument mail-list items with mail-list-item-{id} */
  async listCount(): Promise<number> {
    return this.page.locator("[data-testid^='mail-list-item-']").count();
  }

  /** @todo instrument search input with mail-search-input */
  async search(_query: string): Promise<void> {
    throw new Error("Not implemented — search data-testid missing.");
  }
}
