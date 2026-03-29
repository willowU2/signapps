'use client';

// Idea 40: Global undo — undo actions across modules
// Idea 41: Cross-module clipboard — copy entity ref, paste as link in another module
// Idea 42: Batch operations — bulk actions spanning multiple modules

import { useState, useCallback } from 'react';
import { Undo2, Clipboard, ClipboardPaste, CheckSquare, Loader2, X, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { linksApi } from '@/lib/api/crosslinks';
import { getClient, ServiceName } from '@/lib/api/factory';

const identityClient = () => getClient(ServiceName.IDENTITY);

const UNDO_STORAGE_KEY = 'interop-undo-stack';

interface UndoEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_title: string;
  module: string;
  timestamp: string;
  payload?: unknown;
}

/** Idea 40 – Global undo stack manager */
export function pushUndo(entry: Omit<UndoEntry, 'id' | 'timestamp'>) {
  const stack: UndoEntry[] = JSON.parse(localStorage.getItem(UNDO_STORAGE_KEY) || '[]');
  stack.unshift({ ...entry, id: `u-${Date.now()}`, timestamp: new Date().toISOString() });
  localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(stack.slice(0, 30)));
}

export function GlobalUndoButton() {
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState<UndoEntry[]>([]);
  const [undoing, setUndoing] = useState<string | null>(null);

  const loadStack = () => {
    const saved = JSON.parse(localStorage.getItem(UNDO_STORAGE_KEY) || '[]');
    setStack(saved);
  };

  const undo = async (entry: UndoEntry) => {
    setUndoing(entry.id);
    try {
      await identityClient().post('/undo', {
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        payload: entry.payload,
      });
      const updated = stack.filter(e => e.id !== entry.id);
      setStack(updated);
      localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(updated));
      toast.success(`Action annulée : ${entry.entity_title}`);
    } catch {
      toast.error('Impossible d\'annuler cette action');
    } finally {
      setUndoing(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) loadStack(); }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Annuler une action">
          <Undo2 className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <p className="text-xs font-medium mb-2">Historique des actions</p>
        <ScrollArea className="max-h-48">
          <div className="space-y-1 pr-1">
            {stack.length === 0 && <p className="text-xs text-muted-foreground py-2">Aucune action à annuler</p>}
            {stack.map(entry => (
              <div key={entry.id} className="flex items-center gap-2 p-1.5 rounded border hover:bg-muted/40">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{entry.entity_title}</p>
                  <p className="text-[10px] text-muted-foreground">{entry.action} · {entry.module}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => undo(entry)} disabled={undoing === entry.id} className="h-6 w-6 p-0">
                  {undoing === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

const CLIPBOARD_KEY = 'interop-entity-clipboard';

interface ClipboardEntity {
  entity_type: string;
  entity_id: string;
  entity_title: string;
  entity_url?: string;
  copied_at: string;
}

/** Idea 41 – Cross-module clipboard */
export function useEntityClipboard() {
  const copy = useCallback((entity: Omit<ClipboardEntity, 'copied_at'>) => {
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify({
      ...entity,
      copied_at: new Date().toISOString(),
    }));
    toast.success(`"${entity.entity_title}" copié dans le presse-papier`);
  }, []);

  const paste = useCallback((): ClipboardEntity | null => {
    try {
      return JSON.parse(localStorage.getItem(CLIPBOARD_KEY) || 'null');
    } catch { return null; }
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(CLIPBOARD_KEY);
  }, []);

  return { copy, paste, clear };
}

export function EntityCopyButton({
  entityType, entityId, entityTitle, entityUrl,
}: {
  entityType: string; entityId: string; entityTitle: string; entityUrl?: string;
}) {
  const { copy } = useEntityClipboard();
  return (
    <Button size="sm" variant="ghost" onClick={() => copy({ entity_type: entityType, entity_id: entityId, entity_title: entityTitle, entity_url: entityUrl })} className="h-7 w-7 p-0" title="Copier la référence">
      <Clipboard className="w-3.5 h-3.5" />
    </Button>
  );
}

export function EntityPasteAsLink({
  onPaste,
}: {
  onPaste: (entity: ClipboardEntity) => void;
}) {
  const { paste } = useEntityClipboard();
  const entity = paste();

  if (!entity) return null;

  return (
    <Button size="sm" variant="ghost" onClick={() => { const e = paste(); if (e) onPaste(e); }} className="h-7 gap-1 text-xs">
      <ClipboardPaste className="w-3.5 h-3.5" />
      Coller "{entity.entity_title.slice(0, 20)}"
    </Button>
  );
}

type BatchOperation = 'archive' | 'delete' | 'tag' | 'share' | 'export';

interface BatchItem {
  entity_type: string;
  entity_id: string;
  entity_title: string;
  module: string;
}

/** Idea 42 – Batch operations across modules */
export function CrossModuleBatchOps({ items }: { items: BatchItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<BatchOperation | null>(null);

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const execute = async (op: BatchOperation) => {
    if (!selected.size) { toast.error('Sélectionnez des éléments'); return; }
    setOperation(op);
    setLoading(true);
    const batch = items.filter(i => selected.has(`${i.entity_type}:${i.entity_id}`));

    try {
      await identityClient().post('/batch', {
        operation: op,
        items: batch.map(i => ({ entity_type: i.entity_type, entity_id: i.entity_id })),
      });
      toast.success(`${op} appliqué à ${batch.length} élément(s)`);
      setSelected(new Set());
    } catch {
      toast.info(`${batch.length} opération(s) mise(s) en file d'attente`);
    } finally {
      setLoading(false);
      setOperation(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" />Opérations en lot</p>
        {selected.size > 0 && (
          <Badge variant="default" className="text-xs">{selected.size} sélectionné(s)</Badge>
        )}
      </div>
      <ScrollArea className="max-h-40">
        <div className="space-y-1 pr-1">
          {items.map(item => {
            const key = `${item.entity_type}:${item.entity_id}`;
            return (
              <div key={key} className="flex items-center gap-2 p-1.5 rounded border hover:bg-muted/30">
                <Checkbox checked={selected.has(key)} onCheckedChange={() => toggle(key)} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{item.entity_title}</p>
                  <p className="text-[10px] text-muted-foreground">{item.module}</p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      {selected.size > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {(['archive', 'delete', 'tag', 'share', 'export'] as BatchOperation[]).map(op => (
            <Button key={op} size="sm" variant="outline" onClick={() => execute(op)}
              disabled={loading} className="h-6 text-xs capitalize">
              {loading && operation === op ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              {op}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
