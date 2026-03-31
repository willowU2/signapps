'use client';

/**
 * AgentIQ Timeline Widget
 *
 * Scrollable action log: timestamp, agent icon, text, method badge.
 */

import { useQuery } from '@tanstack/react-query';
import { Clock, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { agentiqApi } from '@/lib/api/agentiq';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

interface TimelineEntry {
  id?: string;
  timestamp: string;
  agent?: string;
  text: string;
  method?: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  POST: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PATCH: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const AGENT_INITIALS: Record<string, string> = {
  Antigravity: 'AG',
  Claude: 'CL',
  OpenClaw: 'OC',
};

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

export function AgentiqTimelineWidget({ widget }: Partial<WidgetRenderProps> = {}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['agentiq-timeline'],
    queryFn: () => agentiqApi.dashboard(),
    refetchInterval: 5000,
    retry: false,
  });

  const timeline: TimelineEntry[] = (data?.timeline ?? []).slice(0, 50);
  const offline = isError || data?.error;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-primary" />
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        {offline ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-foreground">
            <WifiOff className="w-5 h-5" />
            <span className="text-xs">AgentIQ hors ligne</span>
          </div>
        ) : isLoading ? (
          <div className="space-y-2 px-3 pb-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
        ) : timeline.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            Aucune activité
          </div>
        ) : (
          <ScrollArea className="h-full px-3 pb-3">
            <div className="space-y-1 pt-1">
              {timeline.map((entry, idx) => (
                <div key={entry.id ?? idx} className="flex items-start gap-2 py-1">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 text-[9px] font-bold">
                    {entry.agent ? (AGENT_INITIALS[entry.agent] ?? entry.agent.slice(0, 2).toUpperCase()) : '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] leading-tight">{entry.text}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{formatTime(entry.timestamp)}</span>
                      {entry.method && (
                        <Badge className={`text-[9px] h-3.5 px-1 ${METHOD_COLORS[entry.method] ?? ''}`}>
                          {entry.method}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
