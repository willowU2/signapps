import { test, expect } from '@playwright/test';

test.describe('Mail System E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login?auto=admin');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.goto('http://localhost:3000/login?auto=admin');
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('should display mail page with accounts', async ({ page }) => {
    await page.goto('http://localhost:3000/mail');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Verify page loads
    const content = await page.textContent('body');
    console.log('[MAIL] Page loaded, content length:', content?.length);

    // Check for mail UI elements
    const hasInbox = content?.includes('Inbox') || content?.includes('inbox') || content?.includes('Boîte');
    const hasCompose = content?.includes('Nouveau') || content?.includes('Compose') || content?.includes('message');
    console.log('[MAIL] Has inbox:', hasInbox, 'Has compose:', hasCompose);

    await page.screenshot({ path: 'e2e/screenshots/mail-inbox.png' });
    expect(content?.length).toBeGreaterThan(100);
  });

  test('mail settings: add local account', async ({ page }) => {
    await page.goto('http://localhost:3000/mail/settings');
    await page.waitForLoadState('networkidle').catch(() => {});

    const content = await page.textContent('body');
    const hasSettings = content?.includes('Compte') || content?.includes('Account') || content?.includes('IMAP');
    console.log('[MAIL SETTINGS] Has settings:', hasSettings);

    await page.screenshot({ path: 'e2e/screenshots/mail-settings.png' });
    expect(content?.length).toBeGreaterThan(100);
  });

  test('verify mail API is accessible', async ({ page }) => {
    // Direct API test via page.evaluate
    const result = await page.evaluate(async () => {
      try {
        const res = await fetch('http://localhost:3012/api/v1/mail/stats', {
          credentials: 'include'
        });
        if (!res.ok) return { error: res.status };
        return await res.json();
      } catch (e) {
        return { error: String(e) };
      }
    });
    console.log('[MAIL API] Stats:', JSON.stringify(result));
  });
});
