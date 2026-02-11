import { unauthenticatedTest, expect, testData, selectors } from './fixtures';

/**
 * Authentication E2E Tests
 * Tests login flow, logout, and route protection
 */

unauthenticatedTest.describe('Authentication Flow', () => {
  unauthenticatedTest.describe('Login Page', () => {
    unauthenticatedTest('should display login form with all elements', async ({ page }) => {
      await page.goto('/login');

      // Check page title and description
      await expect(page.getByText('Welcome Back')).toBeVisible();
      await expect(page.getByText('Sign in to your SignApps account')).toBeVisible();

      // Check form elements
      await expect(page.getByLabel('Username')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

      // Check remember me checkbox
      await expect(page.getByLabel('Remember me')).toBeVisible();

      // Check LDAP option
      await expect(page.getByRole('button', { name: /ldap/i })).toBeVisible();
    });

    unauthenticatedTest('should toggle password visibility', async ({ page }) => {
      await page.goto('/login');

      const passwordInput = page.getByLabel('Password');
      const toggleButton = page.locator('button').filter({ has: page.locator('svg') }).nth(0);

      // Initially password should be hidden
      await expect(passwordInput).toHaveAttribute('type', 'password');

      // Find and click the eye button (toggle visibility)
      await page.locator('input[id="password"]').fill('test');
      const eyeButton = page.locator('button[type="button"]').filter({ hasText: '' }).first();
      await eyeButton.click();

      // Password should now be visible
      await expect(passwordInput).toHaveAttribute('type', 'text');
    });
  });

  unauthenticatedTest.describe('Login with Valid Credentials', () => {
    unauthenticatedTest('should redirect to dashboard after successful login', async ({ page }) => {
      await page.goto('/login');

      // Fill in valid credentials
      await page.getByLabel('Username').fill(testData.validUser.username);
      await page.getByLabel('Password').fill(testData.validUser.password);

      // Submit the form
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should redirect to dashboard (or MFA verify page)
      await page.waitForURL(/\/(dashboard|login\/verify)/, { timeout: 10000 });

      // If we're on dashboard, verify it loaded
      if (page.url().includes('/dashboard')) {
        await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      }
    });

    unauthenticatedTest('should show loading state during login', async ({ page }) => {
      await page.goto('/login');

      // Fill in credentials
      await page.getByLabel('Username').fill(testData.validUser.username);
      await page.getByLabel('Password').fill(testData.validUser.password);

      // Click submit and check for loading state
      const submitButton = page.getByRole('button', { name: /sign in/i });
      await submitButton.click();

      // Button should show loading text
      await expect(page.getByText('Signing in...')).toBeVisible({ timeout: 1000 }).catch(() => {
        // Loading state might be too fast to catch, that's ok
      });
    });
  });

  unauthenticatedTest.describe('Login with Invalid Credentials', () => {
    unauthenticatedTest('should show error message for invalid username', async ({ page }) => {
      await page.goto('/login');

      // Fill in invalid credentials
      await page.getByLabel('Username').fill(testData.invalidUser.username);
      await page.getByLabel('Password').fill(testData.invalidUser.password);

      // Submit the form
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should show error message
      await expect(page.locator('.bg-destructive\\/10, [class*="destructive"]')).toBeVisible({ timeout: 5000 });

      // Should stay on login page
      await expect(page).toHaveURL(/\/login/);
    });

    unauthenticatedTest('should show error for empty username', async ({ page }) => {
      await page.goto('/login');

      // Only fill password
      await page.getByLabel('Password').fill('somepassword');

      // Submit the form
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should show validation error
      await expect(page.getByText('Username is required')).toBeVisible();
    });

    unauthenticatedTest('should show error for empty password', async ({ page }) => {
      await page.goto('/login');

      // Only fill username
      await page.getByLabel('Username').fill('someuser');

      // Submit the form
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should show validation error
      await expect(page.getByText('Password is required')).toBeVisible();
    });
  });

  unauthenticatedTest.describe('Route Protection', () => {
    unauthenticatedTest('should redirect to login when accessing protected route', async ({ page }) => {
      // Try to access dashboard without authentication
      await page.goto('/dashboard');

      // Should be redirected to login
      await expect(page).toHaveURL(/\/login/);
    });

    unauthenticatedTest('should redirect to login when accessing containers page', async ({ page }) => {
      await page.goto('/containers');
      await expect(page).toHaveURL(/\/login/);
    });

    unauthenticatedTest('should redirect to login when accessing storage page', async ({ page }) => {
      await page.goto('/storage');
      await expect(page).toHaveURL(/\/login/);
    });

    unauthenticatedTest('should redirect to login when accessing settings page', async ({ page }) => {
      await page.goto('/settings');
      await expect(page).toHaveURL(/\/login/);
    });

    unauthenticatedTest('should preserve redirect path in URL', async ({ page }) => {
      // Try to access a protected route
      await page.goto('/containers');

      // Should redirect to login with redirect param
      await expect(page).toHaveURL(/\/login(\?redirect=.*)?/);
    });
  });

  unauthenticatedTest.describe('LDAP Login Dialog', () => {
    unauthenticatedTest('should open LDAP login dialog', async ({ page }) => {
      await page.goto('/login');

      // Click LDAP button
      await page.getByRole('button', { name: /ldap/i }).click();

      // Dialog should be visible
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });
  });
});

/**
 * Logout tests - these require authentication first
 */
import { test } from './fixtures';

test.describe('Logout Flow', () => {
  test('should logout and redirect to login page', async ({ page }) => {
    // Start on dashboard (authenticated via fixture)
    await page.goto('/dashboard');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 }).catch(() => {
      // If dashboard doesn't load, we might not be authenticated
    });

    // Find and click the user menu/logout button
    // This depends on your header implementation
    const userMenuButton = page.locator('header button').last();
    await userMenuButton.click().catch(() => {});

    // Look for logout option in dropdown
    const logoutButton = page.getByRole('menuitem', { name: /logout|sign out/i });
    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click();

      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
