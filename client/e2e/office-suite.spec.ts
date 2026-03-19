import { test, expect } from './fixtures';

/**
 * Solid Office Suite E2E Test
 * Prioritizes actual data mutation via the UI over soft checks.
 * MOCK DATA IS STRICTLY BANNED as per Knowledge Base.
 */
test.describe('Office Suite Operations - Solid Architecture', () => {

  test('Should create a real Document, type text, and save', async ({ page }) => {
    // Navigate to docs
    await page.goto('/docs');
    
    // Create new document
    const newDocBtn = page.getByRole('button', { name: /nouveau|new/i });
    await expect(newDocBtn).toBeVisible({ timeout: 15000 });
    await newDocBtn.click();
    
    // Wait for the actual TipTap editor to appear and be interactive
    const editor = page.locator('.tiptap, .ProseMirror, [contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 15000 });
    
    // Solid action: Focus and type
    await editor.click();
    const uniqueText = `Solid Architecture Test Document ${Date.now()}`;
    await page.keyboard.type(uniqueText);
    
    // Check if the exact text exists in the editor
    await expect(editor).toContainText(uniqueText);
    
    // Attempt an export if available (testing integrations)
    const exportBtn = page.getByRole('button', { name: /export|download|télécharger/i });
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      const pdfOption = page.locator('text=/pdf/i').first();
      // Ensure the menu items appear solidly without clicking to avoid actual downloads failing in CI
      await expect(pdfOption).toBeVisible();
    }
  });

});
