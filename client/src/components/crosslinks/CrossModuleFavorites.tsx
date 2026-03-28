'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, Trash2, ExternalLink, BookmarkX } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

const MODULE_HREFS: Record<string, (id: string) => string> = {
  document: id => `/docs/${id}`,
  drive_node: id => `/drive/${id}`,
  mail_message: id => `/mail/${id}`,
  calendar_event: id => `/calendar/${id}`,
  contact: id => `/contacts/${id}`,
  task: id => `/tasks/${id}`,
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
};

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
    client().get<Bookmark[]>('/bookmarks', { params: { entity_type: entityType, entity_id: entityId } })
      .then(({ data }) => {
        if (data.length > 0) { setStarred(true); setBookmarkId(data[0].id); }
      })
      .catch(() => {});
  }, [entityType, entityId]);

  const toggle = async () => {
    if (starred && bookmarkId) {
      try {
        await client().delete(`/bookmarks/${bookmarkId}`);
        setStarred(false);
        setBookmarkId(null);
        toast.success('Favori retiré');
      } catch { toast.error('Erreur'); }
    } else {
      try {
        const { data } = await client().post<Bookmark>('/bookmarks', {
          entity_type: entityType, entity_id: entityId,
          entity_title: entityTitle, entity_url: entityUrl,
        });
        setStarred(true);
        setBookmarkId(data.id);
        toast.success('Ajouté aux favoris');
      } catch { toast.error('Erreur'); }
    }
  };

  return (
    <Button size="sm" variant="ghost" onClick={toggle} className="h-7 w-7 p-0">
      <Star className={`w-4 h-4 transition-colors ${starred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
    </Button>
  );
}

export function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const { data } = await client().get<Bookmark[]>('/bookmarks');
      setBookmarks(data);
    } catch {
      setBookmarks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
    try { await client().delete(`/bookmarks/${id}`); } catch {}
    toast.success('Favori retiré');
  };

  const types = [...new Set(bookmarks.map(b => b.entity_type))];
  const shown = filter === 'all' ? bookmarks : bookmarks.filter(b => b.entity_type === filter);

  if (loading) return <div className="animate-pulse h-48 rounded-lg bg-muted" />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')} className="h-7">
          Tous ({bookmarks.length})
        </Button>
        {types.map(t => (
          <Button key={t} size="sm" variant={filter === t ? 'default' : 'outline'} onClick={() => setFilter(t)} className="h-7">
            {MODULE_ICONS[t] || '🔖'} {t}
          </Button>
        ))}
      </div>

      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-2 pr-2">
          {shown.map(b => {
            const href = b.entity_url || MODULE_HREFS[b.entity_type]?.(b.entity_id) || '#';
            return (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <span className="text-lg">{MODULE_ICONS[b.entity_type] || '🔖'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{b.entity_title}</p>
                  <p className="text-xs text-muted-foreground">{b.entity_type} · {new Date(b.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-1">
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
          {shown.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BookmarkX className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Aucun favori</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
