/**
 * Recent Tasks Widget
 *
 * Affiche les tâches récentes de l'utilisateur.
 */

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare, Circle, Clock, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { calendarApi, tasksApi } from "@/lib/api/calendar";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

const statusConfig = {
  todo: { label: "À faire", color: "bg-slate-500", icon: Circle },
  in_progress: { label: "En cours", color: "bg-blue-500", icon: Clock },
  done: { label: "Terminé", color: "bg-green-500", icon: CheckSquare },
  blocked: { label: "Bloqué", color: "bg-red-500", icon: AlertCircle },
};

const priorityConfig = {
  low: { label: "Basse", variant: "secondary" as const },
  medium: { label: "Moyenne", variant: "default" as const },
  high: { label: "Haute", variant: "destructive" as const },
  urgent: { label: "Urgente", variant: "destructive" as const },
};

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string;
  project_id?: string;
}

export function WidgetRecentTasks({ widget }: WidgetRenderProps) {
  const config = widget.config as {
    limit?: number;
    showCompleted?: boolean;
    filterStatus?: string;
  };
  const limit = config.limit || 5;
  const showCompleted = config.showCompleted || false;
  const filterStatus = config.filterStatus || "all";

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["widget-tasks", limit, showCompleted, filterStatus],
    queryFn: async () => {
      // First get user's calendars
      const calendarsResponse = await calendarApi.listCalendars();
      const calendars = calendarsResponse.data || [];
      if (calendars.length === 0) return [];

      // Get tasks from all calendars
      const allTasks: TaskItem[] = [];
      for (const cal of calendars) {
        try {
          const tasksResponse = await tasksApi.listTasks(cal.id);
          const calTasks = (tasksResponse.data || []) as TaskItem[];
          allTasks.push(...calTasks);
        } catch {
          // Skip calendars that fail to load tasks
        }
      }

      let items = allTasks;

      // Filter by status
      if (filterStatus !== "all") {
        items = items.filter((t) => t.status === filterStatus);
      }

      // Filter completed
      if (!showCompleted) {
        items = items.filter((t) => t.status !== "done");
      }

      return items.slice(0, limit);
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Tâches Récentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          Tâches Récentes
          {tasks && tasks.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {tasks.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          {!tasks || tasks.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Aucune tâche
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.todo;
                const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.medium;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-2 shrink-0 ${status.color}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {task.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={priority.variant} className="text-[10px] h-4">
                          {priority.label}
                        </Badge>
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(task.due_date), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
