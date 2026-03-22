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

  // Wait for React hydration
  await page.waitForLoadState('networkidle');

  // Fill in login credentials using accessibility labels (click first to ensure focus/hydration)
  const usernameInput = page.getByLabel(/username/i);
  await usernameInput.click();
  await usernameInput.fill('admin');

  const passwordInput = page.getByLabel(/password/i);
  await passwordInput.click();
  await passwordInput.fill('admin');

  // Click the sign in button within the form
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();

  // Wait for either the redirect OR an error message to appear
  try {
    await page.waitForURL(/\/(dashboard|login\/verify)/, { timeout: 10000 });
  } catch (error) {
    // If we timed out, let's grab the text content of the page to see if there's an error message
    const pageText = await page.locator('body').innerText();
    console.error("Login failed or timed out. Page content snippet:");
    console.error(pageText.substring(0, 500));
    
    // Also check for any specific error boxes
    const errorBox = page.locator('.text-destructive');
    if (await errorBox.count() > 0) {
      console.error("Found error on page:", await errorBox.first().innerText());
    }
    
    throw error; // Rethrow to fail the test naturally
  }
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
