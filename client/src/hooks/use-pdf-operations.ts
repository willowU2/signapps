/**
 * React hook for PDF operations
 * Provides easy-to-use functions for extracting text, merging, splitting PDFs
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  pdfApi,
  PdfDocumentInfo,
  PdfPagesResponse,
  PdfSplitRange,
  PdfSplitResponse,
} from '@/lib/api/pdf';

interface UsePdfOperationsState {
  isLoading: boolean;
  error: string | null;
  progress: number; // 0-100 for batch operations
}

interface UsePdfOperationsReturn extends UsePdfOperationsState {
  // Service status
  checkService: () => Promise<boolean>;

  // Document info
  getDocumentInfo: (file: File) => Promise<PdfDocumentInfo | null>;
  getPages: (file: File) => Promise<PdfPagesResponse | null>;

  // Text extraction
  extractText: (file: File) => Promise<string | null>;

  // Merge
  mergePdfs: (files: File[]) => Promise<Blob | null>;
  mergePdfsAndDownload: (files: File[], filename?: string) => Promise<void>;

  // Split
  splitPdf: (file: File, ranges: PdfSplitRange[]) => Promise<PdfSplitResponse | null>;
  extractPage: (file: File, pageNumber: number) => Promise<Blob | null>;
  splitPdfAndDownload: (file: File, ranges: PdfSplitRange[], baseFilename?: string) => Promise<void>;

  // Reset state
  reset: () => void;
}

export function usePdfOperations(): UsePdfOperationsReturn {
  const [state, setState] = useState<UsePdfOperationsState>({
    isLoading: false,
    error: null,
    progress: 0,
  });

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading, error: loading ? null : prev.error }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error, isLoading: false }));
  }, []);

  const setProgress = useCallback((progress: number) => {
    setState((prev) => ({ ...prev, progress }));
  }, []);

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, progress: 0 });
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Service Check
  // ═══════════════════════════════════════════════════════════════════════════

  const checkService = useCallback(async (): Promise<boolean> => {
    try {
      return await pdfApi.checkService();
    } catch (err) {
      return false;
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Document Info
  // ═══════════════════════════════════════════════════════════════════════════

  const getDocumentInfo = useCallback(
    async (file: File): Promise<PdfDocumentInfo | null> => {
      setLoading(true);
      try {
        const info = await pdfApi.getDocumentInfo(file);
        setLoading(false);
        return info;
      } catch (err: any) {
        const errorMsg = err.message || 'Erreur lors de la lecture des informations PDF';
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }
    },
    [setLoading, setError]
  );

  const getPages = useCallback(
    async (file: File): Promise<PdfPagesResponse | null> => {
      setLoading(true);
      try {
        const pages = await pdfApi.getPages(file);
        setLoading(false);
        return pages;
      } catch (err: any) {
        const errorMsg = err.message || 'Erreur lors de la lecture des pages';
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }
    },
    [setLoading, setError]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Text Extraction
  // ═══════════════════════════════════════════════════════════════════════════

  const extractText = useCallback(
    async (file: File): Promise<string | null> => {
      setLoading(true);
      try {
        const text = await pdfApi.extractText(file);
        setLoading(false);
        toast.success('Texte extrait avec succès');
        return text;
      } catch (err: any) {
        const errorMsg = err.message || "Erreur lors de l'extraction du texte";
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }
    },
    [setLoading, setError]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Merge
  // ═══════════════════════════════════════════════════════════════════════════

  const mergePdfs = useCallback(
    async (files: File[]): Promise<Blob | null> => {
      if (files.length < 2) {
        const errorMsg = 'Au moins 2 fichiers sont nécessaires pour la fusion';
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }

      setLoading(true);
      setProgress(0);

      try {
        const merged = await pdfApi.merge(files);
        setLoading(false);
        setProgress(100);
        toast.success(`${files.length} fichiers PDF fusionnés`);
        return merged;
      } catch (err: any) {
        const errorMsg = err.message || 'Erreur lors de la fusion des PDF';
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }
    },
    [setLoading, setError, setProgress]
  );

  const mergePdfsAndDownload = useCallback(
    async (files: File[], filename: string = 'merged.pdf'): Promise<void> => {
      const merged = await mergePdfs(files);
      if (merged) {
        downloadBlob(merged, filename);
      }
    },
    [mergePdfs]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Split
  // ═══════════════════════════════════════════════════════════════════════════

  const splitPdf = useCallback(
    async (file: File, ranges: PdfSplitRange[]): Promise<PdfSplitResponse | null> => {
      if (ranges.length === 0) {
        const errorMsg = 'Aucune plage de pages spécifiée';
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }

      setLoading(true);
      setProgress(0);

      try {
        const result = await pdfApi.split(file, ranges);
        setLoading(false);
        setProgress(100);
        toast.success(`PDF divisé en ${result.count} partie(s)`);
        return result;
      } catch (err: any) {
        const errorMsg = err.message || 'Erreur lors de la division du PDF';
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }
    },
    [setLoading, setError, setProgress]
  );

  const extractPage = useCallback(
    async (file: File, pageNumber: number): Promise<Blob | null> => {
      setLoading(true);
      try {
        const page = await pdfApi.extractPage(file, pageNumber);
        setLoading(false);
        toast.success(`Page ${pageNumber} extraite`);
        return page;
      } catch (err: any) {
        const errorMsg = err.message || `Erreur lors de l'extraction de la page ${pageNumber}`;
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }
    },
    [setLoading, setError]
  );

  const splitPdfAndDownload = useCallback(
    async (
      file: File,
      ranges: PdfSplitRange[],
      baseFilename: string = 'document'
    ): Promise<void> => {
      const result = await splitPdf(file, ranges);
      if (result) {
        result.results.forEach((splitResult) => {
          const blob = base64ToBlob(splitResult.data_base64, 'application/pdf');
          const [start, end] = splitResult.range;
          const suffix = start === end ? `page-${start}` : `pages-${start}-${end}`;
          downloadBlob(blob, `${baseFilename}-${suffix}.pdf`);
        });
      }
    },
    [splitPdf]
  );

  return {
    ...state,
    checkService,
    getDocumentInfo,
    getPages,
    extractText,
    mergePdfs,
    mergePdfsAndDownload,
    splitPdf,
    extractPage,
    splitPdfAndDownload,
    reset,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
