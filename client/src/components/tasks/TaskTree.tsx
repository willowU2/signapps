"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/hooks/use-tasks";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: number;
  due_date?: string;
  assigned_to?: string;
}

interface TaskNode {
  task: Task;
  children: TaskNode[];
}

interface TaskTreeProps {
  calendarId: string;
  onTaskSelect?: (task: Task) => void;
  onAddChild?: (parentId: string) => void;
}

const PRIORITY_COLORS: Record<number, string> = {
  0: "text-gray-500",    // Low
  1: "text-blue-500",    // Medium
  2: "text-orange-500",  // High
  3: "text-red-500",     // Urgent
};

const PRIORITY_LABELS: Record<number, string> = {
  0: "Low",
  1: "Medium",
  2: "High",
  3: "Urgent",
};

interface TaskItemProps {
  node: TaskNode;
  level: number;
  onTaskSelect?: (task: Task) => void;
  onAddChild?: (parentId: string) => void;
  onDelete?: (taskId: string) => void;
}

function TaskItem({
  node,
  level,
  onTaskSelect,
  onAddChild,
  onDelete,
}: TaskItemProps) {
  const [expanded, setExpanded] = useState(level < 2); // Expand first 2 levels
  const hasChildren = node.children.length > 0;

  const priorityColor = PRIORITY_COLORS[node.task.priority] || PRIORITY_COLORS[0];
  const isCompleted = node.task.status === "completed";

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded hover:bg-gray-100 group ${
          isCompleted ? "opacity-60" : ""
        }`}
        style={{ paddingLeft: `${12 + level * 20}px` }}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-0.5 hover:bg-gray-200 rounded"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={() => {}}
          className="w-4 h-4 flex-shrink-0"
        />

        {/* Task title */}
        <div
          className="flex-1 cursor-pointer"
          onClick={() => onTaskSelect?.(node.task)}
        >
          <span
            className={`font-medium ${
              isCompleted ? "line-through text-gray-500" : ""
            }`}
          >
            {node.task.title}
          </span>
        </div>

        {/* Priority badge */}
        <span className={`text-xs font-semibold ${priorityColor}`}>
          {PRIORITY_LABELS[node.task.priority]}
        </span>

        {/* Due date */}
        {node.task.due_date && (
          <span className="text-xs text-gray-500">
            {format(new Date(node.task.due_date), "MMM d")}
          </span>
        )}

        {/* Action buttons */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onAddChild?.(node.task.id)}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-red-500 hover:text-red-700"
            onClick={() => onDelete?.(node.task.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TaskItem
              key={child.task.id}
              node={child}
              level={level + 1}
              onTaskSelect={onTaskSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskTree({
  calendarId,
  onTaskSelect,
  onAddChild,
}: TaskTreeProps) {
  const [tree, setTree] = useState<TaskNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getTaskTree, deleteTask } = useTasks(calendarId);

  useEffect(() => {
    const loadTree = async () => {
      try {
        setIsLoading(true);
        const data = await getTaskTree(calendarId);
        setTree(data);
      } catch (error) {
        console.error("Failed to load task tree:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTree();
  }, [calendarId, getTaskTree]);

  const handleDelete = async (taskId: string) => {
    if (!confirm("Delete task and all subtasks?")) return;

    try {
      await deleteTask(taskId);
      // Reload tree
      const data = await getTaskTree(calendarId);
      setTree(data);
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  if (isLoading) {
    return <div className="text-center text-gray-500 py-4">Loading tasks...</div>;
  }

  if (tree.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No tasks yet. Create your first task to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tree.map((node) => (
        <TaskItem
          key={node.task.id}
          node={node}
          level={0}
          onTaskSelect={onTaskSelect}
          onAddChild={onAddChild}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}
