/**
 * E2E — Calendar Ecosystem (Import / Export)
 *
 * Tests the ImportDialog and ExportDialog wiring into CalendarHub. Both
 * dialogs existed as components but were only used by the Tasks page —
 * this commit mounts them in the calendar UI too.
 *
 * Full import/export round-trips (file upload, backend parsing, download
 * verification) are partially covered — we verify the dialogs open, expose
 * their controls, and can be dismissed. End-to-end file round-trips belong
 * in a dedicated integration spec.
 */

import { test, expect } from "./fixtures";
import { CalendarPage } from "./pages/CalendarPage";

test.describe("Calendar — Ecosystem (import/export)", () => {
  let calendar: CalendarPage;

  test.beforeEach(async ({ page }) => {
    calendar = new CalendarPage(page);
    await calendar.goto();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Import
  // ─────────────────────────────────────────────────────────────────────────

  test("the import button is visible and opens the ImportDialog", async ({
    page,
  }) => {
    const importBtn = page.getByTestId("calendar-import-btn");
    await expect(importBtn).toBeVisible();
    await expect(importBtn).toBeEnabled();

    await importBtn.click();
    await expect(
      page.getByRole("heading", { name: /Import Calendar/i }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: /Import Calendar/i }),
    ).toBeHidden();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────────────────────────────────

  test("the export button is visible and opens the ExportDialog", async ({
    page,
  }) => {
    const exportBtn = page.getByTestId("calendar-export-btn");
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();

    await exportBtn.click();
    await expect(
      page.getByRole("heading", { name: /Export Calendar/i }),
    ).toBeVisible();
  });

  test("ExportDialog exposes both .ics and .json format radios", async ({
    page,
  }) => {
    await page.getByTestId("calendar-export-btn").click();
    await expect(
      page.getByRole("heading", { name: /Export Calendar/i }),
    ).toBeVisible();

    // Both format radios are present
    await expect(page.locator("#format-ics")).toBeVisible();
    await expect(page.locator("#format-json")).toBeVisible();

    // .ics is the default selection
    await expect(page.locator("#format-ics")).toBeChecked();
    // The filename preview reflects the selected format
    await expect(page.getByText(/calendar\.ics/)).toBeVisible();

    // Switching to JSON updates the filename preview
    await page.locator("#format-json").click();
    await expect(page.locator("#format-json")).toBeChecked();
    await expect(page.getByText(/calendar\.json/)).toBeVisible();

    await page.keyboard.press("Escape");
  });

  test("switching export format toggles the format-specific help text", async ({
    page,
  }) => {
    await page.getByTestId("calendar-export-btn").click();
    await expect(
      page.getByRole("heading", { name: /Export Calendar/i }),
    ).toBeVisible();

    // Default (.ics) shows the iCalendar-compatible help text
    await expect(
      page.getByText(/Standard format supported by all calendar apps/i),
    ).toBeVisible();

    // Switch to JSON
    await page.locator("#format-json").click();
    // The iCalendar help text disappears
    await expect(
      page.getByText(/Standard format supported by all calendar apps/i),
    ).toBeHidden();

    await page.keyboard.press("Escape");
  });
});
