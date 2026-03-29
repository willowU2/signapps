'use client';

// Feature 13: Preview result without navigating away

import { useState } from 'react';
import { Eye, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface SearchResultPreviewProps {
  title: string;
  url: string;
  entityType: string;
  excerpt?: string;
  metadata?: Record<string, string>;
  onClose?: () => void;
}

export function SearchResultPreview({
  title,
  url,
  entityType,
  excerpt,
  metadata,
  onClose,
}: SearchResultPreviewProps) {
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        title="Aperçu"
      >
        <Eye className="w-3.5 h-3.5" />
      </Button>

      <Sheet open={open} onOpenChange={v => !v && handleClose()}>
        <SheetContent side="right" className="w-[440px] sm:w-[540px] p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <Badge variant="secondary" className="text-xs mb-1 capitalize">
                  {entityType.replace('_', ' ')}
                </Badge>
                <SheetTitle className="text-base leading-tight">{title}</SheetTitle>
              </div>
              <div className="flex gap-1 shrink-0">
                <Link href={url} onClick={handleClose}>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                    <ExternalLink className="w-3 h-3" />
                    Ouvrir
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          <div className="p-4 space-y-4 overflow-y-auto h-full pb-20">
            {excerpt && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Extrait</p>
                <p className="text-sm text-foreground leading-relaxed bg-muted/40 rounded-md p-3">{excerpt}</p>
              </div>
            )}

            {metadata && Object.keys(metadata).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Détails</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {Object.entries(metadata).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</dt>
                      <dd className="text-sm font-medium truncate">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Link href={url} onClick={handleClose} className="flex-1">
                <Button className="w-full gap-2" size="sm">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Voir {entityType.replace('_', ' ')} complet
                </Button>
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
