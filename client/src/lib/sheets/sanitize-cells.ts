/**
 * Auto-sanitizer for Yjs spreadsheet data.
 * Fixes corrupted cell values (e.g., [object Object]) stored by
 * previous parser versions. Runs once on mount, cleans in-place.
 *
 * Created: 2026-03-27 — fixes object values in Yjs grid maps.
 */
import type * as Y from 'yjs';

interface CellData {
  value?: unknown;
  formula?: string;
  style?: unknown;
  comment?: string;
  validation?: unknown;
}

/**
 * Convert any non-string cell value to a proper string.
 * Handles Date objects, formula result objects, rich text, etc.
 */
function valueToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);

  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    // Date (native or cross-realm)
    if (v instanceof Date) return v.toISOString().split('T')[0];
    if (typeof obj.toISOString === 'function') return (obj.toISOString as () => string)().split('T')[0];
    if (typeof obj.getTime === 'function') return new Date(obj.getTime as unknown as number).toISOString().split('T')[0];
    // Formula result
    if ('result' in obj) return valueToString(obj.result);
    // Rich text
    if ('richText' in obj && Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>).map(r => r?.text || '').join('');
    }
    // Hyperlink
    if ('text' in obj && typeof obj.text === 'string') return obj.text;
    // Error
    if ('error' in obj) return String(obj.error || '');
    // Formula wrapper
    if ('formula' in obj) return valueToString(obj.result);
    // Unknown object — try JSON
    try {
      const s = JSON.stringify(v);
      return s === '{}' ? '' : s;
    } catch {
      return '';
    }
  }

  return String(v);
}

/**
 * Scan a Yjs grid map and fix any cell values that are objects instead of strings.
 * Modifies the map in-place within a single transaction.
 * Returns the number of cells fixed.
 */
export function sanitizeGridMap(doc: Y.Doc, gridMapKey: string): number {
  const gridMap = doc.getMap<CellData>(gridMapKey);
  let fixed = 0;
  const fixes: Array<[string, CellData]> = [];

  gridMap.forEach((cellData, key) => {
    if (cellData && cellData.value !== undefined && typeof cellData.value !== 'string') {
      const newValue = valueToString(cellData.value);
      fixes.push([key, { ...cellData, value: newValue }]);
      fixed++;
    }
  });

  if (fixes.length > 0) {
    doc.transact(() => {
      for (const [key, data] of fixes) {
        gridMap.set(key, data);
      }
    });
    console.warn(`[sanitize-cells] Fixed ${fixed} cells in ${gridMapKey}`);
  }

  return fixed;
}

/**
 * Sanitize all sheets in a Yjs document.
 */
export function sanitizeAllSheets(doc: Y.Doc): number {
  const sheetsMetaV2 = doc.getArray<{ id: string; name: string }>('sheets-meta-v2');
  let totalFixed = 0;

  for (let i = 0; i < sheetsMetaV2.length; i++) {
    const sheet = sheetsMetaV2.get(i);
    if (sheet?.id) {
      totalFixed += sanitizeGridMap(doc, `grid-${sheet.id}`);
    }
  }

  // Also check the default grid (for single-sheet docs)
  const defaultMeta = doc.getArray<{ id: string }>('sheets-meta-v2');
  if (defaultMeta.length === 0) {
    // Old format — try "grid-default"
    totalFixed += sanitizeGridMap(doc, 'grid-default');
  }

  return totalFixed;
}
