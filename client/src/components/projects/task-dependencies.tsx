"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, Trash2 } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaskDependency {
  id: string;
  title: string;
  blockedBy?: string; // task ID that blocks this one
}

interface TaskDependenciesProps {
  tasks: TaskDependency[];
  onDependencyChange?: (taskId: string, blockedBy?: string) => void;
  onTaskDelete?: (taskId: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SAMPLE_TASKS: TaskDependency[] = [
  { id: "1", title: "Design & Requirements" },
  { id: "2", title: "Backend Setup", blockedBy: "1" },
  { id: "3", title: "Frontend Components", blockedBy: "1" },
  { id: "4", title: "Testing & QA", blockedBy: "2" },
  { id: "5", title: "Deployment", blockedBy: "4" },
];

// ── Utilities ──────────────────────────────────────────────────────────────

function detectCycle(tasks: TaskDependency[], startId: string, targetId: string): boolean {
  if (startId === targetId) return true;

  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const task = tasks.find((t) => t.id === current);
    if (!task || !task.blockedBy) continue;

    if (task.blockedBy === targetId) return true;
    queue.push(task.blockedBy);
  }

  return false;
}

function buildDependencyPath(tasks: TaskDependency[], taskId: string): string[] {
  const path: string[] = [taskId];
  let current = taskId;

  while (true) {
    const task = tasks.find((t) => t.id === current);
    if (!task || !task.blockedBy) break;
    path.push(task.blockedBy);
    current = task.blockedBy;
  }

  return path;
}

// ── Dependency Selector Dropdown ────────────────────────────────────────────

interface DependencySelectorProps {
  task: TaskDependency;
  allTasks: TaskDependency[];
  onSelect: (blockedBy?: string) => void;
}

function DependencySelector({ task, allTasks, onSelect }: DependencySelectorProps) {
  const [open, setOpen] = useState(false);
  const availableTasks = allTasks.filter((t) => t.id !== task.id);

  const handleSelect = (taskId?: string) => {
    if (taskId && detectCycle(allTasks, task.id, taskId)) {
      toast.error("Impossible de définir la dépendance : créerait une dépendance circulaire");
      return;
    }
    onSelect(taskId);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 justify-between w-full max-w-xs"
        onClick={() => setOpen(!open)}
      >
        <span className="text-muted-foreground text-xs truncate">
          {task.blockedBy
            ? availableTasks.find((t) => t.id === task.blockedBy)?.title || "Unknown"
            : "No dependency"}
        </span>
        <ChevronDown className="size-3 shrink-0" />
      </Button>

      {open && (
        <div className="absolute top-full mt-1 left-0 w-64 bg-popover border rounded shadow-lg z-20">
          {/* Clear option */}
          <button
            onClick={() => handleSelect(undefined)}
            className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b text-muted-foreground"
          >
            No dependency
          </button>

          {/* Available tasks */}
          {availableTasks.length > 0 ? (
            availableTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t.id)}
                className={cn(
                  "w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0",
                  task.blockedBy === t.id && "bg-blue-50 font-semibold"
                )}
              >
                {t.title}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">No other tasks</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Cycle Detection Alert ──────────────────────────────────────────────────

interface CycleAlertProps {
  tasks: TaskDependency[];
  affectedTasks: string[];
}

function CycleAlert({ tasks, affectedTasks }: CycleAlertProps) {
  if (affectedTasks.length === 0) return null;

  const details = affectedTasks
    .map((id) => tasks.find((t) => t.id === id)?.title)
    .filter(Boolean)
    .join(" → ");

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50 text-red-900 text-sm">
      <AlertCircle className="size-4 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold">Circular Dependency Detected</p>
        <p className="text-xs mt-1">{details}</p>
      </div>
    </div>
  );
}

// ── Task Row ────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: TaskDependency;
  allTasks: TaskDependency[];
  onDependencyChange: (blockedBy?: string) => void;
  onDelete: () => void;
  hasCycle: boolean;
}

function TaskRow({
  task,
  allTasks,
  onDependencyChange,
  onDelete,
  hasCycle,
}: TaskRowProps) {
  const dependencyPath = task.blockedBy ? buildDependencyPath(allTasks, task.id) : [];

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 border-b hover:bg-muted/30 transition-colors",
        hasCycle && "bg-red-50"
      )}
    >
      <div className="flex-1">
        <p className="font-medium text-sm">{task.title}</p>
        {dependencyPath.length > 1 && (
          <p className="text-xs text-muted-foreground mt-1">
            Path: {dependencyPath.map((id) => allTasks.find((t) => t.id === id)?.title).join(" ← ")}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <DependencySelector
          task={task}
          allTasks={allTasks}
          onSelect={onDependencyChange}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          className="text-muted-foreground hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function TaskDependencies({
  tasks: initialTasks = SAMPLE_TASKS,
  onDependencyChange,
  onTaskDelete,
}: TaskDependenciesProps) {
  const [tasks, setTasks] = useState(initialTasks);

  const cycleTaskIds = useMemo(() => {
    const cycles: string[] = [];
    for (const task of tasks) {
      if (!task.blockedBy) continue;
      if (detectCycle(tasks, task.id, task.blockedBy)) {
        cycles.push(task.id);
      }
    }
    return cycles;
  }, [tasks]);

  const handleDependencyChange = (taskId: string, blockedBy?: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, blockedBy } : t))
    );
    onDependencyChange?.(taskId, blockedBy);
  };

  const handleTaskDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    onTaskDelete?.(taskId);
  };

  return (
    <div className="w-full border rounded-lg overflow-hidden bg-background">
      {/* Header */}
      <div className="p-4 border-b bg-muted/30">
        <h3 className="font-semibold">Task Dependencies</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Manage task blocking relationships. Circular dependencies are detected automatically.
        </p>
      </div>

      {/* Cycle alert */}
      {cycleTaskIds.length > 0 && (
        <div className="p-4 border-b">
          <CycleAlert tasks={tasks} affectedTasks={cycleTaskIds} />
        </div>
      )}

      {/* Task list */}
      <div className="divide-y">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            allTasks={tasks}
            onDependencyChange={(blockedBy) => handleDependencyChange(task.id, blockedBy)}
            onDelete={() => handleTaskDelete(task.id)}
            hasCycle={cycleTaskIds.includes(task.id)}
          />
        ))}
      </div>

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          <p className="text-sm">No tasks yet</p>
        </div>
      )}
    </div>
  );
}
