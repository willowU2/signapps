'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText } from 'lucide-react';
import { aiApi, storageApi } from '@/lib/api';
import { toast } from 'sonner';
import { FileUploadProgressBar } from '@/components/application/file-upload/file-upload-progress-bar';

interface DocumentUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DocumentUpload({ open, onOpenChange, onSuccess }: DocumentUploadProps) {
  const [successCount, setSuccessCount] = useState(0);

  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        resolve(content);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const customUploadStrategy = async (
    id: string,
    file: File,
    onProgress: (progress: number) => void,
    onUploadSuccess: () => void,
    onError: (error: string) => void
  ) => {
    try {
      onProgress(10);
      
      // Upload to storage first
      await storageApi.uploadFile('documents', file);
      onProgress(50);
      
      // Read file content for indexing
      const content = await readFileContent(file);
      onProgress(75);
      
      // Index in AI service
      const documentId = crypto.randomUUID();
      await aiApi.index(
        documentId,
        content,
        file.name,
        '/documents/',
        file.type
      );
      
      onProgress(100);
      setSuccessCount((prev) => prev + 1);
      onUploadSuccess();
    } catch (error) {
      onError((error as Error).message || 'Failed to process and index document');
    }
  };

  const handleUploadComplete = () => {
    if (successCount > 0) {
      toast.success(`${successCount} document(s) indexed successfully`);
      onSuccess?.();
    }
    setSuccessCount(0);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && successCount > 0) handleUploadComplete();
      if (!isOpen) setSuccessCount(0);
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[600px] min-h-[400px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Index Documents
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 pt-4">
          <FileUploadProgressBar 
            customUploadStrategy={customUploadStrategy}
            onUploadComplete={handleUploadComplete}
            acceptedTypes=".pdf,.txt,.md,.doc,.docx,.csv,.json"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
