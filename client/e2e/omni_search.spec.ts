import { test, expect } from './fixtures';

/**
 * Omni-Search (Command Palette) E2E Test Suite
 *
 * Verifies global keyboard shortcuts, search filtering,
 * application routing, and AI integration via the OmniSearch component.
 *
 * Step 5 of Architectural Pivot
 */
test.describe('Omni-Search (Command Palette) Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard where AppLayout and Command Palette are active
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should open omni-search dialog via keyboard shortcut (Cmd/Ctrl+K)', async ({ page }) => {
    const modKey = process.platform === 'darwin' ? 'Meta' : 'Control';
    
    // Press global shortcut
    await page.keyboard.press(`${modKey}+KeyK`);

    // Verify dialog appears (title is hidden visually but accessible)
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Verify input is ready
    const input = page.getByPlaceholder(/Rechercher une application/i);
    await expect(input).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('should filter and navigate to a specific application', async ({ page }) => {
    const modKey = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modKey}+KeyK`);

    // Verify input is focused and type command
    const input = page.getByPlaceholder(/Rechercher une application/i);
    await input.fill('Calendar');

    // Find the option text and click it directly to bypass CommandItem event interception
    const optionText = page.locator('span.font-medium').filter({ hasText: 'Calendar' }).first();
    await expect(optionText).toBeVisible();

    // Trigger action
    await optionText.click({ force: true });

    // Verify routing 
    await page.waitForURL('**/calendar', { timeout: 10000 });
    expect(page.url()).toContain('/calendar');
  });

  test('should trigger AI Autopilot options for complex queries', async ({ page }) => {
    const modKey = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modKey}+KeyK`);

    const input = page.getByPlaceholder(/Rechercher une application/i);
    await input.fill('analyser les logs serveurs');

    // Wait for autopilot suggestions to render (debounce)
    await page.waitForTimeout(200);

    // Verify the Autopilot group appears
    const autopilotHeader = page.getByText('SignApps Autopilot', { exact: true });
    await expect(autopilotHeader).toBeVisible();

    // Verify the AI Action item matches the query
    const aiAction = page.getByRole('option', { name: /Demander à l'IA d'agir/i });
    await expect(aiAction).toBeVisible();
    await expect(aiAction).toContainText('analyser les logs serveurs');
    
    // Verify RAG Assistant option
    const ragAction = page.getByRole('option', { name: /Interroger l'IA sur/i });
    await expect(ragAction).toBeVisible();
    await expect(ragAction).toContainText('analyser les logs serveurs');
  });
});
