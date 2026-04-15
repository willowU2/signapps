"use client";

/**
 * AgentIQ Sub-Agents Widget
 *
 * Shows dispatched sub-agents sorted by most recent first.
 */

import { useQuery } from "@tanstack/react-query";
import { GitBranch, WifiOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { agentiqApi } from "@/lib/api/agentiq";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

interface SubAgent {
  id: string;
  name: string;
  parent: string;
  task: string;
  status: string;
  model: string;
  startedAt?: string;
  duration?: number;
}

const MODEL_BADGE: Record<string, string> = {
  opus: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  sonnet: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  haiku: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

function modelKey(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("opus")) return "opus";
  if (m.includes("haiku")) return "haiku";
  return "sonnet";
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m${seconds % 60}s`;
}

export function AgentiqSubagentsWidget({
  widget,
}: Partial<WidgetRenderProps> = {}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["agentiq-subagents"],
    queryFn: () => agentiqApi.subagents(),
    refetchInterval: 5000,
    retry: false,
  });

  const subagents: SubAgent[] = Array.isArray(data)
    ? data
    : (data?.subagents ?? []);
  const offline = isError || data?.error;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <GitBranch className="w-4 h-4 text-primary" />
          Sous-Agents
          {subagents.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-auto">
              {subagents.length}
            </Badge>
          )}
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
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded" />
            ))}
          </div>
        ) : subagents.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            Aucun sous-agent actif
          </div>
        ) : (
          <ScrollArea className="h-full px-3 pb-3">
            <div className="grid grid-cols-2 gap-2 pt-1">
              {subagents.map((agent) => {
                const mk = modelKey(agent.model ?? "");
                return (
                  <div key={agent.id} className="rounded-lg border bg-card p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate">
                        {agent.name}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${MODEL_BADGE[mk]}`}
                      >
                        {mk}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mb-1">
                      {agent.task}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {agent.parent}
                      </span>
                      {agent.duration !== undefined && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatDuration(agent.duration)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
