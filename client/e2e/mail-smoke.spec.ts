import { test, expect } from "./fixtures";
import { MailPage } from "./pages/MailPage";

/**
 * Mail smoke tests — minimal journeys relying on the newly instrumented
 * data-testids in the mail page and compose dialog.
 *
 * The Mail module has a very complete backend (34 handlers in signapps-mail)
 * but the frontend had zero test instrumentation. This spec starts the
 * baseline; richer tests (threading, search operators, rules, labels) will
 * follow as more data-testids are added.
 *
 * Spec: docs/product-specs/04-mail.md
 * Debug skill: .claude/skills/mail-debug/SKILL.md
 */
test.describe("Mail — smoke", () => {
  test("inbox loads with mail root visible", async ({ page }) => {
    const mail = new MailPage(page);
    await mail.gotoInbox();
    await expect(page.getByTestId("mail-root")).toBeVisible();
  });

  test("compose button opens the rich compose dialog", async ({ page }) => {
    const mail = new MailPage(page);
    await mail.gotoInbox();
    await mail.openCompose();
    await expect(page.getByTestId("mail-compose-dialog")).toBeVisible();
  });

  test("compose dialog accepts a recipient email", async ({ page }) => {
    const mail = new MailPage(page);
    await mail.gotoInbox();
    await mail.openCompose();
    await mail.setRecipient("recipient@example.com");
    await expect(page.getByTestId("mail-compose-to")).toHaveValue(
      "recipient@example.com",
    );
  });

  test("compose dialog can be closed via Escape", async ({ page }) => {
    const mail = new MailPage(page);
    await mail.gotoInbox();
    await mail.openCompose();
    await mail.closeCompose();
    await expect(page.getByTestId("mail-compose-dialog")).toBeHidden();
  });
});
