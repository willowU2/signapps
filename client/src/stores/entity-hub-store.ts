import { create } from 'zustand';
import axios from 'axios';

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
  createTask: (data: { title: string; description?: string; project_id: string }) => Promise<void>;
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
    set({ isLoading: true });
    try {
      // In real implementation, these call the signapps-scheduler endpoints via proxy
      const response = await axios.get('/api/v1/workspaces', { baseURL: 'http://localhost:3007' });
      set((state) => ({ 
        workspaces: response.data.data, 
        selectedWorkspaceId: state.selectedWorkspaceId || (response.data.data.length > 0 ? response.data.data[0].id : null),
        isLoading: false 
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchCalendars: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.get('/api/v1/calendars', { baseURL: 'http://localhost:3007' });
      set({ calendars: response.data.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.get('/api/v1/projects', { baseURL: 'http://localhost:3007' });
      set({ projects: response.data.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchTasks: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.get('/api/v1/tasks', { baseURL: 'http://localhost:3007' });
      set({ tasks: response.data.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  fetchResources: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.get('/api/v1/resources', { baseURL: 'http://localhost:3007' });
      set({ resources: response.data.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchEvents: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.get('/api/v1/events', { baseURL: 'http://localhost:3007' });
      set({ events: response.data.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createWorkspace: async (data) => {
    set({ isLoading: true });
    try {
      await axios.post('/api/v1/workspaces', data, { baseURL: 'http://localhost:3007' });
      await get().fetchWorkspaces();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createProject: async (data) => {
    set({ isLoading: true });
    try {
      await axios.post('/api/v1/projects', data, { baseURL: 'http://localhost:3007' });
      await get().fetchProjects();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  createTask: async (data) => {
    set({ isLoading: true });
    try {
      await axios.post('/api/v1/tasks', data, { baseURL: 'http://localhost:3007' });
      await get().fetchTasks();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
}));
