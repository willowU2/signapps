'use client';

// Idea 25: Unified timeline — all actions across modules chronologically
// Idea 30: Activity log — track all cross-module interactions

import { useState, useEffect, useCallback } from 'react';
import { Clock, RefreshCw, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { activitiesApi } from '@/lib/api/crosslinks';
import type { Activity } from '@/types/crosslinks';

const MODULE_COLOR: Record<string, string> = {
  document: 'bg-blue-500',
  mail_message: 'bg-orange-500',
  task: 'bg-yellow-500',
  contact: 'bg-purple-500',
  calendar_event: 'bg-green-500',
  chat_message: 'bg-pink-500',
  drive_node: 'bg-cyan-500',
  form_response: 'bg-indigo-500',
  spreadsheet: 'bg-emerald-500',
  presentation: 'bg-red-500',
};

const MODULE_LABEL: Record<string, string> = {
  document: 'Docs',
  mail_message: 'Mail',
  task: 'Tâches',
  contact: 'Contacts',
  calendar_event: 'Calendrier',
  chat_message: 'Chat',
  drive_node: 'Drive',
  form_response: 'Formulaires',
  spreadsheet: 'Sheets',
  presentation: 'Slides',
};

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return 'à l\'instant';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

interface Props {
  userId?: string;
  limit?: number;
  compact?: boolean;
}

export function UnifiedTimeline({ limit = 40, compact = false }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await activitiesApi.feed({ limit });
      setActivities(data);
    } catch {
      // Fall back to localStorage activity tracker
      try {
        const local = JSON.parse(localStorage.getItem('activity-tracker') || '[]');
        setActivities(local.slice(0, limit).map((l: Record<string, unknown>) => ({
          id: l.id as string,
          actor_id: 'vous',
          action: l.action as string,
          entity_type: l.action as string,
          entity_id: l.id as string,
          entity_title: l.target as string,
          metadata: {},
          created_at: l.timestamp as string,
        })));
      } catch { setActivities([]); }
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  const filtered = moduleFilter === 'all'
    ? activities
    : activities.filter(a => a.entity_type === moduleFilter);

  const modules = [...new Set(activities.map(a => a.entity_type))];

  if (loading) return <div className="animate-pulse h-32 rounded-lg bg-muted" />;

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les modules</SelectItem>
              {modules.map(m => (
                <SelectItem key={m} value={m}>{MODULE_LABEL[m] || m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={load} className="h-7 w-7 p-0">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      <ScrollArea className={compact ? 'h-48' : 'h-80'}>
        <div className="relative pl-4 space-y-0 pr-2">
          {/* Vertical line */}
          <div className="absolute left-1.5 top-0 bottom-0 w-px bg-border" />

          {filtered.map((a, i) => (
            <div key={a.id} className={`relative flex gap-3 ${i < filtered.length - 1 ? 'pb-3' : ''}`}>
              {/* Dot */}
              <div className={`absolute left-[-7px] w-3 h-3 rounded-full border-2 border-background mt-1 ${MODULE_COLOR[a.entity_type] || 'bg-muted-foreground'}`} />

              <div className="flex-1 min-w-0 ml-2">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className={`text-[10px] h-4 px-1 shrink-0 ${compact ? 'hidden' : ''}`}>
                    {MODULE_LABEL[a.entity_type] || a.entity_type}
                  </Badge>
                  <p className="text-xs leading-tight flex-1 min-w-0">
                    <span className="font-medium">{a.actor_id === 'vous' ? 'Vous' : a.actor_id.slice(0, 8)}</span>
                    {' '}{a.action}{' '}
                    {a.entity_title && <span className="text-muted-foreground truncate">{a.entity_title}</span>}
                  </p>
                </div>
              </div>
              <time className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{timeAgo(a.created_at)}</time>
            </div>
          ))}

          {!filtered.length && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Clock className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Aucune activité</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
