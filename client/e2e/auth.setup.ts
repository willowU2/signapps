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

  // Aggressively close any dialogs/modals blocking the login form
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  // Click any dismiss/close/skip button that might be visible
  for (const selector of [
    'button:has-text("Passer")',
    'button:has-text("Compris")',
    'button:has-text("Close")',
    'button:has-text("Fermer")',
    'button:has-text("Skip")',
    'button[aria-label="Close"]',
    '[data-state="open"] button:has-text("×")',
    'div[role="dialog"] button',
  ]) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
      await btn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(200);
    }
  }
  // Final escape to close anything remaining
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Fill in login credentials using IDs (language-independent)
  const usernameInput = page.locator('#username');
  await usernameInput.click({ force: true });
  await usernameInput.fill('admin');

  const passwordInput = page.locator('#password');
  await passwordInput.click();
  await passwordInput.fill('admin');

  // Click the sign in button within the form (supports both FR and EN labels)
  const signInBtn = page.locator('form').getByRole('button', { name: /sign in|se connecter|connexion/i });
  await signInBtn.click();

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
