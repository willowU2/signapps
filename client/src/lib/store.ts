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
interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: 'system',
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ui-storage',
    }
  )
);
