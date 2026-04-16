"use client";
import { SpinnerInfinity } from "spinners-react";

/**
 * KanbanView Component
 * Phase 5: Project Management
 *
 * Drag-and-drop Kanban board for task management.
 * Groups tasks by status with swimlanes.
 */

import * as React from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useSchedulingStore } from "@/stores/scheduling/scheduling-store";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Clock,
  Calendar,
  Flag,
  User,
  Tag,
  GripVertical,
} from "lucide-react";
import type { TimeItem, Status, Priority } from "@/lib/scheduling/types";

// ============================================================================
// Types
// ============================================================================

interface KanbanViewProps {
  className?: string;
  items?: TimeItem[];
  groupBy?: "status" | "priority" | "assignee" | "project";
  onItemClick?: (item: TimeItem) => void;
  onItemDoubleClick?: (item: TimeItem) => void;
  onCreateItem?: (column: string) => void;
}

interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
  items: TimeItem[];
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_COLUMNS: { id: Status; title: string; color: string }[] = [
  { id: "todo", title: "À faire", color: "bg-blue-500" },
  { id: "in_progress", title: "En cours", color: "bg-yellow-500" },
  { id: "done", title: "Terminé", color: "bg-green-500" },
  { id: "cancelled", title: "Annulé", color: "bg-gray-500" },
];

const PRIORITY_COLUMNS: { id: Priority; title: string; color: string }[] = [
  { id: "urgent", title: "Urgent", color: "bg-red-500" },
  { id: "high", title: "Haute", color: "bg-orange-500" },
  { id: "medium", title: "Moyenne", color: "bg-yellow-500" },
  { id: "low", title: "Basse", color: "bg-green-500" },
];

const PRIORITY_ICONS: Record<Priority, string> = {
  urgent: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-green-500",
};

// ============================================================================
// Component
// ============================================================================

export function KanbanView({
  className,
  items: propItems,
  groupBy = "status",
  onItemClick,
  onItemDoubleClick,
  onCreateItem,
}: KanbanViewProps) {
  const storeItems = useSchedulingStore((state) => state.timeItems);
  const isLoading = useSchedulingStore((state) => state.isLoading);
  const updateTimeItem = useSchedulingStore((state) => state.updateTimeItem);

  const items = propItems || storeItems;

  // Filter to only tasks
  const tasks = React.useMemo(
    () => items.filter((item) => item.type === "task"),
    [items],
  );

  // Build columns based on groupBy
  const columns = React.useMemo((): KanbanColumn[] => {
    switch (groupBy) {
      case "status":
        return STATUS_COLUMNS.map((col) => ({
          id: col.id,
          title: col.title,
          color: col.color,
          items: tasks.filter((task) => task.status === col.id),
        }));

      case "priority":
        return PRIORITY_COLUMNS.map((col) => ({
          id: col.id,
          title: col.title,
          color: col.color,
          items: tasks.filter((task) => task.priority === col.id),
        }));

      case "assignee":
        const assignees = new Map<string, TimeItem[]>();
        const unassigned: TimeItem[] = [];

        tasks.forEach((task) => {
          if (task.users && task.users.length > 0) {
            const userId = task.users[0].userId;
            if (!assignees.has(userId)) {
              assignees.set(userId, []);
            }
            assignees.get(userId)!.push(task);
          } else {
            unassigned.push(task);
          }
        });

        const cols: KanbanColumn[] = [
          { id: "unassigned", title: "Non assigné", items: unassigned },
        ];

        assignees.forEach((items, userId) => {
          cols.push({
            id: userId,
            title: items[0]?.users?.[0]?.userId || "Utilisateur",
            items,
          });
        });

        return cols;

      case "project":
        const projects = new Map<string, TimeItem[]>();
        const noProject: TimeItem[] = [];

        tasks.forEach((task) => {
          if (task.projectId) {
            if (!projects.has(task.projectId)) {
              projects.set(task.projectId, []);
            }
            projects.get(task.projectId)!.push(task);
          } else {
            noProject.push(task);
          }
        });

        const projectCols: KanbanColumn[] = [
          { id: "no-project", title: "Sans projet", items: noProject },
        ];

        projects.forEach((items, projectId) => {
          projectCols.push({
            id: projectId,
            title: projectId,
            items,
          });
        });

        return projectCols;

      default:
        return STATUS_COLUMNS.map((col) => ({
          id: col.id,
          title: col.title,
          color: col.color,
          items: tasks.filter((task) => task.status === col.id),
        }));
    }
  }, [tasks, groupBy]);

  // Drag and drop state
  const [draggedItem, setDraggedItem] = React.useState<TimeItem | null>(null);
  const [dragOverColumn, setDragOverColumn] = React.useState<string | null>(
    null,
  );

  const handleDragStart = (e: React.DragEvent, item: TimeItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.id);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedItem) return;

    // Update based on groupBy
    try {
      switch (groupBy) {
        case "status":
          await updateTimeItem(draggedItem.id, { status: columnId as Status });
          break;
        case "priority":
          await updateTimeItem(draggedItem.id, {
            priority: columnId as Priority,
          });
          break;
        // For assignee and project, more complex logic would be needed
      }
    } catch (error) {
      console.error("Failed to move item:", error);
    }

    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverColumn(null);
  };

  if (isLoading && tasks.length === 0) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="flex flex-col items-center gap-2">
          <SpinnerInfinity
            size={32}
            secondaryColor="rgba(128,128,128,0.2)"
            color="currentColor"
            speed={120}
          />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full", className)}>
      <ScrollArea className="h-full w-full">
        <div
          className="flex gap-4 p-4"
          style={{ minWidth: columns.length * 300 }}
        >
          {columns.map((column) => (
            <div
              key={column.id}
              className={cn(
                "flex flex-col w-72 flex-shrink-0 rounded-lg border bg-muted/30",
                dragOverColumn === column.id && "ring-2 ring-primary",
              )}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-2">
                  {column.color && (
                    <div className={cn("w-3 h-3 rounded-full", column.color)} />
                  )}
                  <h3 className="font-medium text-sm">{column.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {column.items.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onCreateItem?.(column.id)}
                  aria-label="Ajouter"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Column Content */}
              <ScrollArea className="flex-1 p-2">
                <div className="flex flex-col gap-2">
                  {column.items.map((item) => (
                    <KanbanCard
                      key={item.id}
                      item={item}
                      onClick={() => onItemClick?.(item)}
                      onDoubleClick={() => onItemDoubleClick?.(item)}
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedItem?.id === item.id}
                    />
                  ))}

                  {column.items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Aucune tâche
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => onCreateItem?.(column.id)}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Ajouter
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// KanbanCard Component
// ============================================================================

interface KanbanCardProps {
  item: TimeItem;
  onClick: () => void;
  onDoubleClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

function KanbanCard({
  item,
  onClick,
  onDoubleClick,
  onDragStart,
  onDragEnd,
  isDragging,
}: KanbanCardProps) {
  const dueDate = item.deadline
    ? typeof item.deadline === "string"
      ? parseISO(item.deadline)
      : item.deadline
    : null;

  const isOverdue = dueDate && dueDate < new Date() && item.status !== "done";

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isDragging && "opacity-50 rotate-2 scale-105",
      )}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <CardContent className="p-3">
        {/* Drag handle + Title */}
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 cursor-grab" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight truncate">
              {item.title}
            </p>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {item.description}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs px-1.5 py-0"
              >
                {tag}
              </Badge>
            ))}
            {item.tags.length > 3 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                +{item.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t">
          <div className="flex items-center gap-2">
            {/* Priority */}
            {item.priority && (
              <Flag
                className={cn(
                  "h-3.5 w-3.5",
                  PRIORITY_ICONS[item.priority] || "text-muted-foreground",
                )}
              />
            )}

            {/* Due date */}
            {dueDate && (
              <span
                className={cn(
                  "flex items-center gap-1 text-xs",
                  isOverdue ? "text-red-500" : "text-muted-foreground",
                )}
              >
                <Calendar className="h-3 w-3" />
                {format(dueDate, "d MMM", { locale: fr })}
              </span>
            )}

            {/* Estimated time */}
            {item.duration && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {item.duration}m
              </span>
            )}
          </div>

          {/* Assignees */}
          {item.users && item.users.length > 0 && (
            <div className="flex -space-x-2">
              {item.users.slice(0, 3).map((user, i) => (
                <Avatar
                  key={user.userId}
                  className="h-5 w-5 border-2 border-background"
                >
                  <AvatarFallback className="text-[10px]">
                    {user.userId.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {item.users.length > 3 && (
                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] border-2 border-background">
                  +{item.users.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default KanbanView;
