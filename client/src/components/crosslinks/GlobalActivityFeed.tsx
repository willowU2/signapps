'use client';

import { useEffect, useState, useCallback } from 'react';
import { activitiesApi } from '@/lib/api/crosslinks';
import type { Activity } from '@/types/crosslinks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Activity as ActivityIcon } from 'lucide-react';

const MODULE_COLORS: Record<string, string> = {
  document: 'bg-blue-100 text-blue-700',
  calendar_event: 'bg-green-100 text-green-700',
  mail_message: 'bg-orange-100 text-orange-700',
  contact: 'bg-purple-100 text-purple-700',
  task: 'bg-yellow-100 text-yellow-700',
  drive_node: 'bg-cyan-100 text-cyan-700',
  chat_message: 'bg-pink-100 text-pink-700',
  form_response: 'bg-indigo-100 text-indigo-700',
};

const MODULE_LABELS: Record<string, string> = {
  document: 'Docs',
  calendar_event: 'Calendrier',
  mail_message: 'Mail',
  contact: 'Contacts',
  task: 'Tâches',
  drive_node: 'Drive',
  chat_message: 'Chat',
  form_response: 'Formulaires',
  signature_envelope: 'Signatures',
};

const ACTION_LABELS: Record<string, string> = {
  created: 'a créé',
  updated: 'a modifié',
  deleted: 'a supprimé',
  shared: 'a partagé',
  signed: 'a signé',
  sent: 'a envoyé',
  uploaded: 'a uploadé',
  approved: 'a approuvé',
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

interface Props {
  compact?: boolean;
  limit?: number;
}

export function GlobalActivityFeed({ compact = false, limit = 50 }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filtered, setFiltered] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await activitiesApi.feed({ limit });
      setActivities(data);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let result = activities;
    if (moduleFilter !== 'all') result = result.filter(a => a.entity_type === moduleFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.entity_title?.toLowerCase().includes(q) ||
        a.entity_type.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [activities, moduleFilter, search]);

  const modules = [...new Set(activities.map(a => a.entity_type))];

  if (loading) return <div className="animate-pulse h-32 rounded-lg bg-muted" />;

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 w-40"
          />
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les modules</SelectItem>
              {modules.map(m => (
                <SelectItem key={m} value={m}>{MODULE_LABELS[m] || m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={load} className="h-8 px-2">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      <ScrollArea className={compact ? 'h-64' : 'h-96'}>
        <div className="space-y-1 pr-2">
          {filtered.map(a => (
            <div key={a.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${MODULE_COLORS[a.entity_type] || 'bg-muted text-muted-foreground'}`}>
                {MODULE_LABELS[a.entity_type] || a.entity_type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-tight">
                  <span className="font-medium">{a.actor_id.slice(0, 8)}</span>{' '}
                  {ACTION_LABELS[a.action] || a.action}{' '}
                  {a.entity_title && <span className="font-medium truncate">{a.entity_title}</span>}
                </p>
              </div>
              <time className="text-xs text-muted-foreground shrink-0">{timeAgo(a.created_at)}</time>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ActivityIcon className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Aucune activité</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
