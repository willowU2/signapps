/**
 * QA1: Critical Flow E2E Tests for SignApps Platform
 *
 * Tests the 5 most important pages load correctly and are interactive.
 * UI is in French — all selectors use French labels.
 * Dialogs are pre-dismissed via localStorage in auth.setup.ts.
 */

import { test, expect, dismissDialogs } from './fixtures';

async function ensureClean(page: import('@playwright/test').Page) {
  await dismissDialogs(page);
}

// ---------------------------------------------------------------------------
// 1. Dashboard
// ---------------------------------------------------------------------------

test.describe('Dashboard', () => {
  test('loads with heading and sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await ensureClean(page);

    await expect(
      page.locator('h1, h2').filter({ hasText: /tableau de bord|dashboard/i }).first()
    ).toBeVisible({ timeout: 15000 });

    await expect(page.locator('aside')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Mail
// ---------------------------------------------------------------------------

test.describe('Mail', () => {
  test('loads and shows compose button', async ({ page }) => {
    await page.goto('/mail');
    await ensureClean(page);

    // "Nouveau message" button should be visible
    const composeButton = page
      .getByRole('button', { name: /nouveau message|rédiger/i })
      .first();

    await expect(composeButton).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// 3. Calendar
// ---------------------------------------------------------------------------

test.describe('Calendar', () => {
  test('loads with view toolbar and navigable views', async ({ page }) => {
    await page.goto('/calendar');
    await ensureClean(page);

    // Calendar has view buttons: Jour, Sem, Mois, Agenda, etc.
    // These are buttons with text content
    await expect(
      page.locator('button').filter({ hasText: /^Mois$/ }).first()
    ).toBeVisible({ timeout: 10000 });

    // "Aujourd'hui" button
    await expect(
      page.locator('button').filter({ hasText: /Aujourd/i }).first()
    ).toBeVisible();

    // Main area (calendar has 2 main elements — outer + inner)
    await expect(page.locator('main').first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Contacts
// ---------------------------------------------------------------------------

test.describe('Contacts', () => {
  test('loads and shows create button', async ({ page }) => {
    await page.goto('/contacts');
    await ensureClean(page);

    // "Nouveau contact" button should be visible
    const newContactButton = page
      .getByRole('button', { name: /nouveau contact|ajouter/i })
      .first();

    await expect(newContactButton).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// 5. Tasks
// ---------------------------------------------------------------------------

test.describe('Tasks', () => {
  test('loads with header and task views', async ({ page }) => {
    await page.goto('/tasks');
    await ensureClean(page);

    // "Tâches" heading should be visible
    await expect(
      page.locator('h1').filter({ hasText: /tâches/i }).first()
    ).toBeVisible({ timeout: 10000 });

    // View tabs should be present (Liste, Board, Custom)
    await expect(
      page.getByRole('tab', { name: /liste/i }).first()
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 6. New features — Org Structure
// ---------------------------------------------------------------------------

test.describe('Org Structure', () => {
  test('admin org-structure page loads', async ({ page }) => {
    await page.goto('/admin/org-structure');
    await ensureClean(page);
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
  });

  test('admin persons page loads', async ({ page }) => {
    await page.goto('/admin/persons');
    await ensureClean(page);
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
  });

  test('admin sites page loads', async ({ page }) => {
    await page.goto('/admin/sites');
    await ensureClean(page);
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// 7. Vault
// ---------------------------------------------------------------------------

test.describe('Vault', () => {
  test('vault page loads', async ({ page }) => {
    await page.goto('/vault');
    await ensureClean(page);
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// 8. Drive
// ---------------------------------------------------------------------------

test.describe('Drive', () => {
  test('drive page loads', async ({ page }) => {
    await page.goto('/storage');
    await ensureClean(page);
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// 9. Settings / Branding
// ---------------------------------------------------------------------------

test.describe('Settings', () => {
  test('admin settings page loads', async ({ page }) => {
    await page.goto('/admin/settings');
    await ensureClean(page);
    // Settings may not use <main>, check for body content
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    // Should not show error boundary
    await expect(page.locator('.error-boundary')).not.toBeVisible();
  });
});
