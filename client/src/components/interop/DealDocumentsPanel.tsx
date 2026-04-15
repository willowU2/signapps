"use client";
// Feature 13: CRM deal → show linked documents
// Feature 24: Contact → show all linked files from Drive

import { useState, useEffect } from "react";
import { FileText, FolderOpen, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedAt?: string;
  url?: string;
}

interface LinkedFile {
  entityType: "deal" | "contact";
  entityId: string;
  fileId: string;
  fileName: string;
  url?: string;
  addedAt: string;
}

function loadLinkedFiles(
  entityType: "deal" | "contact",
  entityId: string,
): LinkedFile[] {
  if (typeof window === "undefined") return [];
  try {
    const all = JSON.parse(
      localStorage.getItem("crm:linked_files") ?? "[]",
    ) as LinkedFile[];
    return all.filter(
      (f) => f.entityType === entityType && f.entityId === entityId,
    );
  } catch {
    return [];
  }
}

function saveLinkedFile(file: LinkedFile) {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(
      localStorage.getItem("crm:linked_files") ?? "[]",
    ) as LinkedFile[];
    localStorage.setItem("crm:linked_files", JSON.stringify([...all, file]));
  } catch {
    /* noop */
  }
}

function removeLinkedFile(fileId: string, entityId: string) {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(
      localStorage.getItem("crm:linked_files") ?? "[]",
    ) as LinkedFile[];
    localStorage.setItem(
      "crm:linked_files",
      JSON.stringify(
        all.filter((f) => !(f.fileId === fileId && f.entityId === entityId)),
      ),
    );
  } catch {
    /* noop */
  }
}

const MIME_ICON: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOC",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLS",
  "image/png": "IMG",
  "image/jpeg": "IMG",
};

interface Props {
  entityType: "deal" | "contact";
  entityId: string;
  entityName?: string;
}

export function DealDocumentsPanel({
  entityType,
  entityId,
  entityName,
}: Props) {
  const [files, setFiles] = useState<LinkedFile[]>([]);
  const [driveUrl, setDriveUrl] = useState("/drive");

  useEffect(() => {
    setFiles(loadLinkedFiles(entityType, entityId));
    if (entityName) {
      setDriveUrl(`/drive?search=${encodeURIComponent(entityName)}`);
    }
  }, [entityType, entityId, entityName]);

  const refresh = () => setFiles(loadLinkedFiles(entityType, entityId));

  const handleUnlink = (fileId: string) => {
    removeLinkedFile(fileId, entityId);
    refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <FolderOpen className="h-3 w-3" /> Documents ({files.length})
        </p>
        <Button size="sm" variant="outline" asChild className="h-7 text-xs">
          <Link href={driveUrl}>
            <Plus className="h-3 w-3 mr-1" /> Drive
          </Link>
        </Button>
      </div>

      {files.length === 0 ? (
        <div className="text-xs text-muted-foreground italic">
          Aucun document lié.{" "}
          <Link
            href={driveUrl}
            className="text-primary hover:underline inline-flex items-center gap-0.5"
          >
            Ouvrir Drive <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5">
          {files.map((file) => (
            <div
              key={file.fileId}
              className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-muted-foreground bg-muted rounded px-1">
                  {MIME_ICON[file.fileId] ?? "FIC"}
                </span>
                <span className="truncate">{file.fileName}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {file.url && (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-muted-foreground"
                  onClick={() => handleUnlink(file.fileId)}
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
