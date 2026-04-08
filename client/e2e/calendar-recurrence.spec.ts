/**
 * E2E — Calendar Recurrence
 *
 * Covers the recurrence editor that's now wired into EventForm via a
 * collapsible "Récurrence" section. Tests enable recurrence, configure a
 * frequency + end condition, save, and verify the resulting `rrule` lands
 * on the event in the backend.
 *
 * API-based assertions (via `calendar.eventByTitle(title)`'s polling) are
 * preferred over DOM lookups — see calendar-manipulation.spec.ts for the
 * long story on why DOM assertions break for calendar events.
 */

import { test, expect } from "./fixtures";
import { CalendarPage } from "./pages/CalendarPage";
import { EventFormDialog } from "./pages/EventFormDialog";

function uniq(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Poll the backend for an event with the given title and return its rrule
 * string (or `null` if not found / no rrule). Scans all calendars belonging
 * to the current user in a ±2-month window around today.
 */
async function getEventRRule(
  page: import("@playwright/test").Page,
  title: string,
): Promise<string | null> {
  const calListResp = await page.request.get(
    "http://localhost:3011/api/v1/calendars",
  );
  if (!calListResp.ok()) return null;
  const cals = await calListResp.json().catch(() => null);
  const list = Array.isArray(cals) ? cals : (cals?.data ?? []);
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - 1);
  const end = new Date(now);
  end.setMonth(end.getMonth() + 3);
  for (const cal of list) {
    const resp = await page.request.get(
      `http://localhost:3011/api/v1/calendars/${cal.id}/events?start=${start.toISOString()}&end=${end.toISOString()}`,
    );
    if (!resp.ok()) continue;
    const body = await resp.json().catch(() => null);
    const events = Array.isArray(body) ? body : (body?.data ?? []);
    const found = events.find((e: { title?: string; rrule?: string }) =>
      (e.title ?? "").includes(title),
    );
    if (found) return found.rrule ?? null;
  }
  return null;
}

test.describe("Calendar — Recurrence", () => {
  let calendar: CalendarPage;
  let dialog: EventFormDialog;

  test.beforeEach(async ({ page }) => {
    calendar = new CalendarPage(page);
    dialog = new EventFormDialog(page);
    await calendar.goto();
    await calendar.switchView("Semaine").catch(() => {});
  });

  test("the recurrence section is present in the EventForm dialog", async ({
    page,
  }) => {
    await calendar.clickNewEvent();
    await dialog.waitOpen();
    // The dedicated data-testid anchors the section regardless of label
    // translation or reordering.
    await expect(page.getByTestId("event-recurrence-section")).toBeVisible();
    // The "Repeat" checkbox should be visible and unchecked by default.
    await expect(page.locator("#recurring")).toBeVisible();
    await expect(page.locator("#recurring")).not.toBeChecked();
    await dialog.cancel();
  });

  test("creates a daily recurring event", async ({ page }) => {
    const title = `Daily recurring ${uniq()}`;
    await calendar.clickNewEvent();
    await dialog.waitOpen();
    await dialog.fillTitle(title);

    // Enable recurrence via the "Repeat" checkbox
    await page.locator("#recurring").check();

    // Default frequency is WEEKLY per parseRRule's fallback — change to DAILY
    await page.locator("#frequency").click();
    await page.getByRole("option", { name: "Daily" }).click();

    // End after 5 occurrences
    await page.locator("#count").fill("5");

    await dialog.save();

    // The backend should persist an rrule containing FREQ=DAILY + COUNT=5
    const rrule = await getEventRRule(page, title);
    expect(rrule, "event should have an rrule set").toBeTruthy();
    expect(rrule).toContain("FREQ=DAILY");
    expect(rrule).toContain("COUNT=5");
  });

  test("creates a weekly recurring event on specific days", async ({
    page,
  }) => {
    const title = `Weekly Mon+Wed ${uniq()}`;
    await calendar.clickNewEvent();
    await dialog.waitOpen();
    await dialog.fillTitle(title);

    await page.locator("#recurring").check();

    // Frequency defaults to WEEKLY, so no change needed. Just pick the days.
    await page.locator("#day-MO").check();
    await page.locator("#day-WE").check();
    await page.locator("#count").fill("10");

    await dialog.save();

    const rrule = await getEventRRule(page, title);
    expect(rrule).toBeTruthy();
    expect(rrule).toContain("FREQ=WEEKLY");
    expect(rrule).toContain("BYDAY=");
    expect(rrule).toContain("MO");
    expect(rrule).toContain("WE");
    expect(rrule).toContain("COUNT=10");
  });

  test("creates a monthly recurring event", async ({ page }) => {
    const title = `Monthly recurring ${uniq()}`;
    await calendar.clickNewEvent();
    await dialog.waitOpen();
    await dialog.fillTitle(title);

    await page.locator("#recurring").check();
    await page.locator("#frequency").click();
    await page.getByRole("option", { name: "Monthly" }).click();
    await page.locator("#count").fill("12");

    await dialog.save();

    const rrule = await getEventRRule(page, title);
    expect(rrule).toBeTruthy();
    expect(rrule).toContain("FREQ=MONTHLY");
    expect(rrule).toContain("COUNT=12");
  });

  test("toggling recurrence off clears the rule", async ({ page }) => {
    const title = `Not recurring after toggle ${uniq()}`;
    await calendar.clickNewEvent();
    await dialog.waitOpen();
    await dialog.fillTitle(title);

    // Turn on → configure → turn off.
    await page.locator("#recurring").check();
    await page.locator("#frequency").click();
    await page.getByRole("option", { name: "Daily" }).click();
    await page.locator("#recurring").uncheck();

    await dialog.save();

    const rrule = await getEventRRule(page, title);
    // After toggling off, either no rrule or an empty/null one is acceptable.
    expect(rrule ?? "").toBe("");
  });
});
