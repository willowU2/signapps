import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

async function login(page: any) {
  await page.goto(`${BASE}/login?auto=admin`);
  await page.waitForTimeout(3000);
  await page.goto(`${BASE}/login?auto=admin`);
  await page.waitForTimeout(3000);
  // If still on login, try manual login
  if (page.url().includes('/login')) {
    const user = page.locator('input[name="username"], input[id="username"], #username');
    if (await user.isVisible({ timeout: 2000 }).catch(() => false)) {
      await user.fill('admin');
      const pass = page.locator('input[name="password"], input[id="password"], #password');
      await pass.fill('admin');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(3000);
    }
  }
}

test.describe('UX Deep Audit', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  // ─── DOCS CRUD ─────────────────────────────────────
  test('docs: create, open, edit document', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/docs`);
    await page.waitForTimeout(2000);

    // Click "Feuille vierge" or blank doc
    const blank = page.locator('text=Document vierge, text=Feuille vierge, text=Blank').first();
    if (await blank.isVisible({ timeout: 3000 }).catch(() => false)) {
      await blank.click();
      await page.waitForTimeout(2000);
    }

    // Check if we're in the editor
    const url = page.url();
    const hasEditor = url.includes('/docs/') || url.includes('/editor');
    console.log(`[DOCS] After create: ${url}, hasEditor: ${hasEditor}`);

    await page.screenshot({ path: 'e2e/screenshots/ux-docs.png' });
  });

  // ─── CONTACTS CRUD ─────────────────────────────────
  test('contacts: create, edit, delete contact', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/contacts`);
    await page.waitForTimeout(2000);

    // Count initial contacts
    const initialCount = await page.locator('tr').count();
    console.log(`[CONTACTS] Initial rows: ${initialCount}`);

    // Click "Nouveau Contact"
    const addBtn = page.locator('text=Nouveau Contact, button:has-text("Ajouter")').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1000);

      // Fill form
      const nameInput = page.locator('input[placeholder*="nom"], input[name="name"], input[name="firstName"]').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('Test Contact E2E');
        console.log('[CONTACTS] Filled name');
      }

      // Submit
      const submit = page.locator('button:has-text("Créer"), button:has-text("Ajouter"), button[type="submit"]').first();
      if (await submit.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submit.click();
        await page.waitForTimeout(2000);
      }
    }

    await page.screenshot({ path: 'e2e/screenshots/ux-contacts.png' });
    const finalCount = await page.locator('tr').count();
    console.log(`[CONTACTS] Final rows: ${finalCount}`);
  });

  // ─── MAIL COMPOSE ──────────────────────────────────
  test('mail: compose new message', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/mail`);
    await page.waitForTimeout(2000);

    const compose = page.locator('text=Nouveau message, button:has-text("Compose")').first();
    if (await compose.isVisible({ timeout: 3000 }).catch(() => false)) {
      await compose.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'e2e/screenshots/ux-mail.png' });
    const hasComposeDialog = await page.locator('input[placeholder*="@"], input[name="to"], textarea').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[MAIL] Compose dialog: ${hasComposeDialog}`);
  });

  // ─── TASKS CREATE ──────────────────────────────────
  test('tasks: create project and task', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/tasks`);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/ux-tasks.png' });

    // Check for create button
    const createBtn = page.locator('button:has-text("Créer"), button:has-text("Nouveau"), button:has-text("Add")').first();
    const hasCreate = await createBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[TASKS] Create button: ${hasCreate}`);

    // Check page content
    const content = await page.textContent('body');
    const hasProjects = content?.includes('projet') || content?.includes('Project');
    console.log(`[TASKS] Has project content: ${hasProjects}`);
  });

  // ─── CALENDAR CREATE EVENT ─────────────────────────
  test('calendar: create event', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/cal`);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/ux-calendar.png' });

    // Look for add event button
    const addBtn = page.locator('button:has-text("+"), button[aria-label*="add"], button[aria-label*="créer"]').first();
    const hasAdd = await addBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[CALENDAR] Add button: ${hasAdd}`);
  });

  // ─── CHAT SEND MESSAGE ─────────────────────────────
  test('chat: send a message', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/chat`);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/ux-chat.png' });

    const input = page.locator('input[placeholder*="message"], textarea[placeholder*="message"]').first();
    const hasInput = await input.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[CHAT] Message input: ${hasInput}`);

    if (hasInput) {
      await input.fill('Test message E2E');
      // Try to send
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }
  });

  // ─── CONTAINERS LIST ───────────────────────────────
  test('containers: list and manage', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/containers`);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/ux-containers.png' });

    const content = await page.textContent('body');
    const hasContainers = content?.includes('container') || content?.includes('Container') || content?.includes('Docker');
    console.log(`[CONTAINERS] Has container content: ${hasContainers}`);

    // Check for action buttons
    const newBtn = page.locator('button:has-text("New"), button:has-text("Nouveau")').first();
    const hasNew = await newBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[CONTAINERS] New button: ${hasNew}`);
  });

  // ─── SCHEDULING CRUD ───────────────────────────────
  test('scheduling: create reservation', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/scheduling`);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/ux-scheduling.png' });

    // Check calendar grid
    const hasGrid = await page.locator('text=08:00, text=8:00, text=8h').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[SCHEDULING] Calendar grid: ${hasGrid}`);

    // Click create button
    const createBtn = page.locator('button:has-text("Réserver"), button:has-text("Nouvelle")').first();
    const hasCreate = await createBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[SCHEDULING] Create button: ${hasCreate}`);
  });

  // ─── STORAGE BUCKETS ───────────────────────────────
  test('storage: create bucket', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/storage`);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/ux-storage.png' });

    const createBtn = page.locator('button:has-text("Create Bucket"), button:has-text("Créer")').first();
    const hasCreate = await createBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[STORAGE] Create bucket button: ${hasCreate}`);
  });

  // ─── AI STUDIO ─────────────────────────────────────
  test('ai: studio panels work', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/ai/studio`);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/ux-ai-studio.png' });

    // Check tabs
    const tabs = ['Image', 'Video', 'Audio', 'Vision'];
    for (const tab of tabs) {
      const t = page.locator(`text=${tab}`).first();
      const visible = await t.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`[AI STUDIO] Tab ${tab}: ${visible}`);
    }
  });

  // ─── GLOBAL DRIVE CRUD ─────────────────────────────
  test('global-drive: navigate folders', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/global-drive`);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/ux-drive.png' });

    // Check for files
    const content = await page.textContent('body');
    const hasFiles = content?.includes('Documents') || content?.includes('.pdf') || content?.includes('.xlsx');
    console.log(`[DRIVE] Has files: ${hasFiles}`);

    // Click on a folder
    const folder = page.locator('text=Documents').first();
    if (await folder.isVisible({ timeout: 2000 }).catch(() => false)) {
      await folder.click();
      await page.waitForTimeout(1000);
      console.log('[DRIVE] Navigated into Documents folder');
    }
  });

  // ─── ADMIN SETTINGS ────────────────────────────────
  test('admin: settings tabs work', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/admin/settings`);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'e2e/screenshots/ux-admin-settings.png' });

    // Check tabs
    const tabs = ['General', 'Securite', 'Email', 'Stockage', 'Integrations'];
    for (const tab of tabs) {
      const t = page.locator(`text=${tab}`).first();
      if (await t.isVisible({ timeout: 2000 }).catch(() => false)) {
        await t.click();
        await page.waitForTimeout(500);
        console.log(`[ADMIN] Tab ${tab}: clicked OK`);
      } else {
        console.log(`[ADMIN] Tab ${tab}: NOT VISIBLE`);
      }
    }
  });
});
