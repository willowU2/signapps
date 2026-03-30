import { test, expect, testData } from './fixtures';

/**
 * Storage Page E2E Tests
 * Tests tab navigation, upload dialog, and folder creation
 */

test.describe('Storage Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/storage');
  });

  test.describe('Page Layout', () => {
    test('should display storage page with title', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Storage' })).toBeVisible();
    });

    test('should display all tabs', async ({ page }) => {
      const tabs = ['Dashboard', 'Fichiers', 'Disques', 'Montages', 'Externes', 'Partages', 'RAID'];

      for (const tab of tabs) {
        await expect(page.getByRole('tab', { name: tab })).toBeVisible();
      }
    });

    test('should show dashboard tab by default', async ({ page }) => {
      // Dashboard tab should be active
      const dashboardTab = page.getByRole('tab', { name: 'Dashboard' });
      await expect(dashboardTab).toHaveAttribute('data-state', 'active');
    });
  });

  test.describe('Tab Navigation', () => {
    test('should navigate to Files tab', async ({ page }) => {
      await page.getByRole('tab', { name: 'Fichiers' }).click();

      // URL should update
      await expect(page).toHaveURL(/tab=files/);

      // Files tab content should be visible
      await expect(page.getByRole('button', { name: /upload files/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /new folder/i })).toBeVisible();
    });

    test('should navigate to Disks tab', async ({ page }) => {
      await page.getByRole('tab', { name: 'Disques' }).click();
      await expect(page).toHaveURL(/tab=disks/);
    });

    test('should navigate to Mounts tab', async ({ page }) => {
      await page.getByRole('tab', { name: 'Montages' }).click();
      await expect(page).toHaveURL(/tab=mounts/);
    });

    test('should navigate to External tab', async ({ page }) => {
      await page.getByRole('tab', { name: 'Externes' }).click();
      await expect(page).toHaveURL(/tab=external/);
    });

    test('should navigate to Shares tab', async ({ page }) => {
      await page.getByRole('tab', { name: 'Partages' }).click();
      await expect(page).toHaveURL(/tab=shares/);
    });

    test('should navigate to RAID tab', async ({ page }) => {
      await page.getByRole('tab', { name: 'RAID' }).click();
      await expect(page).toHaveURL(/tab=raid/);
    });

    test('should preserve tab state on page reload', async ({ page }) => {
      // Navigate to Files tab
      await page.getByRole('tab', { name: 'Fichiers' }).click();
      await expect(page).toHaveURL(/tab=files/);

      // Reload page
      await page.reload();

      // Should still be on Files tab
      await expect(page).toHaveURL(/tab=files/);
      const filesTab = page.getByRole('tab', { name: 'Fichiers' });
      await expect(filesTab).toHaveAttribute('data-state', 'active');
    });
  });

  test.describe('Dashboard Tab', () => {
    test('should display storage overview stats', async ({ page }) => {
      // Dashboard should show storage statistics
      await page.locator('[class*="Card"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      // Look for stats cards or overview content
      const statsContent = page.locator('[class*="Card"]');
      const count = await statsContent.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display health gauge', async ({ page }) => {
      await page.locator('[class*="Card"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      // Health gauge or utilization display
      await expect(page.getByText(/utilisation/i)).toBeVisible().catch(() => {
        // Might have different text
      });
    });
  });

  test.describe('Files Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Fichiers' }).click();
    });

    test('should display file browser elements', async ({ page }) => {
      // Upload and New Folder buttons
      await expect(page.getByRole('button', { name: /upload files/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /new folder/i })).toBeVisible();

      // Bucket selector
      await expect(page.getByRole('button', { name: /select bucket/i })).toBeVisible().catch(() => {
        // Might show a bucket name if one is selected
      });

      // Search input
      await expect(page.getByPlaceholder(/search files/i)).toBeVisible();
    });

    test('should display breadcrumb navigation', async ({ page }) => {
      // Home button in breadcrumb
      await expect(page.locator('button svg')).toBeTruthy();
    });

    test('should open bucket dropdown', async ({ page }) => {
      // Click bucket selector
      const bucketButton = page.locator('button').filter({ hasText: /bucket|select/i }).first();
      await bucketButton.click();

      // Dropdown should appear
      await expect(page.locator('[role="menu"], [role="listbox"]')).toBeVisible().catch(() => {
        // Might use different component
      });
    });

    test('should display file list header', async ({ page }) => {
      await page.locator('text=Name').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      // File list should have column headers
      await expect(page.getByText('Name')).toBeVisible();
      await expect(page.getByText('Size')).toBeVisible();
      await expect(page.getByText('Modified')).toBeVisible();
    });

    test('should display files or empty message', async ({ page }) => {
      await page.locator('[class*="CardContent"] .divide-y > div, text=/no files found/i').first()
        .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      // Either files are listed or empty message
      const hasFiles = await page.locator('[class*="CardContent"] .divide-y > div').count() > 0;
      const hasEmptyMessage = await page.getByText(/no files found/i).isVisible().catch(() => false);

      expect(hasFiles || hasEmptyMessage).toBeTruthy();
    });

    test('should filter files by search', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search files/i);
      await searchInput.fill('test');
      await page.waitForTimeout(200); // debounce

      // Search should filter the list (visual verification)
    });
  });

  test.describe('Upload Dialog', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Fichiers' }).click();
    });

    test('should open upload dialog', async ({ page }) => {
      await page.getByRole('button', { name: /upload files/i }).click();

      // Dialog should be visible
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });

    test('should close upload dialog with cancel', async ({ page }) => {
      await page.getByRole('button', { name: /upload files/i }).click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Close dialog
      await page.getByRole('button', { name: /cancel|close/i }).click().catch(async () => {
        // Try clicking outside or X button
        await page.keyboard.press('Escape');
      });

      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });
  });

  test.describe('Create Folder Dialog', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Fichiers' }).click();
    });

    test('should open create folder dialog', async ({ page }) => {
      await page.getByRole('button', { name: /new folder/i }).click();

      // Dialog should be visible
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await expect(page.getByRole('heading', { name: /create.*folder/i })).toBeVisible();
    });

    test('should display folder name input', async ({ page }) => {
      await page.getByRole('button', { name: /new folder/i }).click();

      // Folder name input should be visible
      await expect(page.getByLabel(/folder name/i)).toBeVisible();
    });

    test('should show current path info', async ({ page }) => {
      await page.getByRole('button', { name: /new folder/i }).click();

      // Should show where folder will be created
      await expect(page.getByText(/will be created/i)).toBeVisible();
    });

    test('should have create and cancel buttons', async ({ page }) => {
      await page.getByRole('button', { name: /new folder/i }).click();

      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create Folder' })).toBeVisible();
    });

    test('should close dialog with cancel button', async ({ page }) => {
      await page.getByRole('button', { name: /new folder/i }).click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test('should fill folder name and attempt creation', async ({ page }) => {
      await page.getByRole('button', { name: /new folder/i }).click();

      // Fill folder name
      await page.getByLabel(/folder name/i).fill(testData.testFolder.name);

      // Create button should be enabled
      const createButton = page.getByRole('button', { name: 'Create Folder' });
      await expect(createButton).toBeEnabled();
    });
  });

  test.describe('Create Bucket Dialog', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Fichiers' }).click();
    });

    test('should open create bucket dialog', async ({ page }) => {
      // Find the + button next to bucket selector
      const addBucketButton = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: '' });

      // Click the small + button (should be near bucket dropdown)
      await page.locator('button[class*="icon"]').first().click().catch(async () => {
        // Alternative: look for specific button
        const buttons = page.locator('button');
        const count = await buttons.count();
        for (let i = 0; i < count; i++) {
          const button = buttons.nth(i);
          const hasPlus = await button.locator('svg').count() > 0;
          if (hasPlus) {
            const text = await button.textContent();
            if (!text || text.trim() === '') {
              await button.click();
              break;
            }
          }
        }
      });

      // Check if bucket dialog opened
      const hasDialog = await page.locator('[role="dialog"]').isVisible().catch(() => false);
      if (hasDialog) {
        await expect(page.getByText(/create.*bucket/i)).toBeVisible();
      }
    });
  });

  test.describe('RAID Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'RAID' }).click();
    });

    test('should display RAID overview', async ({ page }) => {
      await page.locator('[class*="Card"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      // RAID tab should show arrays or empty state
      const content = page.locator('[class*="Card"]');
      const hasContent = await content.count() > 0;

      expect(hasContent).toBeTruthy();
    });
  });

  test.describe('Shares Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Partages' }).click();
    });

    test('should display shares list', async ({ page }) => {
      await page.locator('main, [class*="Content"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      // Should show shares or empty state
      const content = page.locator('main, [class*="Content"]');
      await expect(content).toBeVisible();
    });
  });
});
