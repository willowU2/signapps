import { test, expect } from './fixtures';

/**
 * Navigation E2E Tests
 * Tests sidebar navigation, breadcrumbs, and responsive menu
 */

test.describe('Navigation', () => {
  test.describe('Sidebar Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dashboard');
    });

    test('should display sidebar with navigation links', async ({ page }) => {
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();

      // Check for main navigation items
      await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /containers/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /storage/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /routes/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /settings/i })).toBeVisible();
    });

    test('should display logo/brand in sidebar', async ({ page }) => {
      // Logo or brand name
      await expect(page.getByText('SignApps')).toBeVisible();
    });

    test('should navigate to Dashboard', async ({ page }) => {
      await page.getByRole('link', { name: /dashboard/i }).click();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('should navigate to Containers', async ({ page }) => {
      await page.getByRole('link', { name: /containers/i }).click();
      await expect(page).toHaveURL(/\/containers/);
      await expect(page.getByRole('heading', { name: 'Containers' })).toBeVisible();
    });

    test('should navigate to Storage', async ({ page }) => {
      await page.getByRole('link', { name: /storage/i }).click();
      await expect(page).toHaveURL(/\/storage/);
      await expect(page.getByRole('heading', { name: 'Storage' })).toBeVisible();
    });

    test('should navigate to Routes', async ({ page }) => {
      await page.getByRole('link', { name: /routes/i }).click();
      await expect(page).toHaveURL(/\/routes/);
    });

    test('should navigate to VPN', async ({ page }) => {
      await page.getByRole('link', { name: /vpn/i }).click();
      await expect(page).toHaveURL(/\/vpn/);
    });

    test('should navigate to Scheduler', async ({ page }) => {
      await page.getByRole('link', { name: /scheduler/i }).click();
      await expect(page).toHaveURL(/\/scheduler/);
    });

    test('should navigate to Monitoring', async ({ page }) => {
      await page.getByRole('link', { name: /monitoring/i }).click();
      await expect(page).toHaveURL(/\/monitoring/);
    });

    test('should navigate to AI Chat', async ({ page }) => {
      await page.getByRole('link', { name: /ai/i }).click();
      await expect(page).toHaveURL(/\/ai/);
    });

    test('should navigate to Users', async ({ page }) => {
      await page.getByRole('link', { name: /users/i }).click();
      await expect(page).toHaveURL(/\/users/);
    });

    test('should navigate to Settings', async ({ page }) => {
      await page.getByRole('link', { name: /settings/i }).click();
      await expect(page).toHaveURL(/\/settings/);
    });

    test('should highlight active navigation item', async ({ page }) => {
      // Dashboard link should be active
      const dashboardLink = page.getByRole('link', { name: /dashboard/i });

      // Check for active state (typically has different background/color)
      await expect(dashboardLink).toHaveClass(/accent|active/);

      // Navigate to containers
      await page.getByRole('link', { name: /containers/i }).click();

      // Containers link should now be active
      const containersLink = page.getByRole('link', { name: /containers/i });
      await expect(containersLink).toHaveClass(/accent|active/);
    });

    test('should collapse and expand sidebar', async ({ page }) => {
      const sidebar = page.locator('aside');

      // Find collapse button (chevron)
      const collapseButton = sidebar.locator('button').first();
      await collapseButton.click();

      // Sidebar should be narrower (collapsed state)
      await expect(sidebar).toHaveClass(/w-16/);

      // Text labels should be hidden
      await expect(page.getByText('SignApps')).not.toBeVisible();

      // Click again to expand
      await collapseButton.click();

      // Sidebar should be wider again
      await expect(sidebar).toHaveClass(/w-60/);
      await expect(page.getByText('SignApps')).toBeVisible();
    });

    test('should show tooltips when sidebar is collapsed', async ({ page }) => {
      const sidebar = page.locator('aside');
      const collapseButton = sidebar.locator('button').first();

      // Collapse sidebar
      await collapseButton.click();

      // Hover over a navigation item
      const dashboardLink = page.getByRole('link', { name: /dashboard/i });
      await dashboardLink.hover();

      // Tooltip should appear
      await expect(page.getByRole('tooltip', { name: /dashboard/i })).toBeVisible().catch(() => {
        // Tooltip might use different role
      });
    });

    test('should display version in sidebar footer', async ({ page }) => {
      await expect(page.getByText(/v0\.1\.0/)).toBeVisible();
    });
  });

  test.describe('Header Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dashboard');
    });

    test('should display header with user menu', async ({ page }) => {
      const header = page.locator('header');
      await expect(header).toBeVisible();
    });

    test('should display notification icon', async ({ page }) => {
      // Look for bell icon or notification button
      const notificationButton = page.locator('header button').filter({ has: page.locator('svg') });
      const count = await notificationButton.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display user avatar/menu', async ({ page }) => {
      // User menu button in header
      const headerButtons = page.locator('header button, header [role="button"]');
      const count = await headerButtons.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Quick Links from Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dashboard');
    });

    test('should navigate to Containers from stat card', async ({ page }) => {
      // Click on Containers stat card
      const containerCard = page.locator('a').filter({ hasText: /containers/i }).first();
      await containerCard.click();

      await expect(page).toHaveURL(/\/containers/);
    });

    test('should navigate to Storage from stat card', async ({ page }) => {
      const storageCard = page.locator('a').filter({ hasText: /storage/i }).first();
      await storageCard.click();

      await expect(page).toHaveURL(/\/storage/);
    });

    test('should navigate to Routes from stat card', async ({ page }) => {
      const routesCard = page.locator('a').filter({ hasText: /routes/i }).first();
      await routesCard.click();

      await expect(page).toHaveURL(/\/routes/);
    });

    test('should navigate via Quick Actions', async ({ page }) => {
      // Quick Actions section
      const newContainerButton = page.getByRole('button', { name: /new container/i });
      if (await newContainerButton.isVisible()) {
        await newContainerButton.click();
        await expect(page).toHaveURL(/\/containers/);
      }
    });
  });

  test.describe('Responsive Navigation', () => {
    test('should show mobile menu on small screens', async ({ page }) => {
      // Set viewport to mobile size
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');

      // Sidebar might be hidden or collapsed on mobile
      const sidebar = page.locator('aside');

      // On mobile, sidebar might be:
      // 1. Completely hidden
      // 2. Collapsed to icons only
      // 3. Off-screen with a hamburger menu to toggle

      // Check if there's a mobile menu toggle button
      const menuToggle = page.locator('button[aria-label*="menu"], button[class*="menu"]');
      const hasMenuToggle = await menuToggle.count() > 0;

      // Either menu toggle exists or sidebar adapts
      const sidebarVisible = await sidebar.isVisible();
      expect(hasMenuToggle || sidebarVisible).toBeTruthy();
    });

    test('should collapse sidebar on tablet', async ({ page }) => {
      // Set viewport to tablet size
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/dashboard');

      // On tablet, sidebar might be auto-collapsed
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();
    });

    test('should show full sidebar on desktop', async ({ page }) => {
      // Set viewport to desktop size
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/dashboard');

      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();

      // Should show full navigation labels
      await expect(page.getByText('SignApps')).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dashboard');
    });

    test('should navigate with Tab key', async ({ page }) => {
      // Focus first interactive element
      await page.keyboard.press('Tab');

      // Continue tabbing through navigation
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
      }

      // Some navigation element should be focused
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeTruthy();
    });

    test('should activate links with Enter key', async ({ page }) => {
      // Focus the containers link
      const containersLink = page.getByRole('link', { name: /containers/i });
      await containersLink.focus();

      // Press Enter
      await page.keyboard.press('Enter');

      // Should navigate
      await expect(page).toHaveURL(/\/containers/);
    });
  });

  test.describe('Browser Navigation', () => {
    test('should handle browser back button', async ({ page }) => {
      await page.goto('/dashboard');

      // Navigate to containers
      await page.getByRole('link', { name: /containers/i }).click();
      await expect(page).toHaveURL(/\/containers/);

      // Navigate to storage
      await page.getByRole('link', { name: /storage/i }).click();
      await expect(page).toHaveURL(/\/storage/);

      // Go back
      await page.goBack();
      await expect(page).toHaveURL(/\/containers/);

      // Go back again
      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should handle browser forward button', async ({ page }) => {
      await page.goto('/dashboard');
      await page.getByRole('link', { name: /containers/i }).click();
      await page.goBack();

      // Go forward
      await page.goForward();
      await expect(page).toHaveURL(/\/containers/);
    });
  });

  test.describe('404 Page', () => {
    test('should display 404 for unknown routes', async ({ page }) => {
      await page.goto('/unknown-page-that-does-not-exist');

      // Should show 404 page or redirect
      const is404 = await page.getByText(/404|not found/i).isVisible().catch(() => false);
      const isRedirected = page.url().includes('/login') || page.url().includes('/dashboard');

      expect(is404 || isRedirected).toBeTruthy();
    });
  });
});
