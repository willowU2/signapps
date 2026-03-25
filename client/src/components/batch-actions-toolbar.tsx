'use client';

import { Trash2, Archive, Tag, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';

interface BatchAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

interface BatchActionsToolbarProps {
  selectedCount: number;
  onClear: () => void;
  actions: BatchAction[];
}

export function BatchActionsToolbar({ selectedCount, onClear, actions }: BatchActionsToolbarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border bg-background/95 backdrop-blur-xl shadow-2xl px-4 py-2.5"
        >
          <span className="text-sm font-medium text-foreground mr-2">
            {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
          </span>

          <div className="h-5 w-px bg-border" />

          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant === 'destructive' ? 'destructive' : 'ghost'}
              size="sm"
              onClick={action.onClick}
              className="gap-1.5"
            >
              {action.icon}
              <span className="hidden sm:inline">{action.label}</span>
            </Button>
          ))}

          <div className="h-5 w-px bg-border" />

          <Button variant="ghost" size="sm" onClick={onClear} className="gap-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Annuler
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Pre-built action factories for common operations */
export function createBatchActions(handlers: {
  onDelete?: () => void;
  onArchive?: () => void;
  onTag?: () => void;
  onDownload?: () => void;
}): BatchAction[] {
  const actions: BatchAction[] = [];
  if (handlers.onArchive) actions.push({ label: 'Archiver', icon: <Archive className="h-4 w-4" />, onClick: handlers.onArchive });
  if (handlers.onTag) actions.push({ label: 'Taguer', icon: <Tag className="h-4 w-4" />, onClick: handlers.onTag });
  if (handlers.onDownload) actions.push({ label: 'Télécharger', icon: <Download className="h-4 w-4" />, onClick: handlers.onDownload });
  if (handlers.onDelete) actions.push({ label: 'Supprimer', icon: <Trash2 className="h-4 w-4" />, onClick: handlers.onDelete, variant: 'destructive' });
  return actions;
}
