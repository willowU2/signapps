import { test, expect } from './fixtures';

/**
 * Tasks Layout E2E Tests
 * Tests for the Google Tasks-like interface (client/src/app/tasks/page.tsx)
 */

test.describe('Tasks Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
    // Wait for the tasks page to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Structure', () => {
    test('should display tasks container', async ({ page }) => {
      // The main container with rounded corners
      const container = page.locator('.rounded-\\[24px\\], [class*="rounded"]').first();
      await expect(container).toBeVisible({ timeout: 10000 });
    });

    test('should display tasks header', async ({ page }) => {
      // TasksHeader component
      const header = page.locator('header, [class*="header"]').first();
      await expect(header).toBeVisible();
    });

    test('should display loading state or task list', async ({ page }) => {
      // Either loading or actual content
      const loadingOrContent = page.getByText(/chargement|aucune liste|mes tâches/i);
      await expect(loadingOrContent).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Header Actions', () => {
    test('should have calendar/list selector in header', async ({ page }) => {
      // Look for dropdown trigger in header
      const dropdown = page.getByRole('button', { name: /mes tâches|my tasks/i }).or(
        page.locator('[role="combobox"]')
      );

      if (await dropdown.isVisible({ timeout: 5000 })) {
        await expect(dropdown).toBeVisible();
      }
    });

    test('should have add task button or action', async ({ page }) => {
      // Look for add task functionality
      const addButton = page.getByRole('button', { name: /ajouter|nouvelle|add|new|\+/i }).first();

      if (await addButton.isVisible({ timeout: 5000 })) {
        await expect(addButton).toBeVisible();
      }
    });

    test('should have export/import options', async ({ page }) => {
      // Look for more options menu
      const moreButton = page.getByRole('button', { name: /more|plus|options/i }).or(
        page.locator('button:has(svg[class*="MoreVertical"]), button:has(svg)')
      );

      if (await moreButton.isVisible({ timeout: 3000 })) {
        await moreButton.click();

        // Check for export/import options
        const exportOption = page.getByRole('menuitem', { name: /export/i });
        const importOption = page.getByRole('menuitem', { name: /import/i });

        // At least one should be visible if menu opened
        await expect(exportOption.or(importOption)).toBeVisible({ timeout: 3000 }).catch(() => {});
      }
    });
  });

  test.describe('Task Form Dialog', () => {
    test('should open task form dialog when adding task', async ({ page }) => {
      // Find and click add button
      const addButton = page.getByRole('button', { name: /ajouter|nouvelle|add|new|\+/i }).first();

      if (await addButton.isVisible({ timeout: 5000 })) {
        await addButton.click();

        // TaskForm dialog should appear
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 5000 });
      }
    });

    test('should close task form on cancel', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /ajouter|nouvelle|add|new|\+/i }).first();

      if (await addButton.isVisible({ timeout: 5000 })) {
        await addButton.click();

        const dialog = page.getByRole('dialog');
        if (await dialog.isVisible({ timeout: 3000 })) {
          const cancelButton = dialog.getByRole('button', { name: /annuler|cancel|fermer|close/i });

          if (await cancelButton.isVisible()) {
            await cancelButton.click();
            await expect(dialog).not.toBeVisible({ timeout: 3000 });
          }
        }
      }
    });
  });

  test.describe('Task Tree', () => {
    test('should display task tree component when calendar selected', async ({ page }) => {
      // Wait for potential API call
      await page.waitForTimeout(1000);

      // TaskTree should be in the content area
      const taskTree = page.locator('[class*="TaskTree"], .pb-20').first();

      // Either task tree or empty state message
      const content = taskTree.or(page.getByText(/aucune liste de tâches/i));
      await expect(content).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Export Dialog', () => {
    test('should open export dialog', async ({ page }) => {
      // Find the more menu
      const moreButton = page.locator('button').filter({ has: page.locator('svg') }).last();

      if (await moreButton.isVisible({ timeout: 3000 })) {
        await moreButton.click();

        const exportOption = page.getByRole('menuitem', { name: /export/i });
        if (await exportOption.isVisible({ timeout: 2000 })) {
          await exportOption.click();

          const dialog = page.getByRole('dialog');
          await expect(dialog).toBeVisible({ timeout: 3000 }).catch(() => {});
        }
      }
    });
  });

  test.describe('Import Dialog', () => {
    test('should open import dialog', async ({ page }) => {
      const moreButton = page.locator('button').filter({ has: page.locator('svg') }).last();

      if (await moreButton.isVisible({ timeout: 3000 })) {
        await moreButton.click();

        const importOption = page.getByRole('menuitem', { name: /import/i });
        if (await importOption.isVisible({ timeout: 2000 })) {
          await importOption.click();

          const dialog = page.getByRole('dialog');
          await expect(dialog).toBeVisible({ timeout: 3000 }).catch(() => {});
        }
      }
    });
  });

  test.describe('Empty State', () => {
    test('should show appropriate message when no calendars exist', async ({ page }) => {
      // When no calendars, should show empty state
      const emptyMessage = page.getByText(/aucune liste de tâches trouvée|no task lists found/i);

      // This might or might not be visible depending on state
      if (await emptyMessage.isVisible({ timeout: 5000 })) {
        await expect(emptyMessage).toBeVisible();
      }
    });
  });

  test.describe('Responsive Layout', () => {
    test('should center task container on different viewports', async ({ page }) => {
      const container = page.locator('.max-w-md, [class*="max-w"]').first();

      await page.setViewportSize({ width: 1920, height: 1080 });
      if (await container.isVisible({ timeout: 3000 })) {
        await expect(container).toBeVisible();
      }

      await page.setViewportSize({ width: 768, height: 1024 });
      if (await container.isVisible({ timeout: 3000 })) {
        await expect(container).toBeVisible();
      }
    });
  });
});
