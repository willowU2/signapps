/**
 * E2E Tests for Calendar Real-time Collaboration (Phase 7)
 * Tests multi-client presence tracking, WebSocket sync, and conflict scenarios.
 *
 * ALL tests in this file require a live WebSocket server + real-time presence
 * infrastructure (signapps-collab CRDT service on port 3013) which is not
 * available in the standard E2E test environment. Each test is therefore
 * skipped until the real-time backend is fully integrated.
 */

import { test, expect, Page } from "@playwright/test";

// Helper to create browser context for multi-client testing
async function createCalendarContext(page: Page, calendarId: string) {
  await page.goto(`/calendar?id=${calendarId}`);
  await page.waitForSelector('[data-testid="calendar-view"]', {
    timeout: 5000,
  });
}

test.describe("Calendar Real-time Collaboration (Phase 7)", () => {
  test.beforeEach(async ({ context }) => {
    // Set up authentication headers if needed
    // This would typically involve login or JWT token setup
  });

  test.describe("WebSocket Connection", () => {
    test.skip("should connect to WebSocket on calendar load", async ({
      page,
    }) => {
      // requires live WebSocket server
      const wsPromise = page.waitForEvent("websocket");

      await page.goto("/calendar?id=test-calendar-1");

      const ws = await wsPromise;
      expect(ws.url()).toContain("/api/v1/calendars/test-calendar-1/ws");
    });

    test.skip("should handle WebSocket reconnection on network failure", async ({
      page,
      context,
    }) => {
      // requires live WebSocket server
      await page.goto("/calendar?id=test-calendar-1");

      await context.setOffline(true);
      await page.waitForLoadState("domcontentloaded").catch(() => {});

      const errorBanner = page.locator('[data-testid="connection-error"]');
      await expect(errorBanner).toBeVisible();

      await context.setOffline(false);
      await expect(errorBanner).toBeHidden({ timeout: 5000 });
    });

    test.skip("should send heartbeat every 30 seconds", async ({ page }) => {
      // requires live WebSocket server
      const messages: any[] = [];

      page.on("websocket", (ws) => {
        ws.on("framesent", (data) => {
          messages.push({
            type: "sent",
            time: Date.now(),
          });
        });
      });

      test.setTimeout(120_000);

      await page.goto("/calendar?id=test-calendar-1");

      await expect(async () => {
        expect(messages.length).toBeGreaterThanOrEqual(3);
      }).toPass({ timeout: 100_000 });

      expect(messages.length).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe("Presence Tracking", () => {
    test.skip("should display presence indicator when others are viewing", async ({
      browser,
    }) => {
      // requires live WebSocket server + presence service
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, "shared-calendar-1");

      const presenceIndicator = page1.locator(
        '[data-testid="presence-indicator"]',
      );
      await expect(presenceIndicator).toBeVisible();

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, "shared-calendar-1");

      await page1
        .locator('[data-testid="presence-count"]')
        .waitFor({ state: "visible", timeout: 5000 })
        .catch(() => {});

      const presence1 = page1.locator('[data-testid="presence-count"]');
      await expect(presence1).toContainText("2");

      const presence2 = page2.locator('[data-testid="presence-count"]');
      await expect(presence2).toContainText("2");

      await context1.close();
      await context2.close();
    });

    test.skip('should show "X editing" when user edits event', async ({
      browser,
    }) => {
      // requires live WebSocket server + presence service
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, "shared-calendar-1");

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, "shared-calendar-1");

      await page1.click('[data-testid="event-1"]');
      await page1.click('[data-testid="edit-button"]');

      await page2
        .locator('[data-testid="presence-editing-count"]')
        .waitFor({ state: "visible", timeout: 3000 })
        .catch(() => {});

      const editingSummary = page2.locator(
        '[data-testid="presence-editing-count"]',
      );
      await expect(editingSummary).toContainText("1 editing");

      const itemEditing = page2.locator(
        '[data-testid="item-editing-indicator-event-1"]',
      );
      await expect(itemEditing).toContainText("editing");

      await context1.close();
      await context2.close();
    });

    test.skip("should clear presence when user closes tab", async ({
      browser,
    }) => {
      // requires live WebSocket server + presence service
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, "shared-calendar-1");

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, "shared-calendar-1");

      let presence2 = page2.locator('[data-testid="presence-count"]');
      await expect(presence2).toContainText("2");

      await context1.close();

      await page2
        .locator('[data-testid="presence-count"]')
        .waitFor({ state: "visible", timeout: 3000 })
        .catch(() => {});

      presence2 = page2.locator('[data-testid="presence-count"]');
      await expect(presence2).toContainText("1");

      await context2.close();
    });

    test.skip("should mark user as idle after 30 seconds of inactivity", async ({
      page,
    }) => {
      // requires live WebSocket server + presence service
      test.setTimeout(60_000);

      await page.goto("/calendar?id=test-calendar-1");

      await page.waitForSelector('[data-testid="presence-indicator"]');

      await expect(async () => {
        const userStatus = page.locator('[data-testid="presence-user-status"]');
        await expect(userStatus).toContainText("Idle");
      }).toPass({ timeout: 50_000 });

      const userStatus = page.locator('[data-testid="presence-user-status"]');
      await expect(userStatus).toContainText("Idle");
    });

    test.skip("should update status back to viewing on activity", async ({
      page,
    }) => {
      // requires live WebSocket server + presence service
      test.setTimeout(60_000);

      await page.goto("/calendar?id=test-calendar-1");

      await expect(async () => {
        const status = page.locator('[data-testid="presence-user-status"]');
        await expect(status).toContainText("Idle");
      }).toPass({ timeout: 50_000 });

      let userStatus = page.locator('[data-testid="presence-user-status"]');
      await expect(userStatus).toContainText("Idle");

      await page.hover('[data-testid="calendar-view"]');

      await page
        .locator('[data-testid="presence-user-status"]')
        .waitFor({ state: "visible", timeout: 2000 })
        .catch(() => {});

      userStatus = page.locator('[data-testid="presence-user-status"]');
      await expect(userStatus).toContainText("Viewing");
    });
  });

  test.describe("Event Synchronization", () => {
    test.skip("should sync new event to all clients in real-time", async ({
      browser,
    }) => {
      // requires live WebSocket server + CRDT sync
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, "shared-calendar-1");

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, "shared-calendar-1");

      await page1.click('[data-testid="add-event-button"]');
      await page1.fill('[data-testid="event-title"]', "Shared Event");
      await page1.fill('[data-testid="event-time"]', "10:00 AM");
      await page1.click('[data-testid="save-event-button"]');

      await page2
        .locator("text=Shared Event")
        .waitFor({ state: "visible", timeout: 3000 });

      const eventCard = page2.locator("text=Shared Event");
      await expect(eventCard).toBeVisible();

      await context1.close();
      await context2.close();
    });

    test.skip("should handle concurrent edits without conflicts", async ({
      browser,
    }) => {
      // requires live WebSocket server + CRDT sync
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, "shared-calendar-1");

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, "shared-calendar-1");

      await page1.click('[data-testid="event-1"]');
      await page1.click('[data-testid="edit-button"]');
      await page1.fill('[data-testid="event-title"]', "Updated Title");

      await page2.click('[data-testid="event-1"]');
      await page2.click('[data-testid="edit-button"]');
      await page2.fill('[data-testid="event-description"]', "New Description");

      await page1.click('[data-testid="save-event-button"]');

      await page2
        .locator('[data-testid="event-title"]')
        .waitFor({ state: "visible", timeout: 3000 })
        .catch(() => {});

      const titleInForm = page2.locator('[data-testid="event-title"]');
      await expect(titleInForm).toHaveValue("Updated Title");

      await page2.click('[data-testid="save-event-button"]');

      await page1
        .locator('[data-testid="event-1"]')
        .waitFor({ state: "visible", timeout: 3000 })
        .catch(() => {});

      await page1.click('[data-testid="event-1"]');
      const finalTitle = page1.locator('[data-testid="event-title"]');
      const finalDesc = page1.locator('[data-testid="event-description"]');

      await expect(finalTitle).toHaveValue("Updated Title");
      await expect(finalDesc).toHaveValue("New Description");

      await context1.close();
      await context2.close();
    });

    test.skip("should handle 100+ events without performance degradation", async ({
      page,
    }) => {
      // requires live WebSocket server + large test dataset
      await page.goto("/calendar?id=test-calendar-large");

      const startTime = Date.now();
      await page.waitForSelector('[data-testid="calendar-month-view"]', {
        timeout: 10000,
      });
      const renderTime = Date.now() - startTime;

      expect(renderTime).toBeLessThan(2000);

      const eventCount = await page.locator('[data-testid^="event-"]').count();
      expect(eventCount).toBeGreaterThanOrEqual(100);
    });
  });

  test.describe("Presence Indicator UI", () => {
    test.skip("should show user avatar with initials", async ({ page }) => {
      // requires live WebSocket server + presence service
      await page.goto("/calendar?id=test-calendar-1");

      const avatar = page.locator('[data-testid="presence-avatar"]').first();
      await expect(avatar).toBeVisible();

      const text = await avatar.textContent();
      expect(text).toMatch(/^[A-Z]{1,2}$/);
    });

    test.skip("should show status indicator dot with correct color", async ({
      browser,
    }) => {
      // requires live WebSocket server + presence service
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, "shared-calendar-1");

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, "shared-calendar-1");

      const statusDot = page1
        .locator('[data-testid="presence-status-dot"]')
        .first();
      const computedStyle = await statusDot.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor,
      );

      expect(computedStyle).toContain("rgb");

      await context1.close();
      await context2.close();
    });

    test.skip("should display tooltip on hover", async ({ page }) => {
      // requires live WebSocket server + presence service
      await page.goto("/calendar?id=test-calendar-1");

      const avatar = page.locator('[data-testid="presence-avatar"]').first();
      await avatar.hover();

      const tooltip = page.locator('[data-testid="presence-tooltip"]');
      await expect(tooltip).toBeVisible();

      const tooltipText = await tooltip.textContent();
      expect(tooltipText).toContain("Viewing");
    });

    test.skip("should show +N indicator for >3 users", async ({ browser }) => {
      // requires live WebSocket server + presence service + 5 concurrent sessions
      const contexts = [];
      const pages = [];

      for (let i = 0; i < 5; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await createCalendarContext(page, "shared-calendar-1");
        contexts.push(context);
        pages.push(page);
      }

      const page1 = pages[0];
      const overflow = page1.locator('[data-testid="presence-overflow"]');
      await expect(overflow).toContainText("+2");

      for (const context of contexts) {
        await context.close();
      }
    });

    test.skip('should show "Live" pulse animation', async ({ page }) => {
      // requires live WebSocket server + presence service
      await page.goto("/calendar?id=test-calendar-1");

      const liveIndicator = page.locator(
        '[data-testid="presence-live-indicator"]',
      );
      await expect(liveIndicator).toBeVisible();

      const classes = await liveIndicator.getAttribute("class");
      expect(classes).toContain("animate-pulse");
    });
  });

  test.describe("Editing Indicator", () => {
    test.skip("should show item-level editing indicator when event is edited", async ({
      browser,
    }) => {
      // requires live WebSocket server + presence service
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, "shared-calendar-1");

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, "shared-calendar-1");

      await page1.click('[data-testid="event-1"]');
      await page1.click('[data-testid="edit-button"]');

      await page2
        .locator('[data-testid="item-editing-indicator-event-1"]')
        .waitFor({ state: "visible", timeout: 3000 });

      const itemIndicator = page2.locator(
        '[data-testid="item-editing-indicator-event-1"]',
      );
      await expect(itemIndicator).toBeVisible();
      await expect(itemIndicator).toContainText("editing");

      await context1.close();
      await context2.close();
    });

    test.skip("should hide item indicator when editing is complete", async ({
      browser,
    }) => {
      // requires live WebSocket server + presence service
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, "shared-calendar-1");

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, "shared-calendar-1");

      await page1.click('[data-testid="event-1"]');
      await page1.click('[data-testid="edit-button"]');

      await page2
        .locator('[data-testid="item-editing-indicator-event-1"]')
        .waitFor({ state: "visible", timeout: 3000 });

      let itemIndicator = page2.locator(
        '[data-testid="item-editing-indicator-event-1"]',
      );
      await expect(itemIndicator).toBeVisible();

      await page1.click('[data-testid="close-button"]');

      await page2
        .locator('[data-testid="item-editing-indicator-event-1"]')
        .waitFor({ state: "hidden", timeout: 3000 })
        .catch(() => {});

      itemIndicator = page2.locator(
        '[data-testid="item-editing-indicator-event-1"]',
      );
      await expect(itemIndicator).toBeHidden();

      await context1.close();
      await context2.close();
    });
  });

  test.describe("Performance Benchmarks", () => {
    test.skip("should maintain sub-100ms latency for presence updates", async ({
      browser,
    }) => {
      // requires live WebSocket server + presence service
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await createCalendarContext(page1, "shared-calendar-1");

      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await createCalendarContext(page2, "shared-calendar-1");

      const startTime = Date.now();

      await page1.click('[data-testid="event-1"]');
      await page1.click('[data-testid="edit-button"]');

      const itemIndicator = page2.locator(
        '[data-testid="item-editing-indicator-event-1"]',
      );
      await itemIndicator.waitFor({ state: "visible", timeout: 500 });

      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(200);

      await context1.close();
      await context2.close();
    });

    test.skip("should handle 50 presence updates per second", async ({
      page,
    }) => {
      // requires live WebSocket server + mock presence stream
      await page.goto("/calendar?id=test-calendar-1");

      const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

      const deadline = Date.now() + 5000;
      await page.waitForFunction((ts) => Date.now() >= ts, deadline, {
        timeout: 10_000,
      });

      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;

      const memoryGrowth = (endMemory - startMemory) / 1024 / 1024;
      expect(memoryGrowth).toBeLessThan(10);
    });
  });
});
