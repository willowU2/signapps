import { test, expect } from './fixtures';

/**
 * Smoke Tests — 30+ uncovered pages
 *
 * For each page: navigate, wait for body, assert no crash (no error boundary visible).
 */

const UNCOVERED_PAGES = [
  '/design',
  '/analytics',
  '/billing',
  '/social',
  '/social/compose',
  '/social/calendar',
  '/social/inbox',
  '/social/analytics',
  '/social/accounts',
  '/vpn',
  '/pxe',
  '/remote',
  '/proxy',
  '/securelink',
  '/monitoring',
  '/media',
  '/meet',
  '/admin/ai-cost',
  '/admin/cve',
  '/admin/gdpr',
  '/admin/quota',
  '/admin/feature-flags',
  '/resources',
  '/team/org-chart',
  '/tools',
  '/workforce',
];

test.describe('Smoke Tests — Uncovered Pages', () => {
  for (const route of UNCOVERED_PAGES) {
    test(`${route} — loads without crash`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('body')).toBeVisible();
      // Assert no error boundary is showing
      await expect(page.locator('.error-boundary')).not.toBeVisible();
    });
  }
});
