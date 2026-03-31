'use client';

/**
 * AgentIQ Ideas Kanban Widget
 *
 * Kanban board with 3 columns: Quick Win / Moyen Terme / Long Terme.
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, WifiOff, Search, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { agentiqApi } from '@/lib/api/agentiq';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

interface Idea {
  id: string;
  title: string;
  impact: 'high' | 'medium' | 'low';
  effort: string;
  status: string;
  horizon?: string; // 'quick-win' | 'medium-term' | 'long-term'
}

const IMPACT_BADGE: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

const COLUMNS = [
  { key: 'quick-win', label: 'Quick Win' },
  { key: 'medium-term', label: 'Moyen Terme' },
  { key: 'long-term', label: 'Long Terme' },
];

export function AgentiqIdeasWidget({ widget }: Partial<WidgetRenderProps> = {}) {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agentiq-ideas'],
    queryFn: () => agentiqApi.ideas(),
    refetchInterval: 5000,
    retry: false,
  });

  const ideas: Idea[] = data?.ideas ?? (Array.isArray(data) ? data : []);
  const offline = isError || data?.error;

  const filtered = ideas.filter((idea) =>
    idea.title.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDecide(id: string, decision: string) {
    await agentiqApi.decideIdea(id, decision);
    queryClient.invalidateQueries({ queryKey: ['agentiq-ideas'] });
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-primary" />
            Ideas Kanban
            {ideas.length > 0 && (
              <Badge variant="secondary" className="text-xs">{ideas.length}</Badge>
            )}
          </CardTitle>
        </div>
        <div className="relative mt-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="h-7 pl-6 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-2 pt-0">
        {offline ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-foreground">
            <WifiOff className="w-5 h-5" />
            <span className="text-xs">AgentIQ hors ligne</span>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-3 gap-2 h-full">
            {COLUMNS.map((col) => (
              <Skeleton key={col.key} className="h-full w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 h-full">
            {COLUMNS.map((col) => {
              const colIdeas = filtered.filter(
                (idea) => (idea.horizon ?? 'quick-win') === col.key
              );
              return (
                <div key={col.key} className="flex flex-col min-h-0">
                  <div className="text-xs font-semibold text-muted-foreground mb-1.5 px-1">
                    {col.label}
                    <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                      {colIdeas.length}
                    </Badge>
                  </div>
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-1.5 pr-1">
                      {colIdeas.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-4">Vide</p>
                      ) : (
                        colIdeas.map((idea) => (
                          <div key={idea.id} className="rounded border bg-card p-2">
                            <p className="text-[11px] font-medium leading-tight mb-1.5">
                              {idea.title}
                            </p>
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className={`text-[10px] px-1 py-0.5 rounded ${IMPACT_BADGE[idea.impact] ?? ''}`}>
                                {idea.impact}
                              </span>
                              {idea.effort && (
                                <span className="text-[10px] text-muted-foreground">{idea.effort}</span>
                              )}
                            </div>
                            {idea.status === 'proposed' && (
                              <div className="flex gap-1 mt-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 p-0 text-green-600 hover:text-green-700"
                                  onClick={() => handleDecide(idea.id, 'validated')}
                                  title="Valider"
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 p-0 text-red-500 hover:text-red-600"
                                  onClick={() => handleDecide(idea.id, 'rejected')}
                                  title="Rejeter"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
