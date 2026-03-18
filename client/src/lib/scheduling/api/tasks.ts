/**
 * Tasks API Client
 *
 * React Query hooks for task management.
 * Uses local storage for MVP, will integrate with backend later.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Task, TaskStatus } from '../types/scheduling';

// ============================================================================
// Storage Key
// ============================================================================

const TASKS_STORAGE_KEY = 'scheduling-tasks';

// ============================================================================
// Local Storage Helpers
// ============================================================================

function getStoredTasks(): Task[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!stored) return getDefaultTasks();
    return JSON.parse(stored).map((t: Task) => ({
      ...t,
      start: new Date(t.start),
      end: t.end ? new Date(t.end) : undefined,
      dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
      completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
      createdAt: new Date(t.createdAt),
      updatedAt: new Date(t.updatedAt),
    }));
  } catch {
    return getDefaultTasks();
  }
}

function setStoredTasks(tasks: Task[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

// ============================================================================
// Default Tasks (Demo Data)
// ============================================================================

function getDefaultTasks(): Task[] {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return [
    {
      id: 'task-1',
      type: 'task',
      title: 'Réviser le document de spécifications',
      description: 'Relire et valider les spécifications du projet avant la réunion.',
      status: 'today',
      priority: 'high',
      dueDate: now,
      estimatedMinutes: 60,
      tags: ['documentation', 'urgent'],
      subtasks: [
        { id: 'st-1', title: 'Lire la section technique', completed: true },
        { id: 'st-2', title: 'Vérifier les diagrammes', completed: false },
        { id: 'st-3', title: 'Ajouter mes commentaires', completed: false },
      ],
      allDay: false,
      start: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-2',
      type: 'task',
      title: 'Préparer la présentation client',
      description: 'Créer les slides pour la démo de vendredi.',
      status: 'in-progress',
      priority: 'urgent',
      dueDate: tomorrow,
      estimatedMinutes: 120,
      tags: ['présentation', 'client'],
      allDay: false,
      start: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-3',
      type: 'task',
      title: 'Corriger le bug de connexion',
      description: 'Les utilisateurs rapportent des problèmes de déconnexion aléatoire.',
      status: 'today',
      priority: 'high',
      estimatedMinutes: 90,
      tags: ['bug', 'auth'],
      allDay: false,
      start: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-4',
      type: 'task',
      title: 'Mettre à jour les dépendances',
      description: 'npm audit a détecté des vulnérabilités.',
      status: 'backlog',
      priority: 'medium',
      tags: ['maintenance', 'sécurité'],
      allDay: false,
      start: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-5',
      type: 'task',
      title: 'Écrire les tests unitaires',
      description: 'Couvrir les nouveaux composants du module scheduling.',
      status: 'backlog',
      priority: 'low',
      dueDate: nextWeek,
      estimatedMinutes: 180,
      tags: ['tests', 'qualité'],
      allDay: false,
      start: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'task-6',
      type: 'task',
      title: 'Refactoriser le module de notifications',
      status: 'done',
      priority: 'medium',
      completedAt: now,
      tags: ['refactoring'],
      allDay: false,
      start: now,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// ============================================================================
// Query Keys
// ============================================================================

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
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
    queryFn: () => getStoredTasks(),
  });
}

/**
 * Fetch a single task
 */
export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => {
      const tasks = getStoredTasks();
      return tasks.find((t) => t.id === id) ?? null;
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
    mutationFn: async (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      const tasks = getStoredTasks();
      const now = new Date();
      const newTask: Task = {
        ...data,
        id: `task-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      tasks.push(newTask);
      setStoredTasks(tasks);
      return newTask;
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
      const tasks = getStoredTasks();
      const index = tasks.findIndex((t) => t.id === id);
      if (index === -1) throw new Error('Task not found');

      const updatedTask: Task = {
        ...tasks[index],
        ...updates,
        updatedAt: new Date(),
      };
      tasks[index] = updatedTask;
      setStoredTasks(tasks);
      return updatedTask;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      const previous = queryClient.getQueryData<Task[]>(taskKeys.lists());

      queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t))
      );

      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.lists(), context.previous);
      }
    },
    onSettled: () => {
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
      const tasks = getStoredTasks();
      const filtered = tasks.filter((t) => t.id !== id);
      setStoredTasks(filtered);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      const previous = queryClient.getQueryData<Task[]>(taskKeys.lists());

      queryClient.setQueryData<Task[]>(taskKeys.lists(), (old) =>
        old?.filter((t) => t.id !== id)
      );

      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.lists(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/**
 * Reorder tasks (for drag and drop)
 */
export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tasks: Task[]) => {
      setStoredTasks(tasks);
      return tasks;
    },
    onMutate: async (tasks) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      const previous = queryClient.getQueryData<Task[]>(taskKeys.lists());
      queryClient.setQueryData(taskKeys.lists(), tasks);
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.lists(), context.previous);
      }
    },
  });
}
