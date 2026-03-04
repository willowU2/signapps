"use client";

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

export type OmniSearchPage = 'home' | 'apps' | 'recent' | 'settings';

export interface OmniSearchResult {
  id: string;
  type: 'app' | 'note' | 'mail' | 'task' | 'chat' | 'action';
  title: string;
  description?: string;
  icon?: string;
  href?: string;
  action?: () => void;
  keywords?: string[];
}

interface OmniState {
  isOpen: boolean;
  query: string;
  page: OmniSearchPage;
  recentSearches: string[];

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
  setPage: (page: OmniSearchPage) => void;
  addRecentSearch: (search: string) => void;
  clearRecentSearches: () => void;
}

export const useOmniStore = create<OmniState>()((set, get) => ({
  isOpen: false,
  query: '',
  page: 'home',
  recentSearches: [],

  open: () => set({ isOpen: true, query: '', page: 'home' }),
  close: () => set({ isOpen: false, query: '', page: 'home' }),
  toggle: () => {
    const { isOpen } = get();
    if (isOpen) {
      set({ isOpen: false, query: '', page: 'home' });
    } else {
      set({ isOpen: true, query: '', page: 'home' });
    }
  },

  setQuery: (query) => set({ query }),
  setPage: (page) => set({ page }),

  addRecentSearch: (search) => {
    if (!search.trim()) return;
    set((state) => {
      const filtered = state.recentSearches.filter((s) => s !== search);
      return {
        recentSearches: [search, ...filtered].slice(0, 10),
      };
    });
  },

  clearRecentSearches: () => set({ recentSearches: [] }),
}));

// Selector hooks for optimized re-renders
export const useOmniIsOpen = () => useOmniStore((state) => state.isOpen);
export const useOmniQuery = () => useOmniStore((state) => state.query);

export const useOmniActions = () =>
  useOmniStore(
    useShallow((state) => ({
      open: state.open,
      close: state.close,
      toggle: state.toggle,
      setQuery: state.setQuery,
      setPage: state.setPage,
      addRecentSearch: state.addRecentSearch,
    }))
  );
