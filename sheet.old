"use client";

import { useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { storageApi } from "@/lib/api";

interface UploadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucket: string;
  onUploadComplete: () => void;
}

interface UploadFile {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

export function UploadSheet({
  open,
  onOpenChange,
  bucket,
  onUploadComplete,
}: UploadSheetProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map((file) => ({
      file,
      progress: 0,
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...uploadFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "pending") continue;

      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: "uploading", progress: 0 } : f
        )
      );

      try {
        await storageApi.uploadFile(bucket, files[i].file);

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "success", progress: 100 } : f
          )
        );
      } catch {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? { ...f, status: "error", error: "Upload failed" }
              : f
          )
        );
      }
    }

    onUploadComplete();
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setFiles([]);
    }
    onOpenChange(isOpen);
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const successCount = files.filter((f) => f.status === "success").length;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="overflow-y-auto sm:max-w-xl w-full flex flex-col h-full">
        <SheetHeader>
          <SheetTitle>Upload Files</SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col gap-6 mt-6">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors
              ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }
            `}
          >
            <Upload className="h-10 w-10 mb-4 text-muted-foreground" />
            <p className="text-sm text-center text-muted-foreground mb-4">
              Drag and drop files here, or
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <span className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                Browse Files
              </span>
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="flex-1 space-y-3 overflow-y-auto px-1 pb-1">
              {files.map((uploadFile, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                >
                  <FileText className="h-6 w-6 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(uploadFile.file.size / 1024).toFixed(1)} KB
                    </p>
                    {uploadFile.status === "uploading" && (
                      <Progress value={uploadFile.progress} className="h-1.5 mt-2" />
                    )}
                  </div>
                  {uploadFile.status === "success" && (
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                  )}
                  {uploadFile.status === "error" && (
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  )}
                  {uploadFile.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t">
          <p className="text-sm text-muted-foreground">
            {successCount > 0 && `${successCount} uploaded`}
            {successCount > 0 && pendingCount > 0 && ", "}
            {pendingCount > 0 && `${pendingCount} pending`}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Close
            </Button>
            <Button onClick={uploadFiles} disabled={pendingCount === 0}>
              Upload {pendingCount > 0 && `(${pendingCount})`}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
