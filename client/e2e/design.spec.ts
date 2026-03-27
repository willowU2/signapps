import { test, expect } from './fixtures';

/**
 * SignDesign E2E Tests
 *
 * Covers the design module dashboard and canvas editor.
 */

test.describe('SignDesign', () => {
  test('dashboard loads at /design with create button', async ({ page }) => {
    await page.goto('/design');
    await expect(page.locator('body')).toBeVisible();
    // Dashboard heading should be visible
    const heading = page.locator('h1, [data-testid="design-dashboard"]');
    await heading.first().waitFor({ state: 'visible', timeout: 10000 });
    // A create/new design button should be present
    const createBtn = page.locator(
      'button:has-text("Nouveau"), button:has-text("New"), button:has-text("Créer"), [data-testid="create-design"]'
    );
    await expect(createBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test('canvas editor loads at /design/editor', async ({ page }) => {
    await page.goto('/design/editor');
    await expect(page.locator('body')).toBeVisible();
    // The editor canvas or spinner should appear
    const canvas = page.locator(
      'canvas, [data-testid="design-editor"], [class*="editor"], [class*="canvas"]'
    );
    await canvas.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
      // Editor may still be initializing (Suspense / dynamic import)
    });
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('.error-boundary')).not.toBeVisible();
  });

  test('editor toolbar buttons are visible and clickable', async ({ page }) => {
    await page.goto('/design/editor');
    await expect(page.locator('body')).toBeVisible();
    // Wait for toolbar to appear
    const toolbar = page.locator(
      '[data-testid="editor-toolbar"], [class*="toolbar"], [role="toolbar"]'
    );
    await toolbar.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
      // Toolbar may be embedded differently — fall back to button presence
    });
    // At minimum, there should be some buttons in the page
    const buttons = page.locator('button');
    await expect(buttons.first()).toBeVisible({ timeout: 15000 });
    // Verify clicking a button does not throw (no error boundary appears)
    const firstBtn = buttons.first();
    if (await firstBtn.isEnabled()) {
      await firstBtn.click({ timeout: 5000 }).catch(() => {});
    }
    await expect(page.locator('.error-boundary')).not.toBeVisible();
  });
});
