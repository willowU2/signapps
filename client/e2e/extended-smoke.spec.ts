import { test, expect } from './fixtures';

/**
 * Extended Smoke Tests — Pages not covered by platform-smoke.spec.ts
 */

const PAGES = [
  // Accounting & Finance
  { path: '/accounting', group: 'finance' },
  { path: '/billing', group: 'finance' },

  // CRM & Contacts
  { path: '/crm', group: 'crm' },
  { path: '/contacts', group: 'crm' },

  // Supply Chain
  { path: '/supply-chain/inventory', group: 'supply-chain' },
  { path: '/supply-chain/purchase-orders', group: 'supply-chain' },
  { path: '/supply-chain/stock-alerts', group: 'supply-chain' },
  { path: '/supply-chain/delivery-tracking', group: 'supply-chain' },
  { path: '/supply-chain/receiving-shipping', group: 'supply-chain' },
  { path: '/supply-chain/product-catalog', group: 'supply-chain' },
  { path: '/supply-chain/supplier-portal', group: 'supply-chain' },
  { path: '/supply-chain/warehouse-map', group: 'supply-chain' },

  // LMS
  { path: '/lms/catalog', group: 'lms' },
  { path: '/lms/certificates', group: 'lms' },
  { path: '/lms/learning-paths', group: 'lms' },
  { path: '/lms/progress', group: 'lms' },
  { path: '/lms/quiz-builder', group: 'lms' },
  { path: '/lms/discussions', group: 'lms' },

  // Communications
  { path: '/comms/announcements', group: 'comms' },
  { path: '/comms/digital-signage', group: 'comms' },
  { path: '/comms/polls', group: 'comms' },
  { path: '/comms/suggestions', group: 'comms' },

  // Collaboration & Projects
  { path: '/collaboration', group: 'collab' },
  { path: '/projects', group: 'collab' },

  // Admin
  { path: '/admin/audit', group: 'admin' },
  { path: '/admin/backup', group: 'admin' },
  { path: '/admin/groups', group: 'admin' },
  { path: '/admin/roles', group: 'admin' },
  { path: '/admin/ldap', group: 'admin' },
  { path: '/admin/email-templates', group: 'admin' },
  { path: '/admin/logs', group: 'admin' },
  { path: '/admin/webhooks', group: 'admin' },
  { path: '/admin/api-docs', group: 'admin' },
  { path: '/admin/api-platform', group: 'admin' },
  { path: '/admin/gdpr', group: 'admin' },
  { path: '/admin/i18n', group: 'admin' },
  { path: '/admin/import-export', group: 'admin' },
  { path: '/admin/container-resources', group: 'admin' },
  { path: '/admin/feature-flags', group: 'admin' },
  { path: '/admin/developer-tools', group: 'admin' },

  // Settings
  { path: '/settings/appearance', group: 'settings' },
  { path: '/settings/profile', group: 'settings' },
  { path: '/settings/security', group: 'settings' },
  { path: '/settings/notifications', group: 'settings' },
  { path: '/settings/data-export', group: 'settings' },

  // Misc
  { path: '/analytics', group: 'misc' },
  { path: '/bookmarks', group: 'misc' },
  { path: '/compliance', group: 'misc' },
  { path: '/data-management', group: 'misc' },
  { path: '/gamification', group: 'misc' },
  { path: '/integrations', group: 'misc' },
  { path: '/reports', group: 'misc' },
  { path: '/slides', group: 'misc' },
  { path: '/trash', group: 'misc' },
  { path: '/team/org-chart', group: 'misc' },
  { path: '/storage', group: 'misc' },
  { path: '/vault', group: 'misc' },
  { path: '/admin/org-structure', group: 'misc' },
  { path: '/admin/persons', group: 'misc' },
  { path: '/admin/sites', group: 'misc' },
];

test.describe('Extended Smoke Tests — Uncovered Pages', () => {
  for (const p of PAGES) {
    test(`[${p.group}] ${p.path} loads without crash`, async ({ page }) => {
      test.setTimeout(30_000);

      await page.goto(p.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      // Page rendered meaningful content
      const content = await page.textContent('body');
      expect(content?.length, `${p.path} should render >50 chars`).toBeGreaterThan(50);

      // No error boundary
      const error = page.locator('.error-boundary, [data-nextjs-error]');
      await expect(error).not.toBeVisible();
    });
  }
});
