/**
 * E2E Smoke — Settings module
 *
 * The settings module has 11 user-facing pages and zero E2E coverage today.
 * This spec is a **smoke test** — it loads each route, asserts the app shell
 * rendered (no white page / crash / 404), and checks for the absence of
 * obvious error states. It does NOT exercise the forms/actions within each
 * page — that depth belongs in dedicated per-page specs.
 *
 * Goal: catch regressions that break an entire settings page (broken import,
 * unhandled promise rejection, missing provider, etc.) without the cost of
 * writing detailed interactions for every surface.
 */

import { test, expect, dismissDialogs } from "./fixtures";

/**
 * Pages under `/settings`. The OAuth callback (`/settings/calendar/callback`)
 * is intentionally excluded — it's not reachable by direct navigation, only
 * by the provider after an OAuth round-trip.
 */
const SETTINGS_PAGES: Array<{ path: string; label: string }> = [
  { path: "/settings", label: "Main settings hub" },
  { path: "/settings/appearance", label: "Appearance" },
  { path: "/settings/calendar", label: "Calendar integration" },
  { path: "/settings/data-export", label: "Data export" },
  { path: "/settings/integrations", label: "Integrations" },
  { path: "/settings/interop", label: "Interoperability" },
  { path: "/settings/notifications", label: "Notifications" },
  { path: "/settings/preferences", label: "Preferences" },
  { path: "/settings/profile", label: "Profile" },
  { path: "/settings/security", label: "Security" },
  { path: "/settings/webhooks", label: "Webhooks" },
];

test.describe("Settings — smoke", () => {
  test.beforeEach(async ({ page }) => {
    // Pre-dismiss the changelog modal (see calendar-manipulation.spec.ts).
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
  });

  for (const { path, label } of SETTINGS_PAGES) {
    test(`${label} (${path}) loads without crashing`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      // Ignore noisy React / Next / dev-only warnings but capture real errors.
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          if (
            text.includes("Failed to load resource") ||
            text.includes("favicon") ||
            text.includes("Download the React DevTools")
          ) {
            return;
          }
          errors.push(`[console] ${text}`);
        }
      });

      const response = await page.goto(path);
      // 2xx or 3xx — some routes may redirect (e.g. / → /dashboard before
      // the AppLayout kicks in). A 4xx/5xx is a smoke failure.
      expect(response?.status() ?? 0, `HTTP status for ${path}`).toBeLessThan(
        400,
      );

      // Wait for the app shell to hydrate.
      await page.waitForLoadState("domcontentloaded");
      await dismissDialogs(page);

      // The main <body> should have content (no blank page).
      const bodyText = (await page.locator("body").textContent()) ?? "";
      expect(
        bodyText.trim().length,
        `body text length at ${path}`,
      ).toBeGreaterThan(50);

      // No explicit error fallbacks in view.
      await expect(
        page.getByText(
          /^404$|Page not found|Une erreur est survenue|Something went wrong/i,
        ),
      ).toHaveCount(0);

      // No uncaught JS errors captured during the nav.
      expect(errors, `uncaught page errors at ${path}`).toEqual([]);
    });
  }
});
