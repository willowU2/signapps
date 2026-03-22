'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { storageApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface DropZoneProps {
  bucket: string;
  prefix?: string;
  onUploadComplete?: () => void;
  acceptedTypes?: string;
  maxFileSize?: number; // in bytes
  children?: React.ReactNode;
  className?: string;
}

/**
 * DropZone - Zone interactive pour glisser-déposer des fichiers pour upload.
 *
 * Fonctionnalités :
 * - Drag & drop zone interactive
 * - Sélection fichiers via bouton
 * - Upload multiple fichiers simultanément
 * - Barre de progression par fichier
 * - Gestion des erreurs
 * - Annulation possible
 */
export function DropZone({
  bucket,
  prefix,
  onUploadComplete,
  acceptedTypes = '*',
  maxFileSize = 10 * 1024 * 1024, // 10 MB default
  children,
  className,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllersRef = useRef<Map<string, AbortController>>(
    new Map()
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      const newUploads: UploadFile[] = files.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        progress: 0,
        status: 'pending',
      }));

      setUploads((prev) => [...prev, ...newUploads]);

      // Upload each file
      for (const upload of newUploads) {
        await uploadFile(upload);
      }
    },
    [bucket, prefix]
  );

  const uploadFile = async (upload: UploadFile) => {
    // Validate file size
    if (upload.file.size > maxFileSize) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id
            ? {
              ...u,
              status: 'error',
              error: `File size exceeds ${Math.round(maxFileSize / 1024 / 1024)} MB limit`,
            }
            : u
        )
      );
      toast.error(`File too large: ${upload.file.name}`);
      return;
    }

    setUploads((prev) =>
      prev.map((u) =>
        u.id === upload.id ? { ...u, status: 'uploading', progress: 0 } : u
      )
    );

    try {
      const abortController = new AbortController();
      abortControllersRef.current.set(upload.id, abortController);

      // Create a wrapper around XMLHttpRequest to track progress
      const formData = new FormData();
      formData.append('file', upload.file);
      if (prefix) {
        formData.append('path', prefix);
      }

      // Use axios with onUploadProgress if possible, or fallback to XMLHttpRequest
      const xhr = new XMLHttpRequest();
      let completed = false;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploads((prev) =>
            prev.map((u) =>
              u.id === upload.id ? { ...u, progress: percentComplete } : u
            )
          );
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          completed = true;
          setUploads((prev) =>
            prev.map((u) =>
              u.id === upload.id
                ? { ...u, status: 'success', progress: 100 }
                : u
            )
          );
          toast.success(`Uploaded: ${upload.file.name}`);
        } else {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === upload.id
                ? {
                  ...u,
                  status: 'error',
                  error: `Upload failed (${xhr.status})`,
                }
                : u
            )
          );
          toast.error(`Failed to upload: ${upload.file.name}`);
        }
      });

      xhr.addEventListener('error', () => {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === upload.id
              ? { ...u, status: 'error', error: 'Network error' }
              : u
          )
        );
        toast.error(`Network error uploading: ${upload.file.name}`);
      });

      xhr.addEventListener('abort', () => {
        if (!completed) {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === upload.id
                ? { ...u, status: 'error', error: 'Upload cancelled' }
                : u
            )
          );
        }
      });

      xhr.open('POST', `${process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:3004/api/v1'}/files/${bucket}`);

      // Set auth header (must be after xhr.open)
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);

      abortControllersRef.current.delete(upload.id);
    } catch (error) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id
            ? {
              ...u,
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            }
            : u
        )
      );
      toast.error(`Error uploading: ${upload.file.name}`);
    }

    // Call completion callback if all uploads are done
    if (
      uploads.every((u) =>
        ['success', 'error'].includes(u.status)
      )
    ) {
      onUploadComplete?.();
    }
  };

  const cancelUpload = (id: string) => {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
    }
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  const clearCompleted = () => {
    setUploads((prev) => prev.filter((u) => u.status !== 'success'));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files ? Array.from(e.currentTarget.files) : [];
    handleFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasActiveUploads = uploads.some((u) =>
    ['pending', 'uploading'].includes(u.status)
  );
  const hasCompletedUploads = uploads.some((u) => u.status === 'success');
  const successCount = uploads.filter((u) => u.status === 'success').length;
  const errorCount = uploads.filter((u) => u.status === 'error').length;

  return (
    <div
      className={cn("relative", className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Content */}
      {children}

      {/* Drop Overlay or Default UI */}
      {(isDragging || !children) && (
        <div
          className={cn(
            "flex flex-col items-center justify-center p-8 text-center transition-all",
            children
              ? "absolute inset-0 bg-background/80 z-50 border-2 border-dashed border-primary rounded-lg backdrop-blur-sm"
              : `border-2 border-dashed rounded-lg ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}`
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            accept={acceptedTypes}
            className="hidden"
            disabled={hasActiveUploads}
          />

          <div className="space-y-2 pointer-events-none">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">
                {isDragging
                  ? 'Drop files here'
                  : 'Drag & drop files here'}
              </p>
              {!isDragging && (
                <p className="text-sm text-muted-foreground">
                  or click to select
                </p>
              )}
            </div>
            {!isDragging && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  // Prevent event propagation if clicking through overlay?
                  // Use pointer-events-auto for button
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="pointer-events-auto"
                disabled={hasActiveUploads}
              >
                Select Files
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Max size: {Math.round(maxFileSize / 1024 / 1024)} MB
            </p>
          </div>
        </div>
      )}

      {/* Upload Progress Overlay/Card */}
      {uploads.length > 0 && (
        <div className={cn(
          children ? "fixed bottom-6 right-6 w-96 z-50 shadow-lg" : "mt-4"
        )}>
          <Card>
            <CardHeader className="pb-3 py-3 px-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Uploads{' '}
                  {successCount > 0 && (
                    <span className="text-green-600">({successCount})</span>
                  )}
                  {errorCount > 0 && (
                    <span className="text-red-600">({errorCount})</span>
                  )}
                </CardTitle>
                {hasCompletedUploads && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={clearCompleted}
                  >
                    Clear done
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 p-3 max-h-64 overflow-y-auto">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="space-y-1.5 p-2 rounded-md border border-muted bg-background"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" title={upload.file.name}>
                        {upload.file.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {upload.status === 'uploading' && (
                        <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-3.5 w-3.5  text-blue-500" />
                      )}
                      {upload.status === 'success' && (
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      )}
                      {upload.status === 'error' && (
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                      )}
                      {['pending', 'uploading'].includes(upload.status) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => cancelUpload(upload.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {['pending', 'uploading'].includes(upload.status) && (
                    <Progress value={upload.progress} className="h-1" />
                  )}

                  {upload.status === 'error' && upload.error && (
                    <p className="text-[10px] text-red-600">{upload.error}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
