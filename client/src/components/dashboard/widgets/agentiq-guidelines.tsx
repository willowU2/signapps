"use client";

/**
 * AgentIQ Guidelines Widget
 *
 * Horizontal chip bar: each guideline as a colored chip with status badge.
 * Click to generate ideas from guideline.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Compass, WifiOff, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { agentiqApi } from "@/lib/api/agentiq";
import type { WidgetRenderProps } from "@/lib/dashboard/types";
import { useState } from "react";

interface Guideline {
  id: string;
  title: string;
  status: "active" | "draft";
  color?: string;
}

const CHIP_COLORS = [
  "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300",
  "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300",
  "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300",
  "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300",
  "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300",
  "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300",
];

export function AgentiqGuidelinesWidget({
  widget,
}: Partial<WidgetRenderProps> = {}) {
  const [generating, setGenerating] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["agentiq-guidelines"],
    queryFn: () => agentiqApi.guidelines(),
    refetchInterval: 5000,
    retry: false,
  });

  const guidelines: Guideline[] = Array.isArray(data)
    ? data
    : (data?.guidelines ?? []);
  const offline = isError || data?.error;

  async function handleGenerate(id: string) {
    setGenerating(id);
    try {
      await agentiqApi.decideIdea(id, "generate");
      queryClient.invalidateQueries({ queryKey: ["agentiq-ideas"] });
    } finally {
      setGenerating(null);
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-primary" />
          Guidelines
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-3 pt-0">
        {offline ? (
          <div className="flex flex-col items-center justify-center h-12 gap-1 text-muted-foreground">
            <WifiOff className="w-4 h-4" />
            <span className="text-xs">AgentIQ hors ligne</span>
          </div>
        ) : isLoading ? (
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        ) : guidelines.length === 0 ? (
          <div className="flex items-center justify-center h-12 text-sm text-muted-foreground">
            Aucune guideline
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-wrap gap-2">
              {guidelines.map((g, idx) => (
                <button
                  key={g.id}
                  onClick={() => handleGenerate(g.id)}
                  disabled={generating === g.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all hover:shadow-sm cursor-pointer disabled:opacity-60 ${
                    CHIP_COLORS[idx % CHIP_COLORS.length]
                  }`}
                  title={`Générer des idées depuis: ${g.title}`}
                >
                  {generating === g.id ? (
                    <Sparkles className="w-3 h-3 animate-pulse" />
                  ) : null}
                  {g.title}
                  <Badge
                    variant="secondary"
                    className={`text-[9px] h-3.5 px-1 ml-0.5 ${
                      g.status === "active"
                        ? "bg-green-200 text-green-800"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {g.status}
                  </Badge>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
