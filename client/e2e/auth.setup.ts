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

  // Wait for the login form to be visible
  await expect(page.locator('text=Welcome Back')).toBeVisible();

  // Fill in login credentials using specific input IDs within the form
  // This avoids conflicts with other inputs on the page (like AI assistant)
  await page.locator('input#username').fill('admin');
  await page.locator('input#password').fill('admin123');

  // Click the sign in button within the form
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to dashboard or MFA verification
  await page.waitForURL(/\/(dashboard|login\/verify)/, { timeout: 15000 });

  // If MFA is required, we'd handle it here
  // For now, assume direct login to dashboard
  if (page.url().includes('/login/verify')) {
    // MFA verification would go here
    // For tests, you might skip MFA or use a test account without MFA
    console.log('MFA verification required - skipping for test setup');
  }

  // Save the authentication state
  await page.context().storageState({ path: authFile });
});

/**
 * Export the auth file path for use in other test files
 */
export { authFile };
