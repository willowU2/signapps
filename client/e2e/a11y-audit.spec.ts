/**
 * A11y Audit Spec — Phase E1b
 *
 * Iterates all static authenticated routes + a handful of parameterized
 * public/auth routes, runs axe-core on each, serializes violations to
 *   docs/bug-sweep/a11y-axe-baseline.json
 *
 * This spec does NOT fail on violations — it only collects the baseline.
 * Phase E1c fixes reduce the count; the test can be promoted to a gate
 * once stable.
 *
 * Prerequisites:
 *   - All backend services running (just db-start + start-all.sh)
 *   - Dev server on http://localhost:3000 (cd client && npm run dev)
 *   - Authenticated storage state (auth.setup.ts runs automatically)
 *
 * Run:
 *   cd client && npx playwright test e2e/a11y-audit.spec.ts --project=chromium
 */
import { test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { ImpactValue } from "axe-core";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// ── Route inventory ─────────────────────────────────────────────────────────

/**
 * All static (non-parameterized) pages in src/app, stripped of Next.js
 * route group segments `(auth)/` and `(app)/`. Generated from:
 *   find src/app -name page.tsx | sed ...
 * at 2026-04-16. Kept in source so PR diffs show when routes are added.
 */
const STATIC_ROUTES: string[] = [
  "/",
  "/cal",
  "/cal/heatmap",
  "/metrics",
  "/account/connections",
  "/accounting",
  "/admin",
  "/admin/accessibility",
  "/admin/active-directory",
  "/admin/active-directory/certificates",
  "/admin/active-directory/computers",
  "/admin/active-directory/dc-management",
  "/admin/active-directory/deployment",
  "/admin/active-directory/dhcp",
  "/admin/active-directory/dns",
  "/admin/active-directory/domains",
  "/admin/active-directory/gpo",
  "/admin/active-directory/kerberos",
  "/admin/active-directory/security",
  "/admin/active-directory/snapshots",
  "/admin/active-directory/sync",
  "/admin/activity",
  "/admin/ai-cost",
  "/admin/ai-training",
  "/admin/ai/lightrag",
  "/admin/api-docs",
  "/admin/api-health",
  "/admin/api-marketplace",
  "/admin/api-platform",
  "/admin/api-playground",
  "/admin/api-quota",
  "/admin/audit",
  "/admin/backup",
  "/admin/backups",
  "/admin/branding",
  "/admin/companies",
  "/admin/container-resources",
  "/admin/cve",
  "/admin/db-explorer",
  "/admin/deploy",
  "/admin/deploy/feature-flags",
  "/admin/deploy/maintenance",
  "/admin/deploy/on-premise",
  "/admin/deploy/runtime-config",
  "/admin/devices",
  "/admin/email-templates",
  "/admin/feature-flags",
  "/admin/floorplans",
  "/admin/gamification",
  "/admin/groups",
  "/admin/integrations",
  "/admin/invitations",
  "/admin/license",
  "/admin/lms",
  "/admin/ml-config",
  "/admin/ml-training",
  "/admin/monitoring",
  "/admin/oauth-providers",
  "/admin/offline-devices",
  "/admin/onboarding",
  "/admin/org-structure",
  "/admin/organizations",
  "/admin/partners",
  "/admin/peer-mesh",
  "/admin/permissions",
  "/admin/persons",
  "/admin/platform",
  "/admin/prompts",
  "/admin/restore",
  "/admin/roles",
  "/admin/search",
  "/admin/security",
  "/admin/sessions",
  "/admin/settings",
  "/admin/system-health",
  "/admin/tenant",
  "/admin/tenants",
  "/admin/themes",
  "/admin/users",
  "/admin/users-list",
  "/admin/webhooks",
  "/ai",
  "/ai/hub",
  "/analytics",
  "/analytics/abtest",
  "/analytics/campaigns",
  "/analytics/funnels",
  "/analytics/journey",
  "/analytics/kpi",
  "/analytics/revenue",
  "/appstore",
  "/bio",
  "/board",
  "/bookmarks",
  "/cal/alerts",
  "/cal/events",
  "/cal/heatmap2",
  "/cal/presence-rules",
  "/cal/projects",
  "/cal/share",
  "/cal/tasks",
  "/cal/timesheets",
  "/changelog",
  "/chat",
  "/chat/unified",
  "/collaboration",
  "/comms/events",
  "/comms/intranet",
  "/comms/newsletter",
  "/comms/video-meeting",
  "/complete-profile",
  "/contacts",
  "/containers",
  "/crm",
  "/crm/deals",
  "/crm/leads",
  "/crm/pipeline",
  "/data-room",
  "/design",
  "/design/brand-kit",
  "/devices",
  "/docs",
  "/docs/new",
  "/domains",
  "/drive",
  "/drive/recent",
  "/drive/shared",
  "/drive/starred",
  "/drive/trash",
  "/entity",
  "/expenses",
  "/family",
  "/finance",
  "/finance/budgets",
  "/finance/expenses",
  "/finance/reports",
  "/flows",
  "/forms",
  "/forms/new",
  "/forms/templates",
  "/fund",
  "/gamification/leaderboard",
  "/help",
  "/hr",
  "/hr/onboarding",
  "/infrastructure",
  "/invoices",
  "/it/assets",
  "/it/changes",
  "/it/cmdb",
  "/it/incidents",
  "/it/monitoring",
  "/it/ops",
  "/it/problems",
  "/it/releases",
  "/keep",
  "/login",
  "/lms",
  "/lms/courses",
  "/logout",
  "/maintenance",
  "/mail",
  "/mail/rules",
  "/mail/server",
  "/mail/signatures",
  "/mail/templates",
  "/me",
  "/media",
  "/meet",
  "/members",
  "/my-business",
  "/n8n",
  "/newsroom",
  "/nodes",
  "/notifications",
  "/office",
  "/office/all",
  "/office/docs",
  "/office/favorites",
  "/office/presentations",
  "/office/recent",
  "/office/shared",
  "/office/sheets",
  "/office/trash",
  "/onboarding",
  "/org",
  "/payments",
  "/peer-mesh",
  "/preferences",
  "/presence",
  "/presentations",
  "/privacy",
  "/projects",
  "/proxy",
  "/pxe",
  "/reel",
  "/register",
  "/reports",
  "/resources",
  "/sample-viewer",
  "/scheduling",
  "/scheduling/board",
  "/scheduling/insights",
  "/search",
  "/settings",
  "/settings/payment-methods",
  "/settings/profile",
  "/settings/security",
  "/share",
  "/shared-with-me",
  "/shared-with-me/groups",
  "/shared-with-me/users",
  "/sheets",
  "/sheets/new",
  "/signatures",
  "/slides",
  "/slides/new",
  "/social",
  "/social/analytics",
  "/social/calendar",
  "/social/compose",
  "/social/feed",
  "/storage",
  "/subscription",
  "/tasks",
  "/tenant",
  "/terms",
  "/themes",
  "/tools",
  "/vault",
  "/vault/import",
  "/vault/passwords",
  "/vault/shared",
  "/wallet",
  "/whiteboard",
  "/wiki",
  "/workflows",
  "/workforce",
  "/workforce/hr",
];

/**
 * Parameterized routes with seed IDs. IDs come from tools/signapps-seed
 * known UUIDs. If the seed is absent, axe will hit a 404 or empty state
 * — still useful to catch layout-level a11y issues.
 */
const PARAM_ROUTES: string[] = ["/f/00000000-0000-0000-0000-000000000101"];

const ALL_ROUTES = [...STATIC_ROUTES, ...PARAM_ROUTES];

// ── The audit ───────────────────────────────────────────────────────────────

interface RouteResult {
  route: string;
  status: "ok" | "error";
  violations: Array<{
    id: string;
    impact: ImpactValue | undefined;
    help: string;
    helpUrl: string;
    nodes: number;
  }>;
  error?: string;
  timing_ms: number;
}

test.describe("A11y baseline audit", () => {
  test.describe.configure({ mode: "serial" });

  test("audit all routes with axe-core", async ({ page }) => {
    // ~30 min for 270 routes. Generous timeout.
    test.setTimeout(60 * 60 * 1000);

    const results: RouteResult[] = [];

    for (const route of ALL_ROUTES) {
      const started = Date.now();
      try {
        await page.goto(`http://localhost:3000${route}`, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });

        // Wait for real content before auditing (axe on an empty SPA
        // shell produces meaningless results). 20s gives client
        // components time to hydrate — the first visit per route in dev
        // mode triggers JIT compilation (~5-15s on slow pages).
        await page
          .locator(
            "main, nav, [data-slot='sidebar'], form, [data-page='login']",
          )
          .first()
          .waitFor({ state: "visible", timeout: 20_000 })
          .catch(() => {});

        const { violations } = await new AxeBuilder({ page })
          .disableRules([
            // color-contrast audit is a dedicated session (Tailwind v4
            // tokens). Too noisy at the design-system level.
            "color-contrast",
          ])
          .analyze();

        results.push({
          route,
          status: "ok",
          violations: violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            helpUrl: v.helpUrl,
            nodes: v.nodes.length,
          })),
          timing_ms: Date.now() - started,
        });
        console.log(
          `[${results.length}/${ALL_ROUTES.length}] ${route} — ${violations.length} violations (${Date.now() - started}ms)`,
        );
      } catch (err) {
        results.push({
          route,
          status: "error",
          violations: [],
          error: err instanceof Error ? err.message : String(err),
          timing_ms: Date.now() - started,
        });
        console.warn(
          `[${results.length}/${ALL_ROUTES.length}] ${route} — ERROR: ${err}`,
        );
      }
    }

    const outDir = path.resolve(__dirname, "..", "..", "docs", "bug-sweep");
    mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "a11y-axe-baseline.json");
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          total_routes: ALL_ROUTES.length,
          results,
        },
        null,
        2,
      ),
      "utf-8",
    );

    const totalViolations = results.reduce(
      (sum, r) => sum + r.violations.length,
      0,
    );
    console.log(
      `\n=== a11y audit complete ===\nRoutes: ${results.length}\nTotal violations: ${totalViolations}\nErrors: ${results.filter((r) => r.status === "error").length}\nOutput: ${outPath}\n`,
    );
  });
});
