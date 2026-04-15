/**
 * useOptimizedExport Hook
 *
 * Optimized document export with progress tracking, chunking, and caching.
 */

import { useState, useCallback, useRef } from "react";
import {
  processInChunks,
  conversionCache,
  startMetric,
  endMetric,
  isLargeDocument,
  estimateDocumentSize,
} from "@/lib/office/performance";

// ============================================================================
// Types
// ============================================================================

export type ExportFormat =
  | "docx"
  | "pdf"
  | "html"
  | "markdown"
  | "xlsx"
  | "csv"
  | "pptx"
  | "png";

interface ExportOptions {
  format: ExportFormat;
  includeComments?: boolean;
  includeTrackChanges?: boolean;
  quality?: number;
  useCache?: boolean;
  [key: string]: unknown;
}

interface ExportProgress {
  phase: "preparing" | "converting" | "finalizing" | "complete" | "error";
  progress: number;
  message: string;
}

interface ExportResult {
  success: boolean;
  data?: ArrayBuffer;
  filename?: string;
  error?: string;
  cached?: boolean;
  duration?: number;
}

interface UseOptimizedExportReturn {
  exportDocument: (
    documentId: string,
    content: unknown,
    options: ExportOptions,
  ) => Promise<ExportResult>;
  progress: ExportProgress;
  isExporting: boolean;
  cancel: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  docx: ".docx",
  pdf: ".pdf",
  html: ".html",
  markdown: ".md",
  xlsx: ".xlsx",
  csv: ".csv",
  pptx: ".pptx",
  png: ".png",
};

const FORMAT_MIME_TYPES: Record<ExportFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  html: "text/html",
  markdown: "text/markdown",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
};

// ============================================================================
// Hook
// ============================================================================

export function useOptimizedExport(): UseOptimizedExportReturn {
  const [progress, setProgress] = useState<ExportProgress>({
    phase: "complete",
    progress: 0,
    message: "",
  });
  const [isExporting, setIsExporting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsExporting(false);
      setProgress({
        phase: "complete",
        progress: 0,
        message: "Export cancelled",
      });
    }
  }, []);

  const exportDocument = useCallback(
    async (
      documentId: string,
      content: unknown,
      options: ExportOptions,
    ): Promise<ExportResult> => {
      const { format, useCache = true } = options;

      // Check cache first
      if (useCache) {
        const cached = conversionCache.get(documentId, format, options);
        if (cached) {
          return {
            success: true,
            data: cached,
            filename: `document${FORMAT_EXTENSIONS[format]}`,
            cached: true,
            duration: 0,
          };
        }
      }

      // Start export
      const metric = startMetric(`export-${format}`);
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsExporting(true);
      setProgress({
        phase: "preparing",
        progress: 0,
        message: "Preparing document...",
      });

      try {
        // Phase 1: Prepare content
        const isLarge = isLargeDocument(content);
        const documentSize = estimateDocumentSize(content);

        if (signal.aborted) {
          throw new Error("Export cancelled");
        }

        setProgress({
          phase: "converting",
          progress: 0.1,
          message: isLarge ? "Processing large document..." : "Converting...",
        });

        // Phase 2: Convert based on format
        let result: ArrayBuffer;

        if (isLarge && Array.isArray(content)) {
          // Process in chunks for large array-based content
          const chunks = await processInChunks(
            content,
            async (chunk) => {
              // Process each chunk
              return chunk;
            },
            {
              chunkSize: 100,
              signal,
              onProgress: (p) => {
                setProgress({
                  phase: "converting",
                  progress: 0.1 + p * 0.7,
                  message: `Converting... ${Math.round(p * 100)}%`,
                });
              },
            },
          );

          result = await convertToFormat(chunks, format, options, signal);
        } else {
          // Direct conversion for smaller documents
          result = await convertToFormat(content, format, options, signal);
        }

        setProgress({
          phase: "finalizing",
          progress: 0.9,
          message: "Finalizing...",
        });

        if (signal.aborted) {
          throw new Error("Export cancelled");
        }

        // Phase 3: Cache result
        if (useCache) {
          conversionCache.set(documentId, format, result, options);
        }

        endMetric(metric, documentSize);

        setProgress({
          phase: "complete",
          progress: 1,
          message: "Export complete",
        });

        return {
          success: true,
          data: result,
          filename: `document${FORMAT_EXTENSIONS[format]}`,
          duration: metric.duration,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Export failed";

        setProgress({
          phase: "error",
          progress: 0,
          message: errorMessage,
        });

        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsExporting(false);
        abortControllerRef.current = null;
      }
    },
    [],
  );

  return {
    exportDocument,
    progress,
    isExporting,
    cancel,
  };
}

// ============================================================================
// Conversion Helpers
// ============================================================================

async function convertToFormat(
  content: unknown,
  format: ExportFormat,
  options: ExportOptions,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  // This would call the actual conversion API
  // For now, return a placeholder implementation
  const response = await fetch("/api/v1/office/convert", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      format,
      options: {
        includeComments: options.includeComments,
        includeTrackChanges: options.includeTrackChanges,
        quality: options.quality,
      },
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Conversion failed: ${response.statusText}`);
  }

  return response.arrayBuffer();
}

// ============================================================================
// Download Helper
// ============================================================================

export function downloadExportResult(
  result: ExportResult,
  filename?: string,
): void {
  if (!result.success || !result.data) {
    console.error("Cannot download failed export");
    return;
  }

  const blob = new Blob([result.data]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || result.filename || "download";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
