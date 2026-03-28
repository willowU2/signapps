'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Star, Trash2, ExternalLink, BookmarkX, Search, SortAsc, SortDesc, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getClient, ServiceName } from '@/lib/api/factory';
import Link from 'next/link';

const client = () => getClient(ServiceName.IDENTITY);

export interface Bookmark {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_title: string;
  entity_url?: string;
  created_at: string;
  source?: 'api' | 'local';
}

const MODULE_HREFS: Record<string, (id: string) => string> = {
  document: id => `/docs/${id}`,
  drive_node: id => `/drive/${id}`,
  mail_message: id => `/mail/${id}`,
  calendar_event: id => `/calendar/${id}`,
  contact: id => `/contacts/${id}`,
  task: id => `/tasks/${id}`,
  spreadsheet: id => `/sheets/${id}`,
  presentation: id => `/slides/${id}`,
};

const MODULE_ICONS: Record<string, string> = {
  document: '📄',
  drive_node: '📁',
  mail_message: '✉️',
  calendar_event: '📅',
  contact: '👤',
  task: '✅',
  form_response: '📝',
  chat_message: '💬',
  spreadsheet: '📊',
  presentation: '📽️',
};

const MODULE_LABELS: Record<string, string> = {
  document: 'Documents',
  drive_node: 'Drive',
  mail_message: 'Emails',
  calendar_event: 'Evenements',
  contact: 'Contacts',
  task: 'Taches',
  form_response: 'Formulaires',
  chat_message: 'Messages',
  spreadsheet: 'Feuilles',
  presentation: 'Presentations',
};

// ─── localStorage bookmark helpers ──────────────────────────────────────────

const LOCAL_STORAGE_KEY = 'signapps-bookmarks';

function getLocalBookmarks(): Bookmark[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalBookmarks(bookmarks: Bookmark[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bookmarks));
}

export function addLocalBookmark(bookmark: Omit<Bookmark, 'id' | 'created_at' | 'source'>) {
  const existing = getLocalBookmarks();
  const already = existing.find(b => b.entity_type === bookmark.entity_type && b.entity_id === bookmark.entity_id);
  if (already) return already;

  const newBookmark: Bookmark = {
    ...bookmark,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    source: 'local',
  };
  existing.push(newBookmark);
  saveLocalBookmarks(existing);
  return newBookmark;
}

export function removeLocalBookmark(id: string) {
  const existing = getLocalBookmarks();
  saveLocalBookmarks(existing.filter(b => b.id !== id));
}

export function isLocalBookmarked(entityType: string, entityId: string): boolean {
  const existing = getLocalBookmarks();
  return existing.some(b => b.entity_type === entityType && b.entity_id === entityId);
}

// ─── StarButton ─────────────────────────────────────────────────────────────

interface StarButtonProps {
  entityType: string;
  entityId: string;
  entityTitle: string;
  entityUrl?: string;
}

export function StarButton({ entityType, entityId, entityTitle, entityUrl }: StarButtonProps) {
  const [starred, setStarred] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);

  useEffect(() => {
    // Check API first, then localStorage
    client().get<Bookmark[]>('/bookmarks', { params: { entity_type: entityType, entity_id: entityId } })
      .then(({ data }) => {
        if (data.length > 0) { setStarred(true); setBookmarkId(data[0].id); }
        else if (isLocalBookmarked(entityType, entityId)) {
          const local = getLocalBookmarks().find(b => b.entity_type === entityType && b.entity_id === entityId);
          if (local) { setStarred(true); setBookmarkId(local.id); }
        }
      })
      .catch(() => {
        // Fallback to localStorage only
        if (isLocalBookmarked(entityType, entityId)) {
          const local = getLocalBookmarks().find(b => b.entity_type === entityType && b.entity_id === entityId);
          if (local) { setStarred(true); setBookmarkId(local.id); }
        }
      });
  }, [entityType, entityId]);

  const toggle = async () => {
    if (starred && bookmarkId) {
      // Remove
      try {
        if (bookmarkId.startsWith('local-')) {
          removeLocalBookmark(bookmarkId);
        } else {
          await client().delete(`/bookmarks/${bookmarkId}`);
        }
        setStarred(false);
        setBookmarkId(null);
        toast.success('Favori retire');
      } catch {
        // Try local removal as fallback
        removeLocalBookmark(bookmarkId);
        setStarred(false);
        setBookmarkId(null);
        toast.success('Favori retire');
      }
    } else {
      // Add
      try {
        const { data } = await client().post<Bookmark>('/bookmarks', {
          entity_type: entityType, entity_id: entityId,
          entity_title: entityTitle, entity_url: entityUrl,
        });
        setStarred(true);
        setBookmarkId(data.id);
        toast.success('Ajoute aux favoris');
      } catch {
        // Fallback to localStorage
        const local = addLocalBookmark({
          entity_type: entityType,
          entity_id: entityId,
          entity_title: entityTitle,
          entity_url: entityUrl,
        });
        if (local) {
          setStarred(true);
          setBookmarkId(local.id);
          toast.success('Ajoute aux favoris (local)');
        }
      }
    }
  };

  return (
    <Button size="sm" variant="ghost" onClick={toggle} className="h-7 w-7 p-0">
      <Star className={`w-4 h-4 transition-colors ${starred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
    </Button>
  );
}

// ─── BookmarksPage ──────────────────────────────────────────────────────────

export function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'alpha'>('newest');

  const load = useCallback(async () => {
    let apiBookmarks: Bookmark[] = [];
    try {
      const { data } = await client().get<Bookmark[]>('/bookmarks');
      apiBookmarks = (data || []).map(b => ({ ...b, source: 'api' as const }));
    } catch {
      // API unavailable
    }

    // Merge with localStorage bookmarks
    const localBookmarks = getLocalBookmarks();

    // Deduplicate: if a bookmark exists in both API and local, keep the API version
    const apiKeys = new Set(apiBookmarks.map(b => `${b.entity_type}:${b.entity_id}`));
    const uniqueLocal = localBookmarks.filter(b => !apiKeys.has(`${b.entity_type}:${b.entity_id}`));

    setBookmarks([...apiBookmarks, ...uniqueLocal]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    const bookmark = bookmarks.find(b => b.id === id);
    setBookmarks(prev => prev.filter(b => b.id !== id));

    if (id.startsWith('local-')) {
      removeLocalBookmark(id);
    } else {
      try { await client().delete(`/bookmarks/${id}`); } catch {}
    }
    toast.success('Favori retire');
  };

  const types = useMemo(() => [...new Set(bookmarks.map(b => b.entity_type))], [bookmarks]);

  const filtered = useMemo(() => {
    let result = filter === 'all' ? bookmarks : bookmarks.filter(b => b.entity_type === filter);

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b =>
        b.entity_title.toLowerCase().includes(q) ||
        b.entity_type.toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortOrder === 'alpha') return a.entity_title.localeCompare(b.entity_title, 'fr');
      if (sortOrder === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // newest
    });

    return result;
  }, [bookmarks, filter, searchQuery, sortOrder]);

  if (loading) return <div className="animate-pulse h-48 rounded-lg bg-muted" />;

  return (
    <div className="space-y-4">
      {/* Search and sort controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans les favoris..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5"
          onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : s === 'oldest' ? 'alpha' : 'newest')}
        >
          {sortOrder === 'newest' && <><SortDesc className="h-3.5 w-3.5" /> Recent</>}
          {sortOrder === 'oldest' && <><SortAsc className="h-3.5 w-3.5" /> Ancien</>}
          {sortOrder === 'alpha' && <><SortAsc className="h-3.5 w-3.5" /> A-Z</>}
        </Button>
      </div>

      {/* Type filters */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')} className="h-7">
          Tous ({bookmarks.length})
        </Button>
        {types.map(t => {
          const count = bookmarks.filter(b => b.entity_type === t).length;
          return (
            <Button key={t} size="sm" variant={filter === t ? 'default' : 'outline'} onClick={() => setFilter(t)} className="h-7">
              {MODULE_ICONS[t] || '🔖'} {MODULE_LABELS[t] || t} ({count})
            </Button>
          );
        })}
      </div>

      <ScrollArea className="h-[calc(100vh-340px)]">
        <div className="space-y-2 pr-2">
          {filtered.map(b => {
            const href = b.entity_url || MODULE_HREFS[b.entity_type]?.(b.entity_id) || '#';
            return (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group">
                <span className="text-lg">{MODULE_ICONS[b.entity_type] || '🔖'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{b.entity_title}</p>
                    {b.source === 'local' && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">local</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <span>{MODULE_LABELS[b.entity_type] || b.entity_type}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(b.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                    <Link href={href}><ExternalLink className="w-3.5 h-3.5" /></Link>
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => remove(b.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BookmarkX className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">{searchQuery ? 'Aucun favori correspondant' : 'Aucun favori'}</p>
              {!searchQuery && (
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Cliquez sur l&apos;etoile dans n&apos;importe quel module pour ajouter un favori
                </p>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
