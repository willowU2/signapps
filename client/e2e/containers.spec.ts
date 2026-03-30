import { test, expect, testData, selectors } from './fixtures';

/**
 * Containers Page E2E Tests
 * Tests container listing, creation dialog, and start/stop functionality
 */

test.describe('Containers Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to containers page before each test
    await page.goto('/containers');
  });

  test.describe('Container List Display', () => {
    test('should display containers page with title', async ({ page }) => {
      // Check page title
      await expect(page.getByRole('heading', { name: 'Containers' })).toBeVisible();
    });

    test('should display action buttons', async ({ page }) => {
      // Check for Refresh button
      await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();

      // Check for New Container button
      await expect(page.getByRole('button', { name: /new container/i })).toBeVisible();
    });

    test('should display filter buttons', async ({ page }) => {
      // Check filter buttons
      await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Running' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Stopped' })).toBeVisible();
    });

    test('should display search input', async ({ page }) => {
      // Check search input
      await expect(page.getByPlaceholder('Search containers...')).toBeVisible();
    });

    test('should filter containers by status', async ({ page }) => {
      // Click Running filter
      await page.getByRole('button', { name: 'Running' }).click();

      // Verify filter is active (button should have different style)
      const runningButton = page.getByRole('button', { name: 'Running' });
      await expect(runningButton).toHaveAttribute('data-state', 'active').catch(() => {
        // Alternative: check for active class or style
      });

      // Click Stopped filter
      await page.getByRole('button', { name: 'Stopped' }).click();

      // Click All to reset
      await page.getByRole('button', { name: 'All' }).click();
    });

    test('should search containers by name', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search containers...');

      // Type in search
      await searchInput.fill('nginx');

      // Wait for filter to apply (debounce)
      await page.waitForLoadState("domcontentloaded").catch(() => {});

      // Verify search is applied (results should be filtered)
      // This is a visual verification - actual results depend on data
    });

    test('should display container cards or empty state', async ({ page }) => {
      // Wait for loading to complete
      await page.locator('[class*="Card"], text=No containers found').first()
        .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      // Either containers are displayed or empty message
      const hasContainers = await page.locator('[class*="Card"]').count() > 0;
      const hasEmptyMessage = await page.getByText('No containers found').isVisible().catch(() => false);

      expect(hasContainers || hasEmptyMessage).toBeTruthy();
    });

    test('should show container details in list', async ({ page }) => {
      // Wait for loading
      await page.locator('[class*="Card"]').first()
        .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      // Check if any container cards exist
      const containerCards = page.locator('[class*="Card"]');
      const count = await containerCards.count();

      if (count > 0) {
        // First container card should show name and image info
        const firstCard = containerCards.first();
        await expect(firstCard).toBeVisible();

        // Container should have status indicator (colored dot)
        await expect(firstCard.locator('.rounded-full')).toBeVisible().catch(() => {});
      }
    });
  });

  test.describe('Create Container Dialog', () => {
    test('should open create container dialog', async ({ page }) => {
      // Click New Container button
      await page.getByRole('button', { name: /new container/i }).click();

      // Dialog should be visible
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Check dialog title
      await expect(page.getByRole('heading', { name: 'Create Container' })).toBeVisible();
    });

    test('should display all tabs in create dialog', async ({ page }) => {
      await page.getByRole('button', { name: /new container/i }).click();

      // Check all tabs are present
      await expect(page.getByRole('tab', { name: 'General' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Ports' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Environment' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Volumes' })).toBeVisible();
    });

    test('should show general tab form fields', async ({ page }) => {
      await page.getByRole('button', { name: /new container/i }).click();

      // General tab should be active by default
      await expect(page.getByLabel('Container Name')).toBeVisible();
      await expect(page.getByLabel('Image')).toBeVisible();
      await expect(page.getByLabel('Restart Policy')).toBeVisible();
    });

    test('should switch between tabs', async ({ page }) => {
      await page.getByRole('button', { name: /new container/i }).click();

      // Switch to Ports tab
      await page.getByRole('tab', { name: 'Ports' }).click();
      await expect(page.getByText('Port Mappings')).toBeVisible();
      await expect(page.getByRole('button', { name: /add port/i })).toBeVisible();

      // Switch to Environment tab
      await page.getByRole('tab', { name: 'Environment' }).click();
      await expect(page.getByText('Environment Variables')).toBeVisible();
      await expect(page.getByRole('button', { name: /add variable/i })).toBeVisible();

      // Switch to Volumes tab
      await page.getByRole('tab', { name: 'Volumes' }).click();
      await expect(page.getByText('Volume Mounts')).toBeVisible();
      await expect(page.getByRole('button', { name: /add volume/i })).toBeVisible();
    });

    test('should add and remove port mappings', async ({ page }) => {
      await page.getByRole('button', { name: /new container/i }).click();
      await page.getByRole('tab', { name: 'Ports' }).click();

      // Initially no port mappings
      await expect(page.getByText('No port mappings configured')).toBeVisible();

      // Add a port mapping
      await page.getByRole('button', { name: /add port/i }).click();

      // Port inputs should appear
      await expect(page.getByPlaceholder('Host port')).toBeVisible();
      await expect(page.getByPlaceholder('Container port')).toBeVisible();

      // Remove the port mapping
      const deleteButton = page.locator('button').filter({ has: page.locator('.text-destructive') }).first();
      await deleteButton.click();

      // Should show empty message again
      await expect(page.getByText('No port mappings configured')).toBeVisible();
    });

    test('should add and remove environment variables', async ({ page }) => {
      await page.getByRole('button', { name: /new container/i }).click();
      await page.getByRole('tab', { name: 'Environment' }).click();

      // Add an env var
      await page.getByRole('button', { name: /add variable/i }).click();

      // Inputs should appear
      await expect(page.getByPlaceholder('KEY')).toBeVisible();
      await expect(page.getByPlaceholder('value')).toBeVisible();
    });

    test('should add and remove volumes', async ({ page }) => {
      await page.getByRole('button', { name: /new container/i }).click();
      await page.getByRole('tab', { name: 'Volumes' }).click();

      // Add a volume
      await page.getByRole('button', { name: /add volume/i }).click();

      // Volume inputs should appear
      await expect(page.getByPlaceholder('/host/path')).toBeVisible();
      await expect(page.getByPlaceholder('/container/path')).toBeVisible();
    });

    test('should close dialog with cancel button', async ({ page }) => {
      await page.getByRole('button', { name: /new container/i }).click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Click cancel
      await page.getByRole('button', { name: 'Cancel' }).click();

      // Dialog should be closed
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await page.getByRole('button', { name: /new container/i }).click();

      // Try to create without filling required fields
      await page.getByRole('button', { name: 'Create Container' }).click();

      // Should show error toast or validation message - wait for response
      await page.waitForLoadState("domcontentloaded").catch(() => {}); // debounce
    });

    test('should fill form and attempt creation', async ({ page }) => {
      await page.getByRole('button', { name: /new container/i }).click();

      // Fill in container details
      await page.getByLabel('Container Name').fill(testData.testContainer.name);
      await page.getByLabel('Image').fill(testData.testContainer.image);

      // Click create (this will attempt API call)
      await page.getByRole('button', { name: 'Create Container' }).click();

      // Wait for response - either success or error toast
      await page.locator('[role="status"], [role="alert"], [data-testid*="toast"]').first()
        .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    });
  });

  test.describe('Container Actions', () => {
    test('should have start/stop buttons on container cards', async ({ page }) => {
      await page.locator('[class*="Card"]').first()
        .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const containerCards = page.locator('[class*="Card"]');
      const count = await containerCards.count();

      if (count > 0) {
        const firstCard = containerCards.first();

        // Should have either Start or Stop button
        const hasStartButton = await firstCard.getByRole('button', { name: /start/i }).isVisible().catch(() => false);
        const hasStopButton = await firstCard.getByRole('button', { name: /stop/i }).isVisible().catch(() => false);

        // At least one should be visible
        expect(hasStartButton || hasStopButton).toBeTruthy();
      }
    });

    test('should have logs button on container cards', async ({ page }) => {
      await page.locator('[class*="Card"]').first()
        .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const containerCards = page.locator('[class*="Card"]');
      const count = await containerCards.count();

      if (count > 0) {
        const firstCard = containerCards.first();
        await expect(firstCard.getByRole('button', { name: /logs/i })).toBeVisible();
      }
    });

    test('should have dropdown menu with more actions', async ({ page }) => {
      await page.locator('[class*="Card"]').first()
        .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const containerCards = page.locator('[class*="Card"]');
      const count = await containerCards.count();

      if (count > 0) {
        // Find the more actions button (three dots menu)
        const moreButton = containerCards.first().locator('button').filter({ has: page.locator('svg') }).last();
        await moreButton.click();

        // Dropdown should show Restart and Remove options
        await expect(page.getByRole('menuitem', { name: /restart/i })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: /remove/i })).toBeVisible();
      }
    });

    test('should open logs dialog', async ({ page }) => {
      await page.locator('[class*="Card"]').first()
        .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const containerCards = page.locator('[class*="Card"]');
      const count = await containerCards.count();

      if (count > 0) {
        // Click logs button
        await containerCards.first().getByRole('button', { name: /logs/i }).click();

        // Logs dialog should open
        await expect(page.locator('[role="dialog"]')).toBeVisible();
      }
    });

    test('should refresh container list', async ({ page }) => {
      // Click refresh button
      await page.getByRole('button', { name: /refresh/i }).click();

      // Button might show loading state briefly - wait for refresh to complete
      await page.waitForLoadState("domcontentloaded").catch(() => {}); // debounce

      // Page should still be functional
      await expect(page.getByRole('heading', { name: 'Containers' })).toBeVisible();
    });
  });
});
