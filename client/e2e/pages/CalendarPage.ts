import { type Page, type Locator, expect } from "@playwright/test";
import { BasePage } from "./BasePage";
import { dndKitDrag, resizeElementBottom } from "../helpers/drag";

/**
 * Page Object for the unified calendar at `/cal`.
 *
 * Required source data-testids (added in this commit):
 *   - calendar-view                    → CalendarHub root div
 *   - calendar-period-label            → date title span
 *   - calendar-event                   → each event card (Week + Month views)
 *   - day-cell-{YYYY-MM-DD}            → each MonthCalendar day cell
 *   - day-column-{YYYY-MM-DD}          → each WeekCalendar day column
 *
 * Navigation buttons use existing aria-labels from the source:
 *   - "Période précédente" / "Période suivante"
 *
 * View switching uses `<nav aria-label="Sélecteur de vue">` inside CalendarHub.
 *
 * Keyboard shortcuts (wired in CalendarHub useEffect):
 *   c=create, j=jour, s=semaine, m=mois, a=agenda, t=timeline, k=kanban,
 *   p=roster, x=tasks, v=availability, r=presence, Home=today,
 *   Delete/Backspace=delete selected, Ctrl+Z=undo delete.
 */
export class CalendarPage extends BasePage {
  get path(): string {
    return "/cal";
  }

  get readyIndicator(): Locator {
    return this.page.getByTestId("calendar-view");
  }

  // ───────────────────────────── Header / nav ─────────────────────────────

  get newEventButton(): Locator {
    return this.page.getByTestId("calendar-new-event-btn");
  }

  get todayButton(): Locator {
    return this.page.getByRole("button", { name: /Aujourd'?hui/i }).first();
  }

  get prevPeriodButton(): Locator {
    return this.page.getByRole("button", { name: "Période précédente" });
  }

  get nextPeriodButton(): Locator {
    return this.page.getByRole("button", { name: "Période suivante" });
  }

  get currentPeriodLabel(): Locator {
    return this.page.getByTestId("calendar-period-label");
  }

  // ───────────────────────────── Views ────────────────────────────────────

  /** Map from user-friendly French label → internal view id (data-view-id). */
  private static readonly VIEW_LABEL_TO_ID: Record<string, string> = {
    Jour: "day",
    Semaine: "week",
    Mois: "month",
    Agenda: "agenda",
    Frise: "timeline",
    Kanban: "kanban",
    Dispo: "heatmap",
    Planning: "roster",
    Tâches: "tasks",
    Disponibilité: "availability",
    Présence: "presence",
  };

  /**
   * Click a view tab. `labelOrId` accepts either the French label (Jour,
   * Semaine, Mois, Agenda, ...) or the raw view id (day, week, month, ...).
   * Uses the `data-view-id` attribute added to the source.
   */
  async switchView(labelOrId: string): Promise<void> {
    const id = CalendarPage.VIEW_LABEL_TO_ID[labelOrId] ?? labelOrId;
    // Scope to the desktop nav (hidden lg:flex) — at default Playwright viewport
    // (1280x720) this is the visible nav. Use .first() to be safe in case both
    // desktop + mobile navs match.
    await this.page.locator(`button[data-view-id="${id}"]`).first().click();
  }

  /** Assert that a given view is currently active (aria-pressed=true). */
  async expectViewActive(labelOrId: string): Promise<void> {
    const id = CalendarPage.VIEW_LABEL_TO_ID[labelOrId] ?? labelOrId;
    const btn = this.page.locator(`button[data-view-id="${id}"]`).first();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
  }

  // ───────────────────────────── Grid / events ────────────────────────────

  get events(): Locator {
    return this.page.getByTestId("calendar-event");
  }

  eventByTitle(title: string): Locator {
    return this.events.filter({ hasText: title });
  }

  /** Month-view day cell. */
  dayCell(isoDate: string): Locator {
    return this.page.getByTestId(`day-cell-${isoDate}`);
  }

  /** Week-view day column (used for drag-to-create positioning). */
  dayColumn(isoDate: string): Locator {
    return this.page.getByTestId(`day-column-${isoDate}`);
  }

  // ───────────────────────────── Navigation ───────────────────────────────

  async goToToday(): Promise<void> {
    await this.todayButton.click();
  }

  async goToPreviousPeriod(): Promise<void> {
    await this.prevPeriodButton.click();
  }

  async goToNextPeriod(): Promise<void> {
    await this.nextPeriodButton.click();
  }

  // ───────────────────────────── Create / edit / delete ──────────────────

  async clickNewEvent(): Promise<void> {
    await this.newEventButton.click();
  }

  /**
   * Single click on an existing event → selectEvent → edit form opens.
   *
   * Event cards are wrapped in @dnd-kit's `useDraggable`, whose pointer
   * listeners can swallow real clicks that Playwright synthesises too
   * fast (they look like drag starts). `dispatchEvent('click')` bypasses
   * pointer-event plumbing entirely and hands React a clean click, which
   * is the correct signal for `onClick → selectEvent → edit form`.
   */
  async clickEvent(title: string): Promise<void> {
    const target = this.eventByTitle(title).first();
    await target.scrollIntoViewIfNeeded().catch(() => {});
    await target.dispatchEvent("click");
  }

  /**
   * Drag-to-create: start at the given hour in a week-view day column and
   * drag vertically by `durationPx` pixels. Uses the column's bounding box
   * and the hourHeight data attribute to compute the start Y position.
   *
   * Example: dragToCreateInColumn('2026-04-08', 14, 120) → creates a ~2h
   * event starting at 14:00 in the 2026-04-08 column (hourHeight=60).
   */
  async dragToCreateInColumn(
    isoDate: string,
    startHour: number,
    durationPx: number,
  ): Promise<void> {
    const column = this.dayColumn(isoDate);
    const box = await column.boundingBox();
    if (!box)
      throw new Error(`dragToCreateInColumn: column ${isoDate} not found`);

    // hourHeight is exposed as data attribute (defaults to 60 if missing)
    const hourHeightAttr = await column.getAttribute("data-hour-height");
    const hourHeight = hourHeightAttr ? parseInt(hourHeightAttr, 10) : 60;

    const startX = box.x + box.width / 2;
    const startY = box.y + startHour * hourHeight + 4;
    const endY = startY + durationPx;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(startX + 2, startY + 3, { steps: 5 });
    await this.page.mouse.move(startX, endY, { steps: 15 });
    await this.page.mouse.up();
  }

  /**
   * Resize an existing event by dragging its bottom edge.
   *
   * The handle is only 12px tall and @dnd-kit's parent listeners can
   * intercept Playwright's mouse events before they reach the React
   * synthetic `onMouseDown` on the handle. We dispatch the mouse events
   * directly on the handle element in the page context, which bypasses
   * pointer-event routing and gives the handler a clean signal.
   */
  async resizeEventBy(eventTitle: string, deltaPx: number): Promise<void> {
    const eventLocator = this.eventByTitle(eventTitle).first();
    const handle = eventLocator.getByTestId("event-resize-handle");
    const handleEl = await handle.elementHandle();
    if (!handleEl)
      throw new Error(`resizeEventBy: handle not found for "${eventTitle}"`);

    await this.page.evaluate(
      ({ el, delta }) => {
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        const fire = (
          target: EventTarget,
          type: string,
          cy: number,
          buttons = 1,
        ) => {
          target.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              composed: true,
              view: window,
              button: 0,
              buttons,
              clientX: x,
              clientY: cy,
              screenX: x,
              screenY: cy,
            }),
          );
        };

        fire(el, "mousedown", y, 1);
        // Document-scoped move/up — the ResizeHandle attaches these listeners
        // on `document` once mousedown triggers, so subsequent events must
        // target document (not the element) to be caught.
        fire(document, "mousemove", y + 5, 1);
        fire(document, "mousemove", y + Math.floor(delta / 2), 1);
        fire(document, "mousemove", y + delta, 1);
        fire(document, "mouseup", y + delta, 0);
      },
      { el: handleEl, delta: deltaPx },
    );

    await this.page.waitForTimeout(500); // wait for PUT + re-render
  }

  /**
   * Move an event to a target day in MONTH view via drag & drop.
   *
   * Playwright's `locator.dragTo()` uses a multi-step mouse sequence that
   * works better with @dnd-kit than our manual helper, especially when the
   * draggable has an activation distance constraint.
   */
  async moveEventInMonthViewTo(
    eventTitle: string,
    targetIsoDate: string,
  ): Promise<void> {
    const source = this.eventByTitle(eventTitle).first();
    const target = this.dayCell(targetIsoDate);
    await source.dragTo(target, {
      force: true,
      // The source position defaults to the middle of the element, which is
      // fine for month view event cards.
    });
    // Give @dnd-kit's onDragEnd + the backend PUT + the re-render cycle
    // some time to complete before the test queries positions.
    await this.page.waitForTimeout(400);
  }

  // ───────────────────────────── Keyboard ─────────────────────────────────

  /**
   * Press a calendar keyboard shortcut.
   *
   * `page.keyboard.press()` routes events to the focused element — in our
   * layout nothing holds focus right after navigation, so keydown events
   * don't reliably propagate to the document-level listener registered by
   * CalendarHub. We bypass that by dispatching a synthetic KeyboardEvent
   * directly on `document`, which is exactly what a real key press would
   * do after bubbling.
   */
  async pressShortcutKey(key: string): Promise<void> {
    await this.page.evaluate((k) => {
      const ev = new KeyboardEvent("keydown", {
        key: k,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(ev);
    }, key);
  }

  async pressDelete(): Promise<void> {
    await this.page.evaluate(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Delete",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  }

  async pressUndo(): Promise<void> {
    await this.page.evaluate(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "z",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
  }

  // ───────────────────────────── Assertions helpers ───────────────────────

  /**
   * Assert an event with the given title exists in the backend.
   *
   * Using the API as the source of truth (instead of the DOM) avoids three
   * classes of flakiness we hit with DOM assertions:
   *   1. `toBeVisible` fails for events that render off-screen in the
   *      scrollable time grid (e.g. an event at 22:00 below the viewport).
   *   2. `MultiDayEventBars` caps rendered rows at `maxRows=3`, so events
   *      4+ on the same spatial slot never touch the DOM at all.
   *   3. Re-render timing (the DraggableEventCard detaches briefly while
   *      useEvents.setEvents replaces the list).
   *
   * Tests that specifically need to verify UI rendering should query the
   * DOM directly via `calendar.eventByTitle(title)` with a context-aware
   * locator (scroll into view first, pick a specific view, etc.).
   */
  async expectEventVisible(title: string): Promise<void> {
    await expect
      .poll(
        async () => {
          const calListResp = await this.page.request.get(
            "http://localhost:3011/api/v1/calendars",
          );
          if (!calListResp.ok()) return 0;
          const cals = await calListResp.json().catch(() => null);
          const list = Array.isArray(cals) ? cals : (cals?.data ?? []);
          let total = 0;
          for (const cal of list) {
            // Search a wide date window (±2 months) to catch events that
            // tests create outside the current week/month.
            const now = new Date();
            const start = new Date(now);
            start.setMonth(start.getMonth() - 1);
            const end = new Date(now);
            end.setMonth(end.getMonth() + 3);
            const eventsResp = await this.page.request.get(
              `http://localhost:3011/api/v1/calendars/${cal.id}/events?start=${start.toISOString()}&end=${end.toISOString()}`,
            );
            if (!eventsResp.ok()) continue;
            const body = await eventsResp.json().catch(() => null);
            const events = Array.isArray(body) ? body : (body?.data ?? []);
            total += events.filter((e: { title?: string }) =>
              (e.title ?? "").includes(title),
            ).length;
          }
          return total;
        },
        {
          timeout: 5000,
          message: `event "${title}" should exist in the backend`,
        },
      )
      .toBeGreaterThan(0);
  }

  async expectEventHidden(title: string): Promise<void> {
    await expect
      .poll(
        async () => {
          const calListResp = await this.page.request.get(
            "http://localhost:3011/api/v1/calendars",
          );
          if (!calListResp.ok()) return 0;
          const cals = await calListResp.json().catch(() => null);
          const list = Array.isArray(cals) ? cals : (cals?.data ?? []);
          let total = 0;
          for (const cal of list) {
            const now = new Date();
            const start = new Date(now);
            start.setMonth(start.getMonth() - 1);
            const end = new Date(now);
            end.setMonth(end.getMonth() + 3);
            const eventsResp = await this.page.request.get(
              `http://localhost:3011/api/v1/calendars/${cal.id}/events?start=${start.toISOString()}&end=${end.toISOString()}`,
            );
            if (!eventsResp.ok()) continue;
            const body = await eventsResp.json().catch(() => null);
            const events = Array.isArray(body) ? body : (body?.data ?? []);
            total += events.filter((e: { title?: string }) =>
              (e.title ?? "").includes(title),
            ).length;
          }
          return total;
        },
        {
          timeout: 5000,
          message: `event "${title}" should not exist in the backend`,
        },
      )
      .toBe(0);
  }
}
