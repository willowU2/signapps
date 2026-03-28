'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, FileText, Calendar, Mail, Users, CheckSquare, Folder, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Link from 'next/link';
import { getClient, ServiceName } from '@/lib/api/factory';

const client = () => getClient(ServiceName.IDENTITY);

interface SearchResult {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  excerpt?: string;
  url: string;
  score: number;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  document: <FileText className="w-4 h-4" />,
  calendar_event: <Calendar className="w-4 h-4" />,
  mail_message: <Mail className="w-4 h-4" />,
  contact: <Users className="w-4 h-4" />,
  task: <CheckSquare className="w-4 h-4" />,
  drive_node: <Folder className="w-4 h-4" />,
};

const TYPE_LABELS: Record<string, string> = {
  document: 'Document', calendar_event: 'Calendrier',
  mail_message: 'Mail', contact: 'Contact',
  task: 'Tâche', drive_node: 'Fichier',
};

const MODULE_COLORS: Record<string, string> = {
  document: 'text-blue-500', calendar_event: 'text-green-500',
  mail_message: 'text-orange-500', contact: 'text-purple-500',
  task: 'text-yellow-500', drive_node: 'text-cyan-500',
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UnifiedSearchDialog({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); }
    else { setQuery(''); setResults([]); }
  }, [open]);

  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    const search = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = { q: debouncedQuery, limit: '30' };
        if (activeFilter !== 'all') params.type = activeFilter;
        const { data } = await client().get<SearchResult[]>('/search/unified', { params });
        setResults(data);
      } catch { setResults([]); }
      finally { setLoading(false); }
    };
    search();
  }, [debouncedQuery, activeFilter]);

  const types = [...new Set(results.map(r => r.entity_type))];
  const shown = activeFilter === 'all' ? results : results.filter(r => r.entity_type === activeFilter);

  const grouped = shown.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.entity_type] = acc[r.entity_type] || []).push(r);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="p-0 max-w-2xl gap-0 overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher dans tous les modules..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          {query && (
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setQuery('')}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
          {loading && <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
        </div>

        {results.length > 0 && (
          <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto">
            <Button size="sm" variant={activeFilter === 'all' ? 'secondary' : 'ghost'} onClick={() => setActiveFilter('all')} className="h-6 text-xs shrink-0">
              Tout ({results.length})
            </Button>
            {types.map(t => (
              <Button key={t} size="sm" variant={activeFilter === t ? 'secondary' : 'ghost'} onClick={() => setActiveFilter(t)} className="h-6 text-xs shrink-0">
                {TYPE_LABELS[t] || t} ({results.filter(r => r.entity_type === t).length})
              </Button>
            ))}
          </div>
        )}

        <ScrollArea className="max-h-96">
          {query.length >= 2 && results.length === 0 && !loading && (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Hash className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Aucun résultat pour "{query}"</p>
            </div>
          )}
          {query.length < 2 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Tapez au moins 2 caractères pour rechercher
            </div>
          )}
          <div className="p-2">
            {Object.entries(grouped).map(([type, items]) => (
              <div key={type} className="mb-3">
                <div className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${MODULE_COLORS[type] || 'text-muted-foreground'}`}>
                  {TYPE_ICONS[type]}
                  {TYPE_LABELS[type] || type}
                </div>
                {items.map(r => (
                  <Link key={r.id} href={r.url} onClick={onClose}>
                    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-md hover:bg-muted cursor-pointer">
                      <p className="text-sm font-medium">{r.title}</p>
                      {r.excerpt && <p className="text-xs text-muted-foreground line-clamp-1">{r.excerpt}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/** Inline trigger button */
export function UnifiedSearchButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 text-muted-foreground h-8 w-48 justify-start"
      >
        <Search className="w-3.5 h-3.5" />
        Recherche globale
        <kbd className="ml-auto text-xs bg-muted px-1 rounded">Ctrl+K</kbd>
      </Button>
      <UnifiedSearchDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
