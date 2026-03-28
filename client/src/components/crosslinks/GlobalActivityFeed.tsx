'use client';

import { useEffect, useState, useCallback } from 'react';
import { activitiesApi } from '@/lib/api/crosslinks';
import type { Activity } from '@/types/crosslinks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Activity as ActivityIcon, Trash2 } from 'lucide-react';
import { useActivityTracker, type TrackedActivity } from '@/hooks/use-activity-tracker';

const MODULE_COLORS: Record<string, string> = {
  document: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  calendar_event: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  mail_message: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  contact: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  task: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  drive_node: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  chat_message: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  form_response: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  // Local activity types
  created: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  search: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  navigated: 'bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-300',
  login: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
};

const MODULE_LABELS: Record<string, string> = {
  document: 'Docs',
  calendar_event: 'Calendrier',
  mail_message: 'Mail',
  contact: 'Contacts',
  task: 'Taches',
  drive_node: 'Drive',
  chat_message: 'Chat',
  form_response: 'Formulaires',
  signature_envelope: 'Signatures',
  // Local activity action labels
  created: 'Nouveau',
  search: 'Recherche',
  navigated: 'Navigation',
  login: 'Connexion',
  updated: 'Modifie',
  deleted: 'Supprime',
  sent: 'Envoye',
  uploaded: 'Upload',
};

const ACTION_LABELS: Record<string, string> = {
  created: 'a cree',
  updated: 'a modifie',
  deleted: 'a supprime',
  shared: 'a partage',
  signed: 'a signe',
  sent: 'a envoye',
  uploaded: 'a uploade',
  approved: 'a approuve',
  search: 'a recherche',
  navigated: 'a consulte',
  login: 's\'est connecte',
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "A l'instant";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

/**
 * Convert localStorage-tracked activities to the Activity shape
 * used by the feed rendering.
 */
function localToActivity(t: TrackedActivity): Activity {
  return {
    id: t.id,
    actor_id: 'vous',
    action: t.action,
    entity_type: t.action,
    entity_id: t.id,
    entity_title: t.target,
    metadata: t.details ? { details: t.details } : {},
    created_at: t.timestamp,
  };
}

interface Props {
  compact?: boolean;
  limit?: number;
}

export function GlobalActivityFeed({ compact = false, limit = 50 }: Props) {
  const [apiActivities, setApiActivities] = useState<Activity[]>([]);
  const [filtered, setFiltered] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [search, setSearch] = useState('');

  // localStorage-backed activities as fallback
  const { activities: localActivities, clear: clearLocal } = useActivityTracker();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await activitiesApi.feed({ limit });
      setApiActivities(data);
    } catch {
      setApiActivities([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  // Merge API activities with local activities (local as fallback or supplement)
  const mergedActivities: Activity[] = (() => {
    const localConverted = localActivities.slice(0, limit).map(localToActivity);

    if (apiActivities.length > 0) {
      // API has data: show API activities first, then local ones that are not duplicates
      const apiIds = new Set(apiActivities.map(a => a.id));
      const uniqueLocal = localConverted.filter(l => !apiIds.has(l.id));
      return [...apiActivities, ...uniqueLocal]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
    }

    // No API data: show local activities only
    return localConverted;
  })();

  useEffect(() => {
    let result = mergedActivities;
    if (moduleFilter !== 'all') result = result.filter(a => a.entity_type === moduleFilter || a.action === moduleFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.entity_title?.toLowerCase().includes(q) ||
        a.entity_type.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedActivities.length, apiActivities, localActivities, moduleFilter, search]);

  const modules = [...new Set(mergedActivities.map(a => a.entity_type))];

  if (loading) return <div className="animate-pulse h-32 rounded-lg bg-muted" />;

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex gap-2 flex-wrap items-center">
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
          <Button size="sm" variant="ghost" onClick={load} className="h-8 px-2" title="Rafraichir">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          {localActivities.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clearLocal} className="h-8 px-2 text-muted-foreground" title="Effacer l'historique local">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}

      <ScrollArea className={compact ? 'h-64' : 'h-96'}>
        <div className="space-y-1 pr-2">
          {filtered.map(a => (
            <div key={a.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${MODULE_COLORS[a.entity_type] || MODULE_COLORS[a.action] || 'bg-muted text-muted-foreground'}`}>
                {MODULE_LABELS[a.entity_type] || MODULE_LABELS[a.action] || a.entity_type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-tight">
                  <span className="font-medium">{a.actor_id === 'vous' ? 'Vous' : a.actor_id.slice(0, 8)}</span>{' '}
                  {ACTION_LABELS[a.action] || a.action}{' '}
                  {a.entity_title && <span className="font-medium truncate">{a.entity_title}</span>}
                </p>
                {a.metadata?.details != null && (
                  <p className="text-xs text-muted-foreground mt-0.5">{String(a.metadata.details as unknown)}</p>
                )}
              </div>
              <time className="text-xs text-muted-foreground shrink-0">{timeAgo(a.created_at)}</time>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ActivityIcon className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Aucune activite</p>
              <p className="text-xs mt-1">Vos actions apparaitront ici au fil de votre utilisation.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
