/**
 * Office API Client - SignApps Platform
 *
 * Gère les opérations de conversion de documents:
 * - Export: Tiptap JSON → DOCX, PDF, Markdown, HTML, Text
 * - Import: DOCX, Markdown, HTML, Text → Tiptap JSON
 * - PDF Operations: merge, split, extract text
 */

import { getClient, getServiceBaseUrl, ServiceName } from './factory';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ExportFormat = 'docx' | 'pdf' | 'markdown' | 'html' | 'text';
export type ImportFormat = 'docx' | 'markdown' | 'html' | 'txt';

export interface ConversionInfo {
  supported_input_formats: string[];
  supported_output_formats: string[];
  version: string;
}

export interface ImportInfo {
  supported_formats: string[];
  max_file_size_mb: number;
  version: string;
}

export interface ImportResult {
  success: boolean;
  detected_format: string;
  tiptap_json: any;
  metadata: {
    word_count: number;
    character_count: number;
    has_images: boolean;
    has_tables: boolean;
  };
}

export interface PdfInfo {
  page_count: number;
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  version: string;
}

export interface PdfPageInfo {
  page_number: number;
  width: number;
  height: number;
}

/**
 * Comment reply for export
 */
export interface ExportCommentReply {
  author: string;
  content: string;
  created_at: string;
}

/**
 * Comment data for export (included in DOCX appendix)
 */
export interface ExportComment {
  id: string;
  author: string;
  content: string;
  created_at: string;
  resolved: boolean;
  replies?: ExportCommentReply[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════════════════════

const officeClient = () => getClient(ServiceName.OFFICE);

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get conversion service info
 */
export async function getConversionInfo(): Promise<ConversionInfo> {
  const response = await officeClient().get('/convert/info');
  return response.data;
}

/**
 * Export options
 */
export interface ExportOptions {
  filename?: string;
  comments?: ExportComment[];
}

/**
 * Export a Tiptap document to a specific format
 * Returns a Blob that can be downloaded
 */
export async function exportDocument(
  tiptapJson: any,
  format: ExportFormat,
  options?: ExportOptions
): Promise<Blob> {
  const queryParams = new URLSearchParams({ format });
  if (options?.filename) {
    queryParams.set('filename', options.filename);
  }

  const response = await officeClient().post(
    `/convert?${queryParams.toString()}`,
    {
      input_format: 'tiptapjson',
      content: tiptapJson,
      comments: options?.comments,
    },
    {
      responseType: 'blob',
    }
  );
  return response.data;
}

/**
 * Export a document and trigger download
 */
export async function downloadDocument(
  tiptapJson: any,
  format: ExportFormat,
  filename: string,
  comments?: ExportComment[]
): Promise<void> {
  const blob = await exportDocument(tiptapJson, format, { filename, comments });

  const extension = format === 'markdown' ? 'md' : format;
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

/**
 * Export document as text (returns string instead of blob)
 */
export async function exportAsText(
  tiptapJson: any,
  format: 'markdown' | 'html' | 'text'
): Promise<string> {
  const response = await officeClient().post(
    `/convert?format=${format}`,
    {
      input_format: 'tiptapjson',
      content: tiptapJson,
    }
  );
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get import service info
 */
export async function getImportInfo(): Promise<ImportInfo> {
  const response = await officeClient().get('/import/info');
  return response.data;
}

/**
 * Import a document from text content (Markdown, HTML, TXT)
 */
export async function importFromText(
  content: string,
  format?: ImportFormat
): Promise<ImportResult> {
  const response = await officeClient().post('/import', {
    content,
    format,
  });
  return response.data;
}

/**
 * Import a document from a file (DOCX, MD, HTML, TXT)
 */
export async function importFromFile(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await officeClient().post('/import/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get PDF operations info
 */
export async function getPdfInfo(): Promise<{
  service: string;
  version: string;
  operations: string[];
}> {
  const response = await officeClient().get('/pdf/info');
  return response.data;
}

/**
 * Extract text from a PDF file
 */
export async function extractPdfText(file: File): Promise<{ text: string; success: boolean }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await officeClient().post('/pdf/extract-text', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Get PDF document info
 */
export async function getPdfDocumentInfo(file: File): Promise<PdfInfo> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await officeClient().post('/pdf/document-info', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Get PDF pages info
 */
export async function getPdfPages(file: File): Promise<{ count: number; pages: PdfPageInfo[] }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await officeClient().post('/pdf/pages', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Merge multiple PDF files
 */
export async function mergePdfs(files: File[]): Promise<Blob> {
  const formData = new FormData();
  files.forEach((file, index) => {
    formData.append(`file${index}`, file);
  });

  const response = await officeClient().post('/pdf/merge', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Split a PDF file by page ranges
 */
export async function splitPdf(
  file: File,
  ranges: string // e.g., "1-3,5,7-10"
): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('ranges', ranges);

  const response = await officeClient().post('/pdf/split', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    responseType: 'blob',
  });
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SPREADSHEET OPERATIONS (Epic 6)
// ═══════════════════════════════════════════════════════════════════════════

export type SpreadsheetFormat = 'xlsx' | 'csv' | 'ods';

export interface SpreadsheetInfo {
  supported_formats: string[];
  max_rows: number;
  max_cols: number;
  version: string;
}

export interface SpreadsheetData {
  sheets: {
    name: string;
    data: (string | number | null)[][];
    styles?: Record<string, any>;
  }[];
}

/**
 * Get spreadsheet service info
 */
export async function getSpreadsheetInfo(): Promise<SpreadsheetInfo> {
  const response = await officeClient().get('/spreadsheet/info');
  return response.data;
}

/**
 * Export spreadsheet data to XLSX
 */
export async function exportSpreadsheet(
  data: SpreadsheetData,
  format: SpreadsheetFormat = 'xlsx'
): Promise<Blob> {
  const response = await officeClient().post(
    '/spreadsheet/export',
    { data, format },
    { responseType: 'blob' }
  );
  return response.data;
}

/**
 * Export spreadsheet data to CSV
 */
export async function exportSpreadsheetCsv(
  data: (string | number | null)[][],
  options?: { delimiter?: string; filename?: string }
): Promise<Blob> {
  const response = await officeClient().post(
    '/spreadsheet/export/csv',
    { data, ...options },
    { responseType: 'blob' }
  );
  return response.data;
}

/**
 * Export spreadsheet data to ODS
 */
export async function exportSpreadsheetOds(data: SpreadsheetData): Promise<Blob> {
  const response = await officeClient().post(
    '/spreadsheet/export/ods',
    { data },
    { responseType: 'blob' }
  );
  return response.data;
}

/**
 * Import spreadsheet from file (XLSX, CSV, ODS)
 */
export async function importSpreadsheet(file: File): Promise<SpreadsheetData> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await officeClient().post('/spreadsheet/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Import CSV from text
 */
export async function importCsvText(
  content: string,
  options?: { delimiter?: string; has_headers?: boolean }
): Promise<SpreadsheetData> {
  const response = await officeClient().post('/spreadsheet/import/csv', {
    content,
    ...options,
  });
  return response.data;
}

/**
 * Download spreadsheet
 */
export async function downloadSpreadsheet(
  data: SpreadsheetData,
  format: SpreadsheetFormat,
  filename: string
): Promise<void> {
  const blob = await exportSpreadsheet(data, format);
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
// PRESENTATION OPERATIONS (Epic 7)
// ═══════════════════════════════════════════════════════════════════════════

export type PresentationExportFormat = 'pptx' | 'pdf' | 'png' | 'svg';

export interface PresentationInfo {
  supported_formats: string[];
  max_slides: number;
  version: string;
}

export interface SlideElement {
  type: 'text' | 'image' | 'shape' | 'chart';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  style?: Record<string, any>;
}

export interface Slide {
  id: string;
  elements: SlideElement[];
  background?: string;
  notes?: string;
  layout?: string;
}

export interface PresentationData {
  title: string;
  slides: Slide[];
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
  };
}

/**
 * Get presentation service info
 */
export async function getPresentationInfo(): Promise<PresentationInfo> {
  const response = await officeClient().get('/presentation/info');
  return response.data;
}

/**
 * Export presentation to PPTX
 */
export async function exportPresentationPptx(data: PresentationData): Promise<Blob> {
  const response = await officeClient().post(
    '/presentation/export/pptx',
    data,
    { responseType: 'blob' }
  );
  return response.data;
}

/**
 * Export presentation to PDF
 */
export async function exportPresentationPdf(data: PresentationData): Promise<Blob> {
  const response = await officeClient().post(
    '/presentation/export/pdf',
    data,
    { responseType: 'blob' }
  );
  return response.data;
}

/**
 * Export single slide to PNG
 */
export async function exportSlidePng(
  slide: Slide,
  options?: { width?: number; height?: number }
): Promise<Blob> {
  const response = await officeClient().post(
    '/presentation/export/png',
    { slide, ...options },
    { responseType: 'blob' }
  );
  return response.data;
}

/**
 * Export single slide to SVG
 */
export async function exportSlideSvg(slide: Slide): Promise<string> {
  const response = await officeClient().post('/presentation/export/svg', { slide });
  return response.data;
}

/**
 * Export all slides to PNG (zip archive)
 */
export async function exportAllSlidesPng(
  data: PresentationData,
  options?: { width?: number; height?: number }
): Promise<Blob> {
  const response = await officeClient().post(
    '/presentation/export/all/png',
    { ...data, ...options },
    { responseType: 'blob' }
  );
  return response.data;
}

/**
 * Export all slides to SVG (zip archive)
 */
export async function exportAllSlidesSvg(data: PresentationData): Promise<Blob> {
  const response = await officeClient().post(
    '/presentation/export/all/svg',
    data,
    { responseType: 'blob' }
  );
  return response.data;
}

/**
 * Download presentation
 */
export async function downloadPresentation(
  data: PresentationData,
  format: 'pptx' | 'pdf',
  filename: string
): Promise<void> {
  const blob = format === 'pptx'
    ? await exportPresentationPptx(data)
    : await exportPresentationPdf(data);

  const fullFilename = filename.endsWith(`.${format}`)
    ? filename
    : `${filename}.${format}`;

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
 * Check if the office service is healthy
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const baseUrl = getServiceBaseUrl(ServiceName.OFFICE);
    const response = await fetch(`${baseUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
