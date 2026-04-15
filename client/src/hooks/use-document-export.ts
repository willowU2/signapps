/**
 * Hook for document export functionality
 */

import { useState, useCallback } from "react";
import { Editor } from "@tiptap/react";
import {
  downloadDocument,
  ExportFormat,
  ExportComment,
  checkHealth,
} from "@/lib/api/office";
import { toast } from "sonner";

export interface UseDocumentExportOptions {
  editor: Editor | null;
  documentTitle?: string;
  comments?: ExportComment[];
}

export function useDocumentExport(
  editorOrOptions: Editor | null | UseDocumentExportOptions,
  documentTitle: string = "document",
) {
  // Support both legacy signature and new options object
  const options: UseDocumentExportOptions =
    editorOrOptions && "editor" in editorOrOptions
      ? editorOrOptions
      : { editor: editorOrOptions as Editor | null, documentTitle };

  const { editor, documentTitle: title = "document", comments } = options;

  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);

  const exportDocument = useCallback(
    async (format: ExportFormat) => {
      if (!editor) {
        toast.error("Éditeur non disponible");
        return;
      }

      setIsExporting(true);
      setExportFormat(format);

      try {
        // Check service health first
        const isHealthy = await checkHealth();
        if (!isHealthy) {
          toast.error("Service de conversion indisponible", {
            description: "Veuillez réessayer dans quelques instants",
          });
          return;
        }

        // Get Tiptap JSON content
        const content = editor.getJSON();

        // Generate filename
        const filename =
          title.replace(/[^a-zA-Z0-9-_\s]/g, "").trim() || "document";

        // Download the document (include comments for DOCX export)
        const exportComments = format === "docx" ? comments : undefined;
        await downloadDocument(content, format, filename, exportComments);

        const successMessage =
          format === "docx" && comments?.length
            ? `Document exporté en ${format.toUpperCase()} avec ${comments.length} commentaire(s)`
            : `Document exporté en ${format.toUpperCase()}`;

        toast.success(successMessage, {
          description: `${filename}.${format === "markdown" ? "md" : format}`,
        });
      } catch (error) {
        console.error("Export error:", error);
        toast.error("Erreur lors de l'export", {
          description:
            error instanceof Error ? error.message : "Une erreur est survenue",
        });
      } finally {
        setIsExporting(false);
        setExportFormat(null);
      }
    },
    [editor, title, comments],
  );

  const exportAsDocx = useCallback(
    () => exportDocument("docx"),
    [exportDocument],
  );
  const exportAsPdf = useCallback(
    () => exportDocument("pdf"),
    [exportDocument],
  );
  const exportAsMarkdown = useCallback(
    () => exportDocument("markdown"),
    [exportDocument],
  );
  const exportAsHtml = useCallback(
    () => exportDocument("html"),
    [exportDocument],
  );
  const exportAsText = useCallback(
    () => exportDocument("text"),
    [exportDocument],
  );

  return {
    isExporting,
    exportFormat,
    exportDocument,
    exportAsDocx,
    exportAsPdf,
    exportAsMarkdown,
    exportAsHtml,
    exportAsText,
  };
}
