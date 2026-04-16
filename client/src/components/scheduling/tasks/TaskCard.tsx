"use client";

/**
 * TaskCard Component
 *
 * Draggable task card for Kanban board.
 * Shows task title, priority, due date, assignee, and subtask progress.
 */

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Flag,
  GripVertical,
  MoreHorizontal,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Task, Priority } from "@/lib/scheduling/types/scheduling";

// ============================================================================
// Types
// ============================================================================

interface TaskCardProps {
  task: Task;
  onClick?: (task: Task) => void;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onEdit?: (task: Task) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
}

// ============================================================================
// Priority Badge
// ============================================================================

const priorityConfig: Record<Priority, { color: string; label: string }> = {
  low: { color: "bg-slate-100 text-slate-600", label: "Basse" },
  medium: { color: "bg-blue-100 text-blue-600", label: "Moyenne" },
  high: { color: "bg-orange-100 text-orange-600", label: "Haute" },
  urgent: { color: "bg-red-100 text-red-600", label: "Urgente" },
};

function PriorityBadge({ priority }: { priority: Priority }) {
  const config = priorityConfig[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
        config.color,
      )}
    >
      <Flag className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// ============================================================================
// Due Date Display
// ============================================================================

function DueDateBadge({ date }: { date: Date }) {
  const isOverdue = isPast(date) && !isToday(date);
  const isDueToday = isToday(date);
  const isDueTomorrow = isTomorrow(date);

  let label: string;
  if (isDueToday) {
    label = "Aujourd'hui";
  } else if (isDueTomorrow) {
    label = "Demain";
  } else {
    label = format(date, "d MMM", { locale: fr });
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs",
        isOverdue && "bg-red-100 text-red-600",
        isDueToday && "bg-amber-100 text-amber-600",
        isDueTomorrow && "bg-blue-100 text-blue-600",
        !isOverdue &&
          !isDueToday &&
          !isDueTomorrow &&
          "bg-muted text-muted-foreground",
      )}
    >
      <Calendar className="h-3 w-3" />
      {label}
    </span>
  );
}

// ============================================================================
// Subtask Progress
// ============================================================================

function SubtaskProgress({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {completed}/{total}
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskCard({
  task,
  onClick,
  onComplete,
  onDelete,
  onEdit,
  isDragging,
  isOverlay,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCompleted = task.status === "done";
  const completedSubtasks =
    task.subtasks?.filter((s) => s.completed).length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  const handleCheckboxChange = (checked: boolean) => {
    if (checked && onComplete) {
      onComplete(task.id);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger click when interacting with checkbox or dropdown
    if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) {
      return;
    }
    onClick?.(task);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border bg-card p-3 shadow-sm transition-all",
        "hover:shadow-md hover:border-primary/20",
        (isDragging || isSortableDragging) && "opacity-50 shadow-lg rotate-2",
        isOverlay && "shadow-xl rotate-3 cursor-grabbing",
        isCompleted && "opacity-60",
      )}
      onClick={handleCardClick}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded cursor-grab",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "hover:bg-muted",
        )}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="pl-5">
        {/* Header: Checkbox + Title + Menu */}
        <div className="flex items-start gap-2">
          <Checkbox
            checked={isCompleted}
            onCheckedChange={handleCheckboxChange}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <h4
              className={cn(
                "font-medium text-sm leading-tight",
                isCompleted && "line-through text-muted-foreground",
              )}
            >
              {task.title}
            </h4>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                aria-label="Plus d'actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(task)}>
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onComplete?.(task.id)}>
                {isCompleted ? "Marquer non terminée" : "Marquer terminée"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete?.(task.id)}
              >
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {task.priority && task.priority !== "medium" && (
            <PriorityBadge priority={task.priority} />
          )}
          {task.dueDate && <DueDateBadge date={new Date(task.dueDate)} />}
          {task.estimatedMinutes && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {task.estimatedMinutes}min
            </span>
          )}
        </div>

        {/* Subtask Progress */}
        {totalSubtasks > 0 && (
          <div className="mt-3">
            <SubtaskProgress
              completed={completedSubtasks}
              total={totalSubtasks}
            />
          </div>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {task.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{task.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Assignee */}
        {task.assigneeId && (
          <div className="flex items-center gap-2 mt-3 pt-2 border-t">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-xs">
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">Assignée</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Compact Variant
// ============================================================================

export function TaskCardCompact({
  task,
  onClick,
  onComplete,
}: Pick<TaskCardProps, "task" | "onClick" | "onComplete">) {
  const isCompleted = task.status === "done";

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors",
        isCompleted && "opacity-60",
      )}
      onClick={() => onClick?.(task)}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={(checked) => checked && onComplete?.(task.id)}
        onClick={(e) => e.stopPropagation()}
      />
      <span
        className={cn(
          "flex-1 text-sm truncate",
          isCompleted && "line-through text-muted-foreground",
        )}
      >
        {task.title}
      </span>
      {task.priority === "urgent" && <Flag className="h-3 w-3 text-red-500" />}
      {task.priority === "high" && <Flag className="h-3 w-3 text-orange-500" />}
    </div>
  );
}

export default TaskCard;
