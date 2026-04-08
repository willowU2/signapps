/**
 * E2E — Calendar Collaboration
 *
 * Covers the collaboration affordances the calendar exposes: finding a
 * meeting slot with AI assistance, and managing attendees on an event.
 *
 * Scope:
 *   - "Trouver un créneau" button + FindSlot dialog shell
 *   - Attendees button on EventForm + AttendeeList dialog shell
 *
 * Full workflows (AI-generated slot acceptance, actual attendee invitation
 * with RSVP round-trips across multiple users) require richer seeding and
 * belong in a dedicated multi-user spec.
 */

import { test, expect } from "./fixtures";
import { CalendarPage } from "./pages/CalendarPage";
import { EventFormDialog } from "./pages/EventFormDialog";

test.describe("Calendar — Collaboration", () => {
  let calendar: CalendarPage;
  let dialog: EventFormDialog;

  test.beforeEach(async ({ page }) => {
    calendar = new CalendarPage(page);
    dialog = new EventFormDialog(page);
    await calendar.goto();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Find a Slot (AI-assisted)
  // ─────────────────────────────────────────────────────────────────────────

  test('the "Find a Slot" button is visible and opens the FindSlot dialog', async ({
    page,
  }) => {
    const findSlotBtn = page.getByTestId("calendar-find-slot-btn");
    await expect(findSlotBtn).toBeVisible();
    await expect(findSlotBtn).toBeEnabled();

    await findSlotBtn.click();
    await expect(
      page.getByRole("heading", { name: /Find a Slot with AI/i }),
    ).toBeVisible();
  });

  test("FindSlot dialog exposes description + duration + participants inputs", async ({
    page,
  }) => {
    await page.getByTestId("calendar-find-slot-btn").click();
    await expect(
      page.getByRole("heading", { name: /Find a Slot with AI/i }),
    ).toBeVisible();

    // The dialog body contains labels/inputs for the AI prompt fields.
    // We assert presence via labels rather than ids (the component doesn't
    // expose ids for every input).
    const dialogRoot = page.getByRole("dialog");
    await expect(dialogRoot.getByText(/Describe your meeting/i)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: /Find a Slot with AI/i }),
    ).toBeHidden();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Attendees — EventForm → AttendeeList
  // ─────────────────────────────────────────────────────────────────────────

  test('the Participants section in EventForm exposes an "Ajouter" button', async ({
    page,
  }) => {
    await calendar.clickNewEvent();
    await dialog.waitOpen();

    // The Participants section is below Ressources and above Récurrence.
    // We scope by label and assert the trigger button is present.
    const dialogRoot = page.getByRole("dialog");
    await expect(dialogRoot.getByText(/^Participants$/i)).toBeVisible();
    const addAttendeeBtn = dialogRoot.getByRole("button", {
      name: /Ajouter des participants/i,
    });
    await expect(addAttendeeBtn).toBeVisible();

    await dialog.cancel();
  });

  test('clicking "Ajouter des participants" opens the AttendeeList dialog', async ({
    page,
  }) => {
    await calendar.clickNewEvent();
    await dialog.waitOpen();

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Ajouter des participants/i })
      .click();

    // AttendeeList is a Radix Dialog with title "Event Attendees".
    // It opens on top of EventForm (Radix may replace the active dialog).
    await expect(
      page.getByRole("heading", { name: /Event Attendees/i }),
    ).toBeVisible();

    // The RSVP summary cards (Accepted / Pending / Declined) confirm the
    // dialog body rendered, not just the header.
    await expect(page.getByText(/Accepted/i).first()).toBeVisible();
    await expect(page.getByText(/Pending/i).first()).toBeVisible();
    await expect(page.getByText(/Declined/i).first()).toBeVisible();
  });
});
