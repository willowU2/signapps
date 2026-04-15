/**
 * Tasks API Client
 *
 * React Query hooks for task management.
 * Integrates directly with the `signapps-calendar` backend microservice.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskStatus, Subtask, Priority } from "../types/scheduling";
import { getClient, ServiceName } from "@/lib/api/factory";

// ============================================================================
// Backend Mapping
// ============================================================================

interface BackendTask {
  id: string;
  calendar_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: string; // open|in_progress|completed|archived
  priority: number; // 0=low, 1=medium, 2=high, 3=urgent
  position: number;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendTaskNode {
  task: BackendTask;
  children: BackendTaskNode[];
}

function mapStatus(status: string): TaskStatus {
  switch (status) {
    case "in_progress":
      return "in-progress";
    case "completed":
    case "archived":
      return "done";
    case "open":
    default:
      return "backlog";
  }
}

function unmapStatus(status: TaskStatus | undefined): string {
  switch (status) {
    case "in-progress":
      return "in_progress";
    case "done":
      return "completed";
    case "today":
      return "open"; // or track 'today' differently via tags
    case "backlog":
    default:
      return "open";
  }
}

function mapPriority(prio: number): Priority {
  if (prio === 3) return "urgent";
  if (prio === 2) return "high";
  if (prio === 1) return "medium";
  return "low";
}

function unmapPriority(prio: Priority | undefined): number {
  if (prio === "urgent") return 3;
  if (prio === "high") return 2;
  if (prio === "medium") return 1;
  return 0; // low or default
}

function toFrontendTask(node: BackendTaskNode): Task {
  const t = node.task;

  // Basic mapping of backend children as subtasks
  const subtasks: Subtask[] = node.children.map((child) => ({
    id: child.task.id,
    title: child.task.title,
    completed:
      child.task.status === "completed" || child.task.status === "archived",
  }));

  return {
    id: t.id,
    type: "task",
    title: t.title,
    description: t.description || undefined,
    status: mapStatus(t.status),
    priority: mapPriority(t.priority),
    dueDate: t.due_date ? new Date(t.due_date) : undefined,
    completedAt: t.completed_at ? new Date(t.completed_at) : undefined,
    assigneeId: t.assigned_to || undefined,
    subtasks: subtasks,
    allDay: false,
    start: new Date(t.created_at), // Fallback start to created_at
    createdAt: new Date(t.created_at),
    updatedAt: new Date(t.updated_at),
  };
}

/**
 * Fetch the primary calendar id for the user
 */
async function getPrimaryCalendarId(): Promise<string> {
  const client = getClient(ServiceName.CALENDAR);
  const { data } = await client.get<any[]>("/calendars");
  if (!data || data.length === 0) {
    throw new Error("No calendar found for the current user.");
  }
  // Try to find default or just first
  // The 'is_primary' isn't explicitly in calendar model, but usually the first one is owned
  return data[0].id;
}

// ============================================================================
// Query Keys
// ============================================================================

export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, "detail"] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch all tasks
 */
export function useTasks() {
  return useQuery({
    queryKey: taskKeys.lists(),
    queryFn: async (): Promise<Task[]> => {
      const calendarId = await getPrimaryCalendarId();
      const client = getClient(ServiceName.CALENDAR);
      const res = await client.get<BackendTaskNode[]>(
        `/calendars/${calendarId}/tasks/tree`,
      );
      return res.data.map(toFrontendTask);
    },
  });
}

/**
 * Fetch a single task
 */
export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async (): Promise<Task | null> => {
      const client = getClient(ServiceName.CALENDAR);
      const res = await client.get<BackendTaskNode>(`/tasks/${id}`);
      if (!res.data) return null;
      return toFrontendTask(res.data);
    },
    enabled: !!id,
  });
}

/**
 * Create a new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Task, "id" | "createdAt" | "updatedAt">) => {
      const calendarId = await getPrimaryCalendarId();
      const client = getClient(ServiceName.CALENDAR);

      const payload = {
        title: data.title,
        description: data.description || null,
        priority: unmapPriority(data.priority),
        due_date: data.dueDate
          ? data.dueDate.toISOString().split("T")[0]
          : null,
        assigned_to: data.assigneeId || null,
        status: unmapStatus(data.status),
      };

      const res = await client.post<BackendTaskNode>(
        `/calendars/${calendarId}/tasks`,
        payload,
      );
      return toFrontendTask(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/**
 * Update an existing task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Task>;
    }) => {
      const client = getClient(ServiceName.CALENDAR);

      const payload: any = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined)
        payload.description = updates.description;
      if (updates.status !== undefined)
        payload.status = unmapStatus(updates.status);
      if (updates.priority !== undefined)
        payload.priority = unmapPriority(updates.priority);
      if (updates.dueDate !== undefined)
        payload.due_date = updates.dueDate
          ? updates.dueDate.toISOString().split("T")[0]
          : null;
      if (updates.assigneeId !== undefined)
        payload.assigned_to = updates.assigneeId;

      await client.put(`/tasks/${id}`, payload);
      // Wait, we just invalidate after, no need to return exact node since mutation output can just be void
      return { id, updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/**
 * Delete a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const client = getClient(ServiceName.CALENDAR);
      await client.delete(`/tasks/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/**
 * Reorder tasks (for drag and drop)
 * No bulk reorder in backend yet, we'll mimic this by updating positions individually
 */
export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tasks: Task[]) => {
      const client = getClient(ServiceName.CALENDAR);
      // We assume index in the array is the desired position
      // For simplicity/perf we only fire off updates for a few if needed,
      // But currently we'll blindly put to all of them using Promise.all
      // In a real prod environment we'd build a batch endpoint in rust
      await Promise.all(
        tasks.map((t, idx) => client.put(`/tasks/${t.id}`, { position: idx })),
      );
      return tasks;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}
