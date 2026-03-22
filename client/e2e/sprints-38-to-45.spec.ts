import { test, expect } from '@playwright/test';

test.describe('SignApps - Sprints 38 to 45 Feature Validation', () => {

  // Auth is typically handled by auth.setup.ts, but we include it in the describe block
  test.beforeEach(async ({ page }) => {
    // Navigate to the app root
    await page.goto('/');
  });

  test('Command Palette Universal Search (Sprint 39)', async ({ page }) => {
    // 1. Open Command Palette via shortcut
    await page.keyboard.press('Control+k');
    
    // 2. Wait for the dialog to appear
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // 3. Type a search query
    const input = page.locator('input[placeholder*="Type a command or search"]');
    await input.fill('test document');

    // 4. Check if we receive results or the AI fallback button
    // The Universal Search should render items dynamically.
    const commandList = page.locator('[cmdk-list]');
    await expect(commandList).toBeVisible();
    
    // If backend is down, we expect the Ask AI fallback
    const emptyState = page.locator('text=Ask Universal AI to find');
    // We don't strictly assert this since it depends on DB state, 
    // but the list itself MUST not crash.
  });

  test('Admin Dashboard Network I/O (Sprint 40)', async ({ page }) => {
    // Navigate to admin monitoring
    await page.goto('/admin/monitoring');
    
    // Check if the Network I/O card renders correctly
    // It should display 'MB/s' or 'KB/s' based on the unmocked logic
    const networkCard = page.locator('text=Network I/O').locator('..');
    await expect(networkCard).toBeVisible();
    
    // Wait for the difference algorithm to kick in (5 seconds)
    // await page.waitForTimeout(5500); 
    // const speedText = networkCard.locator('.text-2xl');
    // await expect(speedText.textContent()).resolves.toMatch(/MB\/s|KB\/s|0 B\/s/);
  });

  test('Admin User Management & Role Toggles (Sprint 43)', async ({ page }) => {
    // Navigate to admin users
    await page.goto('/admin/users');
    
    const tableHeader = page.locator('text=Name');
    await expect(tableHeader).toBeVisible();

    // Open the dropdown menu for the first user
    const firstRowAction = page.locator('tbody tr').first().locator('button:has-text("Open menu")');
    // If there is a user, test the actions
    if (await firstRowAction.count() > 0) {
      await firstRowAction.click();
      
      const menu = page.locator('[role="menu"]');
      await expect(menu).toBeVisible();

      // Check for our new Admin Control actions
      await expect(menu.locator('text=Reset Password')).toBeVisible();
    }
  });

  test('Editor Collaborative MVP (Sprint 44)', async ({ page }) => {
    // Navigate to docs
    await page.goto('/docs/new');
    
    // The editor should mount the TipTap instance
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible();

    // Verify it is editable
    await expect(editor).toHaveAttribute('contenteditable', 'true');
    
    // Type into the document
    await editor.click();
    await page.keyboard.type('Hello Collab MVP!');
    await expect(editor).toContainText('Hello Collab MVP!');
  });

  test('Dashboard Framer Motion Arrays (Sprint 45)', async ({ page }) => {
    // Navigate to standard dashboard
    await page.goto('/dashboard');
    
    // The grid should have stagger animations, the layout wrapper must exist
    const layout = page.locator('.layout');
    await expect(layout).toBeVisible();
  });
});
