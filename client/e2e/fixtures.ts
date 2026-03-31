import { test as base, expect, type Page } from '@playwright/test';
import path from 'path';

/**
 * Custom fixtures for SignApps E2E tests
 */

// Path to the authenticated state file
const authFile = path.join(__dirname, '../playwright/.auth/user.json');

/**
 * Dismiss any remaining blocking dialogs.
 * Normally dialogs are suppressed via localStorage in auth.setup.ts,
 * but call this as a safety net if needed.
 */
export async function dismissDialogs(page: Page) {
  await page.waitForTimeout(500);

  // Dismiss common blocking dialogs by clicking their dismiss buttons
  for (const name of [/passer|skip/i, /compris|got it/i]) {
    const btn = page.getByRole('button', { name }).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(200);
    }
  }

  // Close any remaining open dialogs via Escape
  const dialog = page.locator('[role="dialog"]').first();
  if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
}

/**
 * Authenticated test fixture
 * Uses stored authentication state (including localStorage with dismissed dialogs)
 */
export const test = base.extend({
  storageState: authFile,
});

/**
 * Unauthenticated test fixture
 * For testing login flow and route protection
 */
export const unauthenticatedTest = base.extend({
  storageState: { cookies: [], origins: [] },
});

export { expect };

/**
 * Test data helpers
 */
export const testData = {
  validUser: {
    username: 'admin',
    password: 'admin',
  },
  invalidUser: {
    username: 'invalid_user',
    password: 'wrong_password',
  },
  testContainer: {
    name: 'test-container-e2e',
    image: 'nginx:alpine',
  },
  testBucket: {
    name: 'test-bucket-e2e',
  },
  testFolder: {
    name: 'test-folder-e2e',
  },
};

/**
 * Page object helpers (French labels)
 */
export const selectors = {
  loginForm: {
    username: '#username',
    password: '#password',
    submitButton: 'button[type="submit"]',
    errorMessage: '.bg-destructive\\/10',
    rememberMe: '#remember',
  },
  dashboard: {
    title: 'h1:has-text("Tableau de bord"), h2:has-text("Tableau de bord")',
    refreshButton: 'button:has-text("Actualiser")',
  },
  sidebar: {
    container: 'aside',
    navLinks: 'nav a',
    logo: 'a:has-text("SignApps")',
  },
  dialog: {
    container: '[role="dialog"]',
    title: '[role="dialog"] h2',
    closeButton: '[role="dialog"] button:has-text("Fermer")',
    submitButton: '[role="dialog"] button[type="submit"]',
  },
};
