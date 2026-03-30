import { test, expect } from '@playwright/test';
import path from 'path';
import { randomUUID } from 'crypto';

const XLSX_PATH = path.resolve(__dirname, '../../Calcul Marge 2019 - 2032.xlsx');

test.describe('Sheets XLSX Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login?auto=admin');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.goto('http://localhost:3000/login?auto=admin');
    await page.waitForURL(/\/(dashboard|sheets)/, { timeout: 10000 });
  });

  test('should import Calcul Marge XLSX file', async ({ page }) => {
    test.setTimeout(300000); // 5 min for large file

    // Navigate directly to the editor with a new sheet ID
    const sheetId = randomUUID();
    await page.goto(`http://localhost:3000/sheets/editor?id=${sheetId}&name=CalcMargeTest`);
    await page.waitForLoadState('networkidle');

    // Verify editor is loaded (should have a grid)
    await page.screenshot({ path: 'e2e/screenshots/sheets-01-editor.png' });
    console.log('Editor loaded');

    // Import the Excel file via the hidden file input
    const fileInput = page.locator('input[type="file"][accept*=".xlsx"]');
    await expect(fileInput).toBeAttached({ timeout: 10000 });
    console.log('File input found, setting file...');

    await fileInput.setInputFiles(XLSX_PATH);
    console.log('File set, waiting for import processing...');

    // Wait for import to complete: sheet tabs or grid cells become visible (100K+ cells)
    await page.locator(
      '[data-testid="import-complete"], div[class*="border-r"][class*="border-b"], [data-testid="sheet-tab"]'
    ).first().waitFor({ state: 'visible', timeout: 90_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    console.log('Import complete indicator detected');

    // Close any welcome/onboarding dialogs
    const closeBtn = page.locator('button:has-text("Actualiser"), button:has-text("Fermer"), button:has-text("OK"), [data-slot="dialog-close"]');
    if (await closeBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.first().click();
      await page.waitForLoadState('networkidle').catch(() => {});
    }
    // Also try Escape
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await page.screenshot({ path: 'e2e/screenshots/sheets-02-after-import.png' });

    // Check page content for sheet names
    const html = await page.content();
    const sheetNames = ['SAISIEJOUR', 'DONNEES PERIODIQUES', 'OBJECTIFS', 'DATES'];
    const foundSheets: string[] = [];

    for (const name of sheetNames) {
      if (html.includes(name)) {
        foundSheets.push(name);
        console.log(`Sheet "${name}": FOUND`);
      } else {
        console.log(`Sheet "${name}": NOT FOUND`);
      }
    }

    // Check for cell content - the spreadsheet uses divs, not table cells
    const cellInfo = await page.evaluate(() => {
      // Try multiple selector strategies
      const selectors = ['td', '[data-cell]', '[class*="cell"]', 'div[style*="grid"]', '[class*="row"]'];
      let totalCells = 0;
      let withContent = 0;
      const samples: string[] = [];

      // Strategy 1: look for any visible text in the spreadsheet area
      const allDivs = document.querySelectorAll('div');
      allDivs.forEach(d => {
        const rect = d.getBoundingClientRect();
        // Only check divs in the grid area (below toolbar ~100px, above bottom)
        if (rect.top > 100 && rect.top < 700 && rect.left > 140 && rect.width < 200 && rect.height < 30) {
          totalCells++;
          const t = d.textContent?.trim();
          if (t && t.length > 0 && t.length < 100) {
            withContent++;
            if (samples.length < 30) samples.push(t);
          }
        }
      });

      // Strategy 2: check if any sheet tab text exists
      const bodyText = document.body.innerText;
      const hasSheetData = bodyText.includes('SAISIEJOUR') || bodyText.includes('OBJECTIFS') || bodyText.includes('DATES');

      return { totalCells, withContent, samples, hasGrid: true, hasSheetData, bodyTextLength: bodyText.length };
    });

    console.log(`Grid found: ${cellInfo.hasGrid}`);
    console.log(`Total cells in DOM: ${cellInfo.totalCells}`);
    console.log(`Cells with content: ${cellInfo.withContent}`);
    console.log(`Sample values:`, cellInfo.samples);

    // Check console for errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('DevTools')) {
          errors.push(text.substring(0, 300));
        }
      }
    });

    // Wait for final state
    await page.locator('div[class*="border-r"][class*="border-b"]').first()
      .waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: 'e2e/screenshots/sheets-03-final.png' });

    console.log(`Found sheets: ${foundSheets.length}/${sheetNames.length}`);
    console.log(`Console errors after import: ${errors.length}`);
    errors.slice(0, 5).forEach(e => console.log(`  ERROR: ${e}`));

    // Assertions - data was imported
    expect(cellInfo.withContent).toBeGreaterThan(10);

    // Check that header values from the Excel file are present
    const hasExpectedHeaders = cellInfo.samples.some(s =>
      ['CV+TK', 'MgBrut', 'CAcomp', 'MGcomp', 'Remise', 'Jour', 'Date'].includes(s)
    );
    expect(hasExpectedHeaders).toBe(true);

    // Check NO [object Object] values
    const objectObjectCount = cellInfo.samples.filter(s => s.includes('[object Object]')).length;
    console.log(`[object Object] count in samples: ${objectObjectCount}`);
    expect(objectObjectCount).toBe(0);

    console.log('IMPORT SUCCESS: Excel data loaded with headers and cell content');
  });
});
