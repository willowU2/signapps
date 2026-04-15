/**
 * Unified Scheduling System - Main Zustand Store
 * Story 1.1.3: Scheduling Zustand Store
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  TimeItem,
  Scope,
  TimeItemType,
  Priority,
  Status,
  CreateTimeItemInput,
  UpdateTimeItemInput,
  DateRange,
} from "@/lib/scheduling/types";
import { schedulingApi } from "@/lib/scheduling/api";

// ============================================================================
// STATE INTERFACE
// ============================================================================

interface Filters {
  types: TimeItemType[];
  priorities: Priority[];
  statuses: Status[];
  projectIds: string[];
  tags: string[];
  search: string;
}

export interface SchedulingState {
  // Data
  timeItems: TimeItem[];
  selectedItem: TimeItem | null;

  // Filters
  scope: Scope | "all";
  dateRange: DateRange | null;
  filters: Filters;

  // UI State
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Optimistic updates tracking
  pendingUpdates: Map<string, Partial<TimeItem>>;

  // Actions
  fetchTimeItems: (range: DateRange, scope?: Scope | "all") => Promise<void>;
  fetchUnscheduledTasks: () => Promise<void>;
  createTimeItem: (input: CreateTimeItemInput) => Promise<TimeItem>;
  updateTimeItem: (
    id: string,
    updates: UpdateTimeItemInput,
  ) => Promise<TimeItem>;
  deleteTimeItem: (id: string) => Promise<void>;
  moveTimeItem: (
    id: string,
    startTime: string,
    endTime?: string,
  ) => Promise<TimeItem>;

  // Scope & Filters
  setScope: (scope: Scope | "all") => void;
  setDateRange: (range: DateRange) => void;
  setFilters: (filters: Partial<Filters>) => void;
  clearFilters: () => void;

  // Selection
  selectItem: (item: TimeItem | null) => void;

  // Optimistic updates
  optimisticUpdate: (id: string, updates: Partial<TimeItem>) => void;
  rollbackUpdate: (id: string) => void;
  commitUpdate: (id: string) => void;

  // Sharing
  shareItem: (
    id: string,
    userIds?: string[],
    groupIds?: string[],
  ) => Promise<TimeItem>;

  // Utilities
  getItemById: (id: string) => TimeItem | undefined;
  getItemsByDateRange: (start: Date, end: Date) => TimeItem[];
  getItemsByProject: (projectId: string) => TimeItem[];
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const defaultFilters: Filters = {
  types: [],
  priorities: [],
  statuses: [],
  projectIds: [],
  tags: [],
  search: "",
};

const initialState = {
  timeItems: [] as TimeItem[],
  selectedItem: null as TimeItem | null,
  scope: "moi" as Scope | "all",
  dateRange: null as DateRange | null,
  filters: defaultFilters,
  isLoading: false,
  isSaving: false,
  error: null as string | null,
  pendingUpdates: new Map<string, Partial<TimeItem>>(),
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const useSchedulingStore = create<SchedulingState>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // ======================================================================
      // FETCH ACTIONS
      // ======================================================================

      fetchTimeItems: async (range: DateRange, scope?: Scope | "all") => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
          state.dateRange = range;
          if (scope) state.scope = scope;
        });

        try {
          const { filters } = get();
          const response = await schedulingApi.queryTimeItems({
            start: range.start.toISOString(),
            end: range.end.toISOString(),
            scope:
              scope || get().scope === "all"
                ? undefined
                : (get().scope as Scope),
            types: filters.types.length ? filters.types : undefined,
            priorities: filters.priorities.length
              ? filters.priorities
              : undefined,
            statuses: filters.statuses.length ? filters.statuses : undefined,
            search: filters.search || undefined,
            includeRecurrences: true,
            includeCompleted: true,
          });

          set((state) => {
            state.timeItems = response.items;
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error ? error.message : "Failed to fetch items";
            state.isLoading = false;
          });
        }
      },

      fetchUnscheduledTasks: async () => {
        try {
          const tasks = await schedulingApi.getUnscheduledTasks();
          set((state) => {
            // Merge with existing items, avoiding duplicates
            const existingIds = new Set(state.timeItems.map((item) => item.id));
            const newTasks = tasks.filter((task) => !existingIds.has(task.id));
            state.timeItems = [...state.timeItems, ...newTasks];
          });
        } catch (error) {
          console.error("Failed to fetch unscheduled tasks:", error);
        }
      },

      // ======================================================================
      // CRUD ACTIONS
      // ======================================================================

      createTimeItem: async (input: CreateTimeItemInput) => {
        set((state) => {
          state.isSaving = true;
          state.error = null;
        });

        try {
          const item = await schedulingApi.createTimeItem(input);
          set((state) => {
            state.timeItems.push(item);
            state.isSaving = false;
          });
          return item;
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error
                ? error.message
                : "Impossible de créer item";
            state.isSaving = false;
          });
          throw error;
        }
      },

      updateTimeItem: async (id: string, updates: UpdateTimeItemInput) => {
        // Optimistic update
        const originalItem = get().timeItems.find((item) => item.id === id);
        if (originalItem) {
          get().optimisticUpdate(id, updates as Partial<TimeItem>);
        }

        set((state) => {
          state.isSaving = true;
          state.error = null;
        });

        try {
          const item = await schedulingApi.updateTimeItem(id, updates);
          set((state) => {
            const index = state.timeItems.findIndex((i) => i.id === id);
            if (index !== -1) {
              state.timeItems[index] = item;
            }
            state.pendingUpdates.delete(id);
            state.isSaving = false;
          });
          return item;
        } catch (error) {
          // Rollback on error
          get().rollbackUpdate(id);
          set((state) => {
            state.error =
              error instanceof Error
                ? error.message
                : "Impossible de mettre à jour item";
            state.isSaving = false;
          });
          throw error;
        }
      },

      deleteTimeItem: async (id: string) => {
        // Optimistic delete
        const originalItem = get().timeItems.find((item) => item.id === id);

        set((state) => {
          state.timeItems = state.timeItems.filter((item) => item.id !== id);
          state.isSaving = true;
          state.error = null;
          if (state.selectedItem?.id === id) {
            state.selectedItem = null;
          }
        });

        try {
          await schedulingApi.deleteTimeItem(id);
          set((state) => {
            state.isSaving = false;
          });
        } catch (error) {
          // Rollback on error
          if (originalItem) {
            set((state) => {
              state.timeItems.push(originalItem);
            });
          }
          set((state) => {
            state.error =
              error instanceof Error
                ? error.message
                : "Impossible de supprimer item";
            state.isSaving = false;
          });
          throw error;
        }
      },

      moveTimeItem: async (id: string, startTime: string, endTime?: string) => {
        const originalItem = get().timeItems.find((item) => item.id === id);
        if (!originalItem) {
          throw new Error("Item not found");
        }

        // Optimistic update
        get().optimisticUpdate(id, { startTime, endTime });

        set((state) => {
          state.isSaving = true;
        });

        try {
          const item = await schedulingApi.moveTimeItem(id, {
            startTime,
            endTime,
          });
          set((state) => {
            const index = state.timeItems.findIndex((i) => i.id === id);
            if (index !== -1) {
              state.timeItems[index] = item;
            }
            state.pendingUpdates.delete(id);
            state.isSaving = false;
          });
          return item;
        } catch (error) {
          get().rollbackUpdate(id);
          set((state) => {
            state.error =
              error instanceof Error ? error.message : "Failed to move item";
            state.isSaving = false;
          });
          throw error;
        }
      },

      // ======================================================================
      // SCOPE & FILTERS
      // ======================================================================

      setScope: (scope: Scope | "all") => {
        set((state) => {
          state.scope = scope;
        });
        // Refetch with new scope if we have a date range
        const { dateRange } = get();
        if (dateRange) {
          get().fetchTimeItems(dateRange, scope);
        }
      },

      setDateRange: (range: DateRange) => {
        set((state) => {
          state.dateRange = range;
        });
      },

      setFilters: (filters: Partial<Filters>) => {
        set((state) => {
          state.filters = { ...state.filters, ...filters };
        });
      },

      clearFilters: () => {
        set((state) => {
          state.filters = defaultFilters;
        });
      },

      // ======================================================================
      // SELECTION
      // ======================================================================

      selectItem: (item: TimeItem | null) => {
        set((state) => {
          state.selectedItem = item;
        });
      },

      // ======================================================================
      // OPTIMISTIC UPDATES
      // ======================================================================

      optimisticUpdate: (id: string, updates: Partial<TimeItem>) => {
        set((state) => {
          // Store original for rollback
          const item = state.timeItems.find((i) => i.id === id);
          if (item) {
            state.pendingUpdates.set(id, { ...item });
            // Apply optimistic update
            const index = state.timeItems.findIndex((i) => i.id === id);
            if (index !== -1) {
              state.timeItems[index] = {
                ...state.timeItems[index],
                ...updates,
              };
            }
          }
        });
      },

      rollbackUpdate: (id: string) => {
        set((state) => {
          const original = state.pendingUpdates.get(id);
          if (original) {
            const index = state.timeItems.findIndex((i) => i.id === id);
            if (index !== -1) {
              state.timeItems[index] = {
                ...state.timeItems[index],
                ...original,
              } as TimeItem;
            }
            state.pendingUpdates.delete(id);
          }
        });
      },

      commitUpdate: (id: string) => {
        set((state) => {
          state.pendingUpdates.delete(id);
        });
      },

      // ======================================================================
      // SHARING
      // ======================================================================

      shareItem: async (
        id: string,
        userIds?: string[],
        groupIds?: string[],
      ) => {
        set((state) => {
          state.isSaving = true;
        });

        try {
          const item = await schedulingApi.shareTimeItem(id, {
            users: userIds,
            groups: groupIds,
          });
          set((state) => {
            const index = state.timeItems.findIndex((i) => i.id === id);
            if (index !== -1) {
              state.timeItems[index] = item;
            }
            state.isSaving = false;
          });
          return item;
        } catch (error) {
          set((state) => {
            state.error =
              error instanceof Error ? error.message : "Failed to share item";
            state.isSaving = false;
          });
          throw error;
        }
      },

      // ======================================================================
      // UTILITIES
      // ======================================================================

      getItemById: (id: string) => {
        return get().timeItems.find((item) => item.id === id);
      },

      getItemsByDateRange: (start: Date, end: Date) => {
        return get().timeItems.filter((item) => {
          if (!item.startTime) return false;
          const itemStart = new Date(item.startTime);
          return itemStart >= start && itemStart <= end;
        });
      },

      getItemsByProject: (projectId: string) => {
        return get().timeItems.filter((item) => item.projectId === projectId);
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },

      reset: () => {
        set((state) => {
          Object.assign(state, initialState);
          state.pendingUpdates = new Map();
        });
      },
    })),
    { name: "scheduling-store" },
  ),
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectTimeItems = (state: SchedulingState) => state.timeItems;
export const selectSelectedItem = (state: SchedulingState) =>
  state.selectedItem;
export const selectScope = (state: SchedulingState) => state.scope;
export const selectDateRange = (state: SchedulingState) => state.dateRange;
export const selectFilters = (state: SchedulingState) => state.filters;
export const selectIsLoading = (state: SchedulingState) => state.isLoading;
export const selectIsSaving = (state: SchedulingState) => state.isSaving;
export const selectError = (state: SchedulingState) => state.error;

// Filtered selectors
export const selectScheduledItems = (state: SchedulingState) =>
  state.timeItems.filter((item) => item.startTime);

export const selectUnscheduledTasks = (state: SchedulingState) =>
  state.timeItems.filter((item) => !item.startTime && item.type === "task");

export const selectItemsByType =
  (type: TimeItemType) => (state: SchedulingState) =>
    state.timeItems.filter((item) => item.type === type);

export const selectItemsByStatus =
  (status: Status) => (state: SchedulingState) =>
    state.timeItems.filter((item) => item.status === status);

export const selectItemsByPriority =
  (priority: Priority) => (state: SchedulingState) =>
    state.timeItems.filter((item) => item.priority === priority);

export const selectTodayItems = (state: SchedulingState) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return state.timeItems.filter((item) => {
    if (!item.startTime) return false;
    const itemStart = new Date(item.startTime);
    return itemStart >= today && itemStart < tomorrow;
  });
};

export default useSchedulingStore;
