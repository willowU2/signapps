import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, type User } from './api';

export type { User };

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaSessionToken: string | null;
  redirectAfterLogin: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setMfaSessionToken: (token: string | null) => void;
  setRedirectAfterLogin: (path: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      mfaSessionToken: null,
      redirectAfterLogin: null,
      setUser: (user) =>
        set({ user, isAuthenticated: !!user, isLoading: false, mfaSessionToken: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setMfaSessionToken: (mfaSessionToken) => set({ mfaSessionToken }),
      setRedirectAfterLogin: (redirectAfterLogin) => set({ redirectAfterLogin }),
      logout: () => {
        // Invalidate server session (fire-and-forget)
        authApi.logout().catch(() => {
          // Ignore errors - we still want to clear local state
        });
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        // Clear cookie immediately so middleware sees unauthenticated state
        if (typeof document !== 'undefined') {
          document.cookie = 'auth-storage=; path=/; max-age=0';
        }
        set({ user: null, isAuthenticated: false, mfaSessionToken: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        redirectAfterLogin: state.redirectAfterLogin,
      }),
      // Sync to cookie for middleware access
      onRehydrateStorage: () => (state) => {
        if (typeof document !== 'undefined' && state) {
          const value = JSON.stringify({ state: { isAuthenticated: state.isAuthenticated } });
          document.cookie = `auth-storage=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
        }
      },
    }
  )
);

// Right sidebar widget types
export type RightWidgetType = 'chat' | 'calendar' | 'tasks' | 'notes' | 'details';

// UI State
export type RightWidgetType = 'chat' | 'calendar' | 'tasks' | 'notes' | 'details';

interface UIState {
  sidebarCollapsed: boolean;
  rightSidebarOpen: boolean;
  activeRightWidget: RightWidgetType;
  theme: 'light' | 'dark' | 'system';
  // Modal state
  createWorkspaceModalOpen: boolean;
  createProjectModalOpen: boolean;
  createTaskModalOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (open: boolean) => void;
  setActiveRightWidget: (widget: RightWidgetType) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setCreateWorkspaceModalOpen: (open: boolean) => void;
  setCreateProjectModalOpen: (open: boolean) => void;
  setCreateTaskModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      rightSidebarOpen: false,
<<<<<<< Updated upstream
      activeRightWidget: 'chat',
=======
      activeRightWidget: 'chat' as RightWidgetType,
>>>>>>> Stashed changes
      theme: 'system',
      createWorkspaceModalOpen: false,
      createProjectModalOpen: false,
      createTaskModalOpen: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleRightSidebar: () => set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
      setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
      setActiveRightWidget: (widget) => set({ activeRightWidget: widget, rightSidebarOpen: true }),
      setTheme: (theme) => set({ theme }),
      setCreateWorkspaceModalOpen: (open) => set({ createWorkspaceModalOpen: open }),
      setCreateProjectModalOpen: (open) => set({ createProjectModalOpen: open }),
      setCreateTaskModalOpen: (open) => set({ createTaskModalOpen: open }),
    }),
    {
      name: 'ui-storage',
    }
  )
);

// Labels State
export interface Label {
  id: string;
  name: string;
  color: string;
}

interface LabelsState {
  labels: Label[];
  addLabel: (name: string, color: string) => void;
  removeLabel: (id: string) => void;
  updateLabel: (id: string, name: string, color: string) => void;
}

export const useLabelsStore = create<LabelsState>()(
  persist(
    (set) => ({
      labels: [
        { id: '1', name: 'Important', color: '#ef4444' },
        { id: '2', name: 'Production', color: '#22c55e' },
        { id: '3', name: 'Review', color: '#8b5cf6' },
      ],
      addLabel: (name, color) =>
        set((state) => ({
          labels: [...state.labels, { id: Date.now().toString(), name, color }],
        })),
      removeLabel: (id) =>
        set((state) => ({
          labels: state.labels.filter((l) => l.id !== id),
        })),
      updateLabel: (id, name, color) =>
        set((state) => ({
          labels: state.labels.map((l) => (l.id === id ? { ...l, name, color } : l)),
        })),
    }),
    { name: 'labels-storage' }
  )
);

// Notes State
export interface Note {
  id: string;
  content: string;
  createdAt: number;
}

interface NotesState {
  notes: Note[];
  addNote: (content: string) => void;
  updateNote: (id: string, content: string) => void;
  removeNote: (id: string) => void;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: [],
      addNote: (content) =>
        set((state) => ({
          notes: [{ id: Date.now().toString(), content, createdAt: Date.now() }, ...state.notes],
        })),
      updateNote: (id, content) =>
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, content } : n)),
        })),
      removeNote: (id) =>
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),
    }),
    { name: 'notes-storage' }
  )
);

// Pinned Apps State
export interface AppPin {
  href: string;
  icon: string; // lucide icon name
  label: string;
  color: string;
}

interface PinnedAppsState {
  pinnedApps: AppPin[];
  pinApp: (app: AppPin) => void;
  unpinApp: (href: string) => void;
  reorderPinnedApps: (apps: AppPin[]) => void;
}

export const usePinnedAppsStore = create<PinnedAppsState>()(
  persist(
    (set) => ({
      pinnedApps: [],
      pinApp: (app) =>
        set((state) => {
          if (state.pinnedApps.some((p) => p.href === app.href)) return state;
          return { pinnedApps: [...state.pinnedApps, app] };
        }),
      unpinApp: (href) =>
        set((state) => ({
          pinnedApps: state.pinnedApps.filter((p) => p.href !== href),
        })),
      reorderPinnedApps: (apps) => set({ pinnedApps: apps }),
    }),
    { name: 'signapps_pinned_apps' }
  )
);

// Quick Tasks State
export interface AttachedFile {
  id: string;
  name: string;
  size?: number;
  type?: string;
  url?: string;
  path?: string;
  attachedAt?: string;
}

export interface QuickTaskList {
  id: string;
  name: string;
  color?: string;
}

export interface QuickTask {
  id: string;
  label: string;
  done: boolean;
  // Extended optional fields
  dueDate?: string;
  listId?: string;
  linkedEventId?: string;
  attachedFiles?: AttachedFile[];
  assignee?: { name: string; avatar?: string };
}

interface QuickTasksState {
  tasks: QuickTask[];
  lists: QuickTaskList[];
  selectedListId: string | null;
  addTask: (label: string, dueDate?: string) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  removeFileFromTask: (taskId: string, fileId: string) => void;
  setSelectedList: (listId: string | null) => void;
  attachFileToTask: (taskId: string, file: AttachedFile) => void;
  linkEventToTask: (taskId: string, eventId: string) => void;
}

export const useQuickTasksStore = create<QuickTasksState>()(
  persist(
    (set) => ({
      tasks: [
        { id: '1', label: 'Vérifier les logs containers', done: false },
        { id: '2', label: 'Mettre à jour les certificats SSL', done: false },
        { id: '3', label: 'Valider les backups', done: true },
      ],
      lists: [{ id: 'default', name: 'My Tasks' }],
      selectedListId: null,
      addTask: (label, dueDate) =>
        set((state) => ({
          tasks: [...state.tasks, { id: Date.now().toString(), label, done: false, dueDate }],
        })),
      toggleTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        })),
      removeTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
      removeFileFromTask: (taskId, fileId) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, attachedFiles: (t.attachedFiles || []).filter((f) => f.id !== fileId) }
              : t
          ),
        })),
      setSelectedList: (listId) => set({ selectedListId: listId }),
      attachFileToTask: (taskId, file) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, attachedFiles: [...(t.attachedFiles || []), file] }
              : t
          ),
        })),
      linkEventToTask: (taskId, eventId) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, linkedEventId: eventId } : t
          ),
        })),
    }),
    { name: 'quick-tasks-storage' }
  )
);
