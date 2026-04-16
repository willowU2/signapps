"use client";

// IDEA-130: Custom Kanban columns — user-defined columns, drag-and-drop cards

import React, { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTasks, useUpdateTask } from "@/lib/scheduling/api/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/scheduling/types/scheduling";
import { TaskSheet } from "./TaskSheet";

const CUSTOM_COLUMNS_KEY = "kanban_custom_columns";

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "backlog", title: "Backlog", color: "bg-slate-500" },
  { id: "today", title: "Aujourd'hui", color: "bg-blue-500" },
  { id: "in-progress", title: "En cours", color: "bg-orange-500" },
  { id: "done", title: "Terminé", color: "bg-green-500" },
];

const COLUMN_COLORS = [
  "bg-slate-500",
  "bg-blue-500",
  "bg-orange-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-red-500",
];

function loadColumns(): KanbanColumn[] {
  try {
    const raw = localStorage.getItem(CUSTOM_COLUMNS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function saveColumns(columns: KanbanColumn[]) {
  localStorage.setItem(CUSTOM_COLUMNS_KEY, JSON.stringify(columns));
}

// ─── Mini Task Card ───────────────────────────────────────────────────────────

function KanbanCard({ task, onClick }: { task: Task; onClick?: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "Task", task },
  });

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className="h-16 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/50 opacity-50"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-background p-3 rounded-lg border shadow-sm cursor-grab hover:shadow-md hover:border-blue-200 transition-all active:cursor-grabbing"
    >
      <p className="text-sm font-medium truncate">{task.title}</p>
      {task.dueDate && (
        <p
          className={cn(
            "text-xs mt-1",
            task.dueDate < new Date()
              ? "text-red-500"
              : "text-muted-foreground",
          )}
        >
          {task.dueDate.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
          })}
        </p>
      )}
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

interface KanbanColumnComponentProps {
  column: KanbanColumn;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onRenameColumn: (id: string, title: string) => void;
  onDeleteColumn: (id: string) => void;
  canDelete: boolean;
}

function KanbanColumnComponent({
  column,
  tasks,
  onTaskClick,
  onRenameColumn,
  onDeleteColumn,
  canDelete,
}: KanbanColumnComponentProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "Column" },
  });
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);

  const commitRename = () => {
    if (editTitle.trim()) onRenameColumn(column.id, editTitle.trim());
    setEditing(false);
  };

  return (
    <div className="w-72 flex-shrink-0 flex flex-col bg-background/50 border rounded-xl overflow-hidden shadow-sm h-full max-h-full">
      <div className="px-3 py-2.5 border-b flex items-center gap-2 bg-black/[0.03]">
        <div className={`h-3 w-3 rounded-full flex-shrink-0 ${column.color}`} />

        {editing ? (
          <>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
              className="h-6 text-sm flex-1 border-0 shadow-none p-0 focus-visible:ring-0"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5"
              onClick={commitRename}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5"
              onClick={() => setEditing(false)}
              aria-label="Fermer"
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <>
            <h3 className="font-semibold text-sm flex-1 truncate">
              {column.title}
            </h3>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
              {tasks.length}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:opacity-100"
              onClick={() => setEditing(true)}
              aria-label="Modifier"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            {canDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100 hover:opacity-100"
                onClick={() => onDeleteColumn(column.id)}
                aria-label="Supprimer"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2.5 overflow-y-auto space-y-2 transition-colors",
          isOver && "bg-blue-50/30",
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

interface CustomKanbanBoardProps {
  projectId?: string;
}

export function CustomKanbanBoard({ projectId }: CustomKanbanBoardProps) {
  const { data: allTasks = [], isLoading } = useTasks();
  const updateTask = useUpdateTask();
  const [columns, setColumns] = useState<KanbanColumn[]>(loadColumns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");
  const [newColColor, setNewColColor] = useState(COLUMN_COLORS[0]);

  const tasks = projectId
    ? allTasks.filter((t) => t.projectId === projectId)
    : allTasks;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const updateColumns = useCallback((next: KanbanColumn[]) => {
    setColumns(next);
    saveColumns(next);
  }, []);

  const addColumn = () => {
    if (!newColTitle.trim()) return;
    const next = [
      ...columns,
      {
        id: `col_${Date.now()}`,
        title: newColTitle.trim(),
        color: newColColor,
      },
    ];
    updateColumns(next);
    setNewColTitle("");
    setAddingColumn(false);
  };

  const renameColumn = (id: string, title: string) => {
    updateColumns(columns.map((c) => (c.id === id ? { ...c, title } : c)));
  };

  const deleteColumn = (id: string) => {
    updateColumns(columns.filter((c) => c.id !== id));
  };

  const handleDragStart = (e: DragStartEvent) =>
    setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overColumn = columns.find((c) => c.id === over.id);
    const overTask = tasks.find((t) => t.id === over.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targetStatus: any = overColumn?.id ?? overTask?.status;

    if (targetStatus && targetStatus !== activeTask.status) {
      updateTask.mutate({
        id: activeTask.id,
        updates: { status: targetStatus },
      });
    }
  };

  const activeTask = tasks.find((t) => t.id === activeId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Chargement…
      </div>
    );
  }

  return (
    <div className="flex h-full w-full gap-3 overflow-x-auto p-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {columns.map((col) => (
          <div key={col.id} className="group">
            <KanbanColumnComponent
              column={col}
              tasks={tasks.filter((t) => t.status === col.id)}
              onTaskClick={(task) => {
                setSelectedTask(task);
                setSheetOpen(true);
              }}
              onRenameColumn={renameColumn}
              onDeleteColumn={deleteColumn}
              canDelete={columns.length > 1}
            />
          </div>
        ))}

        {/* Add column */}
        <div className="w-72 flex-shrink-0">
          {addingColumn ? (
            <div className="flex flex-col gap-2 p-3 rounded-xl border bg-background/50 shadow-sm">
              <Input
                autoFocus
                placeholder="Nom de la colonne…"
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addColumn();
                  if (e.key === "Escape") setAddingColumn(false);
                }}
                className="h-8"
              />
              <div className="flex flex-wrap gap-1.5">
                {COLUMN_COLORS.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                      c,
                      newColColor === c
                        ? "border-foreground scale-110"
                        : "border-transparent",
                    )}
                    onClick={() => setNewColColor(c)}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-7" onClick={addColumn}>
                  Ajouter
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => setAddingColumn(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="w-full h-10 border-2 border-dashed text-muted-foreground hover:text-foreground"
              onClick={() => setAddingColumn(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Ajouter une colonne
            </Button>
          )}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="bg-background p-3 rounded-lg border shadow-xl rotate-2 scale-105">
              <p className="text-sm font-medium">{activeTask.title}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <TaskSheet
        task={selectedTask}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
