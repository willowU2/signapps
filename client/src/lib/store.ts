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
export type RightWidgetType = 'chat' | 'calendar' | 'tasks' | 'notes' | 'details';

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  rightSidebarOpen: boolean;
  activeRightWidget: RightWidgetType;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (open: boolean) => void;
  setActiveRightWidget: (widget: RightWidgetType) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      rightSidebarOpen: false,
      activeRightWidget: 'chat',
      theme: 'system',
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleRightSidebar: () => set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
      setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
      setActiveRightWidget: (widget) => set({ activeRightWidget: widget, rightSidebarOpen: true }),
      setTheme: (theme) => set({ theme }),
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

// Quick Tasks State
export interface QuickTask {
  id: string;
  label: string;
  done: boolean;
}

interface QuickTasksState {
  tasks: QuickTask[];
  addTask: (label: string) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
}

export const useQuickTasksStore = create<QuickTasksState>()(
  persist(
    (set) => ({
      tasks: [
        { id: '1', label: 'Vérifier les logs containers', done: false },
        { id: '2', label: 'Mettre à jour les certificats SSL', done: false },
        { id: '3', label: 'Valider les backups', done: true },
      ],
      addTask: (label) =>
        set((state) => ({
          tasks: [...state.tasks, { id: Date.now().toString(), label, done: false }],
        })),
      toggleTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        })),
      removeTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
    }),
    { name: 'quick-tasks-storage' }
  )
);
