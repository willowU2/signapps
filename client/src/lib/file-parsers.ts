import ExcelJS from 'exceljs';
import * as mammoth from 'mammoth';
import { storageApi } from './api';
import type { CellData, CellStyle, CellValidation } from '@/components/sheets/types';

/**
 * Downloads a document from the storage API and parses it based on extension.
 * Supported: .xlsx, .xls, .csv, .md, .txt, .docx
 */
export async function fetchAndParseDocument(bucket: string, fileKey: string, fileName: string) {
    let ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === fileName.toLowerCase() && !fileName.includes('.')) {
        // Files created natively without extensions are considered 'docx' blobs by signapps editor
        ext = 'docx';
    }
    // 1. Download file stream/blob
    let arrayBuffer: ArrayBuffer | null = null;
    try {
        const blob = await storageApi.downloadFile(bucket, fileKey);
        arrayBuffer = await blob.arrayBuffer();
    } catch (e: any) {
        if (e.response?.status === 404 || e.response?.status === 502) {
            console.warn(`File ${fileKey} not found (status ${e.response.status}). Treating as a new/empty file.`);
            // It will be handled below by passing null or creating empty defaults.
        } else {
            throw new Error(`Failed to download file: ${e.message}`);
        }
    }

    if (!arrayBuffer) {
        // Return default empty state based on file type
        if (['xlsx', 'xls', 'xlsb', 'csv', 'ods'].includes(ext)) {
            return { type: 'spreadsheet', data: {}, sheets: ['Feuille 1'] };
        }
        if (['docx'].includes(ext)) {
            return { type: 'document', html: '', warnings: [] };
        }
        if (['md', 'txt', 'html'].includes(ext)) {
            return { type: 'document', text: '' };
        }
        if (['signslides', 'json'].includes(ext)) {
            return { type: 'slides', format: { version: 1, slides: [] } };
        }
        throw new Error(`Unsupported file type for empty file: ${ext}`);
    }

    // 2. Parse content based on file type
    if (['xlsx', 'xls', 'xlsb', 'csv', 'ods'].includes(ext)) {
        return parseSpreadsheet(arrayBuffer, ext);
    } 
    
    if (['docx'].includes(ext)) {
        return parseDocx(arrayBuffer);
    }
    
    if (['md', 'txt', 'html'].includes(ext)) {
        return parseText(arrayBuffer);
    }

    if (['signslides', 'json'].includes(ext)) {
        return parseSlides(arrayBuffer, fileName);
    }

    throw new Error(`Unsupported file type: ${ext}`);
}

/**
 * Parses a raw XLSX/CSV ArrayBuffer into full spreadsheet data, preserving
 * formulas, styles, merged cells, comments, data validation, column widths
 * and row heights. Can be used both from fetchAndParseDocument and directly
 * from the importFile handler in the spreadsheet component.
 */
export { parseSpreadsheet as parseSpreadsheetBuffer };

export interface SpreadsheetParseResult {
    type: 'spreadsheet';
    data: Record<string, Record<string, CellData>>;
    sheets: string[];
    colWidths?: Record<string, Record<number, number>>;
    rowHeights?: Record<string, Record<number, number>>;
}

/**
 * Extract a display value from an ExcelJS cell, handling all possible value types:
 * string, number, boolean, Date, CellFormulaValue, CellSharedFormulaValue,
 * CellRichTextValue, CellHyperlinkValue, CellErrorValue, null/undefined.
 */
/** Safely convert a formula result to a string, handling all possible types */
function safeResultToString(result: unknown): string {
    if (result === null || result === undefined) return '';
    if (typeof result === 'string') return result;
    if (typeof result === 'number') return String(result);
    if (typeof result === 'boolean') return String(result);
    if (result instanceof Date) return result.toISOString().split('T')[0];
    // Duck-type Date check (cross-realm Date objects)
    if (typeof result === 'object' && result !== null) {
        const r = result as any;
        if (typeof r.toISOString === 'function') return r.toISOString().split('T')[0];
        if ('error' in r) return String(r.error || '');
        if ('richText' in r && Array.isArray(r.richText)) return r.richText.map((t: any) => t?.text || '').join('');
        if ('text' in r) return String(r.text || '');
        if ('result' in r) return safeResultToString(r.result); // recurse
        if ('formula' in r) return safeResultToString(r.result); // formula wrapper
        // Absolutely last resort
        try { const s = JSON.stringify(r); return s === '{}' ? '' : s; } catch { return ''; }
    }
    return String(result);
}

function extractCellValue(cellValue: ExcelJS.CellValue): string {
    if (cellValue === null || cellValue === undefined) return '';

    // Primitive types
    if (typeof cellValue === 'string') return cellValue;
    if (typeof cellValue === 'number') return String(cellValue);
    if (typeof cellValue === 'boolean') return String(cellValue);
    if (cellValue instanceof Date) return cellValue.toISOString().split('T')[0];
    // Duck-type Date for cross-realm objects
    if (typeof cellValue === 'object' && cellValue !== null && typeof (cellValue as any).toISOString === 'function') {
        return (cellValue as any).toISOString().split('T')[0];
    }

    // Object types — use type guards
    if (typeof cellValue === 'object') {
        // CellRichTextValue: { richText: [{text, font}] }
        if ('richText' in cellValue && Array.isArray((cellValue as ExcelJS.CellRichTextValue).richText)) {
            return (cellValue as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('');
        }
        // CellHyperlinkValue: { text, hyperlink }
        if ('hyperlink' in cellValue && 'text' in cellValue) {
            return (cellValue as ExcelJS.CellHyperlinkValue).text || '';
        }
        // CellFormulaValue: { formula, result }
        if ('formula' in cellValue && typeof (cellValue as ExcelJS.CellFormulaValue).formula === 'string') {
            const fv = cellValue as ExcelJS.CellFormulaValue;
            return safeResultToString(fv.result);
        }
        // CellSharedFormulaValue: { sharedFormula, result }
        if ('sharedFormula' in cellValue) {
            const sv = cellValue as ExcelJS.CellSharedFormulaValue;
            return safeResultToString(sv.result);
        }
        // CellErrorValue: { error: '#N/A' | ... }
        if ('error' in cellValue) {
            return (cellValue as ExcelJS.CellErrorValue).error;
        }
    }

    // Final fallback — if it's still an object, try to extract something useful
    if (typeof cellValue === 'object') {
        // Could be a nested result object we didn't catch above
        const obj = cellValue as Record<string, unknown>;
        if ('result' in obj) {
            const r = obj.result;
            if (r === null || r === undefined) return '';
            if (typeof r === 'string') return r;
            if (typeof r === 'number') return String(r);
            if (typeof r === 'boolean') return String(r);
            if (r instanceof Date) return r.toISOString().split('T')[0];
        }
        if ('text' in obj && typeof obj.text === 'string') return obj.text;
        // Last resort — avoid [object Object]
        try { return JSON.stringify(cellValue); } catch { return ''; }
    }

    return safeResultToString(cellValue);
}

/**
 * Convert an ARGB string (e.g. "FF4472C4" with alpha prefix) to a CSS hex color.
 * Returns undefined if invalid.
 */
function argbToHex(argb: string | undefined): string | undefined {
    if (!argb || argb.length < 6) return undefined;
    // ExcelJS ARGB is typically 8 chars: 2 alpha + 6 RGB. Sometimes 6 chars (no alpha).
    const rgb = argb.length === 8 ? argb.substring(2) : argb;
    // Filter out default black/white "000000" from theme colors that aren't explicitly set
    return '#' + rgb;
}

/**
 * Extract CellStyle from an ExcelJS cell's style properties.
 */
function extractCellStyle(cell: ExcelJS.Cell): CellStyle | undefined {
    const style: CellStyle = {};
    let hasStyle = false;

    // Font
    const font = cell.font;
    if (font) {
        if (font.bold) { style.bold = true; hasStyle = true; }
        if (font.italic) { style.italic = true; hasStyle = true; }
        if (font.underline) { style.underline = true; hasStyle = true; }
        if (font.strike) { style.strikethrough = true; hasStyle = true; }
        if (font.size) { style.fontSize = font.size; hasStyle = true; }
        if (font.name) { style.fontFamily = font.name; hasStyle = true; }
        if (font.color?.argb) {
            const hex = argbToHex(font.color.argb);
            if (hex) { style.textColor = hex; hasStyle = true; }
        }
    }

    // Fill
    const fill = cell.fill;
    if (fill && fill.type === 'pattern') {
        const patternFill = fill as ExcelJS.FillPattern;
        if (patternFill.fgColor?.argb) {
            const hex = argbToHex(patternFill.fgColor.argb);
            if (hex) { style.fillColor = hex; hasStyle = true; }
        }
    }

    // Alignment
    const alignment = cell.alignment;
    if (alignment) {
        if (alignment.horizontal) {
            const h = alignment.horizontal;
            if (h === 'left' || h === 'center' || h === 'right') {
                style.align = h; hasStyle = true;
            }
        }
        if (alignment.vertical) {
            const v = alignment.vertical;
            if (v === 'top' || v === 'middle' || v === 'bottom') {
                style.verticalAlign = v; hasStyle = true;
            }
        }
        if (alignment.wrapText) { style.wrap = true; hasStyle = true; }
        if (alignment.textRotation) {
            style.rotation = alignment.textRotation as number;
            hasStyle = true;
        }
    }

    // Borders
    const border = cell.border;
    if (border) {
        if (border.top && border.top.style) { style.borderTop = true; hasStyle = true; }
        if (border.right && border.right.style) { style.borderRight = true; hasStyle = true; }
        if (border.bottom && border.bottom.style) { style.borderBottom = true; hasStyle = true; }
        if (border.left && border.left.style) { style.borderLeft = true; hasStyle = true; }
    }

    // Number format → map to our numberFormat enum when possible
    const numFmt = cell.numFmt;
    if (numFmt && numFmt !== 'General') {
        hasStyle = true;
        if (numFmt.includes('%')) {
            style.numberFormat = 'percent';
        } else if (numFmt.includes('$') || numFmt.includes('€') || numFmt.includes('£') || numFmt.includes('¥')) {
            style.numberFormat = 'currency';
        } else if (numFmt.toLowerCase().includes('e+') || numFmt.toLowerCase().includes('e-')) {
            style.numberFormat = 'scientific';
        } else if (numFmt.includes('yy') || numFmt.includes('mm') && numFmt.includes('dd')) {
            if (numFmt.includes('h') || numFmt.includes('H')) {
                style.numberFormat = 'datetime';
            } else {
                style.numberFormat = 'date';
            }
        } else if (numFmt.includes('h') || numFmt.includes('H')) {
            style.numberFormat = 'time';
        } else if (numFmt.includes('0') || numFmt.includes('#')) {
            style.numberFormat = 'number';
            // Count decimal places
            const decMatch = numFmt.match(/\.(0+|#+)/);
            if (decMatch) {
                style.decimals = decMatch[1].length;
            }
        }
    }

    // Protection / locked
    const protection = cell.protection;
    if (protection?.locked === true) { style.locked = true; hasStyle = true; }
    else if (protection?.locked === false) { style.locked = false; hasStyle = true; }

    return hasStyle ? style : undefined;
}

/**
 * Extract CellValidation from ExcelJS data validation.
 * Maps ExcelJS's validation types to our simplified CellValidation union.
 */
function extractValidation(dv: ExcelJS.DataValidation | undefined | null): CellValidation | undefined {
    if (!dv) return undefined;
    if (dv.type === 'list' && dv.formulae && dv.formulae.length > 0) {
        // ExcelJS stores list values as a single comma-separated string in formulae[0],
        // sometimes with surrounding quotes
        const raw = String(dv.formulae[0]).replace(/^"|"$/g, '');
        const values = raw.split(',').map(s => s.trim());
        return { type: 'list', values };
    }
    return undefined;
}

/**
 * Extract a comment string from an ExcelJS cell note.
 */
function extractComment(note: string | ExcelJS.Comment | undefined): string | undefined {
    if (!note) return undefined;
    if (typeof note === 'string') return note;
    if (note.texts && Array.isArray(note.texts)) {
        return note.texts.map(t => t.text).join('');
    }
    return undefined;
}

/**
 * Parse a cell reference like "A1" into 0-based {row, col}.
 */
function cellRefToRC(ref: string): { row: number; col: number } {
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) return { row: 0, col: 0 };
    const letters = match[1];
    const rowNum = parseInt(match[2], 10) - 1; // 0-based
    let col = 0;
    for (let i = 0; i < letters.length; i++) {
        col = col * 26 + (letters.charCodeAt(i) - 64);
    }
    return { row: rowNum, col: col - 1 }; // 0-based
}

/**
 * Parse a merge range string like "A1:C3" into top-left and bottom-right 0-based coords.
 */
function parseMergeRange(range: string): { minR: number; minC: number; maxR: number; maxC: number } | null {
    // Ranges can be "Sheet!A1:C3" or just "A1:C3"
    const parts = range.includes('!') ? range.split('!')[1] : range;
    const [tlRef, brRef] = parts.split(':');
    if (!tlRef || !brRef) return null;
    const tl = cellRefToRC(tlRef);
    const br = cellRefToRC(brRef);
    return { minR: tl.row, minC: tl.col, maxR: br.row, maxC: br.col };
}

async function parseSpreadsheet(buffer: ArrayBuffer, ext: string): Promise<SpreadsheetParseResult> {
    const workbook = new ExcelJS.Workbook();
    if (ext === 'csv') {
        await workbook.csv.read(new Blob([buffer]).stream() as any);
    } else {
        await workbook.xlsx.load(buffer);
    }

    const sheetsMap: Record<string, Record<string, CellData>> = {};
    const allColWidths: Record<string, Record<number, number>> = {};
    const allRowHeights: Record<string, Record<number, number>> = {};

    workbook.eachSheet((worksheet) => {
        const cells: Record<string, CellData> = {};

        // --- 1. Extract merged cell ranges ---
        // Build a lookup: for each cell that is part of a merge, store the top-left anchor
        // and for the top-left cell, store the merge dimensions.
        const mergeAnchors = new Map<string, { anchorR: number; anchorC: number }>();
        const mergeDimensions = new Map<string, { rows: number; cols: number }>();

        try {
            const merges: string[] = (worksheet.model as any)?.merges ?? [];
            for (const mergeRange of merges) {
                const parsed = parseMergeRange(mergeRange);
                if (!parsed) continue;
                const { minR, minC, maxR, maxC } = parsed;
                const rows = maxR - minR + 1;
                const cols = maxC - minC + 1;
                const anchorKey = `${minR},${minC}`;
                mergeDimensions.set(anchorKey, { rows, cols });

                for (let r = minR; r <= maxR; r++) {
                    for (let c = minC; c <= maxC; c++) {
                        if (r === minR && c === minC) continue;
                        mergeAnchors.set(`${r},${c}`, { anchorR: minR, anchorC: minC });
                    }
                }
            }
        } catch {
            // Merges not available (e.g., CSV) — skip
        }

        // --- 2. Extract cells with full data ---
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                const r = rowNumber - 1; // 0-based
                const c = colNumber - 1; // 0-based
                const key = `${r},${c}`;

                // Value & formula
                let value = '';
                let formula: string | undefined;

                if (cell.formula) {
                    // Cell has a formula (including shared formulas via convenience getter)
                    formula = '=' + cell.formula;
                    value = extractCellValue(cell.result as ExcelJS.CellValue);
                } else {
                    value = extractCellValue(cell.value);
                }
                // SAFETY NET: ensure value is ALWAYS a primitive string
                if (typeof value !== 'string') {
                    if (value === null || value === undefined) value = '';
                    else if (typeof value === 'number' || typeof value === 'boolean') value = String(value);
                    else if (typeof value === 'object') {
                        const v = value as any;
                        if (v instanceof Date || v?.toISOString) value = (v.toISOString?.() || '').split('T')[0];
                        else if (v.result !== undefined) value = String(v.result ?? '');
                        else if (v.text !== undefined) value = String(v.text ?? '');
                        else if (v.richText) value = v.richText.map((r: any) => r?.text || '').join('');
                        else try { value = JSON.stringify(v); } catch { value = ''; }
                    }
                    else value = String(value);
                }

                // Style
                let style = extractCellStyle(cell);

                // Apply merge info
                const dim = mergeDimensions.get(key);
                if (dim) {
                    style = style || {};
                    style.mergeRows = dim.rows;
                    style.mergeCols = dim.cols;
                }
                const anchor = mergeAnchors.get(key);
                if (anchor) {
                    style = style || {};
                    style.mergedInto = `${anchor.anchorR},${anchor.anchorC}`;
                }

                // Comment
                const comment = extractComment(cell.note as string | ExcelJS.Comment | undefined);

                // Data validation
                const validation = extractValidation(
                    (cell as any).dataValidation as ExcelJS.DataValidation | undefined
                );

                // Only store non-empty cells
                if (value || formula || style || comment || validation) {
                    const cellData: CellData = { value };
                    if (formula) cellData.formula = formula;
                    if (style) cellData.style = style;
                    if (comment) cellData.comment = comment;
                    if (validation) cellData.validation = validation;
                    cells[key] = cellData;
                }
            });
        });

        // Also ensure merged-into cells exist even if they had no value
        for (const [key, anchor] of mergeAnchors) {
            if (!cells[key]) {
                cells[key] = {
                    value: '',
                    style: { mergedInto: `${anchor.anchorR},${anchor.anchorC}` }
                };
            }
        }

        sheetsMap[worksheet.name] = cells;

        // --- 3. Extract column widths ---
        const colWidths: Record<number, number> = {};
        try {
            const colCount = worksheet.columnCount;
            for (let i = 1; i <= colCount; i++) {
                const col = worksheet.getColumn(i);
                if (col.width && col.width > 0) {
                    // ExcelJS width is in "characters", roughly 8px per character unit.
                    // Excel width 12.88 → ~103px, default 8.43 → ~67px
                    const pxWidth = Math.round(col.width * 8);
                    colWidths[i - 1] = pxWidth; // 0-based
                }
            }
        } catch {
            // Column info not available
        }
        if (Object.keys(colWidths).length > 0) {
            allColWidths[worksheet.name] = colWidths;
        }

        // --- 4. Extract row heights ---
        const rowHeights: Record<number, number> = {};
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (row.height && row.height > 0) {
                // ExcelJS height is in points (1pt = 1.333px)
                const pxHeight = Math.round(row.height * 1.333);
                rowHeights[rowNumber - 1] = pxHeight; // 0-based
            }
        });
        if (Object.keys(rowHeights).length > 0) {
            allRowHeights[worksheet.name] = rowHeights;
        }
    });

    const sheetNames = workbook.worksheets.map(ws => ws.name);

    return {
        type: 'spreadsheet',
        data: sheetsMap,
        sheets: sheetNames,
        colWidths: Object.keys(allColWidths).length > 0 ? allColWidths : undefined,
        rowHeights: Object.keys(allRowHeights).length > 0 ? allRowHeights : undefined,
    };
}

async function parseDocx(buffer: ArrayBuffer) {
    try {
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        return { type: 'document', html: result.value, warnings: result.messages };
    } catch (e) {
        throw new Error("Failed to parse .docx file");
    }
}

async function parseText(buffer: ArrayBuffer) {
    const text = new TextDecoder().decode(buffer);
    return { type: 'document', text: text };
}

interface SlideObject {
    id: string;
    [key: string]: any;
}

interface SlideFileData {
    id: string;
    title: string;
    objects: SlideObject[];
    notes?: string; // Speaker notes for presentations
}

export interface SlidesFileFormat {
    version: number;
    slides: SlideFileData[];
    metadata?: {
        createdAt?: string;
        updatedAt?: string;
        author?: string;
    };
}

async function parseSlides(buffer: ArrayBuffer, fileName: string): Promise<{ type: 'slides'; data: SlidesFileFormat }> {
    try {
        const text = new TextDecoder().decode(buffer);
        const data = JSON.parse(text) as SlidesFileFormat;

        // Validate structure
        if (!data.slides || !Array.isArray(data.slides)) {
            throw new Error("Invalid slides file format: missing slides array");
        }

        return { type: 'slides', data };
    } catch (e: any) {
        throw new Error(`Failed to parse slides file: ${e.message}`);
    }
}
