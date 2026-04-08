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

import { test } from "./fixtures";
import { assertPageLoadsCleanly } from "./helpers/smoke";

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
  for (const { path, label } of IT_ASSETS_PAGES) {
    test(`${label} (${path}) loads without crashing`, async ({ page }) => {
      await assertPageLoadsCleanly(page, path);
    });
  }
});
