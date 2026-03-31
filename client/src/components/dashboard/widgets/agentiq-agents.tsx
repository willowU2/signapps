'use client';

/**
 * AgentIQ Agents Widget
 *
 * Shows the 3 principal agents: Antigravity, Claude, OpenClaw.
 */

import { useQuery } from '@tanstack/react-query';
import { Bot, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { agentiqApi } from '@/lib/api/agentiq';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

interface AgentData {
  name: string;
  status: 'active' | 'idle' | 'waiting';
  currentTask?: string;
  progress?: number;
  model?: string;
  framework?: string;
}

const AGENT_COLORS: Record<string, string> = {
  Antigravity: 'bg-purple-500/10 border-purple-200 dark:border-purple-800',
  Claude: 'bg-blue-500/10 border-blue-200 dark:border-blue-800',
  OpenClaw: 'bg-green-500/10 border-green-200 dark:border-green-800',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  idle: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  waiting: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};

export function AgentiqAgentsWidget({ widget }: Partial<WidgetRenderProps> = {}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['agentiq-agents'],
    queryFn: () => agentiqApi.dashboard(),
    refetchInterval: 5000,
    retry: false,
  });

  const agents: AgentData[] = data?.agents ?? [];
  const offline = isError || data?.error;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Bot className="w-4 h-4 text-primary" />
          Agents IA
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-3 pt-0 space-y-3">
        {offline ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-foreground">
            <WifiOff className="w-5 h-5" />
            <span className="text-xs">AgentIQ hors ligne</span>
          </div>
        ) : isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))
        ) : agents.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            Aucun agent actif
          </div>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.name}
              className={`rounded-lg border p-3 ${AGENT_COLORS[agent.name] ?? 'bg-muted/30'}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm">{agent.name}</span>
                <div className="flex items-center gap-1.5">
                  {agent.model && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      {agent.model}
                    </Badge>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[agent.status] ?? ''}`}>
                    {agent.status}
                  </span>
                </div>
              </div>
              {agent.currentTask && (
                <p className="text-xs text-muted-foreground truncate mb-1.5">
                  {agent.currentTask}
                </p>
              )}
              {agent.progress !== undefined && (
                <Progress value={agent.progress} className="h-1.5" />
              )}
              {agent.framework && (
                <p className="text-[10px] text-muted-foreground mt-1">{agent.framework}</p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
