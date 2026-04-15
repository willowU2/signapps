/**
 * Hook for document import functionality
 */

import { useState, useCallback, useRef } from "react";
import { Editor } from "@tiptap/react";
import {
  importFromFile,
  importFromText,
  checkHealth,
  ImportResult,
} from "@/lib/api/office";
import { toast } from "sonner";

export type ImportFormat = "docx" | "markdown" | "html" | "txt";

export function useDocumentImport(editor: Editor | null) {
  const [isImporting, setIsImporting] = useState(false);
  const [importFormat, setImportFormat] = useState<ImportFormat | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportResult = useCallback(
    (result: ImportResult) => {
      if (!editor) return;

      if (result.success && result.tiptap_json) {
        editor.commands.setContent(result.tiptap_json);
        toast.success(
          `Document importé (${result.detected_format.toUpperCase()})`,
          {
            description: `${result.metadata.word_count} mots, ${result.metadata.character_count} caractères`,
          },
        );
      } else {
        toast.error("Erreur lors de l'import", {
          description: "Le document n'a pas pu être converti",
        });
      }
    },
    [editor],
  );

  const importDocument = useCallback(
    async (file: File) => {
      if (!editor) {
        toast.error("Éditeur non disponible");
        return;
      }

      setIsImporting(true);

      // Detect format from file extension
      const ext = file.name.split(".").pop()?.toLowerCase();
      const format = ext === "md" ? "markdown" : (ext as ImportFormat);
      setImportFormat(format || null);

      try {
        // Check service health first
        const isHealthy = await checkHealth();
        if (!isHealthy) {
          toast.error("Service d'import indisponible", {
            description: "Veuillez réessayer dans quelques instants",
          });
          return;
        }

        const result = await importFromFile(file);
        handleImportResult(result);
      } catch (error) {
        console.error("Import error:", error);
        toast.error("Erreur lors de l'import", {
          description:
            error instanceof Error ? error.message : "Une erreur est survenue",
        });
      } finally {
        setIsImporting(false);
        setImportFormat(null);
      }
    },
    [editor, handleImportResult],
  );

  const importFromClipboard = useCallback(
    async (format: "markdown" | "html") => {
      if (!editor) {
        toast.error("Éditeur non disponible");
        return;
      }

      setIsImporting(true);
      setImportFormat(format);

      try {
        const text = await navigator.clipboard.readText();
        if (!text.trim()) {
          toast.warning("Le presse-papier est vide");
          return;
        }

        const isHealthy = await checkHealth();
        if (!isHealthy) {
          toast.error("Service d'import indisponible");
          return;
        }

        const result = await importFromText(text, format);
        handleImportResult(result);
      } catch (error) {
        console.error("Clipboard import error:", error);
        toast.error("Erreur lors de l'import depuis le presse-papier", {
          description:
            error instanceof Error ? error.message : "Une erreur est survenue",
        });
      } finally {
        setIsImporting(false);
        setImportFormat(null);
      }
    },
    [editor, handleImportResult],
  );

  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        importDocument(file);
      }
      // Reset input to allow same file selection
      event.target.value = "";
    },
    [importDocument],
  );

  return {
    isImporting,
    importFormat,
    importDocument,
    importFromClipboard,
    triggerFileUpload,
    handleFileChange,
    fileInputRef,
  };
}
