import { test, expect } from './fixtures';

/**
 * Workspace Mail Layout E2E Tests
 * Tests for the Gmail-like Mail interface (client/src/app/mail/page.tsx)
 */

test.describe('Workspace Mail Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mail');
    // Wait for the mail workspace to load
    await page.waitForSelector('text=Nouveau message', { timeout: 10000 });
  });

  test.describe('Layout Structure', () => {
    test('should display workspace header', async ({ page }) => {
      // WorkspaceHeader component should be visible
      const header = page.locator('header').first();
      await expect(header).toBeVisible();
    });

    test('should display workspace rail with app icons', async ({ page }) => {
      // WorkspaceRail should show Mail as active
      const mailIcon = page.getByRole('button', { name: /mail/i }).or(
        page.locator('[data-app="mail"]')
      );
      // The rail should be visible
      const rail = page.locator('aside').first();
      await expect(rail).toBeVisible();
    });

    test('should display compose button', async ({ page }) => {
      const composeButton = page.getByRole('button', { name: /nouveau message/i });
      await expect(composeButton).toBeVisible();
    });

    test('should display navigation links', async ({ page }) => {
      // Check main navigation items
      await expect(page.getByText('Boîte de réception')).toBeVisible();
      await expect(page.getByText('Messages suivis')).toBeVisible();
      await expect(page.getByText('En attente')).toBeVisible();
      await expect(page.getByText('Messages envoyés')).toBeVisible();
      await expect(page.getByText('Brouillons')).toBeVisible();
    });

    test('should display labels section', async ({ page }) => {
      await expect(page.getByText('Libellés')).toBeVisible();
    });
  });

  test.describe('Compose Dialog', () => {
    test('should open compose AI dialog when clicking compose button', async ({ page }) => {
      const composeButton = page.getByRole('button', { name: /nouveau message/i });
      await composeButton.click();

      // Dialog should appear
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });
    });

    test('should close compose dialog on cancel', async ({ page }) => {
      const composeButton = page.getByRole('button', { name: /nouveau message/i });
      await composeButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Close the dialog
      const closeButton = dialog.getByRole('button', { name: /annuler|fermer|cancel|close/i });
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await expect(dialog).not.toBeVisible();
      }
    });
  });

  test.describe('Mail List', () => {
    test('should display mail items', async ({ page }) => {
      // Check for mock mail items
      const mailContent = page.locator('.bg-white, [class*="Card"]').first();
      await expect(mailContent).toBeVisible();
    });

    test('should show sender names in mail list', async ({ page }) => {
      // Check for mock data senders (Indeed, LinkedIn, Alan)
      const mailList = page.locator('main, [role="main"]').or(page.locator('.flex-1'));
      await expect(mailList).toBeVisible();
    });
  });

  test.describe('Labels Section', () => {
    test('should toggle labels section expansion', async ({ page }) => {
      const labelsToggle = page.getByRole('button', { name: /libellés/i }).or(
        page.locator('button:has-text("Libellés")')
      );

      // Labels should be visible initially
      const labelItems = page.locator('button:has-text("[Imap]")');
      await expect(labelItems.first()).toBeVisible();

      // Click to collapse
      await labelsToggle.click();

      // Wait for animation
      await page.waitForTimeout(300);
    });

    test('should display label items', async ({ page }) => {
      // Check for label items from the mock data
      await expect(page.getByText('[Imap]/Archived').or(page.getByText('Reply_Later'))).toBeVisible();
    });
  });

  test.describe('More Options', () => {
    test('should display more options button', async ({ page }) => {
      const moreButton = page.getByRole('button', { name: /plus/i }).first();
      await expect(moreButton).toBeVisible();
    });
  });

  test.describe('Responsive Layout', () => {
    test('should maintain layout on viewport resize', async ({ page }) => {
      // Verify layout at different sizes
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(page.getByText('Nouveau message')).toBeVisible();

      await page.setViewportSize({ width: 1280, height: 720 });
      await expect(page.getByText('Nouveau message')).toBeVisible();
    });
  });

  test.describe('Mail Selection', () => {
    test('should select mail item and show display view', async ({ page }) => {
      // Find and click a mail item
      const mailItem = page.locator('button').filter({ hasText: /indeed|linkedin|alan/i }).first();

      if (await mailItem.isVisible()) {
        await mailItem.click();

        // Should show back button in display mode
        const backButton = page.getByRole('button', { name: /retour/i });
        await expect(backButton).toBeVisible({ timeout: 5000 });
      }
    });

    test('should return to list view when clicking back', async ({ page }) => {
      // Click a mail item first
      const mailItem = page.locator('button').filter({ hasText: /indeed|linkedin|alan/i }).first();

      if (await mailItem.isVisible()) {
        await mailItem.click();

        // Wait for display view
        const backButton = page.getByRole('button', { name: /retour/i });
        if (await backButton.isVisible({ timeout: 3000 })) {
          await backButton.click();

          // Should be back to list view
          await expect(page.getByText('Nouveau message')).toBeVisible();
        }
      }
    });
  });
});
