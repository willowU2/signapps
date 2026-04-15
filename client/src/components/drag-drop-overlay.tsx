"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  Mail,
  FileSpreadsheet,
  HardDrive,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { storageApi } from "@/lib/api/storage";

/**
 * DragDropOverlay
 *
 * Global drag-and-drop zone that appears when files are dragged over the window.
 * Routes uploaded files based on the current page context:
 * - /storage: upload to current bucket
 * - /mail: attach to compose (stores in sessionStorage for mail compose to pick up)
 * - /docs or /sheets: open/import the file
 * - Anywhere else: upload to "documents" bucket in storage
 */
export function DragDropOverlay() {
  const [isDragging, setIsDragging] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const dragCountRef = useRef(0);

  const getContext = useCallback(() => {
    if (pathname?.startsWith("/storage")) {
      return {
        icon: HardDrive,
        label: "Uploader dans le Drive",
        sublabel: "Les fichiers seront ajoutés au dossier courant",
        bucket: "documents",
      };
    }
    if (pathname?.startsWith("/mail")) {
      return {
        icon: Mail,
        label: "Joindre au message",
        sublabel: "Les fichiers seront ajoutés en pièce jointe",
        bucket: "__mail_attach__",
      };
    }
    if (pathname?.startsWith("/docs")) {
      return {
        icon: FileText,
        label: "Importer le document",
        sublabel: "Le fichier sera ouvert dans l'éditeur",
        bucket: "__docs_import__",
      };
    }
    if (pathname?.startsWith("/sheets")) {
      return {
        icon: FileSpreadsheet,
        label: "Importer la feuille",
        sublabel: "Le fichier sera importé dans Sheets",
        bucket: "__sheets_import__",
      };
    }
    return {
      icon: Upload,
      label: "Déposer les fichiers ici",
      sublabel: "Les fichiers seront uploadés dans le Drive",
      bucket: "documents",
    };
  }, [pathname]);

  const handleUpload = useCallback(
    async (files: FileList) => {
      const context = getContext();
      const fileArray = Array.from(files);

      if (fileArray.length === 0) return;

      // Mail context: store files in a custom event for the mail compose to pick up
      if (context.bucket === "__mail_attach__") {
        window.dispatchEvent(
          new CustomEvent("dragdrop-mail-attach", {
            detail: { files: fileArray },
          }),
        );
        toast.success(
          `${fileArray.length} fichier(s) ajouté(s) en pièce jointe`,
        );
        return;
      }

      // Docs context: dispatch event for docs editor to handle
      if (context.bucket === "__docs_import__") {
        window.dispatchEvent(
          new CustomEvent("dragdrop-doc-import", {
            detail: { files: fileArray },
          }),
        );
        toast.success(`Import de "${fileArray[0].name}" en cours...`);
        return;
      }

      // Sheets context: dispatch event for sheets editor to handle
      if (context.bucket === "__sheets_import__") {
        window.dispatchEvent(
          new CustomEvent("dragdrop-sheet-import", {
            detail: { files: fileArray },
          }),
        );
        toast.success(`Import de "${fileArray[0].name}" en cours...`);
        return;
      }

      // Storage upload (default)
      const bucket = context.bucket;
      const toastId = toast.loading(
        `Upload de ${fileArray.length} fichier(s)...`,
      );

      try {
        let successCount = 0;
        let errorCount = 0;

        for (const file of fileArray) {
          try {
            await storageApi.uploadFile(bucket, file);
            successCount++;
          } catch {
            errorCount++;
          }
        }

        if (errorCount === 0) {
          toast.success(`${successCount} fichier(s) uploadé(s) avec succès`, {
            id: toastId,
          });
        } else {
          toast.warning(`${successCount} uploadé(s), ${errorCount} erreur(s)`, {
            id: toastId,
          });
        }

        // Dispatch event so the storage page can refresh
        window.dispatchEvent(new CustomEvent("storage-files-changed"));

        // If not on storage page, offer to navigate there
        if (!pathname?.startsWith("/storage")) {
          toast("Fichiers disponibles dans le Drive", {
            action: {
              label: "Voir",
              onClick: () => router.push("/storage"),
            },
          });
        }
      } catch {
        toast.error("Erreur lors de l'upload", { id: toastId });
      }
    },
    [getContext, pathname, router],
  );

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current++;
      if (e.dataTransfer?.types?.includes("Files")) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current--;
      if (dragCountRef.current <= 0) {
        dragCountRef.current = 0;
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      // Needed to allow drop
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleUpload(files);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleUpload]);

  if (!isDragging) return null;

  const context = getContext();
  const Icon = context.icon;

  return (
    <div className="fixed inset-0 z-[9999] bg-primary/10 backdrop-blur-sm flex items-center justify-center transition-all duration-200 animate-in fade-in">
      <div className="bg-background border-2 border-dashed border-primary rounded-2xl p-12 text-center shadow-2xl pointer-events-none">
        <Icon className="h-16 w-16 mx-auto text-primary mb-4" />
        <h2 className="text-xl font-bold">{context.label}</h2>
        <p className="text-muted-foreground mt-2">{context.sublabel}</p>
      </div>
    </div>
  );
}
