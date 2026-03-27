import { test, expect } from '@playwright/test';
import path from 'path';
import { randomUUID } from 'crypto';

const XLSX_PATH = path.resolve(__dirname, '../../Calcul Marge 2019 - 2032.xlsx');

test.describe('Sheets Tab Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login?auto=admin');
    await page.waitForTimeout(2000);
    await page.goto('http://localhost:3000/login?auto=admin');
    await page.waitForURL(/\/(dashboard|sheets)/, { timeout: 10000 });
  });

  test('should switch between imported Excel sheets', async ({ page }) => {
    test.setTimeout(300000);

    const sheetId = randomUUID();
    await page.goto(`http://localhost:3000/sheets/editor?id=${sheetId}&name=TabTest`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Import file
    const fileInput = page.locator('input[type="file"][accept*=".xlsx"]');
    await expect(fileInput).toBeAttached({ timeout: 10000 });
    await fileInput.setInputFiles(XLSX_PATH);
    await page.waitForTimeout(45000);

    // Close any welcome/onboarding modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const closeModalBtn = page.locator('button:has-text("Fermer"), button:has-text("Actualiser"), button:has-text("OK"), button:has-text("Close"), [aria-label="Close"]');
    if (await closeModalBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeModalBtn.first().click();
      await page.waitForTimeout(500);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Check all 4 sheet tabs exist
    const sheetNames = ['SAISIEJOUR', 'DONNEES PERIODIQUES', 'OBJECTIFS', 'DATES'];
    for (const name of sheetNames) {
      const tab = page.locator(`text=${name}`).first();
      const visible = await tab.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`Tab "${name}": ${visible ? 'VISIBLE' : 'NOT VISIBLE'}`);
    }

    // Get initial cell content (should be SAISIEJOUR data)
    const initialContent = await page.evaluate(() => {
      const cells = document.querySelectorAll('[title]');
      const values: string[] = [];
      cells.forEach(c => {
        const t = c.getAttribute('title');
        if (t && t.length > 0 && t.length < 100 && !t.includes('object')) values.push(t);
      });
      return values.slice(0, 10);
    });
    console.log('Initial sheet content:', initialContent);

    // Click on OBJECTIFS tab
    const objectifsTab = page.locator('text=OBJECTIFS').first();
    if (await objectifsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await objectifsTab.click();
      await page.waitForTimeout(2000);

      const afterSwitch = await page.evaluate(() => {
        const cells = document.querySelectorAll('[title]');
        const values: string[] = [];
        cells.forEach(c => {
          const t = c.getAttribute('title');
          if (t && t.length > 0 && t.length < 100 && !t.includes('object')) values.push(t);
        });
        return values.slice(0, 10);
      });
      console.log('After switching to OBJECTIFS:', afterSwitch);

      // Content should be different from initial (different sheet data)
      const isDifferent = JSON.stringify(afterSwitch) !== JSON.stringify(initialContent);
      console.log('Content changed after tab switch:', isDifferent);
    } else {
      console.log('OBJECTIFS tab not found — checking all tab text');
      const allTabs = await page.evaluate(() => {
        const tabs = document.querySelectorAll('[class*="cursor-pointer"], [class*="sheet"]');
        return Array.from(tabs).map(t => t.textContent?.trim()).filter(Boolean).slice(0, 10);
      });
      console.log('All tab-like elements:', allTabs);
    }

    // Click on DATES tab
    const datesTab = page.locator('text=DATES').first();
    if (await datesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await datesTab.click();
      await page.waitForTimeout(2000);

      const datesContent = await page.evaluate(() => {
        const cells = document.querySelectorAll('[title]');
        const values: string[] = [];
        cells.forEach(c => {
          const t = c.getAttribute('title');
          if (t && t.length > 0 && t.length < 100 && !t.includes('object')) values.push(t);
        });
        return values.slice(0, 10);
      });
      console.log('DATES sheet content:', datesContent);
    }

    // Switch back to SAISIEJOUR
    const saisieTab = page.locator('text=SAISIEJOUR').first();
    if (await saisieTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saisieTab.click();
      await page.waitForTimeout(2000);

      const backContent = await page.evaluate(() => {
        const cells = document.querySelectorAll('[title]');
        const values: string[] = [];
        cells.forEach(c => {
          const t = c.getAttribute('title');
          if (t && t.length > 0 && t.length < 100 && !t.includes('object')) values.push(t);
        });
        return values.slice(0, 10);
      });
      console.log('Back to SAISIEJOUR:', backContent);
    }

    // Check how many cells have data per sheet by checking Yjs grid maps
    const gridDebug = await page.evaluate(() => {
      // Look for data in visible cells after each tab switch
      const countVisibleData = () => {
        const cells = document.querySelectorAll('div[class*="border-r border-b"]');
        let withContent = 0;
        let empty = 0;
        cells.forEach(c => {
          const t = c.textContent?.trim();
          if (t && t.length > 0 && t !== '' && !t.match(/^[A-Z]$/)) withContent++;
          else empty++;
        });
        return { withContent, empty, total: cells.length };
      };
      return countVisibleData();
    });
    console.log('Final grid cell count:', JSON.stringify(gridDebug));

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/sheets-tabs.png' });
  });
});
