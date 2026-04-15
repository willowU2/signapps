/**
 * Active Tasks Widget (AQ-DASHWID)
 *
 * Shows the count of in-progress tasks with a link to /scheduler.
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare, Clock, ArrowRight, AlertCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { calendarApi, tasksApi } from "@/lib/api/calendar";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string;
}

export function WidgetActiveTasks({ widget }: WidgetRenderProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["widget-active-tasks"],
    queryFn: async () => {
      const calendarsResponse = await calendarApi.listCalendars();
      const calendars = calendarsResponse.data || [];

      const allTasks: TaskItem[] = [];
      for (const cal of calendars) {
        try {
          const tasksResponse = await tasksApi.listTasks(cal.id);
          const calTasks = (tasksResponse.data || []) as TaskItem[];
          allTasks.push(...calTasks);
        } catch {
          // Skip calendars that fail
        }
      }

      const inProgress = allTasks.filter((t) => t.status === "in_progress");
      const overdue = allTasks.filter(
        (t) =>
          t.status !== "done" &&
          t.due_date &&
          new Date(t.due_date) < new Date(),
      );

      return {
        inProgressCount: inProgress.length,
        overdueCount: overdue.length,
        total: allTasks.filter((t) => t.status !== "done").length,
      };
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Tâches actives
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-20" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  const inProgressCount = data?.inProgressCount ?? 0;
  const overdueCount = data?.overdueCount ?? 0;
  const total = data?.total ?? 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          Tâches actives
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-between gap-4">
        <div className="space-y-2">
          {/* In-progress count — the main metric */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600 leading-none">
                {inProgressCount}
              </div>
              <div className="text-xs text-muted-foreground">en cours</div>
            </div>
          </div>

          {/* Secondary info row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {total} tâche{total !== 1 ? "s" : ""} ouvertes
            </span>
            {overdueCount > 0 && (
              <Badge
                variant="destructive"
                className="gap-1 text-[10px] h-4 px-1"
              >
                <AlertCircle className="h-2.5 w-2.5" />
                {overdueCount} en retard
              </Badge>
            )}
          </div>
        </div>

        <Button asChild size="sm" variant="outline" className="shrink-0 gap-1">
          <Link href="/scheduler">
            Voir
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
