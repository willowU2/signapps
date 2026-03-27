/**
 * Tasks Summary Widget
 *
 * Affiche les statistiques des tâches (counters).
 */

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, Clock, ListTodo } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetRenderProps } from "@/lib/dashboard/types";
import { calendarApi, tasksApi } from "@/lib/api/calendar";

interface TaskStats {
  total: number;
  completed: number;
  in_progress: number;
  blocked: number;
  overdue: number;
}

export function WidgetTasksSummary({ widget }: WidgetRenderProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["widget-tasks-summary"],
    queryFn: async (): Promise<TaskStats> => {
      // Fetch all calendars first, then aggregate tasks across all of them
      const calendarsRes = await calendarApi.listCalendars();
      const calendars = calendarsRes.data ?? [];

      const allTasksNested = await Promise.all(
        calendars.map((cal: { id: string }) =>
          tasksApi.listTasks(cal.id).then((r) => r.data ?? []).catch(() => [])
        )
      );
      const allTasks: Array<{ status: string; due_date?: string | null }> = allTasksNested.flat();

      const now = new Date();
      const total = allTasks.length;
      const completed = allTasks.filter((t) => t.status === "completed").length;
      const in_progress = allTasks.filter((t) => t.status === "in_progress").length;
      // "blocked" is not a native status — count tasks that are open and overdue as blocked
      const overdue = allTasks.filter(
        (t) =>
          t.status !== "completed" &&
          t.status !== "archived" &&
          t.due_date != null &&
          new Date(t.due_date) < now
      ).length;
      const blocked = 0; // no native blocked status in the data model

      return { total, completed, in_progress, blocked, overdue };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Résumé des Tâches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            Résumé des Tâches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-6 text-sm">
            Impossible de charger les statistiques
          </div>
        </CardContent>
      </Card>
    );
  }

  const completionRate = stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-primary" />
          Résumé des Tâches
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-4">
          {/* Completion Rate */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Taux de complétion
              </span>
              <span className="text-sm font-bold text-primary">
                {completionRate}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          {/* Counters Grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Total */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-primary">
                {stats.total}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Total
              </div>
            </div>

            {/* Completed */}
            <div className="bg-green-500/10 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-green-600">
                  {stats.completed}
                </div>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Complétées
              </div>
            </div>

            {/* In Progress */}
            <div className="bg-blue-500/10 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.in_progress}
                </div>
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                En cours
              </div>
            </div>

            {/* Blocked */}
            <div className="bg-red-500/10 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-red-600">
                  {stats.blocked}
                </div>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Bloquées
              </div>
            </div>
          </div>

          {/* Overdue Alert */}
          {stats.overdue > 0 && (
            <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-700 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>
                  <strong>{stats.overdue}</strong> tâche{stats.overdue > 1 ? "s" : ""} en
                  retard
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
