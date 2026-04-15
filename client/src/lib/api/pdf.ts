/**
 * PDF Operations API Client
 * Interacts with signapps-office service for PDF operations
 */

import { getClient, getServiceBaseUrl, ServiceName } from "./factory";

const api = getClient(ServiceName.OFFICE);

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PdfInfoResponse {
  service: string;
  version: string;
  operations: string[];
}

export interface PdfDocumentInfo {
  page_count: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  version: string;
}

export interface PdfPageInfo {
  page_number: number;
  width: number;
  height: number;
}

export interface PdfPagesResponse {
  pages: PdfPageInfo[];
  count: number;
}

export interface PdfTextResponse {
  text: string;
  success: boolean;
}

export interface PdfSplitRange {
  start: number;
  end: number;
}

export interface PdfSplitResult {
  range: [number, number];
  data_base64: string;
  size_bytes: number;
}

export interface PdfSplitResponse {
  success: boolean;
  count: number;
  results: PdfSplitResult[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Service Health Check
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if the PDF service is available
 */
export async function checkPdfService(): Promise<boolean> {
  try {
    const response = await api.get("/pdf/info");
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Get PDF service info and supported operations
 */
export async function getPdfServiceInfo(): Promise<PdfInfoResponse> {
  const response = await api.get<PdfInfoResponse>("/pdf/info");
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Information
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get document information (page count, metadata)
 */
export async function getPdfDocumentInfo(
  file: File | Blob,
): Promise<PdfDocumentInfo> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<PdfDocumentInfo>(
    "/pdf/document-info",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return response.data;
}

/**
 * Get page dimensions for all pages
 */
export async function getPdfPages(
  file: File | Blob,
): Promise<PdfPagesResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<PdfPagesResponse>("/pdf/pages", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// Text Extraction
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract text content from a PDF
 */
export async function extractPdfText(file: File | Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<PdfTextResponse>(
    "/pdf/extract-text",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );

  if (!response.data.success) {
    throw new Error("Text extraction failed");
  }

  return response.data.text;
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Merge
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Merge multiple PDF files into one
 * Returns the merged PDF as a Blob
 */
export async function mergePdfs(files: File[] | Blob[]): Promise<Blob> {
  if (files.length === 0) {
    throw new Error("No files provided for merge");
  }

  const formData = new FormData();
  files.forEach((file, index) => {
    formData.append(`file${index}`, file);
  });

  const response = await api.post("/pdf/merge", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    responseType: "blob",
  });

  return response.data;
}

/**
 * Merge PDFs and download the result
 */
export async function mergePdfsAndDownload(
  files: File[],
  filename: string = "merged.pdf",
): Promise<void> {
  const mergedBlob = await mergePdfs(files);
  downloadBlob(mergedBlob, filename);
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF Split
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Split a PDF by page ranges
 * @param file The PDF file to split
 * @param ranges Array of page ranges (1-based), e.g., [{start: 1, end: 3}, {start: 5, end: 5}]
 */
export async function splitPdf(
  file: File | Blob,
  ranges: PdfSplitRange[],
): Promise<PdfSplitResponse> {
  const formData = new FormData();
  formData.append("file", file);

  // Convert ranges to string format "1-3,5,7-10"
  const rangeStr = ranges
    .map((r) => (r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`))
    .join(",");
  formData.append("ranges", rangeStr);

  const response = await api.post<PdfSplitResponse>("/pdf/split", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
}

/**
 * Extract a single page from a PDF
 */
export async function extractPage(
  file: File | Blob,
  pageNumber: number,
): Promise<Blob> {
  const result = await splitPdf(file, [{ start: pageNumber, end: pageNumber }]);

  if (result.results.length === 0) {
    throw new Error(`Failed to extract page ${pageNumber}`);
  }

  // Decode base64 to blob
  const base64Data = result.results[0].data_base64;
  return base64ToBlob(base64Data, "application/pdf");
}

/**
 * Split PDF and download all resulting files
 */
export async function splitPdfAndDownload(
  file: File | Blob,
  ranges: PdfSplitRange[],
  baseFilename: string = "split",
): Promise<void> {
  const result = await splitPdf(file, ranges);

  result.results.forEach((splitResult, index) => {
    const blob = base64ToBlob(splitResult.data_base64, "application/pdf");
    const [start, end] = splitResult.range;
    const suffix = start === end ? `page-${start}` : `pages-${start}-${end}`;
    downloadBlob(blob, `${baseFilename}-${suffix}.pdf`);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert base64 string to Blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════
// Direct URL Access (for viewing)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the base URL for PDF service
 */
export function getPdfServiceUrl(): string {
  return getServiceBaseUrl(ServiceName.OFFICE);
}

// Export all functions
export const pdfApi = {
  checkService: checkPdfService,
  getServiceInfo: getPdfServiceInfo,
  getDocumentInfo: getPdfDocumentInfo,
  getPages: getPdfPages,
  extractText: extractPdfText,
  merge: mergePdfs,
  mergeAndDownload: mergePdfsAndDownload,
  split: splitPdf,
  extractPage,
  splitAndDownload: splitPdfAndDownload,
  getServiceUrl: getPdfServiceUrl,
};
