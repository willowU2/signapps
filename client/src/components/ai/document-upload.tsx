'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  File,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi, storageApi } from '@/lib/api';
import { toast } from 'sonner';

interface DocumentUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'indexing' | 'done' | 'error';
  progress: number;
  error?: string;
}

export function DocumentUpload({ open, onOpenChange, onSuccess }: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles = newFiles.filter((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'txt', 'md', 'doc', 'docx', 'csv', 'json'].includes(ext || '');
    });

    const uploadFiles: UploadFile[] = validFiles.map((file) => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...uploadFiles]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    },
    [addFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(Array.from(e.target.files));
      }
    },
    [addFiles]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const processFiles = async () => {
    setIsProcessing(true);

    for (const uploadFile of files) {
      if (uploadFile.status !== 'pending') continue;

      try {
        // Update status to uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 20 } : f
          )
        );

        // Upload to storage first
        await storageApi.upload('documents', uploadFile.file);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: 'indexing', progress: 60 } : f
          )
        );

        // Read file content for indexing
        const content = await readFileContent(uploadFile.file);

        // Index in AI service
        const documentId = crypto.randomUUID();
        await aiApi.index(
          documentId,
          content,
          uploadFile.file.name,
          '/documents/',
          uploadFile.file.type
        );

        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: 'done', progress: 100 } : f
          )
        );
      } catch (error) {
        console.error('Failed to process file:', error);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: 'error', error: 'Failed to process file' }
              : f
          )
        );
      }
    }

    setIsProcessing(false);

    const successCount = files.filter((f) => f.status === 'done').length;
    if (successCount > 0) {
      toast.success(`${successCount} document(s) indexed successfully`);
      onSuccess?.();
    }
  };

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'indexing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'done':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: UploadFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...';
      case 'indexing':
        return 'Indexing...';
      case 'done':
        return 'Indexed';
      case 'error':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const canProcess = pendingCount > 0 && !isProcessing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Index Documents
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            className={cn(
              'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="mb-2 text-sm font-medium">
              Drag and drop documents here
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              Supports PDF, TXT, MD, DOC, DOCX, CSV, JSON
            </p>
            <label>
              <input
                type="file"
                multiple
                accept=".pdf,.txt,.md,.doc,.docx,.csv,.json"
                onChange={handleFileInput}
                className="hidden"
              />
              <Button variant="outline" size="sm" asChild>
                <span>Browse Files</span>
              </Button>
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-2">
              {files.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
                >
                  {getStatusIcon(uploadFile.status)}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">
                      {uploadFile.file.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(uploadFile.file.size)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {getStatusText(uploadFile.status)}
                      </Badge>
                    </div>
                    {(uploadFile.status === 'uploading' ||
                      uploadFile.status === 'indexing') && (
                      <Progress value={uploadFile.progress} className="mt-2 h-1" />
                    )}
                    {uploadFile.error && (
                      <p className="mt-1 text-xs text-red-500">{uploadFile.error}</p>
                    )}
                  </div>
                  {uploadFile.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(uploadFile.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setFiles([])}
              disabled={files.length === 0 || isProcessing}
            >
              Clear All
            </Button>
            <Button onClick={processFiles} disabled={!canProcess}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Index {pendingCount} Document{pendingCount !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
