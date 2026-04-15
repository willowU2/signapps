import React, { useMemo } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Task, TaskStatus } from "@/lib/scheduling/types/scheduling";
import { TaskCard } from "./TaskCard";

interface TaskColumnProps {
  column: {
    id: TaskStatus;
    title: string;
  };
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

export function TaskColumn({ column, tasks, onTaskClick }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
  });

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-background/50 border rounded-xl overflow-hidden shadow-sm h-full max-h-full">
      <div className="px-4 py-3 border-b flex items-center justify-between bg-black/[0.03]">
        <h3 className="font-semibold text-sm tracking-tight text-foreground">
          {column.title}
        </h3>
        <span className="text-xs text-muted-foreground font-bold bg-background px-2 py-0.5 rounded border shadow-sm">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 p-3 overflow-y-auto space-y-3 bg-black/[0.015] transition-colors ${
          isOver ? "bg-primary/5" : ""
        }`}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
