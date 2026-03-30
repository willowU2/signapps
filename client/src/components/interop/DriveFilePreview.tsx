'use client';

/**
 * Feature 4: Drive file → preview in any module
 * Feature 8: Drive → quick edit doc from file list
 * Feature 29: Doc → embed Drive file preview inline
 */

import { useState } from 'react';
import { Eye, Pencil, FileText, Image, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { DriveNode } from '@/lib/api/drive';
import { useRouter } from 'next/navigation';
import { FilePreviewer } from '@/components/drive/file-previewer';

interface DriveFilePreviewProps {
  node: DriveNode;
  fileUrl?: string;
}

function getIconType(node: DriveNode): 'image' | 'doc' | 'file' {
  const mime = node.mime_type ?? '';
  if (mime.startsWith('image/')) return 'image';
  if (node.node_type === 'document') return 'doc';
  return 'file';
}

function getPreviewType(node: DriveNode): 'image' | 'pdf' | 'doc' | 'text' | 'unknown' {
  const mime = node.mime_type ?? '';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (node.node_type === 'document') return 'doc';
  if (mime.startsWith('text/')) return 'text';
  return 'unknown';
}

export function DriveFilePreview({ node, fileUrl }: DriveFilePreviewProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const iconType = getIconType(node);

  const handleEdit = () => {
    if (node.node_type === 'document') {
      const targetId = node.target_id || node.id;
      router.push(`/docs/editor?id=${targetId}&name=${encodeURIComponent(node.name)}`);
    } else {
      router.push(`/global-drive?node=${node.id}`);
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(true)} title="Aperçu">
        <Eye className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="flex items-center gap-2 text-sm truncate">
              {iconType === 'image' ? <Image className="h-4 w-4" /> :
               iconType === 'doc'   ? <FileText className="h-4 w-4" /> :
               <File className="h-4 w-4" />}
              {node.name}
            </DialogTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleEdit}>
                <Pencil className="h-3.5 w-3.5" />
                {node.node_type === 'document' ? 'Editer' : 'Ouvrir'}
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-[300px]">
            {fileUrl ? (
              <FilePreviewer
                url={fileUrl}
                filename={node.name}
                mimeType={node.mime_type}
              />
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                <File className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">URL de fichier non disponible</p>
                {node.node_type === 'document' && (
                  <Button size="sm" className="mt-3" onClick={handleEdit}>
                    Ouvrir dans l&apos;editeur
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Inline embed: displays a compact preview card of a Drive file */
export function DriveFileEmbed({ node, fileUrl }: DriveFilePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const type = getPreviewType(node);

  return (
    <div className="rounded-lg border bg-muted/20 p-3 my-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {type === 'image' ? <Image className="h-4 w-4 shrink-0" /> :
           type === 'doc' ? <FileText className="h-4 w-4 shrink-0" /> :
           <File className="h-4 w-4 shrink-0" />}
          <span className="text-sm font-medium truncate">{node.name}</span>
        </div>
        <button onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline shrink-0">
          {expanded ? 'Réduire' : 'Aperçu'}
        </button>
      </div>
      {expanded && type === 'image' && fileUrl && (
        <img src={fileUrl} alt={node.name} className="mt-2 max-w-full rounded" />
      )}
      {expanded && type === 'pdf' && fileUrl && (
        <iframe src={fileUrl} className="mt-2 w-full h-64 border-none rounded" title={node.name} />
      )}
      {expanded && (type === 'doc' || type === 'unknown') && (
        <p className="mt-2 text-xs text-muted-foreground">Aperçu non disponible inline.</p>
      )}
    </div>
  );
}
