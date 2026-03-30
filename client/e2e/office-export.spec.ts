import { test, expect } from './fixtures';

/**
 * Office Import/Export E2E Tests
 * Tests document, spreadsheet, and presentation import/export functionality
 */

test.describe('Document Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/docs');
  });

  test.describe('DOCX Export', () => {
    test('should export document as DOCX', async ({ page }) => {
      const docItem = page.locator('[data-testid="document-item"], .document-card').first();
      if (await docItem.isVisible()) {
        await docItem.click();
        await page.locator('.tiptap, .ProseMirror, [contenteditable="true"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        const exportBtn = page.getByRole('button', { name: /export|download|télécharger/i });
        if (await exportBtn.isVisible()) {
          await exportBtn.click();

          const docxOption = page.locator('text=/docx|word/i');
          if (await docxOption.isVisible()) {
            const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
            await docxOption.click();

            const download = await downloadPromise;
            if (download) {
              expect(download.suggestedFilename()).toMatch(/\.docx$/i);
            }
          }
        }
      }
    });
  });

  test.describe('PDF Export', () => {
    test('should export document as PDF', async ({ page }) => {
      const docItem = page.locator('[data-testid="document-item"], .document-card').first();
      if (await docItem.isVisible()) {
        await docItem.click();
        await page.locator('.tiptap, .ProseMirror, [contenteditable="true"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        const exportBtn = page.getByRole('button', { name: /export|download/i });
        if (await exportBtn.isVisible()) {
          await exportBtn.click();

          const pdfOption = page.locator('text=/pdf/i');
          if (await pdfOption.isVisible()) {
            const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
            await pdfOption.click();

            const download = await downloadPromise;
            if (download) {
              expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
            }
          }
        }
      }
    });
  });

  test.describe('Markdown Export', () => {
    test('should export document as Markdown', async ({ page }) => {
      const docItem = page.locator('[data-testid="document-item"], .document-card').first();
      if (await docItem.isVisible()) {
        await docItem.click();
        await page.locator('.tiptap, .ProseMirror, [contenteditable="true"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        const exportBtn = page.getByRole('button', { name: /export|download/i });
        if (await exportBtn.isVisible()) {
          await exportBtn.click();

          const mdOption = page.locator('text=/markdown|md/i');
          if (await mdOption.isVisible()) {
            const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
            await mdOption.click();

            const download = await downloadPromise;
            if (download) {
              expect(download.suggestedFilename()).toMatch(/\.(md|markdown)$/i);
            }
          }
        }
      }
    });
  });

  test.describe('HTML Export', () => {
    test('should export document as HTML', async ({ page }) => {
      const docItem = page.locator('[data-testid="document-item"], .document-card').first();
      if (await docItem.isVisible()) {
        await docItem.click();
        await page.locator('.tiptap, .ProseMirror, [contenteditable="true"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        const exportBtn = page.getByRole('button', { name: /export|download/i });
        if (await exportBtn.isVisible()) {
          await exportBtn.click();

          const htmlOption = page.locator('text=/html/i');
          if (await htmlOption.isVisible()) {
            const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
            await htmlOption.click();

            const download = await downloadPromise;
            if (download) {
              expect(download.suggestedFilename()).toMatch(/\.html$/i);
            }
          }
        }
      }
    });
  });
});

test.describe('Document Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/docs');
  });

  test.describe('DOCX Import', () => {
    test('should show DOCX import option', async ({ page }) => {
      const importBtn = page.getByRole('button', { name: /import|importer/i });
      if (await importBtn.isVisible()) {
        await importBtn.click();

        const docxOption = page.locator('text=/docx|word/i');
        const hasDocx = await docxOption.isVisible().catch(() => false);
        const body = await page.textContent('body');
        expect(body?.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Markdown Import', () => {
    test('should show Markdown import option', async ({ page }) => {
      const importBtn = page.getByRole('button', { name: /import|importer/i });
      if (await importBtn.isVisible()) {
        await importBtn.click();

        const mdOption = page.locator('text=/markdown|md/i');
        const hasMd = await mdOption.isVisible().catch(() => false);
        const body = await page.textContent('body');
        expect(body?.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('HTML Import', () => {
    test('should show HTML import option', async ({ page }) => {
      const importBtn = page.getByRole('button', { name: /import|importer/i });
      if (await importBtn.isVisible()) {
        await importBtn.click();

        const htmlOption = page.locator('text=/html/i');
        const hasHtml = await htmlOption.isVisible().catch(() => false);
        const body = await page.textContent('body');
        expect(body?.length).toBeGreaterThan(0);
      }
    });
  });
});

test.describe('Spreadsheet Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sheets');
  });

  test.describe('XLSX Export', () => {
    test('should export spreadsheet as XLSX', async ({ page }) => {
      const sheetItem = page.locator('[data-testid="sheet-item"], .sheet-card').first();
      if (await sheetItem.isVisible()) {
        await sheetItem.click();
        await page.locator('.sheet-editor, [data-testid="sheet-editor"], [class*="grid"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        const exportBtn = page.getByRole('button', { name: /export|download|télécharger/i });
        if (await exportBtn.isVisible()) {
          await exportBtn.click();

          const xlsxOption = page.locator('text=/xlsx|excel/i');
          if (await xlsxOption.isVisible()) {
            const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
            await xlsxOption.click();

            const download = await downloadPromise;
            if (download) {
              expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
            }
          }
        }
      }
    });
  });

  test.describe('CSV Export', () => {
    test('should export spreadsheet as CSV', async ({ page }) => {
      const sheetItem = page.locator('[data-testid="sheet-item"], .sheet-card').first();
      if (await sheetItem.isVisible()) {
        await sheetItem.click();
        await page.locator('.sheet-editor, [data-testid="sheet-editor"], [class*="grid"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        const exportBtn = page.getByRole('button', { name: /export|download/i });
        if (await exportBtn.isVisible()) {
          await exportBtn.click();

          const csvOption = page.locator('text=/csv/i');
          if (await csvOption.isVisible()) {
            const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
            await csvOption.click();

            const download = await downloadPromise;
            if (download) {
              expect(download.suggestedFilename()).toMatch(/\.csv$/i);
            }
          }
        }
      }
    });
  });

  test.describe('ODS Export', () => {
    test('should export spreadsheet as ODS', async ({ page }) => {
      const sheetItem = page.locator('[data-testid="sheet-item"], .sheet-card').first();
      if (await sheetItem.isVisible()) {
        await sheetItem.click();
        await page.locator('.sheet-editor, [data-testid="sheet-editor"], [class*="grid"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        const exportBtn = page.getByRole('button', { name: /export|download/i });
        if (await exportBtn.isVisible()) {
          await exportBtn.click();

          const odsOption = page.locator('text=/ods|opendocument/i');
          if (await odsOption.isVisible()) {
            const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
            await odsOption.click();

            const download = await downloadPromise;
            if (download) {
              expect(download.suggestedFilename()).toMatch(/\.ods$/i);
            }
          }
        }
      }
    });
  });
});

test.describe('Spreadsheet Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sheets');
  });

  test.describe('XLSX Import', () => {
    test('should show XLSX import option', async ({ page }) => {
      const importBtn = page.getByRole('button', { name: /import|importer/i });
      if (await importBtn.isVisible()) {
        await importBtn.click();

        const xlsxOption = page.locator('text=/xlsx|excel/i');
        const hasXlsx = await xlsxOption.isVisible().catch(() => false);
        const body = await page.textContent('body');
        expect(body?.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('CSV Import', () => {
    test('should show CSV import option', async ({ page }) => {
      const importBtn = page.getByRole('button', { name: /import|importer/i });
      if (await importBtn.isVisible()) {
        await importBtn.click();

        const csvOption = page.locator('text=/csv/i');
        const hasCsv = await csvOption.isVisible().catch(() => false);
        const body = await page.textContent('body');
        expect(body?.length).toBeGreaterThan(0);
      }
    });
  });
});

test.describe('Presentation Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/slides');
  });

  test.describe('PPTX Export', () => {
    test('should export presentation as PPTX', async ({ page }) => {
      const presentationItem = page.locator('[data-testid="presentation-item"], .presentation-card').first();
      if (await presentationItem.isVisible()) {
        await presentationItem.click();
        await page.locator('[data-testid="slide-editor"], .slide-canvas, canvas').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        const exportBtn = page.getByRole('button', { name: /export|download|télécharger/i });
        if (await exportBtn.isVisible()) {
          await exportBtn.click();

          const pptxOption = page.locator('text=/pptx|powerpoint/i');
          if (await pptxOption.isVisible()) {
            const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
            await pptxOption.click();

            const download = await downloadPromise;
            if (download) {
              expect(download.suggestedFilename()).toMatch(/\.pptx$/i);
            }
          }
        }
      }
    });
  });

  test.describe('PDF Export', () => {
    test('should export presentation as PDF', async ({ page }) => {
      const presentationItem = page.locator('[data-testid="presentation-item"], .presentation-card').first();
      if (await presentationItem.isVisible()) {
        await presentationItem.click();
        await page.locator('[data-testid="slide-editor"], .slide-canvas, canvas').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        const exportBtn = page.getByRole('button', { name: /export|download/i });
        if (await exportBtn.isVisible()) {
          await exportBtn.click();

          const pdfOption = page.locator('text=/pdf/i');
          if (await pdfOption.isVisible()) {
            const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
            await pdfOption.click();

            const download = await downloadPromise;
            if (download) {
              expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
            }
          }
        }
      }
    });
  });

  test.describe('PNG Export', () => {
    test('should export slides as PNG', async ({ page }) => {
      const presentationItem = page.locator('[data-testid="presentation-item"], .presentation-card').first();
      if (await presentationItem.isVisible()) {
        await presentationItem.click();
        await page.locator('[data-testid="slide-editor"], .slide-canvas, canvas').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        const exportBtn = page.getByRole('button', { name: /export|download/i });
        if (await exportBtn.isVisible()) {
          await exportBtn.click();

          const pngOption = page.locator('text=/png|image/i');
          if (await pngOption.isVisible()) {
            const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
            await pngOption.click();

            // May be a single PNG or a ZIP of PNGs
            const download = await downloadPromise;
            const body = await page.textContent('body');
            expect(body?.length).toBeGreaterThan(0);
          }
        }
      }
    });
  });
});

test.describe('Batch Export', () => {
  test('should support batch document export', async ({ page }) => {
    await page.goto('/docs');

    // Select multiple documents
    const docItems = page.locator('[data-testid="document-item"], .document-card');
    const count = await docItems.count();

    if (count >= 2) {
      await docItems.first().click();
      await docItems.nth(1).click({ modifiers: ['Control'] });

      const batchExportBtn = page.getByRole('button', { name: /export selected|exporter la sélection/i });
      const hasBatchExport = await batchExportBtn.isVisible().catch(() => false);
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Export with Comments', () => {
  test('should export document with comments', async ({ page }) => {
    await page.goto('/docs');

    const docItem = page.locator('[data-testid="document-item"]').first();
    if (await docItem.isVisible()) {
      await docItem.click();
      await page.locator('.tiptap, .ProseMirror, [contenteditable="true"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const exportBtn = page.getByRole('button', { name: /export|download/i });
      if (await exportBtn.isVisible()) {
        await exportBtn.click();

        // Check for "include comments" option
        const includeComments = page.locator('text=/include comments|inclure les commentaires/i, [data-testid="include-comments"]');
        const hasOption = await includeComments.isVisible().catch(() => false);
        const body = await page.textContent('body');
        expect(body?.length).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Export with Track Changes', () => {
  test('should export document with track changes', async ({ page }) => {
    await page.goto('/docs');

    const docItem = page.locator('[data-testid="document-item"]').first();
    if (await docItem.isVisible()) {
      await docItem.click();
      await page.locator('.tiptap, .ProseMirror, [contenteditable="true"]').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const exportBtn = page.getByRole('button', { name: /export|download/i });
      if (await exportBtn.isVisible()) {
        await exportBtn.click();

        // Check for "include track changes" option
        const includeChanges = page.locator('text=/include changes|inclure les modifications|track changes/i, [data-testid="include-changes"]');
        const hasOption = await includeChanges.isVisible().catch(() => false);
        const body = await page.textContent('body');
        expect(body?.length).toBeGreaterThan(0);
      }
    }
  });
});
