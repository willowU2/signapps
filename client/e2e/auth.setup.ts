import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

/**
 * Authentication setup - runs before all tests that depend on 'setup'
 * Creates an authenticated session that can be reused across tests
 */
setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Fill in login credentials
  const usernameInput = page.locator('#username');
  await usernameInput.click({ force: true });
  await usernameInput.fill('admin');

  const passwordInput = page.locator('#password');
  await passwordInput.click();
  await passwordInput.fill('admin');

  // Click the sign in button
  const signInBtn = page.locator('form').getByRole('button', { name: /sign in|se connecter|connexion/i });
  await signInBtn.click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/(dashboard|login\/verify)/, { timeout: 30000 });

  // Pre-dismiss all onboarding/changelog dialogs via localStorage
  // These will be persisted in the storage state file for all subsequent tests
  await page.evaluate(() => {
    localStorage.setItem('signapps-onboarding-completed', new Date().toISOString());
    localStorage.setItem('signapps-onboarding-dismissed', 'true');
    localStorage.setItem('signapps-changelog-seen', 'v2.6.0');
    localStorage.setItem('signapps_initialized', new Date().toISOString());
    localStorage.setItem('signapps_seed_dismissed', 'true');
  });

  // Save the authentication state (including localStorage with dismissed dialogs)
  await page.context().storageState({ path: authFile });
});

export { authFile };
