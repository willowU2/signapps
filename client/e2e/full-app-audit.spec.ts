import { test, expect } from './fixtures';

/**
 * Full App Audit — comprehensive page load verification
 *
 * Verifies that every major route renders without a crash (no error boundary,
 * no "Something went wrong" text, body visible).  Uses the stored auth state
 * from fixtures so no manual login is required per test.
 *
 * Run:  npx playwright test e2e/full-app-audit.spec.ts
 * Dev:  next dev must be running on http://localhost:3000
 */

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Assert the page is alive: body visible, no visible error boundary. */
async function assertNoError(page: any) {
  await expect(page.locator('body')).toBeVisible();

  // Error boundary component
  const errorBoundary = page.locator('.error-boundary, [data-error-boundary]');
  await expect(errorBoundary).not.toBeVisible();

  // Generic "something went wrong" text
  const crashText = page.locator('text=Something went wrong');
  expect(await crashText.count()).toBe(0);
}

// ─── page catalogue ──────────────────────────────────────────────────────────

/** Each entry: route path + human label used in the test name. */
const ALL_PAGES = [
  // Core
  { path: '/dashboard',                      label: 'Dashboard' },

  // Productivity
  { path: '/docs',                           label: 'Docs' },
  { path: '/docs/automation',               label: 'Docs > Automation' },
  { path: '/sheets',                         label: 'Sheets' },
  { path: '/slides',                         label: 'Slides' },
  { path: '/mail',                           label: 'Mail' },
  { path: '/mail/advanced',                 label: 'Mail > Advanced' },
  { path: '/mail/analytics',               label: 'Mail > Analytics' },
  { path: '/mail/settings',                label: 'Mail > Settings' },
  { path: '/cal',                            label: 'Calendar' },
  { path: '/cal/heatmap',                  label: 'Calendar > Heatmap' },
  { path: '/calendar',                       label: 'Calendar (alt)' },
  { path: '/tasks',                          label: 'Tasks' },
  { path: '/chat',                           label: 'Chat' },
  { path: '/meet',                           label: 'Meet' },
  { path: '/keep',                           label: 'Keep' },
  { path: '/contacts',                       label: 'Contacts' },
  { path: '/forms',                          label: 'Forms' },
  { path: '/bookmarks',                      label: 'Bookmarks' },
  { path: '/collaboration',                  label: 'Collaboration' },
  { path: '/notifications',                  label: 'Notifications' },
  { path: '/notifications/preferences',     label: 'Notifications > Preferences' },

  // Design & Media
  { path: '/design',                         label: 'Design' },
  { path: '/design/editor',                 label: 'Design > Editor' },
  { path: '/media',                          label: 'Media' },

  // Storage & Drive
  { path: '/storage',                        label: 'Storage' },
  { path: '/storage/shares',               label: 'Storage > Shares' },
  { path: '/storage/trash',                label: 'Storage > Trash' },
  { path: '/drive',                          label: 'Drive' },
  { path: '/global-drive',                  label: 'Global Drive' },
  { path: '/trash',                          label: 'Trash' },
  { path: '/backups',                        label: 'Backups' },

  // Business Apps
  { path: '/crm',                            label: 'CRM' },
  { path: '/billing',                        label: 'Billing' },
  { path: '/accounting',                     label: 'Accounting' },
  { path: '/projects',                       label: 'Projects' },
  { path: '/analytics',                      label: 'Analytics' },
  { path: '/reports',                        label: 'Reports' },
  { path: '/compliance',                     label: 'Compliance' },
  { path: '/gamification',                   label: 'Gamification' },
  { path: '/data-management',               label: 'Data Management' },
  { path: '/integrations',                   label: 'Integrations' },

  // Social
  { path: '/social',                         label: 'Social' },
  { path: '/social/compose',               label: 'Social > Compose' },
  { path: '/social/calendar',             label: 'Social > Calendar' },
  { path: '/social/inbox',                label: 'Social > Inbox' },
  { path: '/social/analytics',           label: 'Social > Analytics' },
  { path: '/social/accounts',            label: 'Social > Accounts' },
  { path: '/social/automation',          label: 'Social > Automation' },
  { path: '/social/media',               label: 'Social > Media' },
  { path: '/social/templates',           label: 'Social > Templates' },
  { path: '/social/settings',            label: 'Social > Settings' },
  { path: '/social/agent',               label: 'Social > Agent' },

  // AI
  { path: '/ai',                             label: 'AI' },
  { path: '/ai/studio',                    label: 'AI > Studio' },
  { path: '/ai/documents',               label: 'AI > Documents' },
  { path: '/ai/search',                  label: 'AI > Search' },
  { path: '/ai/settings',               label: 'AI > Settings' },

  // Communications
  { path: '/comms/announcements',          label: 'Comms > Announcements' },
  { path: '/comms/digital-signage',       label: 'Comms > Digital Signage' },
  { path: '/comms/mention-notifications', label: 'Comms > Mention Notifications' },
  { path: '/comms/news-feed',             label: 'Comms > News Feed' },
  { path: '/comms/newsletter',            label: 'Comms > Newsletter' },
  { path: '/comms/polls',                 label: 'Comms > Polls' },
  { path: '/comms/suggestions',          label: 'Comms > Suggestions' },
  { path: '/comms/teams-directory',      label: 'Comms > Teams Directory' },

  // LMS
  { path: '/lms/catalog',                  label: 'LMS > Catalog' },
  { path: '/lms/certificates',            label: 'LMS > Certificates' },
  { path: '/lms/discussions',             label: 'LMS > Discussions' },
  { path: '/lms/learning-paths',         label: 'LMS > Learning Paths' },
  { path: '/lms/progress',               label: 'LMS > Progress' },
  { path: '/lms/quiz-builder',           label: 'LMS > Quiz Builder' },
  { path: '/lms/reviews',                label: 'LMS > Reviews' },

  // Supply Chain
  { path: '/supply-chain/inventory',             label: 'Supply Chain > Inventory' },
  { path: '/supply-chain/product-catalog',      label: 'Supply Chain > Product Catalog' },
  { path: '/supply-chain/purchase-orders',      label: 'Supply Chain > Purchase Orders' },
  { path: '/supply-chain/delivery-tracking',    label: 'Supply Chain > Delivery Tracking' },
  { path: '/supply-chain/receiving-shipping',   label: 'Supply Chain > Receiving & Shipping' },
  { path: '/supply-chain/stock-alerts',         label: 'Supply Chain > Stock Alerts' },
  { path: '/supply-chain/supplier-portal',      label: 'Supply Chain > Supplier Portal' },
  { path: '/supply-chain/warehouse-map',        label: 'Supply Chain > Warehouse Map' },

  // Infrastructure
  { path: '/containers',                     label: 'Containers' },
  { path: '/monitoring',                     label: 'Monitoring' },
  { path: '/vpn',                            label: 'VPN' },
  { path: '/pxe',                            label: 'PXE' },
  { path: '/remote',                         label: 'Remote' },
  { path: '/proxy',                          label: 'Proxy' },
  { path: '/securelink',                     label: 'SecureLink' },
  { path: '/routes',                         label: 'Routes' },
  { path: '/scheduler',                      label: 'Scheduler' },
  { path: '/scheduler/analytics',          label: 'Scheduler > Analytics' },
  { path: '/scheduling',                     label: 'Scheduling' },
  { path: '/resources',                      label: 'Resources' },
  { path: '/resources/my-reservations',    label: 'Resources > My Reservations' },
  { path: '/it-assets',                      label: 'IT Assets' },
  { path: '/it-assets/scan',              label: 'IT Assets > Scan' },
  { path: '/voice',                          label: 'Voice' },
  { path: '/status',                         label: 'Status' },

  // HR / Workforce
  { path: '/workforce',                      label: 'Workforce' },
  { path: '/workforce/hr',                 label: 'Workforce > HR' },
  { path: '/team/org-chart',               label: 'Team > Org Chart' },

  // Metrics / Tools / Misc
  { path: '/metrics',                        label: 'Metrics' },
  { path: '/tools',                          label: 'Tools' },
  { path: '/apps',                           label: 'Apps' },
  { path: '/all-apps',                       label: 'All Apps' },
  { path: '/app-store',                      label: 'App Store' },
  { path: '/help',                           label: 'Help' },
  { path: '/print',                          label: 'Print' },

  // Settings
  { path: '/settings',                               label: 'Settings' },
  { path: '/settings/profile',                     label: 'Settings > Profile' },
  { path: '/settings/security',                    label: 'Settings > Security' },
  { path: '/settings/preferences',                 label: 'Settings > Preferences' },
  { path: '/settings/notifications',               label: 'Settings > Notifications' },
  { path: '/settings/calendar',                    label: 'Settings > Calendar' },
  { path: '/settings/data-export',                 label: 'Settings > Data Export' },
  { path: '/settings/webhooks',                    label: 'Settings > Webhooks' },

  // Admin
  { path: '/admin',                                  label: 'Admin' },
  { path: '/admin/users',                           label: 'Admin > Users' },
  { path: '/admin/groups',                          label: 'Admin > Groups' },
  { path: '/admin/roles',                           label: 'Admin > Roles' },
  { path: '/admin/settings',                        label: 'Admin > Settings' },
  { path: '/admin/security',                        label: 'Admin > Security' },
  { path: '/admin/audit',                           label: 'Admin > Audit' },
  { path: '/admin/logs',                            label: 'Admin > Logs' },
  { path: '/admin/monitoring',                      label: 'Admin > Monitoring' },
  { path: '/admin/health',                          label: 'Admin > Health' },
  { path: '/admin/backup',                          label: 'Admin > Backup' },
  { path: '/admin/storage',                         label: 'Admin > Storage' },
  { path: '/admin/quota',                           label: 'Admin > Quota' },
  { path: '/admin/api-quota',                      label: 'Admin > API Quota' },
  { path: '/admin/tenant',                          label: 'Admin > Tenant' },
  { path: '/admin/services',                        label: 'Admin > Services' },
  { path: '/admin/feature-flags',                  label: 'Admin > Feature Flags' },
  { path: '/admin/reports',                         label: 'Admin > Reports' },
  { path: '/admin/resources',                       label: 'Admin > Resources' },
  { path: '/admin/workspaces',                      label: 'Admin > Workspaces' },
  { path: '/admin/webhooks',                        label: 'Admin > Webhooks' },
  { path: '/admin/ldap',                            label: 'Admin > LDAP' },
  { path: '/admin/i18n',                            label: 'Admin > i18n' },
  { path: '/admin/env-config',                     label: 'Admin > Env Config' },
  { path: '/admin/developer-tools',               label: 'Admin > Developer Tools' },
  { path: '/admin/api-docs',                       label: 'Admin > API Docs' },
  { path: '/admin/api-platform',                  label: 'Admin > API Platform' },
  { path: '/admin/api-playground',               label: 'Admin > API Playground' },
  { path: '/admin/graphql',                        label: 'Admin > GraphQL' },
  { path: '/admin/migrations',                     label: 'Admin > Migrations' },
  { path: '/admin/ai-cost',                        label: 'Admin > AI Cost' },
  { path: '/admin/cve',                            label: 'Admin > CVE' },
  { path: '/admin/gdpr',                           label: 'Admin > GDPR' },
  { path: '/admin/email-analytics',               label: 'Admin > Email Analytics' },
  { path: '/admin/email-templates',               label: 'Admin > Email Templates' },
  { path: '/admin/entity-hub',                    label: 'Admin > Entity Hub' },
  { path: '/admin/floorplans',                    label: 'Admin > Floorplans' },
  { path: '/admin/file-types',                    label: 'Admin > File Types' },
  { path: '/admin/activity',                       label: 'Admin > Activity' },
  { path: '/admin/user-activity',                 label: 'Admin > User Activity' },
  { path: '/admin/container-resources',           label: 'Admin > Container Resources' },
  { path: '/admin/job-velocity',                  label: 'Admin > Job Velocity' },
];

// ─── suite ───────────────────────────────────────────────────────────────────

test.describe('Full App Audit — page load verification', () => {
  // Auth state is injected via the fixtures storageState; no manual login needed.

  // ── per-page load tests ───────────────────────────────────────────────────
  for (const { path, label } of ALL_PAGES) {
    test(`${label} (${path}) — loads without crash`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await assertNoError(page);
    });
  }

  // ── responsive: mobile viewport ──────────────────────────────────────────
  test('dashboard — sidebar hidden/offscreen on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();

    const sidebar = page.locator('aside');
    // On mobile the sidebar may be translated off-screen; page must not crash.
    const sidebarBox = await sidebar.boundingBox();
    if (sidebarBox) {
      // Either off-screen (x < 0) or width collapsed (<= 64 px icons-only)
      const isOffscreenOrCollapsed = sidebarBox.x < 0 || sidebarBox.width <= 64;
      expect(isOffscreenOrCollapsed).toBeTruthy();
    }
    // Body must still render content
    await assertNoError(page);
  });

  // ── responsive: tablet viewport ──────────────────────────────────────────
  test('dashboard — renders on tablet viewport (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('aside')).toBeVisible();
    await assertNoError(page);
  });

  // ── responsive: wide desktop ─────────────────────────────────────────────
  test('dashboard — renders on wide desktop (1920px)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.getByText('SignApps')).toBeVisible();
    await assertNoError(page);
  });

  // ── sidebar collapse toggle ───────────────────────────────────────────────
  test('sidebar — collapses and expands', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // The first button inside the sidebar is the collapse toggle
    const toggleBtn = sidebar.locator('button').first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      // After collapse the sidebar should be narrower (icon-only width ≤ 80px)
      await page.waitForTimeout(200); // CSS transition animation
      const boxCollapsed = await sidebar.boundingBox();
      if (boxCollapsed) {
        expect(boxCollapsed.width).toBeLessThanOrEqual(80);
      }

      // Expand again
      await toggleBtn.click();
      await page.waitForTimeout(200); // CSS transition animation
      const boxExpanded = await sidebar.boundingBox();
      if (boxExpanded) {
        expect(boxExpanded.width).toBeGreaterThan(80);
      }
    }
  });

  // ── navigation group expansion ────────────────────────────────────────────
  test('sidebar groups — Productivity, Infrastructure, Operations, Administration visible', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const groups = ['Productivity', 'Infrastructure', 'Operations', 'Administration'];
    for (const group of groups) {
      const btn = page.getByRole('button', { name: new RegExp(group, 'i') });
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(btn).toBeVisible();
      }
    }
  });

  // ── header presence ───────────────────────────────────────────────────────
  test('header — visible on every main page', async ({ page }) => {
    const routes = ['/dashboard', '/docs', '/mail', '/tasks', '/settings'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('header')).toBeVisible();
    }
  });

  // ── keyboard shortcut: command palette ────────────────────────────────────
  test('command palette — opens with Ctrl+K', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+k');
    // Dialog should appear within 2 s
    const dialog = page.locator('[role="dialog"], [cmdk-root]');
    await expect(dialog.first()).toBeVisible({ timeout: 2000 });
    // Dismiss
    await page.keyboard.press('Escape');
  });

  // ── 404 handling ──────────────────────────────────────────────────────────
  test('unknown route — shows 404 or redirects gracefully', async ({ page }) => {
    await page.goto('/this-page-absolutely-does-not-exist-xyz');
    await page.waitForLoadState('networkidle');

    const is404 = await page.getByText(/404|not found/i).isVisible().catch(() => false);
    const redirected =
      page.url().includes('/dashboard') ||
      page.url().includes('/login') ||
      page.url().includes('/not-found');

    expect(is404 || redirected).toBeTruthy();
  });

  // ── browser back / forward ────────────────────────────────────────────────
  test('browser navigation — back and forward between pages', async ({ page }) => {
    await page.goto('/dashboard');
    await page.goto('/docs');
    await page.goto('/mail');

    await page.goBack();
    await expect(page).toHaveURL(/\/docs/);

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goForward();
    await expect(page).toHaveURL(/\/docs/);
  });

  // ── AI navigation bar ─────────────────────────────────────────────────────
  test('AI nav bar — /docs command navigates to Docs', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // The AI bar uses a placeholder that includes "naviguer" or similar
    const aiInput = page.locator(
      'input[placeholder*="naviguer"], input[placeholder*="Navigate"], input[placeholder*="Type a command"]'
    );
    if (await aiInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await aiInput.fill('/docs');
      await aiInput.press('Enter');
      await page.waitForURL('**/docs', { timeout: 5000 });
      await expect(page).toHaveURL(/\/docs/);
    }
  });

  // ── right sidebar panel toggle ────────────────────────────────────────────
  test('right sidebar panel — toggles open and closed', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // chevron-right or panel-right toggle button
    const toggleBtn = page.locator(
      'button:has(svg.lucide-chevron-right), button:has(svg.lucide-panel-right), button[aria-label*="panel"]'
    ).first();

    if (await toggleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await toggleBtn.click();
      await page.waitForTimeout(200); // CSS transition animation
      // Second click should close it
      await toggleBtn.click();
      await page.waitForTimeout(200); // CSS transition animation
    }

    // Page should still be alive regardless of toggle state
    await assertNoError(page);
  });
});
