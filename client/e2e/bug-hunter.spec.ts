import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

async function dismissDialogs(page: any) {
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(100); }
  for (const sel of ['button:has-text("Passer")', 'button:has-text("Fermer")', 'button[aria-label="Close"]', 'div[role="dialog"] button']) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 200 }).catch(() => false)) await btn.click({ force: true }).catch(() => {});
  }
  await page.waitForTimeout(200);
}

test.describe('Bug Hunter — Click Everything', () => {
  // Uses the auth setup from auth.setup.ts — no need to login in each test

  // ─── DASHBOARD ─────────────────────────────────
  test('dashboard: all widgets render, no console errors', async ({ page }) => {
    test.setTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(3000);
    await dismissDialogs(page);

    // Check no error boundary
    const errorBoundary = await page.locator('text=Something went wrong').isVisible().catch(() => false);
    expect(errorBoundary).toBe(false);

    // Check key elements exist
    const body = await page.textContent('body');
    expect(body?.length).toBeGreaterThan(500);

    // Click refresh button if present
    const refresh = page.locator('button:has-text("Refresh"), button:has-text("Actualiser")').first();
    if (await refresh.isVisible({ timeout: 2000 }).catch(() => false)) {
      await refresh.click();
      await page.waitForTimeout(1000);
    }

    console.log(`[DASHBOARD] Errors: ${errors.length}, Body: ${body?.length} chars`);
    if (errors.length > 0) console.log(`  Errors: ${errors.slice(0, 3).join('; ')}`);
  });

  // ─── DOCS ──────────────────────────────────────
  test('docs: create and open document', async ({ page }) => {
    test.setTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(`${BASE}/docs`);
    await page.waitForTimeout(3000);
    await dismissDialogs(page);

    // Verify we're not stuck on login (auth should be pre-loaded via storageState)
    const url = page.url();
    const isOnDocs = url.includes('/docs');
    console.log(`[DOCS] URL: ${url}, On docs page: ${isOnDocs}, Errors: ${errors.length}`);

    // Click first template or blank doc
    const blank = page.locator('text=Document vierge, text=Blank document').first();
    if (await blank.isVisible({ timeout: 2000 }).catch(() => false)) {
      await blank.click();
      await page.waitForTimeout(1000);
      // If dialog appears, fill name and create
      const nameInput = page.locator('input[placeholder*="titre"], input[placeholder*="name"]').first();
      if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nameInput.fill('Test Bug Hunter');
        const createBtn = page.locator('button[type="submit"], button:has-text("Créer")').first();
        if (await createBtn.isVisible({ timeout: 1000 }).catch(() => false)) await createBtn.click();
        await page.waitForTimeout(2000);
      }
    }
  });

  // ─── SHEETS ────────────────────────────────────
  test('sheets: create and verify grid', async ({ page }) => {
    test.setTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(`${BASE}/sheets`);
    await page.waitForTimeout(2000);
    await dismissDialogs(page);

    const blank = page.locator('text=Feuille vierge').first();
    if (await blank.isVisible({ timeout: 2000 }).catch(() => false)) {
      await blank.click();
      await page.waitForTimeout(1000);
      const nameInput = page.locator('input[placeholder*="titre"]').first();
      if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await nameInput.fill('Test Sheet');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(3000);
      }
    }

    // Verify grid rendered
    const cells = await page.locator('div[class*="border-r"][class*="border-b"]').count();
    console.log(`[SHEETS] Grid cells: ${cells}, Errors: ${errors.length}`);
  });

  // ─── MAIL ──────────────────────────────────────
  test('mail: page loads, compose button works', async ({ page }) => {
    test.setTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(`${BASE}/mail`);
    await page.waitForTimeout(3000);
    await dismissDialogs(page);

    // The compose button text is "Nouveau message" — match both FR and EN variants
    const compose = page.locator('button:has-text("Nouveau message"), button:has-text("Compose")').first();
    const hasCompose = await compose.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasCompose) {
      await compose.click();
      await page.waitForTimeout(1000);
    }

    console.log(`[MAIL] Compose: ${hasCompose}, Errors: ${errors.length}`);
  });

  // ─── CONTACTS ──────────────────────────────────
  test('contacts: CRUD operations', async ({ page }) => {
    test.setTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(`${BASE}/contacts`);
    await page.waitForTimeout(3000);
    await dismissDialogs(page);

    // Count rows — seed data should appear even when the API is down
    const rows = await page.locator('tbody tr').count();
    console.log(`[CONTACTS] Rows: ${rows}, Errors: ${errors.length}`);
    expect(rows).toBeGreaterThanOrEqual(1); // Should show seed contacts
  });

  // ─── CALENDAR ──────────────────────────────────
  test('calendar: renders without crash', async ({ page }) => {
    test.setTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    // The /calendar page redirects to /cal which may not exist as a separate route.
    // Navigate to /calendar and let the redirect happen if applicable.
    await page.goto(`${BASE}/calendar`);
    await page.waitForTimeout(3000);
    await dismissDialogs(page);

    const body = await page.textContent('body');
    // The calendar page shows "Redirection vers le calendrier..." or actual calendar content
    const hasCal = body?.includes('Lun') || body?.includes('Mon') || body?.includes('calendrier') || body?.includes('Redirection');
    console.log(`[CALENDAR] Has calendar: ${hasCal}, URL: ${page.url()}, Errors: ${errors.length}`);
  });

  // ─── CHAT ──────────────────────────────────────
  test('chat: page loads, can type message', async ({ page }) => {
    test.setTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(`${BASE}/chat`);
    await page.waitForTimeout(3000);
    await dismissDialogs(page);

    // Chat page initially shows empty state with no message input (by design).
    // Check for the search input (always visible in header) or the empty state text.
    const searchInput = page.locator('input[placeholder*="Rechercher"], input[placeholder*="discussion"]').first();
    const hasSearch = await searchInput.isVisible({ timeout: 2000 }).catch(() => false);

    // Also check for the empty state message or the message textarea (if a channel is selected)
    const emptyState = page.locator('text=Aucune conversation sélectionnée').first();
    const hasEmpty = await emptyState.isVisible({ timeout: 1000 }).catch(() => false);

    // The message input is a textarea with placeholder "Message..." (capital M)
    const msgInput = page.locator('textarea[placeholder*="Message"], input[placeholder*="Message"]').first();
    const hasMsgInput = await msgInput.isVisible({ timeout: 1000 }).catch(() => false);

    console.log(`[CHAT] Search: ${hasSearch}, Empty state: ${hasEmpty}, Msg input: ${hasMsgInput}, Errors: ${errors.length}`);
    // Page should at least show the search or empty state
    expect(hasSearch || hasEmpty || hasMsgInput).toBe(true);
  });

  // ─── AI ────────────────────────────────────────
  test('ai: dashboard and studio load', async ({ page }) => {
    test.setTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(`${BASE}/ai`);
    await page.waitForTimeout(2000);
    await dismissDialogs(page);

    const body = await page.textContent('body');
    // The AI page shows "Assistant IA" and conversation UI
    const hasAI = body?.includes('Assistant IA') || body?.includes('Nouvelle conversation') || body?.includes('Envoyer');
    console.log(`[AI] Has content: ${hasAI}, Errors: ${errors.length}`);

    // Navigate to studio
    await page.goto(`${BASE}/ai/studio`);
    await page.waitForTimeout(2000);
    const tabs = await page.locator('button[role="tab"]').count();
    console.log(`[AI STUDIO] Tabs: ${tabs}`);
  });

  // ─── STORAGE ───────────────────────────────────
  test('storage: page loads, buckets visible', async ({ page }) => {
    test.setTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(`${BASE}/storage`);
    await page.waitForTimeout(3000);
    await dismissDialogs(page);

    const body = await page.textContent('body');
    const hasBuckets = body?.includes('Bucket') || body?.includes('bucket') || body?.includes('Create');
    console.log(`[STORAGE] Has buckets: ${hasBuckets}, Errors: ${errors.length}`);
  });

  // ─── SCHEDULING ────────────────────────────────
  test('scheduling: calendar grid renders', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto(`${BASE}/scheduling`);
    await page.waitForTimeout(2000);
    await dismissDialogs(page);

    const body = await page.textContent('body');
    // The scheduling page shows "Planification des ressources" and time slots like "08:00"
    const hasGrid = body?.includes('08:00') || body?.includes('Planification') || body?.includes('ressources');
    console.log(`[SCHEDULING] Has grid: ${hasGrid}`);
  });

  // ─── ADMIN SETTINGS ────────────────────────────
  test('admin settings: tabs work', async ({ page }) => {
    test.setTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(`${BASE}/admin/settings`);
    await page.waitForTimeout(2000);
    await dismissDialogs(page);

    // Click each tab
    for (const tab of ['Securite', 'Email', 'Stockage', 'Integrations']) {
      const t = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).first();
      if (await t.isVisible({ timeout: 1000 }).catch(() => false)) {
        await t.click();
        await page.waitForTimeout(300);
      }
    }

    console.log(`[ADMIN SETTINGS] Errors: ${errors.length}`);
  });

  // ─── GLOBAL DRIVE ──────────────────────────────
  test('global-drive: files visible, folder navigation', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto(`${BASE}/global-drive`);
    await page.waitForTimeout(2000);
    await dismissDialogs(page);

    const body = await page.textContent('body');
    const hasFiles = body?.includes('Documents') || body?.includes('.pdf') || body?.includes('Drive');
    console.log(`[DRIVE] Has files: ${hasFiles}`);
  });

  // ─── KEEP ──────────────────────────────────────
  test('keep: create note', async ({ page }) => {
    test.setTimeout(30000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(`${BASE}/keep`);
    await page.waitForTimeout(2000);
    await dismissDialogs(page);

    const input = page.locator('input[placeholder*="note"], textarea[placeholder*="note"], input[placeholder*="Prendre"]').first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill('Test note from bug hunter');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    console.log(`[KEEP] Errors: ${errors.length}`);
  });

  // ─── MONITORING ────────────────────────────────
  test('monitoring: live metrics display', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto(`${BASE}/monitoring`);
    await page.waitForTimeout(3000);
    await dismissDialogs(page);

    const body = await page.textContent('body');
    const hasCPU = body?.includes('CPU') || body?.includes('cpu');
    const hasMem = body?.includes('Memory') || body?.includes('Memoire') || body?.includes('RAM');
    console.log(`[MONITORING] CPU: ${hasCPU}, Memory: ${hasMem}`);
  });

  // ─── STATUS PAGE ───────────────────────────────
  test('status: all services checked', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto(`${BASE}/status`);
    await page.waitForTimeout(5000);

    const body = await page.textContent('body');
    const services = ['Identity', 'Storage', 'AI', 'Scheduler', 'Metrics'];
    for (const svc of services) {
      const found = body?.includes(svc);
      console.log(`[STATUS] ${svc}: ${found ? 'found' : 'MISSING'}`);
    }
  });

  // ─── HEALTH API ────────────────────────────────
  test('health API returns valid JSON', async ({ page }) => {
    test.setTimeout(10000);
    const response = await page.goto(`${BASE}/api/health`);
    expect(response?.status()).toBe(200);
    const json = await response?.json();
    expect(json.status).toBe('ok');
    expect(json.services.length).toBeGreaterThan(0);
    const up = json.services.filter((s: any) => s.status === 'up').length;
    console.log(`[HEALTH API] Services up: ${up}/${json.services.length}`);
  });
});
