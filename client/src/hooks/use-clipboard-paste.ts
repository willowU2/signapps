'use client';

import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { storageApi } from '@/lib/api/storage';

export interface ClipboardPasteResult {
  url: string;
  key: string;
  bucket: string;
  contentType: string;
  size: number;
}

export interface UseClipboardPasteOptions {
  /** Whether the paste handler is active (default: true) */
  enabled?: boolean;
  /** Storage bucket for uploads (default: 'documents') */
  bucket?: string;
  /** Called when an image is pasted and uploaded */
  onImagePasted?: (result: ClipboardPasteResult) => void;
  /** Called when a file is pasted and uploaded */
  onFilePasted?: (result: ClipboardPasteResult) => void;
}

/**
 * useClipboardPaste
 *
 * Detects pasted images/files from clipboard (Ctrl+V) and uploads them
 * to storage. Useful for mail compose, docs editor, and chat.
 *
 * @example
 * ```ts
 * useClipboardPaste({
 *   enabled: isEditing,
 *   bucket: 'mail-attachments',
 *   onImagePasted: (result) => {
 *     insertInlineImage(result.url);
 *   },
 * });
 * ```
 */
export function useClipboardPaste(options: UseClipboardPasteOptions = {}) {
  const {
    enabled = true,
    bucket = 'documents',
    onImagePasted,
    onFilePasted,
  } = options;

  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      if (!enabled) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Only handle files (images, etc.)
        if (item.kind !== 'file') continue;

        const file = item.getAsFile();
        if (!file) continue;

        // Prevent default paste behavior for files
        e.preventDefault();

        const isImage = file.type.startsWith('image/');
        const toastId = toast.loading(
          isImage
            ? 'Upload de l\'image collee...'
            : `Upload de "${file.name}"...`
        );

        try {
          const response = await storageApi.uploadFile(bucket, file);
          const uploaded = Array.isArray(response.data)
            ? response.data[0]
            : response.data;

          const result: ClipboardPasteResult = {
            url: `/api/v1/files/${uploaded.bucket}/${encodeURIComponent(uploaded.key)}`,
            key: uploaded.key,
            bucket: uploaded.bucket,
            contentType: uploaded.content_type,
            size: uploaded.size,
          };

          toast.success(
            isImage ? 'Image collee et uploadee' : `"${file.name}" uploade`,
            { id: toastId }
          );

          if (isImage && onImagePasted) {
            onImagePasted(result);
          } else if (onFilePasted) {
            onFilePasted(result);
          }
        } catch {
          toast.error('Erreur lors de l\'upload', { id: toastId });
        }

        // Only handle the first file
        break;
      }
    },
    [enabled, bucket, onImagePasted, onFilePasted]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [enabled, handlePaste]);
}
