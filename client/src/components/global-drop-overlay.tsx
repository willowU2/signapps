'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { driveApi } from '@/lib/api';

export function GlobalDropOverlay() {
  const [dragging, setDragging] = useState(false);
  const counter = useRef(0);

  const handleUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    for (const file of files) {
      try {
        await driveApi.uploadFile(file, null);
        toast.success(`"${file.name}" uploadé avec succès`);
      } catch {
        toast.error(`Erreur lors de l'upload de "${file.name}"`);
      }
    }
  }, []);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files')) {
        counter.current++;
        setDragging(true);
      }
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      counter.current--;
      if (counter.current === 0) setDragging(false);
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      counter.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) handleUpload(files);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleUpload]);

  if (!dragging) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary/50 pointer-events-none animate-in fade-in duration-200">
      <div className="flex flex-col items-center gap-3 text-primary">
        <Upload className="h-16 w-16 animate-bounce" />
        <p className="text-xl font-semibold">Déposez vos fichiers pour les uploader</p>
        <p className="text-sm text-muted-foreground">Ils seront ajoutés à votre Drive</p>
      </div>
    </div>
  );
}
