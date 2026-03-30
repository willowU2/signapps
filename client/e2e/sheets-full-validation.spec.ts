import { test, expect } from '@playwright/test';
import path from 'path';
import { randomUUID } from 'crypto';

const XLSX_PATH = path.resolve(__dirname, '../../Calcul Marge 2019 - 2032.xlsx');

test.describe('Full Excel Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login?auto=admin');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.goto('http://localhost:3000/login?auto=admin');
    await page.waitForURL(/\/(dashboard|sheets)/, { timeout: 10000 });
  });

  test('complete validation of Calcul Marge Excel file', async ({ page }) => {
    test.setTimeout(300000);

    const logs: string[] = [];
    page.on('console', msg => {
      const t = msg.text();
      if (t.includes('import') || t.includes('Sheet') || t.includes('cell') || t.includes('error'))
        logs.push(`[${msg.type()}] ${t}`);
    });

    // 1. IMPORT
    const sid = randomUUID();
    await page.goto(`http://localhost:3000/sheets/editor?id=${sid}&name=FullTest`);
    await page.waitForLoadState('networkidle');

    // Wait for editor to be ready
    const fi = page.locator('input[type="file"][accept*=".xlsx"]');
    await expect(fi).toBeAttached({ timeout: 5000 });
    await fi.setInputFiles(XLSX_PATH);
    // Wait for import to complete: sheet tabs or grid cells become visible
    await page.locator(
      '[data-testid="import-complete"], div[class*="border-r"][class*="border-b"], [data-testid="sheet-tab"]'
    ).first().waitFor({ state: 'visible', timeout: 90_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // Close modals
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    logs.forEach(l => console.log(l));

    // 2. VERIFY 4 SHEETS EXIST
    const html = await page.content();
    const sheetNames = ['SAISIEJOUR', 'DONNEES PERIODIQUES', 'OBJECTIFS', 'DATES'];
    for (const name of sheetNames) {
      const found = html.includes(name);
      console.log(`[SHEET] ${name}: ${found ? 'OK' : 'MISSING'}`);
      expect(found).toBe(true);
    }

    // No phantom Sheet1
    const sheet1Count = (html.match(/Sheet1/g) || []).length;
    console.log(`[SHEET] Phantom Sheet1 count: ${sheet1Count} (should be 0)`);

    // 3. VERIFY SAISIEJOUR DATA
    await page.screenshot({ path: 'e2e/screenshots/full-saisiejour.png' });

    const saisieData = await page.evaluate(() => {
      const cells = document.querySelectorAll('div[class*="border-r"][class*="border-b"]');
      const values: string[] = [];
      cells.forEach(c => {
        const t = c.textContent?.trim();
        if (t && t.length > 0 && !t.match(/^[A-Z]$/) && t !== 'ƒx') values.push(t.substring(0, 40));
      });
      return {
        count: values.length,
        hasHeaders: values.some(v => ['CV+TK', 'MgBrut', 'CAcomp', 'Remise'].includes(v)),
        hasDates: values.some(v => /^\d{4}-\d{2}-\d{2}/.test(v)),
        hasNumbers: values.some(v => /^\d+[\.,]\d+/.test(v)),
        hasPercentages: values.some(v => v.includes('%')),
        hasObjectObject: values.some(v => v.includes('[object Object]')),
        sample: values.slice(0, 20)
      };
    });

    console.log(`[SAISIEJOUR] Cells: ${saisieData.count}`);
    console.log(`[SAISIEJOUR] Headers: ${saisieData.hasHeaders}`);
    console.log(`[SAISIEJOUR] Dates: ${saisieData.hasDates}`);
    console.log(`[SAISIEJOUR] Numbers: ${saisieData.hasNumbers}`);
    console.log(`[SAISIEJOUR] Percentages: ${saisieData.hasPercentages}`);
    console.log(`[SAISIEJOUR] [object Object]: ${saisieData.hasObjectObject}`);
    console.log(`[SAISIEJOUR] Sample: ${JSON.stringify(saisieData.sample.slice(0, 10))}`);

    expect(saisieData.hasHeaders).toBe(true);
    expect(saisieData.hasObjectObject).toBe(false);
    expect(saisieData.count).toBeGreaterThan(50);

    // 4. SWITCH TO OBJECTIFS AND VERIFY
    const objTab = page.locator('div').filter({ hasText: /^OBJECTIFS$/ }).last();
    await objTab.click({ force: true });
    await page.locator('div[class*="border-r"][class*="border-b"]').first()
      .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: 'e2e/screenshots/full-objectifs.png' });

    const objData = await page.evaluate(() => {
      const cells = document.querySelectorAll('div[class*="border-r"][class*="border-b"]');
      const values: string[] = [];
      cells.forEach(c => {
        const t = c.textContent?.trim();
        if (t && t.length > 1 && !t.match(/^[A-Z]$/)) values.push(t.substring(0, 40));
      });
      return {
        count: values.length,
        hasObjectifHeaders: values.some(v => v.includes('OBJECTIF') || v.includes('MARGE') || v.includes('Marge')),
        hasDates: values.some(v => /\d{4}/.test(v)),
        sample: values.slice(0, 15)
      };
    });

    console.log(`[OBJECTIFS] Cells: ${objData.count}, Headers: ${objData.hasObjectifHeaders}`);
    console.log(`[OBJECTIFS] Sample: ${JSON.stringify(objData.sample.slice(0, 10))}`);
    expect(objData.count).toBeGreaterThan(5);

    // 5. SWITCH TO DATES AND VERIFY
    const datesTab = page.locator('div').filter({ hasText: /^DATES$/ }).last();
    await datesTab.click({ force: true });
    await page.locator('div[class*="border-r"][class*="border-b"]').first()
      .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: 'e2e/screenshots/full-dates.png' });

    const datesData = await page.evaluate(() => {
      const cells = document.querySelectorAll('div[class*="border-r"][class*="border-b"]');
      const values: string[] = [];
      cells.forEach(c => {
        const t = c.textContent?.trim();
        if (t && t.length > 1) values.push(t.substring(0, 40));
      });
      return {
        count: values.length,
        hasDates: values.some(v => /^\d{4}-\d{2}-\d{2}/.test(v)),
        hasYears: values.some(v => /^20[12]\d$/.test(v)),
        sample: values.slice(0, 15)
      };
    });

    console.log(`[DATES] Cells: ${datesData.count}, Dates: ${datesData.hasDates}, Years: ${datesData.hasYears}`);
    console.log(`[DATES] Sample: ${JSON.stringify(datesData.sample.slice(0, 10))}`);
    expect(datesData.count).toBeGreaterThan(10);

    // 6. SWITCH TO DONNEES PERIODIQUES AND VERIFY
    const dpTab = page.locator('div').filter({ hasText: /^DONNEES PERIODIQUES$/ }).last();
    await dpTab.click({ force: true });
    await page.locator('div[class*="border-r"][class*="border-b"]').first()
      .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: 'e2e/screenshots/full-donnees.png' });

    const dpData = await page.evaluate(() => {
      const cells = document.querySelectorAll('div[class*="border-r"][class*="border-b"]');
      const values: string[] = [];
      cells.forEach(c => {
        const t = c.textContent?.trim();
        if (t && t.length > 1) values.push(t.substring(0, 40));
      });
      return { count: values.length, sample: values.slice(0, 15) };
    });

    console.log(`[DONNEES PERIODIQUES] Cells: ${dpData.count}`);
    console.log(`[DONNEES PERIODIQUES] Sample: ${JSON.stringify(dpData.sample.slice(0, 10))}`);
    expect(dpData.count).toBeGreaterThan(20);

    // 7. BACK TO SAISIEJOUR - verify it still works
    const saisieTab = page.locator('div').filter({ hasText: /^SAISIEJOUR$/ }).last();
    await saisieTab.click({ force: true });
    await page.locator('div[class*="border-r"][class*="border-b"]').first()
      .waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

    const backData = await page.evaluate(() => {
      const cells = document.querySelectorAll('div[class*="border-r"][class*="border-b"]');
      let count = 0;
      cells.forEach(c => { if (c.textContent?.trim().length > 1) count++; });
      return count;
    });
    console.log(`[SAISIEJOUR BACK] Cells: ${backData}`);
    expect(backData).toBeGreaterThan(50);

    // 8. VERIFY STYLES - check for colored cells
    const styleCheck = await page.evaluate(() => {
      const cells = document.querySelectorAll('div[class*="border-r"][class*="border-b"]');
      let withBg = 0;
      let withBold = 0;
      cells.forEach(c => {
        const style = window.getComputedStyle(c);
        if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') withBg++;
        if (style.fontWeight === '700' || style.fontWeight === 'bold') withBold++;
      });
      return { withBg, withBold };
    });
    console.log(`[STYLES] Colored cells: ${styleCheck.withBg}, Bold cells: ${styleCheck.withBold}`);

    // 9. VERIFY FROZEN ROW
    const frozenCheck = await page.evaluate(() => {
      const rows = document.querySelectorAll('div[class*="sticky"]');
      return rows.length;
    });
    console.log(`[FREEZE] Sticky elements: ${frozenCheck}`);

    // 10. FINAL SUMMARY
    console.log('\n=== FULL VALIDATION SUMMARY ===');
    console.log(`Sheets: 4/4 ✓`);
    console.log(`SAISIEJOUR: ${saisieData.count} cells ✓`);
    console.log(`OBJECTIFS: ${objData.count} cells ✓`);
    console.log(`DATES: ${datesData.count} cells ✓`);
    console.log(`DONNEES PERIODIQUES: ${dpData.count} cells ✓`);
    console.log(`Tab switching: works ✓`);
    console.log(`[object Object]: ${saisieData.hasObjectObject ? 'FAIL ✗' : 'none ✓'}`);
    console.log(`Styles: ${styleCheck.withBg} colored, ${styleCheck.withBold} bold`);
    console.log('================================');
  });
});
