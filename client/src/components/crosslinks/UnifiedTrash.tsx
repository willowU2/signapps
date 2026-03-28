'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { getClient, ServiceName } from '@/lib/api/factory';

const client = () => getClient(ServiceName.IDENTITY);

interface SuppriméItem {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_title: string;
  deleted_by: string;
  deleted_at: string;
  expires_at?: string;
}

const MODULE_ICONS: Record<string, string> = {
  document: '📄', drive_node: '📁', mail_message: '✉️',
  calendar_event: '📅', contact: '👤', task: '✅',
  form_response: '📝', chat_message: '💬',
};

const MODULE_LABELS: Record<string, string> = {
  document: 'Document', drive_node: 'Fichier', mail_message: 'Email',
  calendar_event: 'Événement', contact: 'Contact', task: 'Tâche',
  form_response: 'Formulaire', chat_message: 'Message',
};

function daysUntil(date?: string) {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export function UnifiedTrash() {
  const [items, setItems] = useState<SuppriméItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [confirmPurge, setConfirmPurge] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await client().get<SuppriméItem[]>('/trash');
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const restore = async (item: SuppriméItem) => {
    try {
      await client().post(`/trash/${item.id}/restore`);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success(`"${item.entity_title}" restauré`);
    } catch { toast.error('Restauration échouée'); }
  };

  const purge = async (item: SuppriméItem) => {
    try {
      await client().delete(`/trash/${item.id}`);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success('Supprimé définitivement');
    } catch { toast.error('Erreur'); }
  };

  const purgeAll = async () => {
    try {
      await client().delete('/trash');
      setItems([]);
      toast.success('Corbeille vidée');
    } catch { toast.error('Erreur'); }
    setConfirmPurge(false);
  };

  const types = [...new Set(items.map(i => i.entity_type))];
  const shown = filter === 'all' ? items : items.filter(i => i.entity_type === filter);

  if (loading) return <div className="animate-pulse h-48 rounded-lg bg-muted" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')} className="h-7">
            Tout ({items.length})
          </Button>
          {types.map(t => (
            <Button key={t} size="sm" variant={filter === t ? 'default' : 'outline'} onClick={() => setFilter(t)} className="h-7">
              {MODULE_ICONS[t]} {MODULE_LABELS[t] || t}
            </Button>
          ))}
        </div>
        {items.length > 0 && (
          <Button size="sm" variant="destructive" onClick={() => setConfirmPurge(true)} className="h-7">
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Vider la corbeille
          </Button>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-300px)]">
        <div className="space-y-2 pr-2">
          {shown.map(item => {
            const days = daysUntil(item.expires_at);
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <span className="text-lg">{MODULE_ICONS[item.entity_type] || '🗑️'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.entity_title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-xs h-4 px-1">
                      {MODULE_LABELS[item.entity_type] || item.entity_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Supprimé {new Date(item.deleted_at).toLocaleDateString()}
                    </span>
                    {days !== null && days <= 7 && (
                      <span className="flex items-center gap-0.5 text-xs text-orange-500">
                        <AlertTriangle className="w-3 h-3" />
                        Expire dans {days}j
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => restore(item)} className="h-7 text-xs">
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Restaurer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => purge(item)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Trash2 className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">La corbeille est vide</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={confirmPurge} onOpenChange={setConfirmPurge}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vider la corbeille ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement {items.length} élément(s). Elle est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={purgeAll} className="bg-destructive text-destructive-foreground">
              Supprimer tout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
