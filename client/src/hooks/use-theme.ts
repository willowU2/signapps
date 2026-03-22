'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeType = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeType;
  toggle: () => void;
  setTheme: (theme: ThemeType) => void;
  resolvedTheme: 'light' | 'dark';
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: 'light',

      setTheme: (theme: ThemeType) => {
        set({ theme });
        applyTheme(theme);
      },

      toggle: () => {
        const current = get().resolvedTheme;
        const newTheme: ThemeType = current === 'dark' ? 'light' : 'dark';
        set({ theme: newTheme });
        applyTheme(newTheme);
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
        }
      },
    }
  )
);

function applyTheme(theme: ThemeType) {
  if (typeof window === 'undefined') return;

  const html = document.documentElement;
  let resolvedTheme: 'light' | 'dark' = theme as 'light' | 'dark';

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    resolvedTheme = prefersDark ? 'dark' : 'light';
  }

  if (resolvedTheme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }

  useThemeStore.setState({ resolvedTheme });
}

// Initialize theme on client side
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('theme-storage');
  if (stored) {
    try {
      const state = JSON.parse(stored);
      applyTheme(state.state?.theme || 'system');
    } catch (e) {
      applyTheme('system');
    }
  } else {
    applyTheme('system');
  }

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const state = useThemeStore.getState();
    if (state.theme === 'system') {
      applyTheme('system');
    }
  });
}
