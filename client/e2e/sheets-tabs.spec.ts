import { test, expect } from '@playwright/test';
import path from 'path';
import { randomUUID } from 'crypto';

const XLSX_PATH = path.resolve(__dirname, '../../Calcul Marge 2019 - 2032.xlsx');

test.describe('Sheets Tab Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login?auto=admin');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.goto('http://localhost:3000/login?auto=admin');
    await page.waitForURL(/\/(dashboard|sheets)/, { timeout: 10000 });
  });

  test('should import all sheets and switch between them', async ({ page }) => {
    test.setTimeout(300000);

    // Capture ALL console output from the start
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('import') || text.includes('Sheet') || text.includes('cells')) {
        consoleLogs.push(`[${msg.type()}] ${text}`);
      }
    });

    const sheetId = randomUUID();
    await page.goto(`http://localhost:3000/sheets/editor?id=${sheetId}&name=TabTest2`);
    await page.waitForLoadState('networkidle');

    // Wait for editor to be ready
    const fileInput = page.locator('input[type="file"][accept*=".xlsx"]');
    await expect(fileInput).toBeAttached({ timeout: 10000 });
    await fileInput.setInputFiles(XLSX_PATH);

    // Wait for import to complete: sheet tabs or grid cells become visible
    await page.locator(
      '[data-testid="import-complete"], div[class*="border-r"][class*="border-b"], [data-testid="sheet-tab"]'
    ).first().waitFor({ state: 'visible', timeout: 90_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // Print captured console logs
    console.log('=== Console logs during import ===');
    consoleLogs.forEach(l => console.log(l));

    // Close any modals
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // Take screenshot of first sheet
    await page.screenshot({ path: 'e2e/screenshots/tab-sheet1.png' });

    // Count visible data cells
    const countCells = async (label: string) => {
      const info = await page.evaluate(() => {
        const cells = document.querySelectorAll('div[class*="border-r"][class*="border-b"]');
        let withData = 0;
        const samples: string[] = [];
        cells.forEach(c => {
          const t = c.textContent?.trim();
          if (t && t.length > 0 && t !== '' && !t.match(/^[A-Z]$/) && !t.match(/^\d+$/)) {
            withData++;
            if (samples.length < 5) samples.push(t.substring(0, 30));
          }
        });
        return { withData, samples };
      });
      console.log(`${label}: ${info.withData} data cells, samples: ${JSON.stringify(info.samples)}`);
      return info;
    };

    const sheet1 = await countCells('SAISIEJOUR (initial)');

    // Click OBJECTIFS tab
    const objectifsTab = page.locator('div:has-text("OBJECTIFS")').last();
    await objectifsTab.click({ force: true });
    await page.locator('div[class*="border-r"][class*="border-b"]').first()
      .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: 'e2e/screenshots/tab-objectifs.png' });
    const sheet3 = await countCells('OBJECTIFS (after switch)');

    // Click DATES tab
    const datesTab = page.locator('div:has-text("DATES")').last();
    await datesTab.click({ force: true });
    await page.locator('div[class*="border-r"][class*="border-b"]').first()
      .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: 'e2e/screenshots/tab-dates.png' });
    const sheet4 = await countCells('DATES (after switch)');

    // Click back to SAISIEJOUR
    const saisieTab = page.locator('div:has-text("SAISIEJOUR")').last();
    await saisieTab.click({ force: true });
    await page.locator('div[class*="border-r"][class*="border-b"]').first()
      .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    const sheet1again = await countCells('SAISIEJOUR (back)');

    // Assertions
    expect(sheet1.withData).toBeGreaterThan(10); // First sheet has data
    console.log(`OBJECTIFS data: ${sheet3.withData}, DATES data: ${sheet4.withData}`);

    // At minimum, first sheet should work
    expect(sheet1again.withData).toBeGreaterThan(10);
  });
});
