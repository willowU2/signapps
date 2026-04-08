/**
 * E2E Smoke — misc small modules
 *
 * Batches crash-only smoke coverage for 34 single-purpose modules that
 * have zero existing coverage. Each page is tested in isolation with
 * the shared `assertPageLoadsCleanly` helper.
 *
 * Excluded:
 *   - Dynamic `[id]` routes (crm/deals, forms/[id], poll/[id], bio/[username])
 *     — need real IDs and belong in dedicated integration specs.
 *   - Modules already covered by feature specs (calendar, docs, sheets,
 *     slides, mail, office, storage, tasks, ai, containers, design, keep).
 */

import { test } from "./fixtures";
import { assertPageLoadsCleanly } from "./helpers/smoke";

const MISC_PAGES: Array<{ path: string; label: string }> = [
  { path: "/accounting", label: "Accounting" },
  { path: "/analytics", label: "Analytics" },
  { path: "/analytics/custom", label: "Analytics — custom" },
  { path: "/app-store", label: "App store" },
  { path: "/automation", label: "Automation" },
  { path: "/backups", label: "Backups" },
  { path: "/billing", label: "Billing" },
  { path: "/bookmarks", label: "Bookmarks" },
  { path: "/chat", label: "Chat" },
  { path: "/compliance", label: "Compliance" },
  { path: "/crm", label: "CRM" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/data-management", label: "Data management" },
  { path: "/expenses", label: "Expenses" },
  { path: "/gamification", label: "Gamification" },
  { path: "/helpdesk", label: "Helpdesk" },
  { path: "/helpdesk/faq", label: "Helpdesk — FAQ" },
  { path: "/integrations", label: "Integrations" },
  { path: "/media", label: "Media" },
  { path: "/monitoring", label: "Monitoring" },
  { path: "/projects", label: "Projects" },
  { path: "/projects/gantt", label: "Projects — Gantt" },
  { path: "/projects/sprints", label: "Projects — Sprints" },
  { path: "/resources", label: "Resources" },
  { path: "/resources/my-reservations", label: "Resources — My reservations" },
  { path: "/scheduler", label: "Scheduler" },
  { path: "/scheduler/analytics", label: "Scheduler — Analytics" },
  { path: "/signatures", label: "Signatures" },
  { path: "/team", label: "Team" },
  { path: "/team/org-chart", label: "Team — Org chart" },
  { path: "/timesheet", label: "Timesheet" },
  { path: "/voice", label: "Voice" },
  { path: "/whiteboard", label: "Whiteboard" },
  { path: "/wiki", label: "Wiki" },
  { path: "/workforce", label: "Workforce" },
  { path: "/workforce/hr", label: "Workforce — HR" },
];

test.describe("Misc modules — smoke", () => {
  for (const { path, label } of MISC_PAGES) {
    test(`${label} (${path}) loads without crashing`, async ({ page }) => {
      await assertPageLoadsCleanly(page, path);
    });
  }
});
