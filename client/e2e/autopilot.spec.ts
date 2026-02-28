import { test, expect } from './fixtures';

/**
 * Autopilot E2E Tests (Real CRUD Data Only)
 * Simulates a full Action Execution loop using a real Docker container.
 * NO MOCK DATA.
 */
test.describe('SignApps Autopilot', () => {
  const containerName = `autopilot-test-${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    // Navigate to containers page
    await page.goto('/containers');
  });

  test('should proactively suggest restarting a stopped container and execute the action', async ({ page }) => {
    // 1. CREATE: Deploy a real test container
    await page.getByRole('button', { name: /new container/i }).click();
    await page.getByLabel('Container Name').fill(containerName);
    await page.getByLabel('Image').fill('alpine:latest');
    // Alpine exits immediately if no long running command is provided. 
    // This allows us to naturally trigger the "Exited" state for the Autopilot to detect!
    await page.getByRole('button', { name: 'Create Container' }).click();

    // Wait for the container card to appear in the list
    const containerCard = page.locator(`[class*="Card"]`, { hasText: containerName });
    await expect(containerCard).toBeVisible({ timeout: 15000 });

    // 2. TRIGGER AUTOPILOT: Because alpine exits immediately, the status will quickly become 'exited'.
    // The pageContext useEffect will detect this and trigger the proactive message.
    
    // Check if the AI assistant button has the Sparkles icon or glowing class
    const aiButton = page.getByRole('button', { name: /Ask AI Assistant/i });
    
    // Based on ContextAssistant logic, if proactive, it shows a Sparkle icon
    await expect(aiButton.locator('.lucide-sparkles')).toBeVisible({ timeout: 10000 });

    // Ensure the tooltip says something about the crashed container
    await aiButton.hover();
    await expect(page.getByRole('tooltip')).toContainText(containerName);

    // 3. EXECUTE ACTION: Click the glowing assistant
    await aiButton.click();

    // Verify the loading toast appears
    await expect(page.locator('.sonner-toast', { hasText: /Executing/i })).toBeVisible();

    // Wait for success toast, meaning Claude parsed the intent and hit the Action URL which succeeded
    await expect(page.locator('.sonner-toast', { hasText: /Action Success/i })).toBeVisible({ timeout: 15000 });

    // 4. CLEANUP: Delete the test container via the UI
    const moreButton = containerCard.locator('button').filter({ has: page.locator('svg') }).last();
    await moreButton.click();
    
    // Deal with the Dropdown menu
    await page.getByRole('menuitem', { name: /remove/i }).click();
    
    // Potentially confirm deletion if there's an alert dialog
    const confirmButton = page.getByRole('button', { name: /delete|confirm|remove/i }).last();
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Verify container is gone
    await expect(containerCard).not.toBeVisible();
  });
});
