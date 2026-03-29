'use client';

// Idea 43: Cross-module comments — comment on any entity from any module
// Idea 44: Activity digests — weekly summary email of all module activity

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Mail, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { getClient, ServiceName } from '@/lib/api/factory';

const identityClient = () => getClient(ServiceName.IDENTITY);

interface CrossComment {
  id: string;
  entity_type: string;
  entity_id: string;
  author_id: string;
  author_name: string;
  text: string;
  source_module?: string;
  created_at: string;
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'à l\'instant';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

interface Props {
  entityType: string;
  entityId: string;
  compact?: boolean;
}

/** Idea 43 – Cross-module comment thread on any entity */
export function CrossModuleComments({ entityType, entityId, compact = false }: Props) {
  const [comments, setComments] = useState<CrossComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await identityClient().get<CrossComment[]>('/comments', {
        params: { entity_type: entityType, entity_id: entityId },
      });
      setComments(data);
    } catch {
      // Load from localStorage
      const local = JSON.parse(localStorage.getItem(`comments:${entityType}:${entityId}`) || '[]');
      setComments(local);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const post = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPosting(true);
    const optimistic: CrossComment = {
      id: `local-${Date.now()}`,
      entity_type: entityType,
      entity_id: entityId,
      author_id: 'vous',
      author_name: 'Vous',
      text: trimmed,
      source_module: 'cross',
      created_at: new Date().toISOString(),
    };

    setComments(prev => [...prev, optimistic]);
    setText('');

    try {
      const { data } = await identityClient().post<CrossComment>('/comments', {
        entity_type: entityType,
        entity_id: entityId,
        text: trimmed,
      });
      setComments(prev => prev.map(c => c.id === optimistic.id ? data : c));
    } catch {
      // Keep optimistic, persist locally
      const local = JSON.parse(localStorage.getItem(`comments:${entityType}:${entityId}`) || '[]');
      local.push(optimistic);
      localStorage.setItem(`comments:${entityType}:${entityId}`, JSON.stringify(local));
    } finally {
      setPosting(false);
    }
  };

  if (loading) return <div className="animate-pulse h-16 rounded bg-muted" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <MessageSquare className="w-4 h-4" />
        Commentaires
        {comments.length > 0 && <Badge variant="secondary" className="text-xs h-4 px-1">{comments.length}</Badge>}
      </div>

      <ScrollArea className={compact ? 'h-32' : 'h-48'}>
        <div className="space-y-2 pr-1">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2">
              <Avatar className="w-6 h-6 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {c.author_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-medium">{c.author_name}</span>
                  {c.source_module && c.source_module !== 'cross' && (
                    <Badge variant="outline" className="text-[9px] h-3 px-1">{c.source_module}</Badge>
                  )}
                  <time className="text-[10px] text-muted-foreground ml-auto">{timeAgo(c.created_at)}</time>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.text}</p>
              </div>
            </div>
          ))}
          {!comments.length && (
            <p className="text-xs text-muted-foreground py-2 text-center">Aucun commentaire</p>
          )}
        </div>
      </ScrollArea>

      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) post(); }}
          placeholder="Ajouter un commentaire…"
          className="text-xs resize-none min-h-[60px]"
          rows={2}
        />
        <Button size="sm" onClick={post} disabled={posting || !text.trim()} className="h-auto px-3 self-end">
          {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

/** Idea 44 – Activity digest subscription */
export function ActivityDigestSettings() {
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'never'>('weekly');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    identityClient().get<{ frequency: string; email: string }>('/digest/settings')
      .then(({ data }) => {
        setFrequency(data.frequency as 'daily' | 'weekly' | 'never');
        setEmail(data.email || '');
      })
      .catch(() => {
        const s = localStorage.getItem('digest-settings');
        if (s) try { const p = JSON.parse(s); setFrequency(p.frequency); setEmail(p.email || ''); } catch { /* */ }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await identityClient().put('/digest/settings', { frequency, email });
      setSaved(true);
      toast.success('Préférences de digest sauvegardées');
    } catch {
      localStorage.setItem('digest-settings', JSON.stringify({ frequency, email }));
      setSaved(true);
      toast.success('Préférences sauvegardées localement');
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    try {
      await identityClient().post('/digest/send-now', {});
      toast.success('Digest envoyé par email');
    } catch {
      toast.error('Impossible d\'envoyer le digest maintenant');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Mail className="w-4 h-4" />Digest d'activité par email
      </div>
      <div className="flex items-center gap-3">
        <Select value={frequency} onValueChange={(v) => setFrequency(v as 'daily' | 'weekly' | 'never')}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Quotidien</SelectItem>
            <SelectItem value="weekly">Hebdomadaire</SelectItem>
            <SelectItem value="never">Désactivé</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={save} disabled={saving} className="h-8 gap-1 text-xs">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          {saved ? 'Sauvegardé' : 'Sauvegarder'}
        </Button>
        {frequency !== 'never' && (
          <Button size="sm" variant="outline" onClick={sendNow} className="h-8 gap-1 text-xs">
            <Calendar className="w-3 h-3" />Envoyer maintenant
          </Button>
        )}
      </div>
    </div>
  );
}
