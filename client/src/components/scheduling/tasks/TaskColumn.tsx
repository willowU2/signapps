"use client";

/**
 * TaskColumn Component
 *
 * A single column in the Kanban board.
 * Supports drag and drop of task cards.
 */

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskCard } from "./TaskCard";
import type { Task, TaskStatus } from "@/lib/scheduling/types/scheduling";

// ============================================================================
// Types
// ============================================================================

interface TaskColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  color?: string;
  icon?: React.ReactNode;
  onAddTask?: (status: TaskStatus) => void;
  onTaskClick?: (task: Task) => void;
  onTaskComplete?: (taskId: string) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskEdit?: (task: Task) => void;
  onClearColumn?: (status: TaskStatus) => void;
}

// ============================================================================
// Column Config
// ============================================================================

export const columnConfig: Record<
  TaskStatus,
  { title: string; color: string; emoji: string }
> = {
  backlog: {
    title: "Backlog",
    color: "border-slate-300",
    emoji: "📋",
  },
  today: {
    title: "Aujourd'hui",
    color: "border-blue-400",
    emoji: "🎯",
  },
  "in-progress": {
    title: "En cours",
    color: "border-amber-400",
    emoji: "🔄",
  },
  done: {
    title: "Terminé",
    color: "border-green-400",
    emoji: "✅",
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function TaskColumn({
  id,
  title,
  tasks,
  color,
  icon,
  onAddTask,
  onTaskClick,
  onTaskComplete,
  onTaskDelete,
  onTaskEdit,
  onClearColumn,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: "column", status: id },
  });

  const config = columnConfig[id];
  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      className={cn(
        "flex flex-col bg-muted/30 rounded-xl min-w-[280px] max-w-[320px] w-full",
        "border-t-4",
        color ?? config.color,
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon ?? config.emoji}</span>
          <h3 className="font-semibold text-sm">{title ?? config.title}</h3>
          <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onAddTask?.(id)}
            aria-label="Ajouter"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Plus d'actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAddTask?.(id)}>
                Ajouter une tâche
              </DropdownMenuItem>
              {id === "done" && tasks.length > 0 && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onClearColumn?.(id)}
                >
                  Vider la colonne
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 transition-colors rounded-b-xl",
          isOver && "bg-primary/5 ring-2 ring-primary/20 ring-inset",
        )}
      >
        <ScrollArea className="h-[calc(100vh-220px)]">
          <SortableContext
            items={taskIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2 p-3 pt-1">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={onTaskClick}
                  onComplete={onTaskComplete}
                  onDelete={onTaskDelete}
                  onEdit={onTaskEdit}
                />
              ))}

              {/* Empty State */}
              {tasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-sm text-muted-foreground">Aucune tâche</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => onAddTask?.(id)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>
    </div>
  );
}

export default TaskColumn;
