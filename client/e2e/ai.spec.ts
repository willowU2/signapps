import { test, expect } from './fixtures';

/**
 * AI Pages E2E Tests
 * Tests the AI dashboard, studio, search, and settings pages.
 * Focuses on page rendering and UI elements since the AI service
 * (port 3005) may not be running during tests.
 */

test.describe('AI Pages', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Dashboard
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('AI Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/ai');
      await page.waitForLoadState('networkidle');
    });

    test('should display dashboard page with title', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'AI Dashboard' })).toBeVisible();
    });

    test('should display subtitle text', async ({ page }) => {
      await expect(
        page.getByText(/Moniteur de capacites|GPU|historique/i)
      ).toBeVisible();
    });

    test('should display AI navigation bar', async ({ page }) => {
      // The AiNav renders four links: Dashboard, Studio, Search, Settings
      const nav = page.locator('nav');
      await expect(nav.getByRole('link', { name: /Dashboard/i })).toBeVisible();
      await expect(nav.getByRole('link', { name: /Studio/i })).toBeVisible();
      await expect(nav.getByRole('link', { name: /Search/i })).toBeVisible();
      await expect(nav.getByRole('link', { name: /Settings/i })).toBeVisible();
    });

    test('should show GPU monitor section', async ({ page }) => {
      // GPU monitor card or loading spinner should be present
      const hasGpuContent = await page.getByText(/GPU|VRAM|Tier/i).isVisible().catch(() => false);
      const hasLoadingSpinner = await page.locator('.spinner, [class*="Spinner"]').count() > 0;

      // Either GPU data loaded or a spinner/loading state is shown
      expect(hasGpuContent || hasLoadingSpinner).toBeTruthy();
    });

    test('should show capability dashboard section', async ({ page }) => {
      // Capability cards should appear (or loading/error state)
      await page.waitForTimeout(1000);
      const cards = page.locator('[class*="Card"]');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Studio
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('AI Studio', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/ai/studio');
      await page.waitForLoadState('networkidle');
    });

    test('should display studio page with title', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Media Studio' })).toBeVisible();
    });

    test('should display all four media tabs', async ({ page }) => {
      await expect(page.getByRole('tab', { name: /Image/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Video/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Audio/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Vision/i })).toBeVisible();
    });

    test('should show Image tab as default active tab', async ({ page }) => {
      const imageTab = page.getByRole('tab', { name: /Image/i });
      await expect(imageTab).toHaveAttribute('data-state', 'active');
    });

    test('should switch to Video tab', async ({ page }) => {
      await page.getByRole('tab', { name: /Video/i }).click();
      const videoTab = page.getByRole('tab', { name: /Video/i });
      await expect(videoTab).toHaveAttribute('data-state', 'active');
    });

    test('should switch to Audio tab', async ({ page }) => {
      await page.getByRole('tab', { name: /Audio/i }).click();
      const audioTab = page.getByRole('tab', { name: /Audio/i });
      await expect(audioTab).toHaveAttribute('data-state', 'active');
    });

    test('should switch to Vision tab', async ({ page }) => {
      await page.getByRole('tab', { name: /Vision/i }).click();
      const visionTab = page.getByRole('tab', { name: /Vision/i });
      await expect(visionTab).toHaveAttribute('data-state', 'active');
    });

    test('should render tab content panels', async ({ page }) => {
      // Image tab content should be visible by default
      const tabContent = page.locator('[role="tabpanel"]');
      await expect(tabContent).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Search
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('AI Search', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/ai/search');
      await page.waitForLoadState('networkidle');
    });

    test('should display search page with title', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Recherche IA' })).toBeVisible();
    });

    test('should display search subtitle', async ({ page }) => {
      await expect(
        page.getByText(/Recherche multimodale/i)
      ).toBeVisible();
    });

    test('should display search input', async ({ page }) => {
      // The multimodal search component should have an input field
      const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="echerch" i]');
      await expect(searchInput.first()).toBeVisible();
    });

    test('should display search filter tabs', async ({ page }) => {
      // Multimodal search has filter tabs: Tout, Documents, Images, Audio, Video
      await expect(page.getByText('Tout')).toBeVisible();
      await expect(page.getByText('Documents')).toBeVisible();
    });

    test('should display collection selector', async ({ page }) => {
      // The search component has a collection dropdown
      const hasSelect = await page.getByText(/collection/i).isVisible().catch(() => false);
      const hasDropdown = await page.locator('[role="combobox"]').count() > 0;

      expect(hasSelect || hasDropdown).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Settings
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('AI Settings', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/ai/settings');
      await page.waitForLoadState('networkidle');
    });

    test('should display settings page with title', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'AI Settings' })).toBeVisible();
    });

    test('should display settings subtitle', async ({ page }) => {
      await expect(
        page.getByText(/Configuration GPU|profils de modeles|hardware/i)
      ).toBeVisible();
    });

    test('should display hardware info card', async ({ page }) => {
      await expect(page.getByText(/Hardware actuel/i)).toBeVisible();
    });

    test('should display GPU profiles card', async ({ page }) => {
      await expect(page.getByText(/Profils GPU/i)).toBeVisible();
    });

    test('should display refresh button for GPU profiles', async ({ page }) => {
      await expect(
        page.getByRole('button', { name: /Actualiser/i })
      ).toBeVisible();
    });

    test('should show loading or profile data', async ({ page }) => {
      await page.waitForTimeout(1500);

      // Either profiles loaded, loading spinner, or error/empty message
      const hasProfiles = await page.locator('[role="combobox"]').count() > 0;
      const hasSpinner = await page.locator('.spinner, [class*="Spinner"]').count() > 0;
      const hasEmptyMessage = await page.getByText(/Aucun profil GPU|service AI/i).isVisible().catch(() => false);
      const hasError = await page.locator('.text-destructive').count() > 0;

      expect(hasProfiles || hasSpinner || hasEmptyMessage || hasError).toBeTruthy();
    });

    test('should click refresh and not crash', async ({ page }) => {
      const refreshButton = page.getByRole('button', { name: /Actualiser/i });
      await refreshButton.click();

      // Page should remain stable after clicking refresh
      await page.waitForTimeout(1000);
      await expect(page.getByRole('heading', { name: 'AI Settings' })).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────

  test.describe('AI Navigation', () => {
    test('should navigate from Dashboard to Studio via nav link', async ({ page }) => {
      await page.goto('/ai');
      await page.waitForLoadState('networkidle');

      // Click Studio in the AI nav
      const nav = page.locator('nav');
      await nav.getByRole('link', { name: /Studio/i }).click();

      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/ai\/studio/);
      await expect(page.getByRole('heading', { name: 'Media Studio' })).toBeVisible();
    });

    test('should navigate from Studio to Search via nav link', async ({ page }) => {
      await page.goto('/ai/studio');
      await page.waitForLoadState('networkidle');

      const nav = page.locator('nav');
      await nav.getByRole('link', { name: /Search/i }).click();

      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/ai\/search/);
      await expect(page.getByRole('heading', { name: 'Recherche IA' })).toBeVisible();
    });

    test('should navigate from Search to Settings via nav link', async ({ page }) => {
      await page.goto('/ai/search');
      await page.waitForLoadState('networkidle');

      const nav = page.locator('nav');
      await nav.getByRole('link', { name: /Settings/i }).click();

      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/ai\/settings/);
      await expect(page.getByRole('heading', { name: 'AI Settings' })).toBeVisible();
    });

    test('should navigate back to Dashboard via nav link', async ({ page }) => {
      await page.goto('/ai/settings');
      await page.waitForLoadState('networkidle');

      const nav = page.locator('nav');
      await nav.getByRole('link', { name: /Dashboard/i }).click();

      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/ai$/);
      await expect(page.getByRole('heading', { name: 'AI Dashboard' })).toBeVisible();
    });

    test('should highlight active nav item', async ({ page }) => {
      await page.goto('/ai/studio');
      await page.waitForLoadState('networkidle');

      // The active link should have the primary border color class
      const studioLink = page.locator('nav').getByRole('link', { name: /Studio/i });
      await expect(studioLink).toHaveClass(/border-primary/);

      // Other links should NOT have primary border
      const dashboardLink = page.locator('nav').getByRole('link', { name: /Dashboard/i });
      await expect(dashboardLink).toHaveClass(/border-transparent/);
    });
  });
});
