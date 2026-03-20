'use client';

import { useEffect, useState } from 'react';
import { FileArchive, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { previewApi } from '@/lib/api';

interface ArchiveFile {
  name: string;
  size: number;
  compressed_size: number;
}

interface ArchivePreviewProps {
  fileName: string;
  bucket?: string;
  fileKey?: string;
}

/**
 * ArchivePreview - Affiche le contenu des archives (ZIP, TAR, etc.).
 *
 * Note: Cette implémentation affiche un placeholder pour l'instant.
 * Pour fonctionner, il faut un endpoint backend qui retourne la listing de l'archive.
 */
export function ArchivePreview({
  fileName,
  bucket,
  fileKey,
}: ArchivePreviewProps) {
  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSize, setTotalSize] = useState(0);

  useEffect(() => {
    if (!bucket || !fileKey) {
      setLoading(false);
      return;
    }

    previewApi.getArchiveListing(bucket, fileKey)
      .then(res => {
        const fileList = res.data;
        setFiles(fileList);
        const total = fileList.reduce((acc: number, f: ArchiveFile) => acc + f.size, 0);
        setTotalSize(total);
      })
      .catch(err => {
        console.error("Failed to load archive listing", err);
        // Only show toast if it's explicitly requested by an action, or fail silently for preview pane
      })
      .finally(() => {
        setLoading(false);
      });
  }, [bucket, fileKey]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const compressionRatio = totalSize > 0
    ? Math.round((1 - files.reduce((a, f) => a + f.compressed_size, 0) / totalSize) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Archive Info */}
      <div className="bg-muted p-4 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <FileArchive className="h-5 w-5" />
          <p className="font-medium">{fileName}</p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Fichiers</p>
            <p className="font-semibold">{files.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Taille originale</p>
            <p className="font-semibold">{formatSize(totalSize)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Compression</p>
            <p className="font-semibold">{compressionRatio}%</p>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2 border-b grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground">
            <div className="col-span-7">Fichier</div>
            <div className="col-span-2">Taille</div>
            <div className="col-span-2">Compressé</div>
            <div className="col-span-1"></div>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="px-4 py-2 border-b hover:bg-muted/50 grid grid-cols-12 gap-4 text-sm items-center"
              >
                <div className="col-span-7 truncate text-muted-foreground">
                  {file.name}
                </div>
                <div className="col-span-2 text-muted-foreground">
                  {formatSize(file.size)}
                </div>
                <div className="col-span-2 text-muted-foreground">
                  {formatSize(file.compressed_size)}
                </div>
                <div className="col-span-1"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Extraction de contenu non disponible</p>
          <p className="text-xs">Téléchargez l'archive pour l'explorer localement</p>
        </div>
      )}

      {/* Bouton "Extraire" retiré - feature non implémentée (NO DEAD ENDS) */}
    </div>
  );
}
