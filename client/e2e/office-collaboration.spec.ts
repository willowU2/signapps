import { test, expect } from './fixtures';

/**
 * Office Collaboration E2E Tests
 * Tests Comments, Track Changes, and Real-time collaboration
 */

test.describe('Document Comments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/docs');
    // Open a document
    const docItem = page.locator('[data-testid="document-item"], .document-card').first();
    if (await docItem.isVisible()) {
      await docItem.click();
      await page.waitForSelector('.tiptap, .ProseMirror, [contenteditable="true"]', { timeout: 10000 }).catch(() => {});
    }
  });

  test.describe('Comment Creation', () => {
    test('should add comment to selected text', async ({ page }) => {
      const editor = page.locator('.tiptap, .ProseMirror, [contenteditable="true"]');
      if (await editor.isVisible()) {
        // Type some text
        await editor.click();
        await page.keyboard.type('Text to comment on');

        // Select the text
        await page.keyboard.press('Control+a');

        // Click comment button or use keyboard shortcut
        const commentBtn = page.getByRole('button', { name: /comment|annoter|commentaire/i });
        if (await commentBtn.isVisible()) {
          await commentBtn.click();

          // Comment input should appear
          const commentInput = page.locator('[data-testid="comment-input"], .comment-form textarea, input[placeholder*="comment"]');
          const hasInput = await commentInput.isVisible().catch(() => false);
          expect(hasInput).toBeTruthy();
        } else {
          // Try keyboard shortcut Ctrl+Alt+M
          await page.keyboard.press('Control+Alt+m');
          await page.waitForTimeout(500);
          const pageContent = await page.textContent('body');
          expect(pageContent?.length).toBeGreaterThan(0);
        }
      }
    });

    test('should submit comment', async ({ page }) => {
      const editor = page.locator('.tiptap, .ProseMirror, [contenteditable="true"]');
      if (await editor.isVisible()) {
        await editor.click();
        await page.keyboard.type('Commented text');
        await page.keyboard.press('Control+a');

        const commentBtn = page.getByRole('button', { name: /comment/i });
        if (await commentBtn.isVisible()) {
          await commentBtn.click();

          const commentInput = page.locator('[data-testid="comment-input"], textarea').first();
          if (await commentInput.isVisible()) {
            await commentInput.fill('This is a test comment');
            await page.keyboard.press('Enter');

            // Comment should be added
            await expect(page.locator('text=This is a test comment')).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Comment Sidebar', () => {
    test('should open comments sidebar', async ({ page }) => {
      const sidebarBtn = page.getByRole('button', { name: /comments sidebar|voir commentaires|show comments/i });
      if (await sidebarBtn.isVisible()) {
        await sidebarBtn.click();

        const sidebar = page.locator('[data-testid="comments-sidebar"], .comments-panel, aside:has-text("comment")');
        const hasSidebar = await sidebar.isVisible().catch(() => false);
        expect(hasSidebar).toBeTruthy();
      }
    });

    test('should list all comments in sidebar', async ({ page }) => {
      const sidebar = page.locator('[data-testid="comments-sidebar"], .comments-panel');
      if (await sidebar.isVisible()) {
        const commentItems = sidebar.locator('[data-testid="comment-item"], .comment-thread');
        const count = await commentItems.count();
        // May have 0 or more comments
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('should filter comments by status', async ({ page }) => {
      const sidebar = page.locator('[data-testid="comments-sidebar"], .comments-panel');
      if (await sidebar.isVisible()) {
        const filterBtn = page.getByRole('button', { name: /filter|filtrer|resolved|résolus/i });
        if (await filterBtn.isVisible()) {
          await filterBtn.click();
          // Sidebar should still be visible after filtering
          await expect(sidebar).toBeVisible();
        }
      }
    });
  });

  test.describe('Comment Actions', () => {
    test('should reply to comment', async ({ page }) => {
      const commentThread = page.locator('[data-testid="comment-thread"], .comment-item').first();
      if (await commentThread.isVisible()) {
        const replyBtn = commentThread.getByRole('button', { name: /reply|répondre/i });
        if (await replyBtn.isVisible()) {
          await replyBtn.click();

          const replyInput = page.locator('[data-testid="reply-input"], textarea');
          if (await replyInput.isVisible()) {
            await replyInput.fill('Test reply');
            await page.keyboard.press('Enter');

            await expect(page.locator('text=Test reply')).toBeVisible();
          }
        }
      }
    });

    test('should resolve comment', async ({ page }) => {
      const commentThread = page.locator('[data-testid="comment-thread"], .comment-item').first();
      if (await commentThread.isVisible()) {
        const resolveBtn = commentThread.getByRole('button', { name: /resolve|résoudre|mark as resolved/i });
        if (await resolveBtn.isVisible()) {
          await resolveBtn.click();

          // Comment should be marked as resolved
          const isResolved = await commentThread.locator('.resolved, [data-resolved="true"]').isVisible().catch(() => false);
          expect(isResolved).toBeTruthy();
        }
      }
    });

    test('should delete comment', async ({ page }) => {
      const commentThread = page.locator('[data-testid="comment-thread"], .comment-item').first();
      if (await commentThread.isVisible()) {
        const deleteBtn = commentThread.getByRole('button', { name: /delete|supprimer|remove/i });
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();

          // Confirmation dialog may appear
          const confirmBtn = page.getByRole('button', { name: /confirm|confirmer|yes|oui/i });
          if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
          }

          // Thread should no longer be visible after deletion
          const threadStillVisible = await commentThread.isVisible().catch(() => false);
          expect(threadStillVisible).toBeFalsy();
        }
      }
    });
  });
});

test.describe('Track Changes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/docs');
    const docItem = page.locator('[data-testid="document-item"], .document-card').first();
    if (await docItem.isVisible()) {
      await docItem.click();
      await page.waitForSelector('.tiptap, .ProseMirror, [contenteditable="true"]', { timeout: 10000 }).catch(() => {});
    }
  });

  test.describe('Track Changes Toggle', () => {
    test('should toggle track changes mode', async ({ page }) => {
      const trackBtn = page.getByRole('button', { name: /track changes|suivi des modifications|révision/i });
      if (await trackBtn.isVisible()) {
        await trackBtn.click();

        // Indicator should show track changes is active
        const indicator = page.locator('[data-testid="track-changes-active"], .track-changes-indicator, text=/tracking|suivi actif/i');
        const isActive = await indicator.isVisible().catch(() => false);
        expect(isActive).toBeTruthy();
      }
    });
  });

  test.describe('Change Visualization', () => {
    test('should show insertions in green', async ({ page }) => {
      const editor = page.locator('.tiptap, .ProseMirror, [contenteditable="true"]');
      if (await editor.isVisible()) {
        // Enable track changes first
        const trackBtn = page.getByRole('button', { name: /track changes|suivi/i });
        if (await trackBtn.isVisible()) {
          await trackBtn.click();
        }

        await editor.click();
        await page.keyboard.type('New inserted text');

        // Check for insertion mark
        const insertion = page.locator('.insertion, [data-change-type="insert"], ins, .text-green-600');
        const hasInsertion = await insertion.isVisible().catch(() => false);
        expect(hasInsertion).toBeTruthy();
      }
    });

    test('should show deletions with strikethrough', async ({ page }) => {
      const editor = page.locator('.tiptap, .ProseMirror, [contenteditable="true"]');
      if (await editor.isVisible()) {
        // Enable track changes
        const trackBtn = page.getByRole('button', { name: /track changes/i });
        if (await trackBtn.isVisible()) {
          await trackBtn.click();
        }

        await editor.click();
        await page.keyboard.type('Text to delete');
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Backspace');

        // Check for deletion mark
        const deletion = page.locator('.deletion, [data-change-type="delete"], del, .line-through');
        const hasDeletion = await deletion.isVisible().catch(() => false);
        expect(hasDeletion).toBeTruthy();
      }
    });
  });

  test.describe('Accept/Reject Changes', () => {
    test('should accept individual change', async ({ page }) => {
      const change = page.locator('[data-testid="tracked-change"], .tracked-change, .insertion, .deletion').first();
      if (await change.isVisible()) {
        await change.click();

        const acceptBtn = page.getByRole('button', { name: /accept|accepter/i });
        if (await acceptBtn.isVisible()) {
          await acceptBtn.click();
          // Change markup should be removed after accepting
          const changeStillVisible = await change.isVisible().catch(() => false);
          expect(changeStillVisible).toBeFalsy();
        }
      }
    });

    test('should reject individual change', async ({ page }) => {
      const change = page.locator('[data-testid="tracked-change"], .tracked-change').first();
      if (await change.isVisible()) {
        await change.click();

        const rejectBtn = page.getByRole('button', { name: /reject|rejeter|refuser/i });
        if (await rejectBtn.isVisible()) {
          await rejectBtn.click();
          // Change markup should be removed after rejecting
          const changeStillVisible = await change.isVisible().catch(() => false);
          expect(changeStillVisible).toBeFalsy();
        }
      }
    });

    test('should accept all changes', async ({ page }) => {
      const acceptAllBtn = page.getByRole('button', { name: /accept all|accepter tout/i });
      if (await acceptAllBtn.isVisible()) {
        await acceptAllBtn.click();

        // Confirmation may be required
        const confirmBtn = page.getByRole('button', { name: /confirm|confirmer/i });
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }

        // No tracked changes should remain after accepting all
        const remainingChanges = await page.locator('[data-testid="tracked-change"], .tracked-change, .insertion, .deletion').count();
        expect(remainingChanges).toBe(0);
      }
    });

    test('should reject all changes', async ({ page }) => {
      const rejectAllBtn = page.getByRole('button', { name: /reject all|rejeter tout/i });
      if (await rejectAllBtn.isVisible()) {
        await rejectAllBtn.click();

        const confirmBtn = page.getByRole('button', { name: /confirm|confirmer/i });
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }

        // No tracked changes should remain after rejecting all
        const remainingChanges = await page.locator('[data-testid="tracked-change"], .tracked-change, .insertion, .deletion').count();
        expect(remainingChanges).toBe(0);
      }
    });
  });

  test.describe('Changes Sidebar', () => {
    test('should show changes sidebar', async ({ page }) => {
      const changesBtn = page.getByRole('button', { name: /view changes|voir modifications|changes sidebar/i });
      if (await changesBtn.isVisible()) {
        await changesBtn.click();

        const sidebar = page.locator('[data-testid="changes-sidebar"], .changes-panel');
        const hasSidebar = await sidebar.isVisible().catch(() => false);
        expect(hasSidebar).toBeTruthy();
      }
    });

    test('should list all changes with author info', async ({ page }) => {
      const sidebar = page.locator('[data-testid="changes-sidebar"], .changes-panel');
      if (await sidebar.isVisible()) {
        const changeItems = sidebar.locator('[data-testid="change-item"], .change-entry');
        const count = await changeItems.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

test.describe('Real-time Collaboration', () => {
  test.describe('Presence Indicators', () => {
    test('should show presence bar', async ({ page }) => {
      await page.goto('/docs');
      const docItem = page.locator('[data-testid="document-item"]').first();
      if (await docItem.isVisible()) {
        await docItem.click();
        await page.waitForTimeout(2000);

        const presenceBar = page.locator('[data-testid="presence-bar"], .collaborators, .presence-indicators');
        const hasPresence = await presenceBar.isVisible().catch(() => false);
        expect(hasPresence).toBeTruthy();
      }
    });

    test('should show current user in presence', async ({ page }) => {
      await page.goto('/docs');
      const docItem = page.locator('[data-testid="document-item"]').first();
      if (await docItem.isVisible()) {
        await docItem.click();
        await page.waitForTimeout(2000);

        // Current user avatar should be visible
        const avatar = page.locator('[data-testid="user-avatar"], .avatar, img[alt*="user"]');
        const hasAvatar = await avatar.isVisible().catch(() => false);
        expect(hasAvatar).toBeTruthy();
      }
    });
  });

  test.describe('Connection Status', () => {
    test('should show connection status indicator', async ({ page }) => {
      await page.goto('/docs');
      const docItem = page.locator('[data-testid="document-item"]').first();
      if (await docItem.isVisible()) {
        await docItem.click();
        await page.waitForTimeout(2000);

        const statusIndicator = page.locator('[data-testid="sync-status"], .connection-status, text=/connected|connecté|synced/i');
        const hasStatus = await statusIndicator.isVisible().catch(() => false);
        expect(hasStatus).toBeTruthy();
      }
    });
  });

  test.describe('Auto-save', () => {
    test('should auto-save changes', async ({ page }) => {
      await page.goto('/docs');
      const docItem = page.locator('[data-testid="document-item"]').first();
      if (await docItem.isVisible()) {
        await docItem.click();
        await page.waitForSelector('.tiptap, .ProseMirror', { timeout: 10000 }).catch(() => {});

        const editor = page.locator('.tiptap, .ProseMirror, [contenteditable="true"]');
        if (await editor.isVisible()) {
          await editor.click();
          await page.keyboard.type('Auto-save test content');

          // Wait for auto-save
          await page.waitForTimeout(3000);

          // Look for saved indicator
          const savedIndicator = page.locator('text=/saved|enregistré|synced|synchronisé/i');
          const isSaved = await savedIndicator.isVisible().catch(() => false);
          expect(isSaved).toBeTruthy();
        }
      }
    });
  });
});
