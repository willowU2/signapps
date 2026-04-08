/**
 * E2E — Calendar Direct Manipulation
 *
 * Covers Section B of the calendar feature spec: all direct UI manipulations
 * that are now wired end-to-end in the source.
 *
 * Implemented in this PR:
 *   ✓ Create event via "+ Nouveau" button
 *   ✓ Create via single click on empty day/slot
 *   ✓ Drag-to-create on week view (DragCreateLayer wired to useDragCreate)
 *   ✓ Edit via single click on event (selectEvent → form)
 *   ✓ Resize by dragging bottom edge (ResizeHandle in DraggableEventCard)
 *   ✓ Drag & drop event between days in month view
 *   ✓ Delete via dialog Delete button
 *   ✓ Delete key on selected event (with undo toast)
 *   ✓ Ctrl+Z to undo delete (recreates the event)
 *   ✓ Keyboard shortcuts: c (create), j/s/m/a/t/k (view switching)
 *   ✓ Navigation prev/next/today via header buttons
 *   ✓ View switching via clicking view tabs
 */

import { test, expect, dismissDialogs } from "./fixtures";
import { CalendarPage } from "./pages/CalendarPage";
import { EventFormDialog } from "./pages/EventFormDialog";

// The "+ Nouveau" button is disabled when no calendar is selected, so we need
// to ensure at least one calendar exists for the admin user before the tests run.
// Cookies from storageState flow into page.request automatically.
let calendarEnsured = false;

async function ensureCalendarExists(
  page: import("@playwright/test").Page,
): Promise<void> {
  if (calendarEnsured) return;

  const base = "http://localhost:3011/api/v1";

  // List first
  const listResp = await page.request.get(`${base}/calendars`).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[ensureCalendarExists] GET failed:", e);
    return null;
  });
  if (listResp) {
    // eslint-disable-next-line no-console
    console.log("[ensureCalendarExists] GET status:", listResp.status());
    if (listResp.ok()) {
      const body = await listResp.json().catch(() => null);
      const cals = Array.isArray(body) ? body : (body?.data ?? []);
      // eslint-disable-next-line no-console
      console.log("[ensureCalendarExists] Existing calendars:", cals.length);
      if (cals.length > 0) {
        calendarEnsured = true;
        return;
      }
    }
  }

  // Create
  const postResp = await page.request
    .post(`${base}/calendars`, {
      data: {
        name: "E2E Calendar",
        description: "Auto-created for Playwright tests",
        color: "#3b82f6",
        timezone: "Europe/Paris",
        is_shared: false,
      },
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[ensureCalendarExists] POST failed:", e);
      return null;
    });

  if (postResp) {
    // eslint-disable-next-line no-console
    console.log("[ensureCalendarExists] POST status:", postResp.status());
    if (!postResp.ok()) {
      const text = await postResp.text().catch(() => "<unreadable>");
      // eslint-disable-next-line no-console
      console.error("[ensureCalendarExists] POST body:", text.slice(0, 500));
    }
  }

  calendarEnsured = true;
}

/**
 * Generates a unique suffix so test titles don't collide across runs.
 * Events persist in the DB between runs (no cleanup), so reusing a title
 * like "Titre original" finds ghosts from prior runs.
 */
function uniq(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

test.describe("Calendar — Direct manipulation", () => {
  let calendar: CalendarPage;
  let dialog: EventFormDialog;

  test.beforeEach(async ({ page }) => {
    // The ChangelogDialog component is mounted TWICE (header + global-header),
    // each with its own local React state, and auto-opens via setTimeout(2s).
    // We belt-and-brace this three ways:
    //   1. Pre-populate localStorage with the "seen" version (useEffect early-out)
    //   2. Inject CSS to hide any Radix portal with the "Quoi de neuf ?" title
    //   3. Dismiss any remaining blocking dialog via dismissDialogs()
    await page.addInitScript(() => {
      try {
        localStorage.setItem("signapps-changelog-seen", "2.6.0");
        localStorage.setItem(
          "signapps-onboarding-completed",
          new Date().toISOString(),
        );
        localStorage.setItem("signapps-onboarding-dismissed", "true");
        localStorage.setItem("signapps_initialized", new Date().toISOString());
        localStorage.setItem("signapps_seed_dismissed", "true");
      } catch {
        // ignore
      }
    });

    await ensureCalendarExists(page);
    calendar = new CalendarPage(page);
    dialog = new EventFormDialog(page);
    await calendar.goto();
    // Default tests to Week view — Month view truncates to 4 events/day which
    // hides recently-created events behind "X autres" overflow and breaks
    // `expectEventVisible`. Tests that specifically need Month view switch to
    // it explicitly inside the test body.
    await calendar.switchView("Semaine").catch(() => {});

    // Inject CSS that forcibly hides any Radix Dialog whose content includes
    // "Quoi de neuf" — also hides the backdrop overlay so the grid is interactive.
    await page
      .addStyleTag({
        content: `
        [role="dialog"]:has(h2:has-text("Quoi de neuf")),
        [data-state="open"][role="dialog"]:has(:has-text("Quoi de neuf")),
        [data-radix-popper-content-wrapper]:has(:has-text("Quoi de neuf")) {
          display: none !important;
        }
      `.trim(),
      })
      .catch(() => {
        // addStyleTag may reject on strict CSP; ignore.
      });

    // JS-level removal as a safety net (CSS :has is fine in modern Chrome but
    // fragile with :has-text — Playwright-only syntax, not real CSS).
    await page.evaluate(() => {
      const removeChangelogs = () => {
        document.querySelectorAll('[role="dialog"]').forEach((el) => {
          if (el.textContent?.includes("Quoi de neuf")) {
            (el as HTMLElement).style.display = "none";
            // Also remove the backdrop
            let parent = el.parentElement;
            while (parent && parent !== document.body) {
              if (parent.getAttribute?.("data-state") === "open") {
                (parent as HTMLElement).style.display = "none";
              }
              parent = parent.parentElement;
            }
          }
        });
      };
      removeChangelogs();
      // Set up a mutation observer to kill any dialog that appears LATER
      // (the ChangelogDialog has a 2s setTimeout before opening).
      const mo = new MutationObserver(() => removeChangelogs());
      mo.observe(document.body, { childList: true, subtree: true });
      // Also run again after 3s to be sure the delayed modal is caught
      setTimeout(removeChangelogs, 3000);
    });

    await dismissDialogs(page);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CREATION
  // ─────────────────────────────────────────────────────────────────────────

  test('creates event via "+ Nouveau" button', async () => {
    await calendar.clickNewEvent();
    await dialog.createSimpleEvent("Réunion équipe E2E");
    await calendar.expectEventVisible("Réunion équipe E2E");
  });

  test("cancels event creation without persisting", async () => {
    await calendar.clickNewEvent();
    await dialog.waitOpen();
    await dialog.fillTitle("Should not appear");
    await dialog.cancel();
    await calendar.expectEventHidden("Should not appear");
  });

  test('creates event via "c" keyboard shortcut', async () => {
    await calendar.pressShortcutKey("c");
    await dialog.createSimpleEvent("Créé via raccourci");
    await calendar.expectEventVisible("Créé via raccourci");
  });

  test("creates event via drag-to-create on week view day column", async () => {
    await calendar.switchView("Semaine");
    await calendar.expectViewActive("Semaine");

    // Drag from 5:00 down by 120 pixels → ~2h duration. Hour 5 (Y ≈ 300px
    // from the column top) is always within the default-visible region of
    // the time grid, regardless of viewport/scroll position.
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await calendar.dragToCreateInColumn(iso, 5, 120);

    // Drag-create opens the EventForm pre-filled with the drag selection's start/end
    await dialog.waitOpen();
    await dialog.fillTitle("Atelier drag-to-create");
    await dialog.save();

    await calendar.expectEventVisible("Atelier drag-to-create");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EDIT
  // ─────────────────────────────────────────────────────────────────────────

  test("opens edit form on event click and updates title", async () => {
    const id = uniq();
    const before = `Titre original ${id}`;
    const after = `Titre modifié ${id}`;

    await calendar.clickNewEvent();
    await dialog.createSimpleEvent(before);

    await calendar.clickEvent(before);
    await dialog.waitOpen();
    await dialog.fillTitle(after);
    await dialog.save();

    await calendar.expectEventHidden(before);
    await calendar.expectEventVisible(after);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RESIZE
  // ─────────────────────────────────────────────────────────────────────────

  test("resizes an event by dragging its bottom edge (week view)", async ({
    page,
  }) => {
    const title = `Event à redimensionner ${uniq()}`;

    // Seed the event via the API so we don't fight with form state or
    // month-view overflow. Use the same "future month" pattern as the move
    // test to keep this test isolated from other tests' events on today.
    const futureDay = new Date();
    futureDay.setMonth(futureDay.getMonth() + 2);
    futureDay.setDate(10);
    futureDay.setHours(5, 0, 0, 0);
    const endTime = new Date(futureDay);
    endTime.setHours(6); // initial duration = 1h

    const calListResp = await page.request.get(
      "http://localhost:3011/api/v1/calendars",
    );
    expect(calListResp.ok()).toBeTruthy();
    const calListBody = await calListResp.json();
    const cals = Array.isArray(calListBody)
      ? calListBody
      : (calListBody?.data ?? []);
    const calendarId: string = cals[0].id;

    const seedResp = await page.request.post(
      `http://localhost:3011/api/v1/calendars/${calendarId}/events`,
      {
        data: {
          title,
          start_time: futureDay.toISOString(),
          end_time: endTime.toISOString(),
          is_all_day: false,
          timezone: "Europe/Paris",
        },
      },
    );
    expect(seedResp.ok()).toBeTruthy();
    const seeded = await seedResp.json();
    const eventId: string = seeded.id ?? seeded.data?.id;
    expect(eventId).toBeTruthy();
    const originalEndTime: string = seeded.end_time ?? seeded.data?.end_time;

    // Navigate the UI to the seeded event's week.
    await calendar.switchView("Semaine");
    const startLabel =
      (await calendar.currentPeriodLabel.textContent())?.trim() ?? "";
    // Jump to the future week — navigateForward in week view advances 7 days,
    // so ~9 clicks covers 2 months.
    for (let i = 0; i < 9; i++) {
      await calendar.goToNextPeriod();
    }
    await expect
      .poll(
        async () => (await calendar.currentPeriodLabel.textContent())?.trim(),
        { timeout: 3000 },
      )
      .not.toBe(startLabel);

    // The event should be visible at 5:00 on the seeded day.
    await calendar.expectEventVisible(title);

    // Trigger the resize via the ResizeHandle's mouse events. The backend
    // PUT happens asynchronously; we verify SUCCESS by polling the API
    // for the event's end_time to advance, NOT by re-measuring the DOM
    // element (which is briefly detached during the refetch cycle and
    // breaks `toBeVisible` timing).
    await calendar.resizeEventBy(title, 60);

    await expect
      .poll(
        async () => {
          const resp = await page.request.get(
            `http://localhost:3011/api/v1/events/${eventId}`,
          );
          if (!resp.ok()) return null;
          const body = await resp.json();
          const ev = body?.data ?? body;
          return ev.end_time;
        },
        {
          timeout: 5000,
          message: "event end_time should advance after resize",
        },
      )
      .not.toBe(originalEndTime);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE — via dialog button
  // ─────────────────────────────────────────────────────────────────────────

  test("deletes an event via the dialog delete button", async () => {
    const title = `Event à supprimer ${uniq()}`;
    await calendar.clickNewEvent();
    await dialog.createSimpleEvent(title);
    await calendar.expectEventVisible(title);

    await calendar.clickEvent(title);
    await dialog.delete();
    await calendar.expectEventHidden(title);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE via Delete key + UNDO via Ctrl+Z
  // ─────────────────────────────────────────────────────────────────────────

  test("deletes selected event via Delete key then restores via Ctrl+Z", async ({
    page,
  }) => {
    const title = `Event temporaire ${uniq()}`;
    await calendar.clickNewEvent();
    await dialog.createSimpleEvent(title);
    await calendar.expectEventVisible(title);

    // Click to select (updates selectedEventId in the store). Also opens the
    // edit form via useEffect — cancel it so formOpen=false lets the keyboard
    // handler fire.
    await calendar.clickEvent(title);
    await dialog.waitOpen();
    await dialog.cancel();

    // selectedEventId is still set after cancel (we changed that intentionally).
    await calendar.pressDelete();
    await calendar.expectEventHidden(title);

    // Toast should announce the undo option.
    await expect(page.getByText(/supprimé/i).first()).toBeVisible({
      timeout: 3000,
    });

    // Ctrl+Z recreates the event via calendarApi.
    await calendar.pressUndo();
    await calendar.expectEventVisible(title);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────────────────────────────────

  test("navigates prev → next → today via header buttons", async () => {
    await calendar.switchView("Mois");

    const initialLabel =
      (await calendar.currentPeriodLabel.textContent())?.trim() ?? "";

    await calendar.goToNextPeriod();
    const nextLabel =
      (await calendar.currentPeriodLabel.textContent())?.trim() ?? "";
    expect(nextLabel).not.toBe(initialLabel);

    await calendar.goToPreviousPeriod();
    await calendar.goToPreviousPeriod();
    const prevLabel =
      (await calendar.currentPeriodLabel.textContent())?.trim() ?? "";
    expect(prevLabel).not.toBe(initialLabel);
    expect(prevLabel).not.toBe(nextLabel);

    await calendar.goToToday();
    const todayLabel =
      (await calendar.currentPeriodLabel.textContent())?.trim() ?? "";
    expect(todayLabel).toBe(initialLabel);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW SWITCHING — via UI click
  // ─────────────────────────────────────────────────────────────────────────

  test("switches views via navigation tabs (Jour / Semaine / Mois / Agenda)", async () => {
    await calendar.switchView("Jour");
    await calendar.expectViewActive("Jour");

    await calendar.switchView("Semaine");
    await calendar.expectViewActive("Semaine");

    await calendar.switchView("Mois");
    await calendar.expectViewActive("Mois");

    await calendar.switchView("Agenda");
    await calendar.expectViewActive("Agenda");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW SWITCHING — via keyboard shortcuts
  // ─────────────────────────────────────────────────────────────────────────

  test('keyboard shortcut "j" switches to Day view', async () => {
    await calendar.pressShortcutKey("j");
    await calendar.expectViewActive("Jour");
  });

  test('keyboard shortcut "s" switches to Week view', async () => {
    await calendar.pressShortcutKey("s");
    await calendar.expectViewActive("Semaine");
  });

  test('keyboard shortcut "m" switches to Month view', async () => {
    await calendar.pressShortcutKey("m");
    await calendar.expectViewActive("Mois");
  });

  test('keyboard shortcut "a" switches to Agenda view', async () => {
    await calendar.pressShortcutKey("a");
    await calendar.expectViewActive("Agenda");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DRAG & DROP — month view (only view with DndContext drop targets wired)
  // ─────────────────────────────────────────────────────────────────────────

  test("moves an event between days in month view", async ({ page }) => {
    const title = `Event à déplacer ${uniq()}`;

    // Rather than racing against form state and Month-view's 4-events/cell
    // overflow, seed the event directly via the calendar API on a date two
    // months ahead — where no other test writes. Then navigate the UI there
    // and drag it. This isolates the drag-drop interaction from all the
    // create-flow fragility we've debugged elsewhere.
    const futureMonth = new Date();
    futureMonth.setMonth(futureMonth.getMonth() + 2);
    futureMonth.setDate(10);
    futureMonth.setHours(10, 0, 0, 0);
    const endTime = new Date(futureMonth);
    endTime.setHours(11);
    const targetDate = new Date(futureMonth);
    targetDate.setDate(15);

    // Find the first calendar belonging to this user so we can seed into it.
    const calListResp = await page.request.get(
      "http://localhost:3011/api/v1/calendars",
    );
    expect(calListResp.ok()).toBeTruthy();
    const calListBody = await calListResp.json();
    const cals = Array.isArray(calListBody)
      ? calListBody
      : (calListBody?.data ?? []);
    expect(cals.length).toBeGreaterThan(0);
    const calendarId: string = cals[0].id;

    // Seed the event.
    const seedResp = await page.request.post(
      `http://localhost:3011/api/v1/calendars/${calendarId}/events`,
      {
        data: {
          title,
          start_time: futureMonth.toISOString(),
          end_time: endTime.toISOString(),
          is_all_day: false,
          timezone: "Europe/Paris",
        },
      },
    );
    expect(
      seedResp.ok(),
      `event seed failed (${seedResp.status()})`,
    ).toBeTruthy();

    // Switch to Month view, navigate two months forward so the seeded event
    // is visible, and wait for the period label to actually update before
    // touching the grid.
    await calendar.switchView("Mois");
    await calendar.expectViewActive("Mois");
    const startLabel =
      (await calendar.currentPeriodLabel.textContent())?.trim() ?? "";
    await calendar.goToNextPeriod();
    await calendar.goToNextPeriod();
    await expect
      .poll(
        async () => (await calendar.currentPeriodLabel.textContent())?.trim(),
        { timeout: 3000 },
      )
      .not.toBe(startLabel);

    // The seeded event should now be visible in the future month cell.
    await calendar.expectEventVisible(title);
    const eventBeforeBox = await calendar
      .eventByTitle(title)
      .first()
      .boundingBox();
    expect(eventBeforeBox).not.toBeNull();

    // Drag it to day 15 of the same future month.
    const toIso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
    const targetIso = toIso(targetDate);
    await calendar.moveEventInMonthViewTo(title, targetIso);
    await page.waitForTimeout(600); // @dnd-kit dragEnd + PUT + refetch

    // Event still visible, and its X position changed → drop target was hit.
    await calendar.expectEventVisible(title);
    const eventAfterBox = await calendar
      .eventByTitle(title)
      .first()
      .boundingBox();
    expect(eventAfterBox).not.toBeNull();
    if (eventBeforeBox && eventAfterBox) {
      expect(Math.abs(eventAfterBox.x - eventBeforeBox.x)).toBeGreaterThan(30);
    }
  });
});
