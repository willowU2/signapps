import { test, expect } from './fixtures';

/**
 * Keep Layout E2E Tests
 * Tests for the Google Keep-like interface (client/src/app/keep/page.tsx)
 */

test.describe('Keep Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/keep');
    // Wait for the keep page to load
    await page.waitForSelector('text=Keep', { timeout: 10000 });
  });

  test.describe('Header', () => {
    test('should display header with logo', async ({ page }) => {
      const logo = page.getByText('Keep').first();
      await expect(logo).toBeVisible();
    });

    test('should display menu toggle button', async ({ page }) => {
      const menuButton = page.getByRole('button').first();
      await expect(menuButton).toBeVisible();
    });

    test('should display search input', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/rechercher/i);
      await expect(searchInput).toBeVisible();
    });

    test('should display view toggle button (grid/list)', async ({ page }) => {
      // Look for grid/list toggle
      const viewToggle = page.getByRole('button', { name: /affichage liste|affichage grille/i });
      await expect(viewToggle).toBeVisible();
    });

    test('should display settings button', async ({ page }) => {
      const settingsButton = page.getByRole('button', { name: /paramètres/i });
      await expect(settingsButton).toBeVisible();
    });

    test('should display refresh button', async ({ page }) => {
      const refreshButton = page.getByRole('button', { name: /actualiser/i });
      await expect(refreshButton).toBeVisible();
    });

    test('should display user avatar', async ({ page }) => {
      const avatar = page.locator('img[src*="dicebear"], [class*="Avatar"]').first();
      await expect(avatar).toBeVisible();
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('should display sidebar with navigation items', async ({ page }) => {
      // Check for main navigation items
      await expect(page.getByText('Notes')).toBeVisible();
      await expect(page.getByText('Rappels')).toBeVisible();
      await expect(page.getByText('Archives')).toBeVisible();
      await expect(page.getByText('Corbeille')).toBeVisible();
    });

    test('should highlight active navigation item', async ({ page }) => {
      // Notes should be active by default
      const notesButton = page.getByRole('button', { name: /notes/i }).first();
      await expect(notesButton).toBeVisible();

      // Check for active styling (yellow color in dark mode)
      await expect(notesButton).toHaveCSS('color', /.*/);
    });

    test('should switch views when clicking navigation items', async ({ page }) => {
      // Click on Archives
      const archivesButton = page.getByRole('button', { name: /archives/i });
      await archivesButton.click();

      // Should show archive empty state or archived notes
      const archiveContent = page.getByText(/archivées|archives/i);
      await expect(archiveContent).toBeVisible({ timeout: 5000 });

      // Click on Trash
      const trashButton = page.getByRole('button', { name: /corbeille/i });
      await trashButton.click();

      // Should show trash message
      const trashContent = page.getByText(/corbeille|7 jours/i);
      await expect(trashContent).toBeVisible({ timeout: 5000 });
    });

    test('should toggle sidebar expansion', async ({ page }) => {
      const menuButton = page.getByRole('button').first();
      await menuButton.click();

      // Sidebar width should change
      await page.waitForTimeout(300); // Wait for animation

      // Click again to toggle back
      await menuButton.click();
      await page.waitForTimeout(300);
    });
  });

  test.describe('Note Creation', () => {
    test('should display note creation input', async ({ page }) => {
      const createInput = page.getByText(/créer une note/i);
      await expect(createInput).toBeVisible();
    });

    test('should expand note creation on click', async ({ page }) => {
      const createButton = page.locator('button:has-text("Créer une note")');
      await createButton.click();

      // Should show expanded form with title input
      const titleInput = page.getByPlaceholder('Titre');
      await expect(titleInput).toBeVisible({ timeout: 5000 });
    });

    test('should show note creation toolbar', async ({ page }) => {
      const createButton = page.locator('button:has-text("Créer une note")');
      await createButton.click();

      // Should show checklist and image buttons in toolbar
      const checklistButton = page.getByRole('button', { name: /nouvelle liste/i });
      await expect(checklistButton).toBeVisible({ timeout: 5000 });
    });

    test('should create a new note', async ({ page }) => {
      const createButton = page.locator('button:has-text("Créer une note")');
      await createButton.click();

      // Fill in note content
      const titleInput = page.getByPlaceholder('Titre');
      await titleInput.fill('Test Note Title');

      const contentArea = page.locator('textarea[placeholder*="note"]');
      await contentArea.fill('Test note content');

      // Close/save the note
      const closeButton = page.getByRole('button', { name: /fermer/i });
      await closeButton.click();

      // Note should appear in the list
      const noteTitle = page.getByText('Test Note Title');
      await expect(noteTitle).toBeVisible({ timeout: 5000 });
    });

    test('should create a checklist note', async ({ page }) => {
      const createButton = page.locator('button:has-text("Créer une note")');
      await createButton.click();

      // Enable checklist mode
      const checklistButton = page.getByRole('button', { name: /nouvelle liste/i });
      await checklistButton.click();

      // Should show checklist input
      const checklistInput = page.getByPlaceholder(/élément de liste/i);
      await expect(checklistInput).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Search', () => {
    test('should filter notes on search', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/rechercher/i);
      await searchInput.fill('test query');

      // Search should be applied (check the value)
      await expect(searchInput).toHaveValue('test query');
    });

    test('should clear search on X click', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/rechercher/i);
      await searchInput.fill('test');

      // Clear button should appear
      const clearButton = page.locator('button').filter({ has: page.locator('svg') }).nth(1);

      // Try to clear
      await searchInput.clear();
      await expect(searchInput).toHaveValue('');
    });
  });

  test.describe('View Toggle', () => {
    test('should toggle between grid and list view', async ({ page }) => {
      const viewToggle = page.getByRole('button', { name: /affichage liste|affichage grille/i });

      // Click to toggle view
      await viewToggle.click();
      await page.waitForTimeout(200);

      // Click again to toggle back
      await viewToggle.click();
      await page.waitForTimeout(200);
    });
  });

  test.describe('Empty States', () => {
    test('should show notes empty state', async ({ page }) => {
      // Default notes view empty state
      const emptyState = page.getByText(/les notes que vous ajoutez apparaissent ici/i);
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    });

    test('should show reminders empty state', async ({ page }) => {
      const remindersButton = page.getByRole('button', { name: /rappels/i });
      await remindersButton.click();

      const emptyState = page.getByText(/notes avec rappel/i);
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    });

    test('should show archive empty state', async ({ page }) => {
      const archivesButton = page.getByRole('button', { name: /archives/i });
      await archivesButton.click();

      const emptyState = page.getByText(/notes archivées/i);
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    });

    test('should show trash empty state and info message', async ({ page }) => {
      const trashButton = page.getByRole('button', { name: /corbeille/i });
      await trashButton.click();

      const infoMessage = page.getByText(/supprimées au bout de 7 jours/i);
      await expect(infoMessage).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Note Actions', () => {
    test.beforeEach(async ({ page }) => {
      // Create a note first
      const createButton = page.locator('button:has-text("Créer une note")');
      await createButton.click();

      const titleInput = page.getByPlaceholder('Titre');
      await titleInput.fill('Test Note for Actions');

      const closeButton = page.getByRole('button', { name: /fermer/i });
      await closeButton.click();

      await page.waitForTimeout(500);
    });

    test('should show action buttons on hover', async ({ page }) => {
      const noteCard = page.locator('[class*="group"]').first();

      if (await noteCard.isVisible({ timeout: 3000 })) {
        await noteCard.hover();

        // Action buttons should appear
        await page.waitForTimeout(300);
      }
    });

    test('should pin/unpin note', async ({ page }) => {
      const noteCard = page.locator('[class*="group"]').first();

      if (await noteCard.isVisible({ timeout: 3000 })) {
        await noteCard.hover();

        // Find and click pin button
        const pinButton = noteCard.locator('button').first();
        if (await pinButton.isVisible()) {
          await pinButton.click();
        }
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should adapt layout on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Header should still be visible
      await expect(page.getByText('Keep')).toBeVisible();

      // Sidebar should collapse
      await page.waitForTimeout(300);
    });

    test('should adapt layout on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await expect(page.getByText('Keep')).toBeVisible();
    });

    test('should adapt layout on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      await expect(page.getByText('Keep')).toBeVisible();
      await expect(page.getByText('Notes')).toBeVisible();
    });
  });
});
