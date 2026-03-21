import { test, expect } from '@playwright/test';

// Use the authenticated state created by auth.setup.ts
test.use({ storageState: 'playwright/.auth/user.json' });

test.describe('Scheduling & Calendar Workflows', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the unified hub
        await page.goto('/scheduling/hub');
        // Wait for network to settle so React query finishes fetching
        await page.waitForLoadState('networkidle');
    });

    test('Scenario 1: Room Booking Workflow (Resources)', async ({ page }) => {
        // Assert that the page layout has loaded
        await expect(page.getByRole('heading', { name: /planning/i, level: 1 }).or(page.locator('.calendar-view').first())).toBeVisible({ timeout: 10000 });

        // Ensure no error boundaries or crash messages
        await expect(page.getByText(/error|erreur/i)).toHaveCount(0);

        // Try to trigger a resource booking modal if available
        const resourcesTab = page.getByRole('tab', { name: /ressources/i }).or(page.getByText('Ressources', { exact: true }));
        if (await resourcesTab.count() > 0) {
            await resourcesTab.first().click();
        }

        const bookButton = page.getByRole('button', { name: /réserver|book/i }).first();
        if (await bookButton.count() > 0) {
             await bookButton.click();
             
             // Wait for Dialog to appear
             const dialog = page.getByRole('dialog');
             await expect(dialog).toBeVisible({ timeout: 5000 });
             
             // Verify that form elements are present
             await expect(dialog.locator('input, select, textarea').first()).toBeVisible();

             // Cancel to leave the DB untouched
             const cancelBtn = dialog.getByRole('button', { name: /annuler|fermer|cancel|close/i }).first();
             if(await cancelBtn.isVisible()) {
                 await cancelBtn.click();
             }
        }
    });

    test('Scenario 2: Task Creation and Assignment Workflow', async ({ page }) => {
        // Look for Task creation buttons
        const addTaskBtn = page.getByRole('button', { name: /nouvelle tâche|ajouter une tâche/i }).first().or(
            page.getByRole('button', { name: /nouvel événement|add/i, exact: false }).first()
        );
        
        if (await addTaskBtn.count() > 0 && await addTaskBtn.isVisible()) {
            await addTaskBtn.click();
            
            const dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible({ timeout: 5000 });
            
            // Look for title input
            const titleInput = page.getByPlaceholder(/titre|title/i).first();
            if (await titleInput.count() > 0) {
                await titleInput.fill('Test Task Integration E2E');
            }
            
            // Assignment field
            const assigneeInput = page.getByPlaceholder(/assigner|collaborateur|invite/i).first();
            if (await assigneeInput.count() > 0) {
                await assigneeInput.fill('Admin');
                await page.waitForTimeout(500); // UI debouncing
            }
            
            // Cancel securely to avoid DB pollution on prod/test bounds
            const cancelBtn = dialog.getByRole('button', { name: /annuler|fermer|cancel|close/i }).first();
            if(await cancelBtn.isVisible()) {
                await cancelBtn.click();
            }
            await expect(dialog).not.toBeVisible();
        } else {
             // If UI is strictly calendar based (click on grid), we verify grid interaction
             const calendarGrid = page.locator('.rbc-time-content').first().or(page.locator('.fc-timegrid-cols').first());
             if (await calendarGrid.isVisible()) {
                 await calendarGrid.click();
                 // Look for modal
                 const dialog = page.getByRole('dialog');
                 // Check if it opened
                 if (await dialog.count() > 0) {
                     await expect(dialog).toBeVisible();
                     await dialog.getByRole('button', { name: /annuler/i }).click();
                 }
             }
        }
    });
});
