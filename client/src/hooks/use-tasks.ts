//! Hook for task data management

import { useCallback, useState } from "react";

interface Task {
  id: string;
  calendar_id: string;
  parent_task_id?: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "completed" | "archived";
  priority: number;
  due_date?: string;
  assigned_to?: string;
  created_by: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskRequest {
  parent_task_id?: string;
  title: string;
  description?: string;
  priority?: number;
  due_date?: string;
  assigned_to?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: string;
  priority?: number;
  due_date?: string;
  assigned_to?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";

export function useTasks(calendarId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTask = useCallback(
    async (data: CreateTaskRequest) => {
      if (!calendarId) throw new Error("Calendar ID required");

      try {
        setError(null);
        const response = await fetch(`${API_BASE}/calendars/${calendarId}/tasks`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error("Impossible de créer task");
        return await response.json();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Impossible de créer task";
        setError(message);
        throw err;
      }
    },
    [calendarId]
  );

  const updateTask = useCallback(async (id: string, data: UpdateTaskRequest) => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/tasks/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Impossible de mettre à jour task");
      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de mettre à jour task";
      setError(message);
      throw err;
    }
  }, []);

  const moveTask = useCallback(
    async (id: string, newParentId?: string) => {
      try {
        setError(null);
        const response = await fetch(`${API_BASE}/tasks/${id}/move`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ new_parent_id: newParentId || null }),
        });

        if (!response.ok) throw new Error("Failed to move task");
        return await response.json();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to move task";
        setError(message);
        throw err;
      }
    },
    []
  );

  const completeTask = useCallback(async (id: string) => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/tasks/${id}/complete`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to complete task");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete task";
      setError(message);
      throw err;
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/tasks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) throw new Error("Impossible de supprimer task");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de supprimer task";
      setError(message);
      throw err;
    }
  }, []);

  const getTaskTree = useCallback(
    async (id: string) => {
      if (!calendarId) throw new Error("Calendar ID required");

      try {
        setIsLoading(true);
        const response = await fetch(`${API_BASE}/calendars/${calendarId}/tasks/tree`, {
          credentials: "include",
        });

        if (!response.ok) throw new Error("Failed to fetch task tree");
        return await response.json();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch task tree";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [calendarId]
  );

  return {
    isLoading,
    error,
    createTask,
    updateTask,
    moveTask,
    completeTask,
    deleteTask,
    getTaskTree,
  };
}
