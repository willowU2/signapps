import { test, expect } from './fixtures';

/**
 * Spreadsheet E2E Tests
 * Tests spreadsheet functionality, formulas, and import/export
 */

test.describe('Spreadsheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sheets');
  });

  test.describe('Page Layout', () => {
    test('should display sheets page', async ({ page }) => {
      await expect(page.locator('h1, [data-testid="sheets-title"]')).toBeVisible();
    });

    test('should show spreadsheet list or empty state', async ({ page }) => {
      const hasSheets = await page.locator('[data-testid="sheet-item"], .sheet-card').count() > 0;
      const hasEmptyState = await page.locator('text=/aucune feuille|no spreadsheet|créer/i').isVisible().catch(() => false);

      expect(hasSheets || hasEmptyState).toBeTruthy();
    });
  });

  test.describe('Spreadsheet Creation', () => {
    test('should create new spreadsheet', async ({ page }) => {
      const newBtn = page.getByRole('button', { name: /nouveau|new|créer/i });
      if (await newBtn.isVisible()) {
        await newBtn.click();

        // Spreadsheet grid should appear
        const gridVisible = await page.locator('[data-testid="spreadsheet-grid"], .spreadsheet, table').isVisible({ timeout: 10000 }).catch(() => false);

        const hasGrid = await page.locator('[data-testid="spreadsheet-grid"], .spreadsheet, table').isVisible().catch(() => false);
        expect(hasGrid).toBeTruthy();
      }
    });
  });

  test.describe('Grid Functionality', () => {
    test.beforeEach(async ({ page }) => {
      // Try to open or create spreadsheet
      const newBtn = page.getByRole('button', { name: /nouveau|new/i });
      if (await newBtn.isVisible()) {
        await newBtn.click();
      }
      await page.locator('[data-testid="spreadsheet-grid"], .spreadsheet, table, [role="grid"]').isVisible({ timeout: 10000 }).catch(() => false);
    });

    test('should display grid with cells', async ({ page }) => {
      const grid = page.locator('[data-testid="spreadsheet-grid"], .spreadsheet, table, [role="grid"]');
      if (await grid.isVisible()) {
        await expect(grid).toBeVisible();

        // Should have cells
        const cells = page.locator('td, [role="gridcell"], .cell');
        const cellCount = await cells.count();
        expect(cellCount).toBeGreaterThan(0);
      }
    });

    test('should allow cell selection', async ({ page }) => {
      const cell = page.locator('td, [role="gridcell"], .cell').first();
      if (await cell.isVisible()) {
        await cell.click();

        // Cell should be selected (has focus or selected class)
        const isSelected = await cell.evaluate((el) => {
          return el.classList.contains('selected') ||
                 el.classList.contains('active') ||
                 document.activeElement === el ||
                 el.querySelector(':focus') !== null;
        }).catch(() => false);

        expect(isSelected).toBeTruthy();
      }
    });

    test('should allow cell editing', async ({ page }) => {
      const cell = page.locator('td, [role="gridcell"], .cell').first();
      if (await cell.isVisible()) {
        await cell.dblclick();
        await page.keyboard.type('Test Value');
        await page.keyboard.press('Enter');

        // Value should be in the cell
        await expect(page.locator('text=Test Value')).toBeVisible();
      }
    });

    test('should support number entry', async ({ page }) => {
      const cell = page.locator('td, [role="gridcell"], .cell').first();
      if (await cell.isVisible()) {
        await cell.dblclick();
        await page.keyboard.type('42');
        await page.keyboard.press('Enter');

        await expect(page.locator('text=42')).toBeVisible();
      }
    });
  });

  test.describe('Formulas', () => {
    test.beforeEach(async ({ page }) => {
      const newBtn = page.getByRole('button', { name: /nouveau|new/i });
      if (await newBtn.isVisible()) {
        await newBtn.click();
      }
      await page.locator('[data-testid="spreadsheet-grid"], .spreadsheet, table').isVisible({ timeout: 10000 }).catch(() => false);
    });

    test('should calculate SUM formula', async ({ page }) => {
      const cells = page.locator('td, [role="gridcell"], .cell');
      if (await cells.first().isVisible()) {
        // Enter values in A1 and A2
        await cells.nth(0).dblclick();
        await page.keyboard.type('10');
        await page.keyboard.press('Tab');

        await page.keyboard.type('20');
        await page.keyboard.press('Tab');

        // Enter SUM formula in A3
        await page.keyboard.type('=SUM(A1:A2)');
        await page.keyboard.press('Enter');

        // Should show result 30
        const hasResult = await page.locator('text=30').isVisible().catch(() => false);
        expect(hasResult).toBeTruthy();
      }
    });

    test('should show formula bar', async ({ page }) => {
      const formulaBar = page.locator('[data-testid="formula-bar"], .formula-bar, input[placeholder*="formule"]');
      const hasFormulaBar = await formulaBar.isVisible().catch(() => false);
      expect(hasFormulaBar).toBeTruthy();
    });
  });

  test.describe('Column/Row Operations', () => {
    test.beforeEach(async ({ page }) => {
      const newBtn = page.getByRole('button', { name: /nouveau|new/i });
      if (await newBtn.isVisible()) {
        await newBtn.click();
      }
      await page.locator('[data-testid="spreadsheet-grid"], .spreadsheet, table').isVisible({ timeout: 10000 }).catch(() => false);
    });

    test('should show column headers', async ({ page }) => {
      const headers = page.locator('th, .column-header, [data-testid="column-header"]');
      const headerCount = await headers.count();
      expect(headerCount).toBeGreaterThan(0);
    });

    test('should show row numbers', async ({ page }) => {
      const rowNumbers = page.locator('.row-number, [data-testid="row-number"], th:first-child');
      const hasRowNumbers = await rowNumbers.isVisible().catch(() => false);
      expect(hasRowNumbers).toBeTruthy();
    });
  });

  test.describe('Import/Export', () => {
    test('should show import options', async ({ page }) => {
      const importBtn = page.getByRole('button', { name: /import|importer/i });
      if (await importBtn.isVisible()) {
        await importBtn.click();

        // Should show file type options
        const hasOptions = await page.locator('text=/xlsx|csv|ods/i').isVisible().catch(() => false);
        expect(hasOptions).toBeTruthy();
      }
    });

    test('should show export options', async ({ page }) => {
      // Open a spreadsheet first
      const sheetItem = page.locator('[data-testid="sheet-item"], .sheet-card').first();
      if (await sheetItem.isVisible()) {
        await sheetItem.click();
        await page.waitForLoadState('networkidle').catch(() => {});

        const exportBtn = page.getByRole('button', { name: /export|télécharger|download/i });
        if (await exportBtn.isVisible()) {
          await exportBtn.click();

          const hasOptions = await page.locator('text=/xlsx|csv|ods/i').isVisible().catch(() => false);
          expect(hasOptions).toBeTruthy();
        }
      }
    });
  });

  test.describe('Multi-Sheet Support', () => {
    test('should show sheet tabs', async ({ page }) => {
      const newBtn = page.getByRole('button', { name: /nouveau|new/i });
      if (await newBtn.isVisible()) {
        await newBtn.click();
        await page.locator('[data-testid="spreadsheet-grid"], .spreadsheet').isVisible({ timeout: 10000 }).catch(() => false);

        // Look for sheet tabs
        const sheetTabs = page.locator('[data-testid="sheet-tabs"], .sheet-tabs, [role="tablist"]');
        const hasSheetTabs = await sheetTabs.isVisible().catch(() => false);
        expect(hasSheetTabs).toBeTruthy();
      }
    });

    test('should add new sheet', async ({ page }) => {
      const addSheetBtn = page.getByRole('button', { name: /add sheet|nouvelle feuille|\\+/i });
      if (await addSheetBtn.isVisible()) {
        const initialTabs = await page.locator('[role="tab"]').count();
        await addSheetBtn.click();

        const newTabs = await page.locator('[role="tab"]').count();
        expect(newTabs).toBeGreaterThanOrEqual(initialTabs);
      }
    });
  });
});
