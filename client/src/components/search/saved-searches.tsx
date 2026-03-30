'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Bookmark, Bell, BellOff, Trash2, Play, Plus } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, unknown>;
  alertEnabled: boolean;
  savedAt: string;
  lastResultCount?: number;
  newResultCount?: number;
}

const LS_KEY = 'signapps_saved_searches';

function load(): SavedSearch[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function save(items: SavedSearch[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SavedSearchesProps {
  currentQuery?: string;
  currentFilters?: Record<string, unknown>;
  onRun?: (search: SavedSearch) => void;
}

export function SavedSearches({ currentQuery = '', currentFilters = {}, onRun }: SavedSearchesProps) {
  const [searches, setSearches] = useState<SavedSearch[]>(load);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState('');

  // Simulate "new results" badge updates (in prod: would poll the search API)
  useEffect(() => {
    const interval = setInterval(() => {
      setSearches(prev => {
        const updated = prev.map(s => {
          if (!s.alertEnabled) return s;
          const newCount = Math.random() > 0.85 ? Math.floor(1 + Math.random() * 3) : 0;
          return newCount > 0 ? { ...s, newResultCount: (s.newResultCount || 0) + newCount } : s;
        });
        save(updated);
        return updated;
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = useCallback(() => {
    if (!saveName.trim()) { toast.error('Nom requis'); return; }
    const newSearch: SavedSearch = {
      id: crypto.randomUUID(),
      name: saveName.trim(),
      query: currentQuery,
      filters: currentFilters,
      alertEnabled: false,
      savedAt: new Date().toISOString(),
    };
    const updated = [newSearch, ...searches];
    save(updated);
    setSearches(updated);
    setShowSave(false);
    setSaveName('');
    toast.success('Recherche sauvegardée');
  }, [saveName, currentQuery, currentFilters, searches]);

  const handleToggleAlert = (id: string) => {
    const updated = searches.map(s =>
      s.id === id ? { ...s, alertEnabled: !s.alertEnabled, newResultCount: 0 } : s
    );
    save(updated);
    setSearches(updated);
    const search = updated.find(s => s.id === id);
    toast.success(search?.alertEnabled ? 'Alerte activée' : 'Alerte désactivée');
  };

  const handleDelete = (id: string) => {
    const updated = searches.filter(s => s.id !== id);
    save(updated);
    setSearches(updated);
    toast.success('Recherche supprimée');
  };

  const handleRun = (search: SavedSearch) => {
    // Clear new result badge
    const updated = searches.map(s => s.id === search.id ? { ...s, newResultCount: 0 } : s);
    save(updated);
    setSearches(updated);
    onRun?.(search);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Recherches sauvegardées</span>
        </div>
        <Button
          size="sm" variant="ghost"
          className="h-7 text-xs"
          disabled={!currentQuery.trim()}
          onClick={() => { setSaveName(currentQuery); setShowSave(true); }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />Sauvegarder
        </Button>
      </div>

      {/* List */}
      {searches.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Aucune recherche sauvegardée.<br />Lancez une recherche et cliquez sur &ldquo;Sauvegarder&rdquo;.
        </p>
      ) : (
        <div className="space-y-1.5">
          {searches.map(s => (
            <div
              key={s.id}
              className="group flex items-center gap-2 p-2.5 rounded-lg border hover:border-primary/30 hover:bg-muted/40 transition-all"
            >
              <button className="flex-1 min-w-0 text-left" onClick={() => handleRun(s)}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{s.name}</span>
                  {(s.newResultCount || 0) > 0 && (
                    <Badge className="text-[10px] h-4 px-1 bg-primary text-primary-foreground shrink-0">
                      +{s.newResultCount}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">&ldquo;{s.query}&rdquo;</p>
              </button>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost" size="icon"
                  className={`h-7 w-7 ${s.alertEnabled ? 'text-amber-500' : 'text-muted-foreground'}`}
                  title={s.alertEnabled ? 'Désactiver alerte' : 'Activer alerte'}
                  onClick={() => handleToggleAlert(s.id)}
                >
                  {s.alertEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  title="Lancer la recherche"
                  onClick={() => handleRun(s)}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save dialog */}
      <Dialog open={showSave} onOpenChange={setShowSave}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Sauvegarder la recherche</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Nom de la recherche"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            />
            <p className="text-xs text-muted-foreground">
              Requête : &ldquo;<span className="font-medium">{currentQuery}</span>&rdquo;
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSave(false)}>Annuler</Button>
            <Button onClick={handleSave}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
