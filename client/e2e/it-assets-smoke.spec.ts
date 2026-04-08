/**
 * E2E Smoke — IT Assets module
 *
 * 25 pages in the `it-assets/` route tree covering device fleet management,
 * CMDB, MDM, network monitoring, automation, patches, etc. Zero existing
 * coverage — this spec adds a crash-only smoke test for every route.
 *
 * Each page loads via direct navigation, the HTTP response is verified 2xx,
 * the body hydrates with visible content, and uncaught page errors are
 * captured. Form interactions and data assertions are intentionally out
 * of scope; this is a net for regressions that break an entire page.
 */

import { test, expect, dismissDialogs } from "./fixtures";

const IT_ASSETS_PAGES: Array<{ path: string; label: string }> = [
  { path: "/it-assets", label: "IT Assets hub" },
  { path: "/it-assets/automation", label: "Automation" },
  { path: "/it-assets/changes", label: "Changes" },
  { path: "/it-assets/cloud", label: "Cloud" },
  { path: "/it-assets/cmdb", label: "CMDB" },
  { path: "/it-assets/compliance", label: "Compliance" },
  { path: "/it-assets/fleet", label: "Fleet" },
  { path: "/it-assets/groups", label: "Groups" },
  { path: "/it-assets/map", label: "Map" },
  { path: "/it-assets/mdm", label: "MDM" },
  { path: "/it-assets/monitoring", label: "Monitoring" },
  { path: "/it-assets/monitors", label: "Monitors" },
  { path: "/it-assets/network", label: "Network" },
  { path: "/it-assets/onboarding", label: "Onboarding" },
  { path: "/it-assets/packages", label: "Packages" },
  { path: "/it-assets/patches", label: "Patches" },
  { path: "/it-assets/playbooks", label: "Playbooks" },
  { path: "/it-assets/policies", label: "Policies" },
  { path: "/it-assets/printers", label: "Printers" },
  { path: "/it-assets/reports", label: "Reports" },
  { path: "/it-assets/runbooks", label: "Runbooks" },
  { path: "/it-assets/scan", label: "Scan" },
  { path: "/it-assets/scripts", label: "Scripts" },
  { path: "/it-assets/tickets", label: "Tickets" },
  { path: "/it-assets/vendors", label: "Vendors" },
];

test.describe("IT Assets — smoke", () => {
  test.beforeEach(async ({ page }) => {
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

  for (const { path, label } of IT_ASSETS_PAGES) {
    test(`${label} (${path}) loads without crashing`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
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
      expect(response?.status() ?? 0, `HTTP status for ${path}`).toBeLessThan(
        400,
      );

      await page.waitForLoadState("domcontentloaded");
      await dismissDialogs(page);

      const bodyText = (await page.locator("body").textContent()) ?? "";
      expect(
        bodyText.trim().length,
        `body text length at ${path}`,
      ).toBeGreaterThan(50);

      await expect(
        page.getByText(
          /^404$|Page not found|Une erreur est survenue|Something went wrong/i,
        ),
      ).toHaveCount(0);

      expect(errors, `uncaught page errors at ${path}`).toEqual([]);
    });
  }
});
