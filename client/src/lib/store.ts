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

// UI State
export type RightWidgetType = 'chat' | 'calendar' | 'tasks' | 'notes' | 'details' | null;

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  rightSidebarOpen: boolean;
  activeRightWidget: RightWidgetType;

  // Global Modals State
  createWorkspaceModalOpen: boolean;
  createProjectModalOpen: boolean;
  createTaskModalOpen: boolean;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (isOpen: boolean) => void;
  setActiveRightWidget: (widget: RightWidgetType) => void;

  setCreateWorkspaceModalOpen: (isOpen: boolean) => void;
  setCreateProjectModalOpen: (isOpen: boolean) => void;
  setCreateTaskModalOpen: (isOpen: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: 'system',
      rightSidebarOpen: true,
      activeRightWidget: 'chat',

      createWorkspaceModalOpen: false,
      createProjectModalOpen: false,
      createTaskModalOpen: false,

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setTheme: (theme) => set({ theme }),
      toggleRightSidebar: () => set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
      setRightSidebarOpen: (isOpen) => set({ rightSidebarOpen: isOpen }),
      setActiveRightWidget: (widget) => set({ activeRightWidget: widget, rightSidebarOpen: true }),

      setCreateWorkspaceModalOpen: (isOpen) => set({ createWorkspaceModalOpen: isOpen }),
      setCreateProjectModalOpen: (isOpen) => set({ createProjectModalOpen: isOpen }),
      setCreateTaskModalOpen: (isOpen) => set({ createTaskModalOpen: isOpen }),
    }),
    {
      name: 'ui-storage',
    }
  )
);

// Notes State (Right Sidebar)
interface Note {
  id: string;
  content: string;
  createdAt: string;
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
          notes: [
            { id: crypto.randomUUID(), content, createdAt: new Date().toISOString() },
            ...state.notes,
          ],
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

// Quick Tasks State (Right Sidebar) - Google Tasks Style
export interface TaskAssignee {
  id: string;
  name: string;
  avatar?: string;
}

export interface TaskList {
  id: string;
  name: string;
  color?: string;
}

export interface QuickTask {
  id: string;
  label: string;
  done: boolean;
  dueDate?: string; // ISO date string
  assignee?: TaskAssignee;
  listId?: string;
  createdAt: string;
}

interface QuickTasksState {
  tasks: QuickTask[];
  lists: TaskList[];
  selectedListId: string | null;
  addTask: (label: string, dueDate?: string, assignee?: TaskAssignee) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<QuickTask>) => void;
  addList: (name: string) => void;
  removeList: (id: string) => void;
  setSelectedList: (id: string | null) => void;
}

const defaultLists: TaskList[] = [
  { id: 'default', name: 'My Tasks', color: '#4285f4' },
  { id: 'work', name: 'Work', color: '#ea4335' },
  { id: 'personal', name: 'Personal', color: '#34a853' },
];

export const useQuickTasksStore = create<QuickTasksState>()(
  persist(
    (set) => ({
      tasks: [],
      lists: defaultLists,
      selectedListId: 'default',
      addTask: (label, dueDate, assignee) =>
        set((state) => ({
          tasks: [...state.tasks, {
            id: crypto.randomUUID(),
            label,
            done: false,
            dueDate,
            assignee,
            listId: state.selectedListId || 'default',
            createdAt: new Date().toISOString(),
          }],
        })),
      toggleTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        })),
      removeTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      addList: (name) =>
        set((state) => ({
          lists: [...state.lists, { id: crypto.randomUUID(), name }],
        })),
      removeList: (id) =>
        set((state) => ({
          lists: state.lists.filter((l) => l.id !== id),
          tasks: state.tasks.filter((t) => t.listId !== id),
        })),
      setSelectedList: (id) =>
        set({ selectedListId: id }),
    }),
    { name: 'quick-tasks-storage' }
  )
);
