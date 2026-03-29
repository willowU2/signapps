import { test, expect } from './fixtures';

/**
 * Dark Theme E2E Tests
 * Validates key pages render correctly in dark mode without white-background artifacts.
 */

const DARK_TEST_PAGES = [
  '/dashboard',
  '/docs',
  '/mail',
  '/contacts',
  '/admin/settings',
  '/accounting',
  '/workforce',
  '/ai/studio',
];

test.describe('Dark Theme Rendering', () => {
  test.beforeEach(async ({ page }) => {
    // Enable dark mode via localStorage before navigation
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    });
  });

  for (const path of DARK_TEST_PAGES) {
    test(`${path} renders in dark mode without white artifacts`, async ({ page }) => {
      test.setTimeout(30_000);

      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      // Verify dark class is applied
      const isDark = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      );
      expect(isDark).toBe(true);

      // Check that no large elements have hardcoded white backgrounds
      const whiteElements = await page.evaluate(() => {
        const elements = document.querySelectorAll('main *, [role="main"] *');
        let count = 0;
        elements.forEach(el => {
          const bg = getComputedStyle(el).backgroundColor;
          const rect = el.getBoundingClientRect();
          // Only flag visible elements > 100px wide with pure white bg
          if (bg === 'rgb(255, 255, 255)' && rect.width > 100 && rect.height > 50) {
            count++;
          }
        });
        return count;
      });

      expect(
        whiteElements,
        `${path}: found ${whiteElements} element(s) with hardcoded white background in dark mode`
      ).toBeLessThanOrEqual(2); // Small tolerance for intentional elements
    });
  }
});
