import { create } from "zustand";
import axios from "axios";
import { entityHubApi } from "@/lib/api/entityHub";

import { workspacesApi } from "@/lib/api/tenant";

// Minimal entity types used across the Hub UI
export interface EntityWorkspace {
  id: string;
  name: string;
  description?: string;
}

export interface EntityCalendar {
  id: string;
  name: string;
}

export interface EntityResource {
  id: string;
  name: string;
}

export interface EntityProject {
  id: string;
  name: string;
  description?: string;
  workspace_id?: string;
}

export interface EntityTask {
  id: string;
  title: string;
  project_id?: string;
  status?: string;
}

export interface EntityEvent {
  id: string;
  title: string;
  calendar_id?: string;
}

// Unified Entity Hub Store for Phase 5 Calendars & Projects
interface EntityState {
  workspaces: EntityWorkspace[];
  calendars: EntityCalendar[];
  resources: EntityResource[];
  projects: EntityProject[];
  tasks: EntityTask[];
  events: EntityEvent[];

  selectedWorkspaceId: string | null;
  setSelectedWorkspace: (id: string | null) => void;

  isLoading: boolean;
  error: string | null;

  fetchWorkspaces: () => Promise<void>;
  fetchCalendars: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  fetchResources: () => Promise<void>;
  fetchEvents: () => Promise<void>;

  createWorkspace: (data: {
    name: string;
    description?: string;
  }) => Promise<void>;
  createProject: (data: {
    name: string;
    description?: string;
    workspace_id: string;
  }) => Promise<void>;
  createTask: (data: {
    title: string;
    description?: string;
    project_id: string;
    parent_id?: string;
    priority?: number;
    due_date?: string;
  }) => Promise<void>;
  updateTask: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

export const useEntityStore = create<EntityState>((set, get) => ({
  workspaces: [],
  calendars: [],
  resources: [],
  projects: [],
  tasks: [],
  events: [],
  selectedWorkspaceId: null,
  isLoading: false,
  error: null,

  setSelectedWorkspace: (id) => set({ selectedWorkspaceId: id }),

  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await workspacesApi.mine();
      const data = response.data;
      set((state) => ({
        workspaces: data,
        selectedWorkspaceId:
          state.selectedWorkspaceId || (data.length > 0 ? data[0].id : null),
        isLoading: false,
      }));
    } catch (error: unknown) {
      // Silently handle 401/403 - user may not have workspace access yet
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 403) {
        set({ workspaces: [], isLoading: false });
      } else {
        set({
          error:
            (error instanceof Error ? error.message : String(error)) ||
            "Failed to fetch workspaces",
          isLoading: false,
        });
      }
    }
  },

  fetchCalendars: async () => {
    set({ isLoading: true });
    try {
      const response = await entityHubApi.listCalendars();
      set({ calendars: response.data.data || response.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
    }
  },

  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const response = await entityHubApi.listProjects();
      set({ projects: response.data.data || response.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
    }
  },

  fetchTasks: async () => {
    set({ isLoading: true });
    try {
      const response = await entityHubApi.listTasks();
      set({ tasks: response.data.data || response.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
    }
  },

  fetchResources: async () => {
    set({ isLoading: true });
    try {
      const response = await entityHubApi.listResources();
      set({ resources: response.data.data || response.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
    }
  },

  fetchEvents: async () => {
    set({ isLoading: true });
    try {
      const response = await entityHubApi.listEvents();
      set({ events: response.data.data || response.data, isLoading: false });
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
    }
  },

  createWorkspace: async (data) => {
    set({ isLoading: true });
    try {
      await entityHubApi.createWorkspace(data);
      await get().fetchWorkspaces();
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      throw error;
    }
  },

  createProject: async (data) => {
    set({ isLoading: true });
    try {
      await entityHubApi.createProject(data);
      await get().fetchProjects();
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      throw error;
    }
  },

  createTask: async (data) => {
    set({ isLoading: true });
    try {
      await entityHubApi.createTask({
        ...data,
        type: "task",
        status: "todo",
        priority: "medium",
      });
      await get().fetchTasks();
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      throw error;
    }
  },

  updateTask: async (id, data) => {
    set({ isLoading: true });
    try {
      await entityHubApi.updateTask(id, data);
      await get().fetchTasks();
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      throw error;
    }
  },

  deleteTask: async (id) => {
    set({ isLoading: true });
    try {
      await entityHubApi.deleteTask(id);
      await get().fetchTasks();
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      throw error;
    }
  },
}));
