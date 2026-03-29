'use client';

// Feature 10: Saved searches with notifications UI

import { useState } from 'react';
import { BookmarkPlus, Bell, BellOff, Trash2, Play, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSavedSearches } from '@/hooks/use-saved-searches';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface SaveSearchDialogProps {
  currentQuery: string;
  currentFilters?: Record<string, string>;
}

export function SaveSearchDialog({ currentQuery, currentFilters = {} }: SaveSearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [notify, setNotify] = useState(false);
  const { add } = useSavedSearches();

  const handleSave = () => {
    if (!name.trim()) return;
    add(name.trim(), currentQuery, currentFilters, notify);
    toast.success('Recherche sauvegardée');
    setOpen(false);
    setName('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
          <BookmarkPlus className="w-3.5 h-3.5" />
          Sauvegarder
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Sauvegarder la recherche</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs">Nom</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Clients en attente"
              className="mt-1"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1.5">
            Requête : <span className="font-mono font-medium">{currentQuery || '(vide)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={notify} onCheckedChange={setNotify} id="notify-toggle" />
            <Label htmlFor="notify-toggle" className="text-sm cursor-pointer">
              M'alerter si de nouveaux résultats apparaissent
            </Label>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={handleSave} disabled={!name.trim()}>Sauvegarder</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SavedSearchesList({ onSelect }: { onSelect?: (query: string, filters: Record<string, string>) => void }) {
  const { searches, remove, toggle } = useSavedSearches();

  if (searches.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <BookmarkPlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucune recherche sauvegardée</p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-80">
      <div className="space-y-1.5">
        {searches.map(s => (
          <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group">
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect?.(s.query, s.filters)}>
              <p className="text-sm font-medium truncate">{s.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono truncate">{s.query}</span>
                {s.lastRun && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {formatDistanceToNow(new Date(s.lastRun), { addSuffix: true, locale: fr })}
                  </span>
                )}
                {s.resultCount !== undefined && (
                  <Badge variant="secondary" className="text-xs h-4 px-1">{s.resultCount}</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost" size="sm" className="h-6 w-6 p-0"
                onClick={() => toggle(s.id)}
                title={s.notify ? 'Désactiver notifications' : 'Activer notifications'}
              >
                {s.notify ? <Bell className="w-3.5 h-3.5 text-primary" /> : <BellOff className="w-3.5 h-3.5 text-muted-foreground" />}
              </Button>
              <Button
                variant="ghost" size="sm" className="h-6 w-6 p-0"
                onClick={() => onSelect?.(s.query, s.filters)}
                title="Relancer"
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                onClick={() => remove(s.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
