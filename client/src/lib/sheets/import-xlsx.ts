import type * as Y from 'yjs';
import { parseSpreadsheetBuffer } from '@/lib/file-parsers';
import type { CellData } from '@/components/sheets/types';
import { ROWS, COLS } from '@/components/sheets/types';

function ensureString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    const o = v as any;
    if (o instanceof Date) return o.toISOString().split('T')[0];
    if (typeof o.toISOString === 'function') return o.toISOString().split('T')[0];
    if ('result' in o) return ensureString(o.result);
    if ('text' in o) return String(o.text || '');
    if ('richText' in o && Array.isArray(o.richText)) return o.richText.map((r: any) => r?.text || '').join('');
    if ('error' in o) return String(o.error || '');
    try { return JSON.stringify(v); } catch { return ''; }
  }
  return String(v);
}

export interface ImportResult {
  totalCells: number;
  sheetCount: number;
  sheetNames: string[];
  colWidths?: Record<string, Record<number, number>>;
  rowHeights?: Record<string, Record<number, number>>;
}

export async function importXlsxToYjs(
  doc: Y.Doc,
  arrayBuffer: ArrayBuffer,
  ext: string
): Promise<ImportResult> {
  const result = await parseSpreadsheetBuffer(arrayBuffer, ext);
  const sheetNames = result.sheets;
  if (sheetNames.length === 0) throw new Error('No sheets found');

  const sheetsMetaV2 = doc.getArray<{ id: string; name: string }>('sheets-meta-v2');

  // Step 1: Clear all existing sheets and rebuild from scratch.
  // Re-use the first sheet's ID (typically 'default') so existing grid data
  // gets overwritten rather than orphaned, but remove every extra sheet that
  // might be left over from a previous import.
  const firstId = sheetsMetaV2.length > 0 ? sheetsMetaV2.get(0).id : 'default';

  doc.transact(() => {
    // Delete all existing sheet metadata
    if (sheetsMetaV2.length > 0) {
      sheetsMetaV2.delete(0, sheetsMetaV2.length);
    }

    // Insert first Excel sheet re-using the original default ID
    sheetsMetaV2.push([{ id: firstId, name: sheetNames[0] }]);

    // Create additional sheets with fresh IDs
    for (let i = 1; i < sheetNames.length; i++) {
      const id = crypto.randomUUID ? crypto.randomUUID() : `sheet-${Date.now()}-${i}`;
      sheetsMetaV2.push([{ id, name: sheetNames[i] }]);
    }
  });

  // Step 3: Build the complete sheet ID list
  const allEntries = sheetsMetaV2.toArray();
  console.log(
    `[import-xlsx] Sheets created: ${allEntries.length}/${sheetNames.length}`,
    allEntries.map(s => `${s.name}(${s.id})`)
  );

  // Step 4: Write data into each sheet's grid map — chunked to avoid freezing UI
  let totalCells = 0;
  const CHUNK_SIZE = 5000; // Write 5K cells per transaction to keep UI responsive

  for (let i = 0; i < sheetNames.length && i < allEntries.length; i++) {
    const sheetName = sheetNames[i];
    const cellsMap = result.data[sheetName];
    if (!cellsMap) continue;

    const sheetId = allEntries[i].id;
    const gridMap = doc.getMap<CellData>(`grid-${sheetId}`);
    const entries = Object.entries(cellsMap);

    for (let chunk = 0; chunk < entries.length; chunk += CHUNK_SIZE) {
      const batch = entries.slice(chunk, chunk + CHUNK_SIZE);
      doc.transact(() => {
        for (const [key, cellData] of batch) {
          const [rStr, cStr] = key.split(',');
          const r = parseInt(rStr, 10);
          const c = parseInt(cStr, 10);
          if (r >= ROWS || c >= COLS) continue;

          // Skip empty cells to reduce storage
          const val = ensureString(cellData.value);
          if (!val && !cellData.formula && !cellData.style && !cellData.comment) continue;

          const safeData = { ...cellData, value: val } as CellData;
          gridMap.set(`${r},${c}`, safeData);
          totalCells++;
        }
      });
      // Yield to UI thread between chunks
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // Step 5: Store column widths and row heights per sheet in Yjs
  doc.transact(() => {
    for (let i = 0; i < sheetNames.length && i < allEntries.length; i++) {
      const sheetName = sheetNames[i];
      const sheetId = allEntries[i].id;

      const parsedColWidths = result.colWidths?.[sheetName];
      if (parsedColWidths && Object.keys(parsedColWidths).length > 0) {
        const yjsColWidths = doc.getMap<number>(`colWidths-${sheetId}`);
        // Clear any existing widths
        yjsColWidths.forEach((_, key) => yjsColWidths.delete(key));
        for (const [col, width] of Object.entries(parsedColWidths)) {
          yjsColWidths.set(String(col), width);
        }
      }

      const parsedRowHeights = result.rowHeights?.[sheetName];
      if (parsedRowHeights && Object.keys(parsedRowHeights).length > 0) {
        const yjsRowHeights = doc.getMap<number>(`rowHeights-${sheetId}`);
        // Clear any existing heights
        yjsRowHeights.forEach((_, key) => yjsRowHeights.delete(key));
        for (const [row, height] of Object.entries(parsedRowHeights)) {
          yjsRowHeights.set(String(row), height);
        }
      }
    }
  });

  console.log(`[import-xlsx] Imported ${totalCells} cells across ${sheetNames.length} sheets`);

  return {
    totalCells,
    sheetCount: sheetNames.length,
    sheetNames,
    colWidths: result.colWidths,
    rowHeights: result.rowHeights,
  };
}
