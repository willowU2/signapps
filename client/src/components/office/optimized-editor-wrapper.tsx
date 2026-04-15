"use client";

import { SpinnerInfinity } from "spinners-react";

/**
 * OptimizedEditorWrapper
 *
 * Wrapper component that provides lazy loading, performance optimization,
 * and export functionality for office editors.
 */

import React, { Suspense, useCallback, useState } from "react";
import { Download, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  useOptimizedExport,
  downloadExportResult,
  type ExportFormat,
} from "@/hooks/use-optimized-export";
import {
  useLazyEditor,
  preloadCommonExtensions,
} from "@/hooks/use-lazy-editor";

// ============================================================================
// Types
// ============================================================================

type EditorType = "document" | "spreadsheet" | "presentation";

interface OptimizedEditorWrapperProps {
  type: EditorType;
  documentId: string;
  content?: unknown;
  className?: string;
  onSave?: (content: unknown) => void;
  readOnly?: boolean;
}

interface ExportMenuProps {
  type: EditorType;
  documentId: string;
  content: unknown;
  isExporting: boolean;
  onExport: (format: ExportFormat) => void;
}

// ============================================================================
// Export Format Config
// ============================================================================

const exportFormats: Record<
  EditorType,
  { format: ExportFormat; label: string }[]
> = {
  document: [
    { format: "docx", label: "Word (.docx)" },
    { format: "pdf", label: "PDF (.pdf)" },
    { format: "html", label: "HTML (.html)" },
    { format: "markdown", label: "Markdown (.md)" },
  ],
  spreadsheet: [
    { format: "xlsx", label: "Excel (.xlsx)" },
    { format: "csv", label: "CSV (.csv)" },
    { format: "pdf", label: "PDF (.pdf)" },
  ],
  presentation: [
    { format: "pptx", label: "PowerPoint (.pptx)" },
    { format: "pdf", label: "PDF (.pdf)" },
    { format: "png", label: "Images (.png)" },
  ],
};

// ============================================================================
// Loading Skeleton
// ============================================================================

function EditorSkeleton({ type }: { type: EditorType }) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Toolbar skeleton */}
      <div className="flex h-12 items-center gap-2 border-b bg-muted/30 px-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-6 w-8 animate-pulse rounded bg-muted" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="flex-1 p-4">
        {type === "spreadsheet" ? (
          <div className="grid h-full grid-cols-6 gap-px bg-border">
            {Array.from({ length: 42 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse bg-background" />
            ))}
          </div>
        ) : type === "presentation" ? (
          <div className="flex h-full gap-4">
            <div className="w-48 space-y-2 bg-muted/20 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-video animate-pulse rounded bg-muted"
                />
              ))}
            </div>
            <div className="flex-1 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-4 animate-pulse rounded bg-muted"
                style={{ width: `${Math.random() * 40 + 60}%` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Export Menu
// ============================================================================

function ExportMenu({ type, isExporting, onExport }: ExportMenuProps) {
  const formats = exportFormats[type];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          {isExporting ? (
            <SpinnerInfinity
              size={24}
              secondaryColor="rgba(128,128,128,0.2)"
              color="currentColor"
              speed={120}
              className="mr-2 h-4 w-4 "
            />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map(({ format, label }) => (
          <DropdownMenuItem key={format} onClick={() => onExport(format)}>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Export Progress
// ============================================================================

function ExportProgress({
  progress,
  message,
  onCancel,
}: {
  progress: number;
  message: string;
  onCancel: () => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Exporting...</span>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <Progress value={progress * 100} className="mb-2" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

// ============================================================================
// Error Display
// ============================================================================

function EditorError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="ml-2">
          {error.message || "Failed to load editor"}
        </AlertDescription>
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </Alert>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function OptimizedEditorWrapper({
  type,
  documentId,
  content,
  className,
  onSave,
  readOnly = false,
}: OptimizedEditorWrapperProps) {
  const [editorContent, setEditorContent] = useState(content);

  // Lazy load editor
  const { isLoading, isVisible, error, Editor, containerRef, retry } =
    useLazyEditor(type, {
      preload: true,
      rootMargin: "200px",
    });

  // Export functionality
  const { exportDocument, progress, isExporting, cancel } =
    useOptimizedExport();

  // Handle export
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      const result = await exportDocument(documentId, editorContent, {
        format,
        includeComments: true,
        includeTrackChanges: true,
      });

      if (result.success) {
        downloadExportResult(result);
      }
    },
    [documentId, editorContent, exportDocument],
  );

  // Handle content change
  const handleChange = useCallback(
    (newContent: unknown) => {
      setEditorContent(newContent);
      onSave?.(newContent);
    },
    [onSave],
  );

  // Preload extensions on mount
  React.useEffect(() => {
    preloadCommonExtensions();
  }, []);

  return (
    <div ref={containerRef} className={cn("relative h-full w-full", className)}>
      {/* Toolbar with export */}
      <div className="absolute right-4 top-2 z-10">
        <ExportMenu
          type={type}
          documentId={documentId}
          content={editorContent}
          isExporting={isExporting}
          onExport={handleExport}
        />
      </div>

      {/* Editor content */}
      {error ? (
        <EditorError error={error} onRetry={retry} />
      ) : isLoading || !isVisible ? (
        <EditorSkeleton type={type} />
      ) : Editor ? (
        <Suspense fallback={<EditorSkeleton type={type} />}>
          <Editor
            content={editorContent}
            onChange={handleChange}
            readOnly={readOnly}
            documentId={documentId}
          />
        </Suspense>
      ) : (
        <EditorSkeleton type={type} />
      )}

      {/* Export progress overlay */}
      {isExporting && progress.phase !== "complete" && (
        <ExportProgress
          progress={progress.progress}
          message={progress.message}
          onCancel={cancel}
        />
      )}
    </div>
  );
}

export default OptimizedEditorWrapper;
