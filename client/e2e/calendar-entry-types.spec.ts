/**
 * E2E — Calendar Entry Types
 *
 * Covers Section C of the calendar feature spec: the 5 entry types the
 * EventForm lets the user create:
 *   - event    → "Événement" (standard meeting)
 *   - task     → "Tâche" (TODO item)
 *   - leave    → "Demande de congé" (leave request with balance check)
 *   - shift    → "Horaire / shift" (work shift)
 *   - booking  → "Réservation" (resource reservation)
 *
 * For each type we verify the creation flow: open form → change type →
 * fill title → save → event visible in the grid. Type-specific validations
 * (e.g. leave balance, resource selection) are out of scope for this spec
 * and should be covered in dedicated collaboration/resource specs.
 */

import { test, expect, dismissDialogs } from "./fixtures";
import { CalendarPage } from "./pages/CalendarPage";
import { EventFormDialog } from "./pages/EventFormDialog";

let calendarEnsured = false;

async function ensureCalendarExists(
  page: import("@playwright/test").Page,
): Promise<void> {
  if (calendarEnsured) return;
  const base = "http://localhost:3011/api/v1";
  const list = await page.request.get(`${base}/calendars`).catch(() => null);
  if (list?.ok()) {
    const body = await list.json().catch(() => null);
    const cals = Array.isArray(body) ? body : (body?.data ?? []);
    if (cals.length > 0) {
      calendarEnsured = true;
      return;
    }
  }
  await page.request
    .post(`${base}/calendars`, {
      data: {
        name: "E2E Calendar",
        color: "#3b82f6",
        timezone: "Europe/Paris",
        is_shared: false,
      },
    })
    .catch(() => null);
  calendarEnsured = true;
}

function uniq(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

test.describe("Calendar — Entry types", () => {
  let calendar: CalendarPage;
  let dialog: EventFormDialog;

  test.beforeEach(async ({ page }) => {
    // Onboarding/changelog localStorage flags are persisted via `storageState`
    // (see auth.setup.ts), so no addInitScript is needed here.
    await ensureCalendarExists(page);
    calendar = new CalendarPage(page);
    dialog = new EventFormDialog(page);
    await calendar.goto();
    await dismissDialogs(page);
    await calendar.switchView("Semaine").catch(() => {});
  });

  test("creates a standard event (type = Événement)", async () => {
    const title = `Événement standard ${uniq()}`;
    await calendar.clickNewEvent();
    await dialog.waitOpen();
    // Default type is "Événement" — no change needed, but we still click
    // the trigger to prove the selector renders.
    await dialog.selectEventType("Événement");
    await dialog.fillTitle(title);
    await dialog.save();
    await calendar.expectEventVisible(title);
  });

  test("creates a task (type = Tâche)", async () => {
    const title = `Tâche E2E ${uniq()}`;
    await calendar.clickNewEvent();
    await dialog.waitOpen();
    await dialog.selectEventType("Tâche");
    await dialog.fillTitle(title);
    await dialog.save();
    await calendar.expectEventVisible(title);
  });

  test("creates a work shift (type = Horaire / shift)", async () => {
    const title = `Shift E2E ${uniq()}`;
    await calendar.clickNewEvent();
    await dialog.waitOpen();
    await dialog.selectEventType("Horaire / shift");
    await dialog.fillTitle(title);
    await dialog.save();
    await calendar.expectEventVisible(title);
  });

  test("creates a booking (type = Réservation)", async () => {
    const title = `Réservation E2E ${uniq()}`;
    await calendar.clickNewEvent();
    await dialog.waitOpen();
    await dialog.selectEventType("Réservation");
    await dialog.fillTitle(title);
    await dialog.save();
    await calendar.expectEventVisible(title);
  });

  // NOTE: Leave ("Demande de congé") is NOT tested here because the form
  // switches to a specialised flow with leave_type, balance pre-check, and
  // team conflict detection that deserves its own spec. See
  // `calendar-leaves.spec.ts` (TODO).

  test("the event type selector exposes all 5 supported types", async () => {
    await calendar.clickNewEvent();
    await dialog.waitOpen();
    await dialog.eventTypeSelect.click();

    for (const label of [
      "Événement",
      "Tâche",
      "Demande de congé",
      "Horaire / shift",
      "Réservation",
    ]) {
      await expect(
        calendar.page.getByRole("option", { name: label }),
      ).toBeVisible();
    }

    // Close the select without picking anything, then cancel the dialog.
    await calendar.page.keyboard.press("Escape");
    await dialog.cancel();
  });
});
