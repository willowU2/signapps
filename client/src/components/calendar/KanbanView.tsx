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
import { format, parseISO, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { useCalendarStore } from "@/stores/calendar-store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, Clock, Calendar, Flag, GripVertical } from "lucide-react";
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
  onCreateEvent?: (startTime?: Date, endTime?: Date) => void;
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
  onCreateEvent,
}: KanbanViewProps) {
  const storeItems = useCalendarStore((state) => state.timeItems);
  const isLoading = useCalendarStore((state) => state.isLoading);
  const fetchTimeItems = useCalendarStore((state) => state.fetchTimeItems);
  const currentDate = useCalendarStore((state) => state.currentDate);

  const items = propItems || storeItems;

  // Kanban view usually shows a wide range of tasks
  const dateRange = React.useMemo(
    () => ({
      start: addDays(currentDate, -30),
      end: addDays(currentDate, 90),
    }),
    [currentDate],
  );

  const rangeStartISO = dateRange.start.toISOString();
  const rangeEndISO = dateRange.end.toISOString();

  React.useEffect(() => {
    if (!propItems) {
      fetchTimeItems(dateRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propItems, rangeStartISO, rangeEndISO]);

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
            <KanbanColumnDroppable
              key={column.id}
              column={column}
              groupBy={groupBy}
              onCreateEvent={onCreateEvent}
              onItemClick={onItemClick}
              onItemDoubleClick={onItemDoubleClick}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// KanbanColumnDroppable Component
// ============================================================================

interface KanbanColumnDroppableProps {
  column: KanbanColumn;
  groupBy: "status" | "priority" | "assignee" | "project";
  onCreateEvent?: (startTime?: Date, endTime?: Date) => void;
  onItemClick?: (item: TimeItem) => void;
  onItemDoubleClick?: (item: TimeItem) => void;
}

/**
 * Droppable column for the Kanban board.
 *
 * Registers a `kanban-column` drop target with `@dnd-kit/core` so that tasks
 * dragged from any other calendar view (or from within the board itself)
 * can be dropped here. The actual status/priority mutation is handled by
 * `CalendarHub.handleDragEnd` via the `data` payload.
 */
function KanbanColumnDroppable({
  column,
  groupBy,
  onCreateEvent,
  onItemClick,
  onItemDoubleClick,
}: KanbanColumnDroppableProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `kanban-${groupBy}-${column.id}`,
    data: {
      type: "kanban-column",
      groupBy,
      columnId: column.id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      data-testid={`kanban-column-${column.id}`}
      className={cn(
        "flex flex-col w-72 flex-shrink-0 rounded-lg border bg-muted/30 transition-colors",
        isOver && "ring-2 ring-primary bg-primary/5",
      )}
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
          onClick={() => onCreateEvent?.()}
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
            />
          ))}

          {column.items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">Aucune tâche</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => onCreateEvent?.()}
              >
                <Plus className="mr-1 h-4 w-4" />
                Ajouter
              </Button>
            </div>
          )}
        </div>
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
}

/**
 * Draggable Kanban card.
 *
 * Uses `@dnd-kit/core`'s {@link useDraggable} so the card integrates with the
 * global DndContext from `CalendarHub`. Click & double-click stop propagation
 * so they don't trigger a drag start.
 */
function KanbanCard({ item, onClick, onDoubleClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { timeItem: item, type: "time-item" },
  });

  const dueDate = item.deadline
    ? typeof item.deadline === "string"
      ? parseISO(item.deadline)
      : item.deadline
    : null;

  const isOverdue = dueDate && dueDate < new Date() && item.status !== "done";

  return (
    <Card
      ref={setNodeRef}
      data-testid="kanban-card"
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all hover:shadow-md",
        isDragging && "opacity-50 rotate-2 scale-105",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick();
      }}
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
              {item.users.slice(0, 3).map((user) => (
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
