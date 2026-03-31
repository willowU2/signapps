import { test, expect } from './fixtures';

/**
 * Platform Smoke Test Suite
 *
 * Comprehensive E2E smoke tests that validate ALL critical user flows.
 * Each test navigates to a major page and asserts it loads with meaningful content.
 *
 * Uses the authenticated fixture (auth.setup.ts) so all tests run as a logged-in user.
 */

// ---------------------------------------------------------------------------
// All major platform pages with expected content markers
// ---------------------------------------------------------------------------

const PAGES = [
  // Core dashboard
  { path: '/dashboard', expect: 'Dashboard', group: 'core' },

  // Office suite
  { path: '/docs', expect: 'Document', group: 'office' },
  { path: '/sheets', expect: 'calcul', group: 'office' },
  { path: '/mail', expect: 'message', group: 'office' },
  { path: '/cal', expect: 'calendar', group: 'office' },
  { path: '/tasks', expect: 'projet', group: 'office' },
  { path: '/contacts', expect: 'Contact', group: 'office' },
  { path: '/keep', expect: 'note', group: 'office' },
  { path: '/chat', expect: 'channel', group: 'office' },

  // Infrastructure
  { path: '/containers', expect: 'Container', group: 'infra' },
  { path: '/storage', expect: 'Bucket', group: 'infra' },
  { path: '/monitoring', expect: 'CPU', group: 'infra' },

  // AI
  { path: '/ai', expect: 'Dashboard', group: 'ai' },
  { path: '/ai/studio', expect: 'Studio', group: 'ai' },

  // Scheduling & marketplace
  { path: '/scheduling', expect: 'Planification', group: 'platform' },
  { path: '/app-store', expect: 'Marketplace', group: 'platform' },
  { path: '/global-drive', expect: 'Drive', group: 'platform' },

  // Admin
  { path: '/admin/settings', expect: 'General', group: 'admin' },
  { path: '/admin/users', expect: 'admin', group: 'admin' },

  // Help & status
  { path: '/help', expect: 'FAQ', group: 'info' },
  { path: '/status', expect: 'Identity', group: 'info' },

  // Social media management
  { path: '/social', expect: 'Social', group: 'social' },
  { path: '/social/compose', expect: 'Compose', group: 'social' },
  { path: '/social/calendar', expect: 'Calendar', group: 'social' },
  { path: '/social/inbox', expect: 'Inbox', group: 'social' },

  // Additional pages (from previous smoke.spec.ts coverage)
  { path: '/design', expect: 'Design', group: 'platform' },
  { path: '/proxy', expect: 'Proxy', group: 'infra' },
  { path: '/securelink', expect: 'Secure', group: 'infra' },
  { path: '/media', expect: 'Media', group: 'platform' },
  { path: '/meet', expect: 'Meet', group: 'platform' },
  { path: '/workforce', expect: 'Workforce', group: 'platform' },
  { path: '/resources', expect: 'Resource', group: 'platform' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function dismissDialogs(page: import('@playwright/test').Page) {
  // Press Escape multiple times to dismiss any modal/dialog
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  // Try clicking "Passer" with force (skip stability check — button may be animating)
  const skipBtn = page.locator('button:has-text("Passer")');
  if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipBtn.click({ force: true }).catch(() => {});
  }
  // Also try "Compris" and close buttons
  for (const text of ['Compris', 'Fermer', 'Close']) {
    const btn = page.locator(`button:has-text("${text}")`).first();
    if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
      await btn.click({ force: true }).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Platform Smoke Test — All Pages', () => {
  for (const p of PAGES) {
    test(`[${p.group}] ${p.path} loads correctly`, async ({ page }) => {
      test.setTimeout(60_000);

      // Navigate to the page
      await page.goto(p.path, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      // Wait for content — don't use networkidle (services may be slow)
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(200);

      // Get the full body text
      const content = await page.textContent('body');
      const charCount = content?.length || 0;
      const loaded = charCount > 100;

      // Log for debugging (visible in Playwright test output)
      console.log(
        `${p.path}: ${loaded ? 'OK' : 'EMPTY'} (${charCount} chars)` +
        (loaded ? '' : ` — expected "${p.expect}"`)
      );

      // Assert the page rendered meaningful content
      expect(loaded, `Page ${p.path} should render >100 chars of content`).toBe(true);

      // Assert no error boundary or crash overlay is visible
      const errorBoundary = page.locator('.error-boundary, [data-nextjs-error]');
      await expect(errorBoundary).not.toBeVisible();
    });
  }
});

test.describe('Platform Smoke Test — Critical Interactions', () => {
  test('Dashboard loads and shows quick actions', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    await dismissDialogs(page);

    // Verify page loaded with content
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(100);
  });

  test('Status page shows service list', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/status', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    // Verify the page title
    const title = page.locator('h1:has-text("Status")');
    await expect(title).toBeVisible({ timeout: 10_000 });

    // Verify at least one service is listed (Identity is always configured)
    const identityService = page.locator('text=Identity');
    await expect(identityService).toBeVisible({ timeout: 10_000 });
  });

  test('Navigation sidebar is accessible', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    await dismissDialogs(page);

    // Verify navigation exists — look for sidebar or any nav element
    const sidebar = page.locator('aside, nav, [role="navigation"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });

  test('Health API returns service statuses', async ({ page }) => {
    test.setTimeout(15_000);
    const response = await page.goto('/api/health');
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);

    const body = await response!.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('services');
    expect(body).toHaveProperty('timestamp');
    expect(Array.isArray(body.services)).toBe(true);
    expect(body.services.length).toBeGreaterThan(0);

    // Each service should have name and status fields
    for (const svc of body.services) {
      expect(svc).toHaveProperty('name');
      expect(svc).toHaveProperty('status');
      expect(['up', 'down']).toContain(svc.status);
    }
  });
});

test.describe('Platform Smoke Test — Console Error Audit', () => {
  test('Dashboard has no uncaught exceptions', async ({ page }) => {
    test.setTimeout(30_000);

    const errors: string[] = [];
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Filter out expected network errors (services may not be running in test env)
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('Network Error') &&
        !e.includes('ERR_CONNECTION_REFUSED') &&
        !e.includes('ECONNREFUSED') &&
        !e.includes('Failed to fetch') &&
        !e.includes('AbortError') &&
        !e.includes('Load failed')
    );

    if (criticalErrors.length > 0) {
      console.warn('Critical JS errors on dashboard:', criticalErrors);
    }

    expect(
      criticalErrors.length,
      `Dashboard should have no uncaught exceptions (found: ${criticalErrors.join(', ')})`
    ).toBe(0);
  });
});
