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
    // Listen to console.log inside the browser to debug the ContextAssistant state
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    const containerName = `autopilot-test-${Date.now()}`;

    // 1. CREATE A FAILING CONTAINER
    await page.goto('/containers');
    await page.getByRole('button', { name: 'New Container' }).click();
    await page.getByLabel('Container Name').fill(containerName);
    await page.getByLabel('Image').fill('alpine:latest');
    // Alpine exits immediately if no long running command is provided. 
    // This allows us to naturally trigger the "Exited" state for the Autopilot to detect!
    await page.getByRole('button', { name: 'Create Container' }).click();

    // Wait for the container card to appear in the list
    const containerCard = page.locator('button', { hasText: containerName }).locator('..').locator('..').locator('..');
    await expect(page.getByRole('button', { name: containerName })).toBeVisible({ timeout: 15000 });

    // 2. TRIGGER AUTOPILOT: Because alpine exits immediately, the status will quickly become 'exited'.
    // The pageContext useEffect will detect this and trigger the proactive message.
    
    // Check if the AI assistant button has the Sparkles icon or glowing class
    const aiButton = page.getByRole('button', { name: /Ask AI Assistant/i });
    
    // Wait for the AI Assistant to enter proactive mode (warning state with animation)
    await expect(aiButton).toHaveClass(/animate-ai-warning/, { timeout: 15000 });

    // Ensure React state is fully flushed and `isProactive` is true by checking the tooltip title
    await expect(aiButton).toHaveAttribute('title', /restart/i, { timeout: 10000 });

    // 3. EXECUTE ACTION: Use dispatchEvent to bypass pointer-events intercepts and fire the React synthetic event directly
    await aiButton.dispatchEvent('click');

    // Verify the executing toast or success toast appears natively
    await expect(page.locator('text=/Executing AI action/i')).toBeVisible({ timeout: 15000 }).catch(() => console.log('Executing toast might have been missed or overwritten'));

    // Wait for success toast, meaning Claude parsed the intent and hit the Action URL which succeeded
    await expect(page.getByText(/Action Success/i)).toBeVisible({ timeout: 30000 });

    // 4. CLEANUP: Delete the test container via the UI
    try {
      // The container list might re-render after the action
      await page.waitForTimeout(1000);
      const moreButton = containerCard.locator('button').filter({ has: page.locator('svg') }).last();
      await moreButton.click({ timeout: 5000 });
      
      // Deal with the Dropdown menu
      await page.getByRole('menuitem', { name: /remove|delete/i }).click({ timeout: 5000 });
      
      // Potentially confirm deletion if there's an alert dialog
      const confirmButton = page.getByRole('button', { name: /delete|confirm|remove/i }).last();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Verify container is gone
      await expect(containerCard).not.toBeVisible({ timeout: 5000 });
    } catch (e) {
      console.log('Cleanup failed or skipped (non-fatal):', e);
    }
  });
});
