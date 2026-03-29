'use client';

/**
 * TasksView Component
 *
 * Full tasks view with Kanban board.
 * Integrates with tasks API for data management.
 */

import * as React from 'react';
import { TaskKanban } from '../tasks';
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from '@/lib/api/calendar';
import type { Task } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface TasksViewProps {
  className?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function TasksView({ className }: TasksViewProps) {
  const { data: tasks = [], isLoading } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    updateTask.mutate({ id: taskId, updates });
  };

  const handleTaskCreate = (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    createTask.mutate(task);
  };

  const handleTaskDelete = (taskId: string) => {
    deleteTask.mutate(taskId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">
          Chargement des tâches...
        </div>
      </div>
    );
  }

  return (
    <TaskKanban
      tasks={tasks}
      onTaskUpdate={handleTaskUpdate}
      onTaskCreate={handleTaskCreate}
      onTaskDelete={handleTaskDelete}
      isLoading={isLoading}
    />
  );
}

export default TasksView;
