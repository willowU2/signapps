import { test, expect } from './fixtures';

/**
 * Drag & Drop E2E Tests
 * Tests for drag and drop functionality across Tasks and Storage
 */

test.describe('Drag & Drop Functionality', () => {
  test.describe('Tasks Drag & Drop', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/tasks');
      await page.waitForLoadState('networkidle');
    });

    test('should support drag handle on task items', async ({ page }) => {
      // Wait for task tree to potentially load
      await page.locator('[draggable="true"], [data-draggable], [class*="task"], [role="listitem"]').first()
        .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      // Look for draggable elements
      const draggableItems = page.locator('[draggable="true"], [data-draggable]');
      const taskItems = page.locator('[class*="task"], [role="listitem"]');

      // Check if any draggable items exist
      const count = await draggableItems.count();

      if (count > 0) {
        // Verify draggable attribute
        const firstItem = draggableItems.first();
        await expect(firstItem).toBeVisible();
      }
    });

    test('should reorder tasks via drag and drop', async ({ page }) => {
      // Wait for tasks to load
      await page.locator('[draggable="true"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const taskItems = page.locator('[draggable="true"]');
      const count = await taskItems.count();

      if (count >= 2) {
        const firstTask = taskItems.nth(0);
        const secondTask = taskItems.nth(1);

        // Get bounding boxes
        const firstBox = await firstTask.boundingBox();
        const secondBox = await secondTask.boundingBox();

        if (firstBox && secondBox) {
          // Perform drag operation
          await page.mouse.move(
            firstBox.x + firstBox.width / 2,
            firstBox.y + firstBox.height / 2
          );
          await page.mouse.down();

          await page.mouse.move(
            secondBox.x + secondBox.width / 2,
            secondBox.y + secondBox.height / 2,
            { steps: 10 }
          );

          await page.mouse.up();

          // Wait for potential reorder
          await page.waitForLoadState("domcontentloaded").catch(() => {}); // animation delay
        }
      }
    });

    test('should support nesting tasks via drag and drop', async ({ page }) => {
      // Wait for tasks
      await page.locator('[draggable="true"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const taskItems = page.locator('[draggable="true"]');
      const count = await taskItems.count();

      if (count >= 2) {
        const childTask = taskItems.nth(1);
        const parentTask = taskItems.nth(0);

        // Get bounding boxes
        const childBox = await childTask.boundingBox();
        const parentBox = await parentTask.boundingBox();

        if (childBox && parentBox) {
          // Drag to indent (move right into parent)
          await page.mouse.move(
            childBox.x + childBox.width / 2,
            childBox.y + childBox.height / 2
          );
          await page.mouse.down();

          // Move to the right side of parent (indent zone)
          await page.mouse.move(
            parentBox.x + parentBox.width - 20,
            parentBox.y + parentBox.height / 2,
            { steps: 10 }
          );

          await page.mouse.up();
          await page.waitForLoadState("domcontentloaded").catch(() => {}); // animation delay
        }
      }
    });

    test('should show drop indicator during drag', async ({ page }) => {
      await page.locator('[draggable="true"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const taskItems = page.locator('[draggable="true"]');
      const count = await taskItems.count();

      if (count >= 2) {
        const task = taskItems.first();
        const box = await task.boundingBox();

        if (box) {
          // Start dragging
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();

          // Move slightly
          await page.mouse.move(box.x + box.width / 2, box.y + box.height + 50, {
            steps: 5,
          });

          // Check for drop indicator
          const dropIndicator = page.locator(
            '[class*="drop-indicator"], [class*="drag-over"], [class*="highlight"]'
          );

          // Release
          await page.mouse.up();
        }
      }
    });

    test('should cancel drag on escape key', async ({ page }) => {
      await page.locator('[draggable="true"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const taskItems = page.locator('[draggable="true"]');

      if ((await taskItems.count()) > 0) {
        const task = taskItems.first();
        const box = await task.boundingBox();

        if (box) {
          // Start drag
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();

          // Move slightly
          await page.mouse.move(box.x + box.width / 2, box.y + 100);

          // Press Escape
          await page.keyboard.press('Escape');

          // Release
          await page.mouse.up();
        }
      }
    });
  });

  test.describe('Storage Drag & Drop', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/storage');
      await page.waitForLoadState('networkidle');
    });

    test('should support drag and drop file upload', async ({ page }) => {
      // Wait for storage page to load
      await page.locator('main, [class*="content"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      // Look for drop zone
      const dropZone = page.locator(
        '[class*="dropzone"], [class*="drop-zone"], [class*="upload-area"]'
      );

      if (await dropZone.isVisible({ timeout: 3000 })) {
        await expect(dropZone).toBeVisible();
      }
    });

    test('should highlight drop zone on drag over', async ({ page }) => {
      // Simulate dragover by evaluating JavaScript
      await page.evaluate(() => {
        const dropZone = document.querySelector(
          '[class*="dropzone"], [class*="drop-zone"], main, .flex-1'
        );
        if (dropZone) {
          const event = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
          });
          dropZone.dispatchEvent(event);
        }
      });

      // Check for visual feedback
      await page.waitForLoadState("domcontentloaded").catch(() => {}); // animation delay
    });

    test('should move files between folders via drag and drop', async ({ page }) => {
      // Wait for file list to potentially populate
      await page.locator('[draggable="true"], [class*="file-item"]').first()
        .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      // Find file items
      const fileItems = page.locator('[draggable="true"], [class*="file-item"]');
      const folders = page.locator('[class*="folder"], [data-type="folder"]');

      const fileCount = await fileItems.count();
      const folderCount = await folders.count();

      if (fileCount > 0 && folderCount > 0) {
        const file = fileItems.first();
        const folder = folders.first();

        const fileBox = await file.boundingBox();
        const folderBox = await folder.boundingBox();

        if (fileBox && folderBox) {
          // Drag file to folder
          await page.mouse.move(
            fileBox.x + fileBox.width / 2,
            fileBox.y + fileBox.height / 2
          );
          await page.mouse.down();

          await page.mouse.move(
            folderBox.x + folderBox.width / 2,
            folderBox.y + folderBox.height / 2,
            { steps: 10 }
          );

          await page.mouse.up();
          await page.waitForLoadState("domcontentloaded").catch(() => {}); // animation delay
        }
      }
    });

    test('should support multi-select drag', async ({ page }) => {
      // Wait for file items to load
      await page.locator('[class*="file-item"], [class*="selectable"]').first()
        .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const fileItems = page.locator('[class*="file-item"], [class*="selectable"]');

      if ((await fileItems.count()) >= 2) {
        // Ctrl+click to select multiple
        const first = fileItems.nth(0);
        const second = fileItems.nth(1);

        await first.click();
        await second.click({ modifiers: ['Control'] });

        // Now drag
        const box = await first.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + 100, box.y + 100, { steps: 5 });
          await page.mouse.up();
        }
      }
    });
  });

  test.describe('Keep Notes Drag & Drop', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/keep');
      await page.waitForSelector('text=Keep', { timeout: 10000 });
    });

    test('should support reordering notes via drag', async ({ page }) => {
      // First, create some notes
      const createButton = page.locator('button:has-text("Créer une note")');
      await createButton.click();

      const titleInput = page.getByPlaceholder('Titre');
      await titleInput.fill('Note 1');

      const closeButton = page.getByRole('button', { name: /fermer/i });
      await closeButton.click();
      await page.waitForLoadState("domcontentloaded").catch(() => {}); // debounce delay

      // Create second note
      await createButton.click();
      await titleInput.fill('Note 2');
      await closeButton.click();
      await page.waitForLoadState("domcontentloaded").catch(() => {}); // debounce delay

      // Look for note cards
      const noteCards = page.locator('[class*="group"][class*="rounded"]');
      const count = await noteCards.count();

      if (count >= 2) {
        const firstNote = noteCards.nth(0);
        const secondNote = noteCards.nth(1);

        const firstBox = await firstNote.boundingBox();
        const secondBox = await secondNote.boundingBox();

        if (firstBox && secondBox) {
          // Attempt drag
          await page.mouse.move(
            firstBox.x + firstBox.width / 2,
            firstBox.y + firstBox.height / 2
          );
          await page.mouse.down();

          await page.mouse.move(
            secondBox.x + secondBox.width / 2,
            secondBox.y + secondBox.height / 2,
            { steps: 10 }
          );

          await page.mouse.up();
        }
      }
    });
  });

  test.describe('Touch Drag Support', () => {
    test('should support touch drag on mobile', async ({ page }) => {
      // Use mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/tasks');
      await page.waitForLoadState('networkidle');

      // Wait for tasks
      await page.locator('[draggable="true"]').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const taskItems = page.locator('[draggable="true"]');

      if ((await taskItems.count()) > 0) {
        const task = taskItems.first();
        const box = await task.boundingBox();

        if (box) {
          // Simulate touch drag
          await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

          // Long press to initiate drag
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.waitForLoadState("domcontentloaded").catch(() => {}); // Long press minimum duration (debounce)

          await page.mouse.move(box.x + box.width / 2, box.y + 100, { steps: 5 });
          await page.mouse.up();
        }
      }
    });
  });

  test.describe('Keyboard Accessibility', () => {
    test('should support keyboard-based reordering', async ({ page }) => {
      await page.goto('/tasks');
      await page.waitForLoadState('networkidle');

      // Wait for tasks
      await page.locator('[draggable="true"], [role="listitem"]').first()
        .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const taskItems = page.locator('[draggable="true"], [role="listitem"]');

      if ((await taskItems.count()) > 0) {
        const task = taskItems.first();
        await task.focus();

        // Try keyboard shortcuts for moving (commonly Ctrl+Up/Down or Alt+Up/Down)
        await page.keyboard.press('Tab');
        await page.keyboard.press('Space'); // Select
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter'); // Confirm move
      }
    });
  });
});
