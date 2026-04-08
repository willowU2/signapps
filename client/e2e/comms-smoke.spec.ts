/**
 * E2E Smoke — Comms (Internal Communications) module
 *
 * 9 pages covering company announcements, digital signage, mention
 * notifications, the news feed, newsletters, polls, suggestions, and
 * the teams directory.
 */

import { test } from "./fixtures";
import {
  assertPageLoadsCleanly,
  suppressOnboardingModals,
} from "./helpers/smoke";

const COMMS_PAGES: Array<{ path: string; label: string }> = [
  { path: "/comms", label: "Comms hub" },
  { path: "/comms/announcements", label: "Announcements" },
  { path: "/comms/digital-signage", label: "Digital signage" },
  { path: "/comms/mention-notifications", label: "Mention notifications" },
  { path: "/comms/news-feed", label: "News feed" },
  { path: "/comms/newsletter", label: "Newsletter" },
  { path: "/comms/polls", label: "Polls" },
  { path: "/comms/suggestions", label: "Suggestions" },
  { path: "/comms/teams-directory", label: "Teams directory" },
];

test.describe("Comms — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(suppressOnboardingModals());
  });

  for (const { path, label } of COMMS_PAGES) {
    test(`${label} (${path}) loads without crashing`, async ({ page }) => {
      await assertPageLoadsCleanly(page, path);
    });
  }
});
