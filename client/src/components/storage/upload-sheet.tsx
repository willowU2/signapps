"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileUploadProgressBar } from "@/components/application/file-upload/file-upload-progress-bar";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <FileUploadProgressBar
            bucket={bucket}
            onUploadComplete={onUploadComplete}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
