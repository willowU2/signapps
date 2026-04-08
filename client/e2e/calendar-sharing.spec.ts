/**
 * E2E — Calendar Sharing
 *
 * Tests the ShareDialog wiring into CalendarHub. Full share lifecycle
 * (add → list → edit role → revoke) requires a second user to exist in
 * the backend, which is outside this smoke spec's scope. Here we verify:
 *
 *   - The share button is visible in the calendar header
 *   - Clicking it opens the ShareDialog
 *   - The dialog exposes the user-id input, role select, Add button,
 *     and "Shared With" list
 *   - The 3 supported roles (viewer, editor, owner) are selectable
 *   - The dialog closes cleanly without side-effects when cancelled
 */

import { test, expect } from "./fixtures";
import { CalendarPage } from "./pages/CalendarPage";

test.describe("Calendar — Sharing", () => {
  let calendar: CalendarPage;

  test.beforeEach(async ({ page }) => {
    calendar = new CalendarPage(page);
    await calendar.goto();
  });

  test("the share button is visible and opens the ShareDialog", async ({
    page,
  }) => {
    const shareBtn = page.getByTestId("calendar-share-btn");
    await expect(shareBtn).toBeVisible();
    await expect(shareBtn).toBeEnabled();

    await shareBtn.click();

    // Dialog should open with the "Share Calendar" title
    await expect(
      page.getByRole("heading", { name: /Share Calendar/i }),
    ).toBeVisible();
  });

  test("ShareDialog exposes the user-id input, role select, and Add button", async ({
    page,
  }) => {
    await page.getByTestId("calendar-share-btn").click();
    await expect(
      page.getByRole("heading", { name: /Share Calendar/i }),
    ).toBeVisible();

    // User ID / email input
    await expect(page.locator("#user-id")).toBeVisible();
    await expect(page.locator("#user-id")).toBeEditable();

    // Add button is disabled until a user-id is entered
    const addBtn = page.getByRole("button", { name: /^Add$/ });
    await expect(addBtn).toBeDisabled();

    // Typing a value enables the Add button
    await page.locator("#user-id").fill("some-user-id");
    await expect(addBtn).toBeEnabled();

    // Close with Escape to leave no side-effects
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: /Share Calendar/i }),
    ).toBeHidden();
  });

  test("the role selector exposes viewer / editor / owner", async ({
    page,
  }) => {
    await page.getByTestId("calendar-share-btn").click();
    await expect(
      page.getByRole("heading", { name: /Share Calendar/i }),
    ).toBeVisible();

    // The top-of-dialog role select sits next to the user-id input.
    // Scope it to the dialog to avoid matching the per-share selects below.
    const dialog = page.getByRole("dialog");
    const roleSelect = dialog.getByRole("combobox").first();
    await roleSelect.click();

    for (const role of ["Viewer", "Editor", "Owner"]) {
      await expect(page.getByRole("option", { name: role })).toBeVisible();
    }

    // Pick "Editor" and verify the role description updates
    await page.getByRole("option", { name: "Editor" }).click();
    await expect(dialog.getByText(/Can create and edit events/i)).toBeVisible();

    await page.keyboard.press("Escape");
  });

  test("the shared users list shows an empty state when no shares exist", async ({
    page,
  }) => {
    await page.getByTestId("calendar-share-btn").click();
    await expect(
      page.getByRole("heading", { name: /Share Calendar/i }),
    ).toBeVisible();

    // "Shared With" section label is always present
    await expect(
      page.getByRole("dialog").getByText("Shared With", { exact: true }),
    ).toBeVisible();

    // Either shows loading, empty state, or a list. We assert one of the
    // three is present (the E2E test calendar starts unshared so empty state
    // is the expected outcome, but we tolerate a transient list if previous
    // sessions added shares we don't control).
    const dialog = page.getByRole("dialog");
    const emptyState = dialog.getByText(/Not shared with anyone yet/i);
    const hasList = dialog.locator(".space-y-2 > div.flex").first();
    await expect(async () => {
      const emptyCount = await emptyState.count();
      const listCount = await hasList.count();
      expect(emptyCount + listCount).toBeGreaterThan(0);
    }).toPass({ timeout: 3000 });

    await page.keyboard.press("Escape");
  });
});
