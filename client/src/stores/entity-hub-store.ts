import { create } from 'zustand';
import axios from 'axios';
import { entityHubApi } from '@/lib/api/entityHub';

import { workspacesApi } from '@/lib/api/tenant';

// Unified Entity Hub Store for Phase 5 Calendars & Projects
interface EntityState {
  workspaces: any[];
  calendars: any[];
  resources: any[];
  projects: any[];
  tasks: any[];
  events: any[];

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

  createWorkspace: (data: { name: string; description?: string }) => Promise<void>;
  createProject: (data: { name: string; description?: string; workspace_id: string }) => Promise<void>;
  createTask: (data: { title: string; description?: string; project_id: string, parent_id?: string, priority?: number, due_date?: string }) => Promise<void>;
  updateTask: (id: string, data: any) => Promise<void>;
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
        selectedWorkspaceId: state.selectedWorkspaceId || (data.length > 0 ? data[0].id : null),
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch workspaces', isLoading: false });
    }
  },

  fetchCalendars: async () => {
    set({ isLoading: true });
    try {
      const response = await entityHubApi.listCalendars();
      set({ calendars: response.data.data || response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const response = await entityHubApi.listProjects();
      set({ projects: response.data.data || response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchTasks: async () => {
    set({ isLoading: true });
    try {
      const response = await entityHubApi.listTasks();
      set({ tasks: response.data.data || response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  fetchResources: async () => {
    set({ isLoading: true });
    try {
      const response = await entityHubApi.listResources();
      set({ resources: response.data.data || response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchEvents: async () => {
    set({ isLoading: true });
    try {
      const response = await entityHubApi.listEvents();
      set({ events: response.data.data || response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createWorkspace: async (data) => {
    set({ isLoading: true });
    try {
      await entityHubApi.createWorkspace(data);
      await get().fetchWorkspaces();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createProject: async (data) => {
    set({ isLoading: true });
    try {
      await entityHubApi.createProject(data);
      await get().fetchProjects();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createTask: async (data) => {
    set({ isLoading: true });
    try {
      await entityHubApi.createTask(data);
      await get().fetchTasks();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateTask: async (id, data) => {
    set({ isLoading: true });
    try {
      await entityHubApi.updateTask(id, data);
      await get().fetchTasks();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  deleteTask: async (id) => {
    set({ isLoading: true });
    try {
      await entityHubApi.deleteTask(id);
      await get().fetchTasks();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
}));
