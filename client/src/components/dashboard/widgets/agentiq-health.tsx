'use client';

/**
 * AgentIQ Health Widget
 *
 * Session uptime, crash count, Golden Rules compliance chips, sprint info.
 */

import { useQuery } from '@tanstack/react-query';
import { Activity, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { agentiqApi } from '@/lib/api/agentiq';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

interface GoldenRule {
  label: string;
  ok: boolean;
}

interface HealthData {
  sessionUptime?: number; // seconds
  crashCount?: number;
  goldenRules?: GoldenRule[];
  sprint?: {
    name?: string;
    tasksCompleted?: number;
    tasksTotal?: number;
  };
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${m.toString().padStart(2, '0')}m`;
}

export function AgentiqHealthWidget({ widget }: Partial<WidgetRenderProps> = {}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['agentiq-health'],
    queryFn: () => agentiqApi.dashboard(),
    refetchInterval: 5000,
    retry: false,
  });

  const offline = isError || data?.error;
  const health: HealthData = data ?? {};

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-primary" />
          AgentIQ Health
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-3 pt-0 space-y-3">
        {offline ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-foreground">
            <WifiOff className="w-5 h-5" />
            <span className="text-xs">AgentIQ hors ligne</span>
          </div>
        ) : isLoading ? (
          <>
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-10 w-full rounded" />
            <Skeleton className="h-16 w-full rounded" />
          </>
        ) : (
          <>
            {/* Session metrics row */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg bg-muted/40 p-2 text-center">
                <p className="text-xs text-muted-foreground">Uptime</p>
                <p className="text-lg font-bold leading-tight">
                  {health.sessionUptime !== undefined
                    ? formatUptime(health.sessionUptime)
                    : '—'}
                </p>
              </div>
              <div className="flex-1 rounded-lg bg-muted/40 p-2 text-center">
                <p className="text-xs text-muted-foreground">Crashes</p>
                <p className={`text-lg font-bold leading-tight ${(health.crashCount ?? 0) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {health.crashCount ?? 0}
                </p>
              </div>
            </div>

            {/* Sprint info */}
            {health.sprint && (
              <div className="rounded-lg bg-muted/40 p-2">
                <p className="text-xs font-medium">{health.sprint.name ?? 'Sprint actif'}</p>
                {health.sprint.tasksTotal !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {health.sprint.tasksCompleted ?? 0} / {health.sprint.tasksTotal} tâches
                  </p>
                )}
              </div>
            )}

            {/* Golden Rules compliance */}
            {health.goldenRules && health.goldenRules.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Golden Rules</p>
                <div className="flex flex-wrap gap-1">
                  {health.goldenRules.map((rule, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className={`text-[9px] h-4 px-1.5 ${
                        rule.ok
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                      title={rule.label}
                    >
                      {rule.ok ? '✓' : '✗'} {rule.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
