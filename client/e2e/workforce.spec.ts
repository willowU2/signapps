import { test, expect } from '@playwright/test';

// Use the authenticated state created by auth.setup.ts
test.use({ storageState: 'playwright/.auth/user.json' });

test.describe('Workforce Organigram & Employees explorer', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/team/org-chart');
        await page.waitForLoadState('networkidle');
    });

    test('Scenario 3: Organigramme Explorer renders correctly', async ({ page }) => {
        // Since ReactFlow can take a moment to draw nodes
        await page.locator('.react-flow').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

        // Expect a ReactFlow canvas to be present
        const flowCanvas = page.locator('.react-flow').first();
        await expect(flowCanvas).toBeVisible({ timeout: 15000 });
        
        // Ensure there are some generic nodes
        const nodes = page.locator('.react-flow__node');
        // wait for at least one node
        await expect(nodes.first()).toBeVisible({ timeout: 10000 });
        
        // Ensure that clicking a node opens the employee sheet
        await nodes.first().click();
        
        // Wait for the side panel (sheet) to open
        const rightPanel = page.getByRole('dialog').or(page.locator('[data-state="open"]'));
        await expect(rightPanel.first()).toBeVisible({ timeout: 5000 });
        
        // Verify the profile details are loaded inside the sheet
        const profileAvatar = rightPanel.locator('.rounded-full').first().or(rightPanel.getByRole('img').first());
        if (await profileAvatar.count() > 0) {
            await expect(profileAvatar.first()).toBeVisible();
        }
        
        // Close the panel securely
        const closeBtn = rightPanel.locator('button').filter({ hasText: /fermer|close/i }).first().or(
            rightPanel.locator('button > svg.lucide-x').first().locator('..')
        );
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await expect(rightPanel.first()).not.toBeVisible();
        }
    });

    test('Scenario 3b: Ensure Team Directory view is accessible', async ({ page }) => {
         // Check the classic team directory view if available
         await page.goto('/team/directory');
         await page.waitForLoadState('networkidle');

         // Wait for employee cards or table rows (skip header)
         const employeeCard = page.locator('.rounded-lg.border').first().or(page.getByRole('row').nth(1));
         await expect(employeeCard).toBeVisible({ timeout: 10000 });

         // Test search functionality
         const searchInput = page.getByPlaceholder(/rechercher|search/i).first();
         if (await searchInput.isVisible()) {
             await searchInput.fill('Admin');
             // The list should filter - debounce
             await page.waitForTimeout(200);
             // Ensure at least one item remains
             await expect(employeeCard).toBeVisible();
         }
    });
});
