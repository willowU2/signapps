"use client";

/**
 * AgentIQ Code Reviewers Widget
 *
 * Shows code review agents per domain: Security, Quality, Performance, Architecture, UX.
 */

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, WifiOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { agentiqApi } from "@/lib/api/agentiq";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

interface Reviewer {
  id: string;
  domain: string;
  findingsCount: number;
  lastRun?: string;
  model?: string;
  status: "active" | "idle" | "running";
}

const DOMAIN_COLORS: Record<string, string> = {
  Security: "text-red-600",
  Quality: "text-blue-600",
  Performance: "text-orange-600",
  Architecture: "text-purple-600",
  UX: "text-pink-600",
};

export function AgentiqReviewersWidget({
  widget,
}: Partial<WidgetRenderProps> = {}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["agentiq-reviewers"],
    queryFn: () => agentiqApi.reviewers(),
    refetchInterval: 5000,
    retry: false,
  });

  const reviewers: Reviewer[] = Array.isArray(data)
    ? data
    : (data?.reviewers ?? []);
  const offline = isError || data?.error;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Code Reviewers
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-3 pt-0 space-y-2">
        {offline ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-foreground">
            <WifiOff className="w-5 h-5" />
            <span className="text-xs">AgentIQ hors ligne</span>
          </div>
        ) : isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))
        ) : reviewers.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            Aucun reviewer configuré
          </div>
        ) : (
          reviewers.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 py-1.5 border-b last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-semibold ${DOMAIN_COLORS[r.domain] ?? ""}`}
                  >
                    {r.domain}
                  </span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                    {r.findingsCount} finding{r.findingsCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {r.model && (
                    <span className="text-[10px] text-muted-foreground">
                      {r.model}
                    </span>
                  )}
                  {r.lastRun && (
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(r.lastRun).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                  r.status === "running"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : r.status === "active"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {r.status}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
