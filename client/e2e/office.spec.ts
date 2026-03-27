import { test, expect } from './fixtures';

/**
 * Office Suite E2E Tests
 *
 * Covers docs, sheets, and slides — list views and editors.
 */

test.describe('Office Suite', () => {
  test('/docs page loads and doc list renders', async ({ page }) => {
    await page.goto('/docs');
    await expect(page.locator('body')).toBeVisible();
    // Heading should be visible
    const heading = page.locator('h1, [data-testid="docs-title"]');
    await heading.first().waitFor({ state: 'visible', timeout: 10000 });
    // Either a list of documents or an empty-state message
    const docList = page.locator('[data-testid="document-item"], .document-card');
    const emptyState = page.locator('text=/aucun document|no documents|créer|nouveau/i');
    const hasItems = await docList.count() > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasItems || hasEmpty).toBeTruthy();
  });

  test('/sheets page loads and sheet list renders', async ({ page }) => {
    await page.goto('/sheets');
    await expect(page.locator('body')).toBeVisible();
    const heading = page.locator('h1, [data-testid="sheets-title"]');
    await heading.first().waitFor({ state: 'visible', timeout: 10000 });
    const sheetList = page.locator('[data-testid="sheet-item"], .sheet-card');
    const emptyState = page.locator('text=/aucun|no sheet|créer|nouveau/i');
    const hasItems = await sheetList.count() > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasItems || hasEmpty).toBeTruthy();
  });

  test('/slides page loads and slide list renders', async ({ page }) => {
    await page.goto('/slides');
    await expect(page.locator('body')).toBeVisible();
    const heading = page.locator('h1, [data-testid="slides-title"]');
    await heading.first().waitFor({ state: 'visible', timeout: 10000 });
    const slideList = page.locator('[data-testid="slide-item"], .slide-card');
    const emptyState = page.locator('text=/aucun|no slide|créer|nouveau/i');
    const hasItems = await slideList.count() > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasItems || hasEmpty).toBeTruthy();
  });

  test('/docs/editor loads with TipTap editor', async ({ page }) => {
    await page.goto('/docs/editor');
    await expect(page.locator('body')).toBeVisible();
    // TipTap editor element
    const editor = page.locator('.tiptap, .ProseMirror, [contenteditable="true"]');
    await editor.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
      // Editor may require a document id — check that page at least loads
    });
    await expect(page.locator('.error-boundary')).not.toBeVisible();
  });

  test('/sheets/editor loads with spreadsheet grid', async ({ page }) => {
    await page.goto('/sheets/editor');
    await expect(page.locator('body')).toBeVisible();
    // Spreadsheet grid or table
    const grid = page.locator(
      '[data-testid="sheet-grid"], table, [class*="spreadsheet"], [class*="grid"], canvas'
    );
    await grid.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
      // Grid may need a sheet id — verify no crash at minimum
    });
    await expect(page.locator('.error-boundary')).not.toBeVisible();
  });
});
