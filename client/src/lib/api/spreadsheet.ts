/**
 * Spreadsheet API Client - SignApps Platform
 *
 * Gère les opérations d'import/export de spreadsheets:
 * - Import: XLSX, XLS, CSV, ODS → JSON (Handsontable compatible)
 * - Export: JSON → XLSX, CSV, ODS
 */

import { getClient, getServiceBaseUrl, ServiceName } from './factory';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type SpreadsheetImportFormat = 'xlsx' | 'xls' | 'csv' | 'ods';
export type SpreadsheetExportFormat = 'xlsx' | 'csv' | 'ods';

export interface SpreadsheetInfo {
  service: string;
  version: string;
  supported_formats: {
    import: string[];
    export: string[];
  };
  endpoints: Record<string, string>;
}

export interface SpreadsheetCell {
  value: string | number | boolean | null;
  formula?: string;
  style?: SpreadsheetCellStyle;
}

export interface SpreadsheetCellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  textColor?: string;
  fillColor?: string;
  fontFamily?: string;
  fontSize?: number;
  numberFormat?: string;
}

export interface SpreadsheetSheet {
  name: string;
  data: (string | number | boolean | null)[][];
  styles?: Record<string, SpreadsheetCellStyle>;
  columnWidths?: number[];
  rowHeights?: number[];
  frozenRows?: number;
  frozenCols?: number;
}

export interface SpreadsheetImportResult {
  success: boolean;
  filename: string;
  spreadsheet: {
    name?: string;
    data?: (string | number | boolean | null)[][];
    sheets?: SpreadsheetSheet[];
    activeSheet?: number;
  };
}

export interface SpreadsheetExportOptions {
  filename?: string;
  delimiter?: ',' | ';' | '\t';  // For CSV
  includeHeaders?: boolean;      // For CSV
  sheetName?: string;           // For single sheet export
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════════════════════

const officeClient = () => getClient(ServiceName.OFFICE);

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get spreadsheet service info
 */
export async function getSpreadsheetInfo(): Promise<SpreadsheetInfo> {
  const response = await officeClient().get('/spreadsheet/info');
  return response.data;
}

/**
 * Import a spreadsheet file (XLSX, XLS, CSV, ODS)
 */
export async function importSpreadsheet(file: File): Promise<SpreadsheetImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await officeClient().post('/spreadsheet/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Import CSV content from string
 */
export async function importCsvFromText(
  content: string,
  options?: { delimiter?: ',' | ';' | '\t'; hasHeaders?: boolean }
): Promise<SpreadsheetImportResult> {
  const response = await officeClient().post('/spreadsheet/import/csv', {
    content,
    delimiter: options?.delimiter || ',',
    has_headers: options?.hasHeaders ?? true,
  });
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Export spreadsheet data to XLSX format
 * Returns a Blob that can be downloaded
 */
export async function exportToXlsx(
  data: SpreadsheetSheet | SpreadsheetSheet[],
  options?: SpreadsheetExportOptions
): Promise<Blob> {
  const payload = {
    data: Array.isArray(data) ? { sheets: data } : data,
    filename: options?.filename || 'spreadsheet.xlsx',
  };

  const response = await officeClient().post('/spreadsheet/export', payload, {
    responseType: 'blob',
    params: { format: 'xlsx' },
  });
  return response.data;
}

/**
 * Export spreadsheet data to CSV format
 */
export async function exportToCsv(
  data: (string | number | boolean | null)[][],
  options?: SpreadsheetExportOptions
): Promise<Blob> {
  const payload = {
    data,
    filename: options?.filename || 'spreadsheet.csv',
    delimiter: options?.delimiter || ',',
    include_headers: options?.includeHeaders ?? true,
  };

  const response = await officeClient().post('/spreadsheet/export/csv', payload, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Export spreadsheet data to ODS format (OpenDocument)
 */
export async function exportToOds(
  data: SpreadsheetSheet | SpreadsheetSheet[],
  options?: SpreadsheetExportOptions
): Promise<Blob> {
  const payload = {
    data: Array.isArray(data) ? { sheets: data } : data,
    filename: options?.filename || 'spreadsheet.ods',
  };

  const response = await officeClient().post('/spreadsheet/export/ods', payload, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Export spreadsheet and trigger download
 */
export async function downloadSpreadsheet(
  data: SpreadsheetSheet | SpreadsheetSheet[],
  format: SpreadsheetExportFormat,
  filename: string,
  options?: SpreadsheetExportOptions
): Promise<void> {
  let blob: Blob;

  switch (format) {
    case 'xlsx':
      blob = await exportToXlsx(data, { ...options, filename });
      break;
    case 'csv':
      // For CSV, extract data from first sheet
      const csvData = Array.isArray(data) ? data[0].data : data.data;
      blob = await exportToCsv(csvData, { ...options, filename });
      break;
    case 'ods':
      blob = await exportToOds(data, { ...options, filename });
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  // Trigger download
  const extension = format;
  const fullFilename = filename.endsWith(`.${extension}`)
    ? filename
    : `${filename}.${extension}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fullFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if the spreadsheet service is healthy
 */
export async function checkSpreadsheetHealth(): Promise<boolean> {
  try {
    const baseUrl = getServiceBaseUrl(ServiceName.OFFICE);
    const response = await fetch(`${baseUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert frontend sheet data to API format
 */
export function convertToApiFormat(
  data: Record<string, { value: string; formula?: string; style?: any }>,
  rows: number,
  cols: number
): (string | number | boolean | null)[][] {
  const result: (string | number | boolean | null)[][] = [];

  for (let r = 0; r < rows; r++) {
    const row: (string | number | boolean | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const key = `${r}_${c}`;
      const cell = data[key];

      if (!cell || !cell.value) {
        row.push(null);
      } else {
        // Try to parse as number
        const numValue = parseFloat(cell.value);
        if (!isNaN(numValue) && cell.value.trim() !== '') {
          row.push(numValue);
        } else if (cell.value.toLowerCase() === 'true') {
          row.push(true);
        } else if (cell.value.toLowerCase() === 'false') {
          row.push(false);
        } else {
          row.push(cell.value);
        }
      }
    }
    result.push(row);
  }

  // Trim trailing empty rows
  while (result.length > 0 && result[result.length - 1].every((v) => v === null)) {
    result.pop();
  }

  // Trim trailing empty columns
  if (result.length > 0) {
    let maxCol = 0;
    for (const row of result) {
      for (let c = row.length - 1; c >= 0; c--) {
        if (row[c] !== null) {
          maxCol = Math.max(maxCol, c + 1);
          break;
        }
      }
    }
    for (const row of result) {
      row.length = maxCol;
    }
  }

  return result;
}

/**
 * Convert API format back to frontend data format
 */
export function convertFromApiFormat(
  apiData: (string | number | boolean | null)[][]
): Record<string, { value: string; formula?: string }> {
  const result: Record<string, { value: string; formula?: string }> = {};

  for (let r = 0; r < apiData.length; r++) {
    const row = apiData[r];
    for (let c = 0; c < row.length; c++) {
      const value = row[c];
      if (value !== null && value !== undefined && value !== '') {
        result[`${r}_${c}`] = {
          value: String(value),
        };
      }
    }
  }

  return result;
}

/**
 * Detect file format from extension
 */
export function detectSpreadsheetFormat(filename: string): SpreadsheetImportFormat | null {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'xlsx':
      return 'xlsx';
    case 'xls':
      return 'xls';
    case 'csv':
    case 'tsv':
      return 'csv';
    case 'ods':
      return 'ods';
    default:
      return null;
  }
}

/**
 * Get MIME type for format
 */
export function getSpreadsheetMimeType(format: SpreadsheetExportFormat): string {
  switch (format) {
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'csv':
      return 'text/csv';
    case 'ods':
      return 'application/vnd.oasis.opendocument.spreadsheet';
    default:
      return 'application/octet-stream';
  }
}
