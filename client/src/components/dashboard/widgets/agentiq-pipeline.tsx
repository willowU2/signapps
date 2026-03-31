'use client';

/**
 * AgentIQ Pipeline Widget
 *
 * Horizontal funnel showing the idea lifecycle stages.
 */

import { useQuery } from '@tanstack/react-query';
import { GitPullRequest, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { agentiqApi } from '@/lib/api/agentiq';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

interface Idea {
  id: string;
  status: string;
}

const STAGES = [
  { key: 'proposed', label: 'Proposées', color: 'bg-gray-400' },
  { key: 'validated', label: 'Validées', color: 'bg-blue-500' },
  { key: 'brainstorming', label: 'Brainstorm', color: 'bg-purple-500' },
  { key: 'implementing', label: 'En cours', color: 'bg-orange-500' },
  { key: 'deployed', label: 'Déployées', color: 'bg-green-500' },
];

export function AgentiqPipelineWidget({ widget }: Partial<WidgetRenderProps> = {}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['agentiq-pipeline'],
    queryFn: () => agentiqApi.ideas(),
    refetchInterval: 5000,
    retry: false,
  });

  const ideas: Idea[] = data?.ideas ?? (Array.isArray(data) ? data : []);
  const offline = isError || data?.error;

  const counts = STAGES.map((stage) => ({
    ...stage,
    count: ideas.filter((i) => i.status === stage.key).length,
  }));

  const maxCount = Math.max(...counts.map((s) => s.count), 1);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <GitPullRequest className="w-4 h-4 text-primary" />
          Pipeline Ideas
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-3 pt-0">
        {offline ? (
          <div className="flex flex-col items-center justify-center h-16 gap-2 text-muted-foreground">
            <WifiOff className="w-5 h-5" />
            <span className="text-xs">AgentIQ hors ligne</span>
          </div>
        ) : isLoading ? (
          <Skeleton className="h-12 w-full rounded-lg" />
        ) : (
          <div className="flex items-end gap-1 h-full">
            {counts.map((stage, idx) => (
              <div key={stage.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <span className="text-xs font-bold">{stage.count}</span>
                <div
                  className={`w-full rounded-sm transition-all ${stage.color}`}
                  style={{
                    height: `${Math.max(8, (stage.count / maxCount) * 40)}px`,
                    opacity: stage.count === 0 ? 0.3 : 1,
                  }}
                />
                {idx < counts.length - 1 && (
                  <div className="absolute" />
                )}
                <span className="text-[9px] text-muted-foreground text-center leading-tight truncate w-full px-0.5">
                  {stage.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
