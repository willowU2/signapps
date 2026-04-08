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

import { test } from "./fixtures";
import { assertPageLoadsCleanly } from "./helpers/smoke";

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
  for (const { path, label } of SETTINGS_PAGES) {
    test(`${label} (${path}) loads without crashing`, async ({ page }) => {
      await assertPageLoadsCleanly(page, path);
    });
  }
});
