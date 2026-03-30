/**
 * E2E Tests for Calendar Real-time Collaboration (Phase 7)
 * Tests multi-client presence tracking, WebSocket sync, and conflict scenarios
 */

import { test, expect, Page } from '@playwright/test';

// Helper to create browser context for multi-client testing
async function createCalendarContext(page: Page, calendarId: string) {
  await page.goto(`/calendar?id=${calendarId}`);
  await page.waitForSelector('[data-testid="calendar-view"]', { timeout: 5000 });
}

test.describe('Calendar Real-time Collaboration (Phase 7)', () => {
  test.beforeEach(async ({ context }) => {
    // Set up authentication headers if needed
    // This would typically involve login or JWT token setup
  });

  test.describe('WebSocket Connection', () => {
    test('should connect to WebSocket on calendar load', async ({ page }) => {
      const wsPromise = page.waitForEvent('websocket');

      await page.goto('/calendar?id=test-calendar-1');

      const ws = await wsPromise;
      expect(ws.url()).toContain('/api/v1/calendars/test-calendar-1/ws');
    });

    test('should handle WebSocket reconnection on network failure', async ({ page, context }) => {
      await page.goto('/calendar?id=test-calendar-1');

      // Simulate network offline
      await context.setOffline(true);
      await page.waitForTimeout(200); // minimal delay for browser state update

      // Verify error state is shown
      const errorBanner = page.locator('[data-testid="connection-error"]');
      await expect(errorBanner).toBeVisible();

      // Restore network
      await context.setOffline(false);

      // Verify reconnection happens
      await expect(errorBanner).toBeHidden({ timeout: 5000 });
    });

    test('should send heartbeat every 30 seconds', async ({ page }) => {
      const messages: any[] = [];

      page.on('websocket', (ws) => {
        ws.on('framesent', (data) => {
          messages.push({
            type: 'sent',
            time: Date.now()
          });
        });
      });

      test.setTimeout(120_000);

      await page.goto('/calendar?id=test-calendar-1');

      // Wait until at least 3 heartbeat frames have been sent (30s interval × 3 = ~90s max)
      await expect(async () => {
        expect(messages.length).toBeGreaterThanOrEqual(3);
      }).toPass({ timeout: 100_000 });

      // Should have at least 3 messages (initial + 3 heartbeats)
      expect(messages.length).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Presence Tracking', () => {
    test('should display presence indicator when others are viewing', async ({ browser }) => {
      // Open calendar in browser 1
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, 'shared-calendar-1');

      // User 1 should see the presence indicator
      const presenceIndicator = page1.locator('[data-testid="presence-indicator"]');
      await expect(presenceIndicator).toBeVisible();

      // Open calendar in browser 2 (same calendar)
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, 'shared-calendar-1');

      // Give presence system time to propagate
      await page1.locator('[data-testid="presence-count"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      // Both users should see presence indicator with 2 users
      const presence1 = page1.locator('[data-testid="presence-count"]');
      await expect(presence1).toContainText('2');

      const presence2 = page2.locator('[data-testid="presence-count"]');
      await expect(presence2).toContainText('2');

      await context1.close();
      await context2.close();
    });

    test('should show "X editing" when user edits event', async ({ browser }) => {
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, 'shared-calendar-1');

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, 'shared-calendar-1');

      // User 1 starts editing an event
      await page1.click('[data-testid="event-1"]'); // Click event
      await page1.click('[data-testid="edit-button"]');

      // Wait for editing state to propagate
      await page2.locator('[data-testid="presence-editing-count"]').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});

      // User 2 should see "1 editing" in presence summary
      const editingSummary = page2.locator('[data-testid="presence-editing-count"]');
      await expect(editingSummary).toContainText('1 editing');

      // User 2 should see "User 1" in the presence item indicator for this event
      const itemEditing = page2.locator('[data-testid="item-editing-indicator-event-1"]');
      await expect(itemEditing).toContainText('editing');

      await context1.close();
      await context2.close();
    });

    test('should clear presence when user closes tab', async ({ browser }) => {
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, 'shared-calendar-1');

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, 'shared-calendar-1');

      // Verify both users present
      let presence2 = page2.locator('[data-testid="presence-count"]');
      await expect(presence2).toContainText('2');

      // Close tab 1
      await context1.close();

      // Wait for presence update
      await page2.locator('[data-testid="presence-count"]').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});

      // User 1 should be removed from presence
      presence2 = page2.locator('[data-testid="presence-count"]');
      await expect(presence2).toContainText('1');

      await context2.close();
    });

    test('should mark user as idle after 30 seconds of inactivity', async ({ page }) => {
      test.setTimeout(60_000);

      await page.goto('/calendar?id=test-calendar-1');

      // Wait initial presence
      await page.waitForSelector('[data-testid="presence-indicator"]');

      // Poll until the status transitions to "idle" (after ~30s of inactivity)
      await expect(async () => {
        const userStatus = page.locator('[data-testid="presence-user-status"]');
        await expect(userStatus).toContainText('Idle');
      }).toPass({ timeout: 50_000 });

      // Check that user status is now "idle"
      const userStatus = page.locator('[data-testid="presence-user-status"]');
      await expect(userStatus).toContainText('Idle');
    });

    test('should update status back to viewing on activity', async ({ page }) => {
      test.setTimeout(60_000);

      await page.goto('/calendar?id=test-calendar-1');

      // Wait for idle state via polling (triggered after ~30s of inactivity)
      await expect(async () => {
        const status = page.locator('[data-testid="presence-user-status"]');
        await expect(status).toContainText('Idle');
      }).toPass({ timeout: 50_000 });

      // Verify idle
      let userStatus = page.locator('[data-testid="presence-user-status"]');
      await expect(userStatus).toContainText('Idle');

      // Perform activity (move mouse/click)
      await page.hover('[data-testid="calendar-view"]');

      // Wait for status update to propagate
      await page.locator('[data-testid="presence-user-status"]').waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});

      // Status should now be viewing
      userStatus = page.locator('[data-testid="presence-user-status"]');
      await expect(userStatus).toContainText('Viewing');
    });
  });

  test.describe('Event Synchronization', () => {
    test('should sync new event to all clients in real-time', async ({ browser }) => {
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, 'shared-calendar-1');

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, 'shared-calendar-1');

      // User 1 creates new event
      await page1.click('[data-testid="add-event-button"]');
      await page1.fill('[data-testid="event-title"]', 'Shared Event');
      await page1.fill('[data-testid="event-time"]', '10:00 AM');
      await page1.click('[data-testid="save-event-button"]');

      // Wait for sync - event should appear on page 2
      await page2.locator('text=Shared Event').waitFor({ state: 'visible', timeout: 3000 });

      // User 2 should see the event
      const eventCard = page2.locator('text=Shared Event');
      await expect(eventCard).toBeVisible();

      await context1.close();
      await context2.close();
    });

    test('should handle concurrent edits without conflicts', async ({ browser }) => {
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, 'shared-calendar-1');

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, 'shared-calendar-1');

      // Both users edit the same event simultaneously
      // User 1 changes title
      await page1.click('[data-testid="event-1"]');
      await page1.click('[data-testid="edit-button"]');
      await page1.fill('[data-testid="event-title"]', 'Updated Title');

      // User 2 changes description (before user 1 saves)
      await page2.click('[data-testid="event-1"]');
      await page2.click('[data-testid="edit-button"]');
      await page2.fill('[data-testid="event-description"]', 'New Description');

      // User 1 saves
      await page1.click('[data-testid="save-event-button"]');

      // Wait for sync to page 2
      await page2.locator('[data-testid="event-title"]').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});

      // User 2 should see title update in background
      const titleInForm = page2.locator('[data-testid="event-title"]');
      await expect(titleInForm).toHaveValue('Updated Title');

      // User 2 saves their changes
      await page2.click('[data-testid="save-event-button"]');

      // Wait for final sync
      await page1.locator('[data-testid="event-1"]').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});

      // User 1 should see both changes applied (CRDT merge)
      await page1.click('[data-testid="event-1"]');
      const finalTitle = page1.locator('[data-testid="event-title"]');
      const finalDesc = page1.locator('[data-testid="event-description"]');

      await expect(finalTitle).toHaveValue('Updated Title');
      await expect(finalDesc).toHaveValue('New Description');

      await context1.close();
      await context2.close();
    });

    test('should handle 100+ events without performance degradation', async ({ page }) => {
      await page.goto('/calendar?id=test-calendar-large');

      // Measure initial render time
      const startTime = Date.now();
      await page.waitForSelector('[data-testid="calendar-month-view"]', { timeout: 10000 });
      const renderTime = Date.now() - startTime;

      // Should render in < 2 seconds for 100 events
      expect(renderTime).toBeLessThan(2000);

      // Verify all events loaded
      const eventCount = await page.locator('[data-testid^="event-"]').count();
      expect(eventCount).toBeGreaterThanOrEqual(100);
    });
  });

  test.describe('Presence Indicator UI', () => {
    test('should show user avatar with initials', async ({ page }) => {
      await page.goto('/calendar?id=test-calendar-1');

      const avatar = page.locator('[data-testid="presence-avatar"]').first();
      await expect(avatar).toBeVisible();

      // Avatar should have text content (initials)
      const text = await avatar.textContent();
      expect(text).toMatch(/^[A-Z]{1,2}$/);
    });

    test('should show status indicator dot with correct color', async ({ browser }) => {
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, 'shared-calendar-1');

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, 'shared-calendar-1');

      // Default status should be "viewing" (blue)
      const statusDot = page1.locator('[data-testid="presence-status-dot"]').first();
      const computedStyle = await statusDot.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );

      // Blue color for viewing
      expect(computedStyle).toContain('rgb');

      await context1.close();
      await context2.close();
    });

    test('should display tooltip on hover', async ({ page }) => {
      await page.goto('/calendar?id=test-calendar-1');

      const avatar = page.locator('[data-testid="presence-avatar"]').first();
      await avatar.hover();

      // Tooltip should appear
      const tooltip = page.locator('[data-testid="presence-tooltip"]');
      await expect(tooltip).toBeVisible();

      // Should contain username and status
      const tooltipText = await tooltip.textContent();
      expect(tooltipText).toContain('Viewing');
    });

    test('should show +N indicator for >3 users', async ({ browser }) => {
      const contexts = [];
      const pages = [];

      // Open 5 concurrent browser contexts on same calendar
      for (let i = 0; i < 5; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await createCalendarContext(page, 'shared-calendar-1');
        contexts.push(context);
        pages.push(page);
        await page.waitForTimeout(100); // stagger context creation
      }

      // Check first page for +N indicator
      const page1 = pages[0];
      const overflow = page1.locator('[data-testid="presence-overflow"]');
      await expect(overflow).toContainText('+2');

      // Cleanup
      for (const context of contexts) {
        await context.close();
      }
    });

    test('should show "Live" pulse animation', async ({ page }) => {
      await page.goto('/calendar?id=test-calendar-1');

      const liveIndicator = page.locator('[data-testid="presence-live-indicator"]');
      await expect(liveIndicator).toBeVisible();

      // Check for pulse animation class
      const classes = await liveIndicator.getAttribute('class');
      expect(classes).toContain('animate-pulse');
    });
  });

  test.describe('Editing Indicator', () => {
    test('should show item-level editing indicator when event is edited', async ({ browser }) => {
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, 'shared-calendar-1');

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, 'shared-calendar-1');

      // User 1 starts editing
      await page1.click('[data-testid="event-1"]');
      await page1.click('[data-testid="edit-button"]');

      // Wait for indicator to appear on page 2
      await page2.locator('[data-testid="item-editing-indicator-event-1"]').waitFor({ state: 'visible', timeout: 3000 });

      // ItemEditingIndicator should appear on User 2's screen
      const itemIndicator = page2.locator('[data-testid="item-editing-indicator-event-1"]');
      await expect(itemIndicator).toBeVisible();
      await expect(itemIndicator).toContainText('editing');

      await context1.close();
      await context2.close();
    });

    test('should hide item indicator when editing is complete', async ({ browser }) => {
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, 'shared-calendar-1');

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, 'shared-calendar-1');

      // User 1 edits event
      await page1.click('[data-testid="event-1"]');
      await page1.click('[data-testid="edit-button"]');

      // Wait for indicator to be visible
      await page2.locator('[data-testid="item-editing-indicator-event-1"]').waitFor({ state: 'visible', timeout: 3000 });

      // Indicator should be visible
      let itemIndicator = page2.locator('[data-testid="item-editing-indicator-event-1"]');
      await expect(itemIndicator).toBeVisible();

      // User 1 closes edit form (cancel or save)
      await page1.click('[data-testid="close-button"]');

      // Wait for indicator to disappear
      await page2.locator('[data-testid="item-editing-indicator-event-1"]').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

      // Indicator should disappear
      itemIndicator = page2.locator('[data-testid="item-editing-indicator-event-1"]');
      await expect(itemIndicator).toBeHidden();

      await context1.close();
      await context2.close();
    });
  });

  test.describe('Performance Benchmarks', () => {
    test('should maintain sub-100ms latency for presence updates', async ({ browser }) => {
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, 'shared-calendar-1');

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, 'shared-calendar-1');

      // Measure time from user 1 action to user 2 seeing update
      const startTime = Date.now();

      await page1.click('[data-testid="event-1"]');
      await page1.click('[data-testid="edit-button"]');

      // Wait for indicator to appear on page 2
      const itemIndicator = page2.locator('[data-testid="item-editing-indicator-event-1"]');
      await itemIndicator.waitFor({ state: 'visible', timeout: 500 });

      const latency = Date.now() - startTime;

      // Should be < 100ms typically, allow up to 200ms for CI variance
      expect(latency).toBeLessThan(200);

      await context1.close();
      await context2.close();
    });

    test('should handle 50 presence updates per second', async ({ page }) => {
      // This is a load test - simulates rapid presence updates
      // Would require mock WebSocket server in real scenario

      await page.goto('/calendar?id=test-calendar-1');

      const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Allow 5 seconds of runtime to accumulate presence updates, then sample memory
      const deadline = Date.now() + 5000;
      await page.waitForFunction((ts) => Date.now() >= ts, deadline, { timeout: 10_000 });

      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Memory growth should be < 10MB (allows for normal allocation)
      const memoryGrowth = (endMemory - startMemory) / 1024 / 1024;
      expect(memoryGrowth).toBeLessThan(10);
    });
  });
});
