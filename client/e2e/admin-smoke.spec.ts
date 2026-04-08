/**
 * E2E Smoke — Admin module
 *
 * The largest module in the app — 70+ static pages covering tenant
 * management, RBAC, API platform, security, monitoring, Active Directory,
 * GDPR, the database explorer, and dozens of operational surfaces.
 *
 * Dynamic routes (`[id]` segments under floorplans, etc.) are excluded —
 * they require real IDs and belong in dedicated integration specs.
 */

import { test } from "./fixtures";
import {
  assertPageLoadsCleanly,
  suppressOnboardingModals,
} from "./helpers/smoke";

const ADMIN_PAGES: Array<{ path: string; label: string }> = [
  { path: "/admin", label: "Admin hub" },
  { path: "/admin/accessibility", label: "Accessibility" },
  { path: "/admin/activity", label: "Activity log" },
  { path: "/admin/active-directory", label: "Active Directory" },
  { path: "/admin/active-directory/certificates", label: "AD — Certificates" },
  { path: "/admin/active-directory/computers", label: "AD — Computers" },
  {
    path: "/admin/active-directory/dc-management",
    label: "AD — DC Management",
  },
  { path: "/admin/active-directory/deployment", label: "AD — Deployment" },
  { path: "/admin/active-directory/dhcp", label: "AD — DHCP" },
  { path: "/admin/active-directory/dns", label: "AD — DNS" },
  { path: "/admin/active-directory/domains", label: "AD — Domains" },
  { path: "/admin/active-directory/gpo", label: "AD — GPO" },
  { path: "/admin/active-directory/kerberos", label: "AD — Kerberos" },
  { path: "/admin/active-directory/security", label: "AD — Security" },
  { path: "/admin/active-directory/snapshots", label: "AD — Snapshots" },
  { path: "/admin/active-directory/sync", label: "AD — Sync" },
  { path: "/admin/ai-cost", label: "AI cost" },
  { path: "/admin/ai-training", label: "AI training" },
  { path: "/admin/ai/lightrag", label: "AI — LightRAG" },
  { path: "/admin/api-docs", label: "API docs" },
  { path: "/admin/api-health", label: "API health" },
  { path: "/admin/api-marketplace", label: "API marketplace" },
  { path: "/admin/api-platform", label: "API platform" },
  { path: "/admin/api-playground", label: "API playground" },
  { path: "/admin/api-quota", label: "API quota" },
  { path: "/admin/audit", label: "Audit" },
  { path: "/admin/backup", label: "Backup" },
  { path: "/admin/backups", label: "Backups list" },
  { path: "/admin/branding", label: "Branding" },
  { path: "/admin/container-resources", label: "Container resources" },
  { path: "/admin/cve", label: "CVE tracking" },
  { path: "/admin/db-explorer", label: "DB explorer" },
  { path: "/admin/developer-tools", label: "Developer tools" },
  { path: "/admin/drive-audit", label: "Drive audit" },
  { path: "/admin/email-analytics", label: "Email analytics" },
  { path: "/admin/email-templates", label: "Email templates" },
  { path: "/admin/entity-hub", label: "Entity hub" },
  { path: "/admin/env-config", label: "Env config" },
  { path: "/admin/feature-flags", label: "Feature flags" },
  { path: "/admin/file-types", label: "File types" },
  { path: "/admin/floorplans", label: "Floorplans" },
  { path: "/admin/gdpr", label: "GDPR" },
  { path: "/admin/graphql", label: "GraphQL" },
  { path: "/admin/groups", label: "Groups" },
  { path: "/admin/health", label: "Health" },
  { path: "/admin/i18n", label: "i18n" },
  { path: "/admin/import-export", label: "Import / export" },
  { path: "/admin/job-velocity", label: "Job velocity" },
  { path: "/admin/ldap", label: "LDAP" },
  { path: "/admin/logs", label: "Logs" },
  { path: "/admin/mail-server", label: "Mail server" },
  { path: "/admin/migrations", label: "Migrations" },
  { path: "/admin/monitoring", label: "Monitoring" },
  { path: "/admin/org-structure", label: "Org structure" },
  { path: "/admin/persons", label: "Persons" },
  { path: "/admin/quota", label: "Quota" },
  { path: "/admin/reports", label: "Reports" },
  { path: "/admin/resources", label: "Resources" },
  { path: "/admin/roles", label: "Roles" },
  { path: "/admin/security", label: "Security" },
  { path: "/admin/services", label: "Services" },
  { path: "/admin/settings", label: "Admin settings" },
  { path: "/admin/sharing-audit", label: "Sharing audit" },
  { path: "/admin/sharing-templates", label: "Sharing templates" },
  { path: "/admin/sites", label: "Sites" },
  { path: "/admin/storage", label: "Storage" },
  { path: "/admin/swagger", label: "Swagger" },
  { path: "/admin/tenant", label: "Tenant" },
  { path: "/admin/user-activity", label: "User activity" },
  { path: "/admin/users", label: "Users" },
  { path: "/admin/webhooks", label: "Webhooks" },
  { path: "/admin/workflows", label: "Workflows" },
  { path: "/admin/workspaces", label: "Workspaces" },
];

test.describe("Admin — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(suppressOnboardingModals());
  });

  for (const { path, label } of ADMIN_PAGES) {
    test(`${label} (${path}) loads without crashing`, async ({ page }) => {
      await assertPageLoadsCleanly(page, path);
    });
  }
});
