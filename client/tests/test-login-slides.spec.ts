import { test, expect } from '@playwright/test';

test('login and navigate to slides to open menu', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  
  // Fill in the login form
  await page.fill('input[id="username"]', 'admin');
  await page.fill('input[type="password"]', 'password123');
  
  // Submit the form
  await page.click('button:has-text("Sign In")');

  // Verify successful login by waiting for the dashboard/storage page element
  await page.waitForURL('http://localhost:3000/dashboard');

  // Navigate directly to the slides interface
  await page.goto('http://localhost:3000/slides');
  await page.waitForLoadState('networkidle');

  // Take a full page screenshot
  await expect(page.locator('text=Fichier')).toBeVisible();
  
  // Click on the Fichier menu item
  await page.click('button:has-text("Fichier")');

  // Take a screenshot of the opened menu
  await page.screenshot({ path: 'tests/slides-menu-demo.png' });
});
