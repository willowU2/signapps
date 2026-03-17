/**
 * Command Bar Store
 *
 * Gère l'état du Command Bar: récents, favoris, historique de commandes.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { UniversalBlock } from "@/lib/blocks";

// ============================================================================
// Types
// ============================================================================

export interface RecentItem {
  block: UniversalBlock;
  accessedAt: Date;
}

export interface CommandHistoryItem {
  command: string;
  executedAt: Date;
}

interface CommandBarState {
  // Recent items (max 20)
  recentItems: RecentItem[];
  addRecentItem: (block: UniversalBlock) => void;
  clearRecentItems: () => void;

  // Command history (max 50)
  commandHistory: CommandHistoryItem[];
  addToHistory: (command: string) => void;
  clearHistory: () => void;

  // Favorites (pinned items)
  favorites: UniversalBlock[];
  addFavorite: (block: UniversalBlock) => void;
  removeFavorite: (blockId: string) => void;
  isFavorite: (blockId: string) => boolean;

  // UI state
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useCommandBarStore = create<CommandBarState>()(
  persist(
    (set, get) => ({
      // Recent items
      recentItems: [],
      addRecentItem: (block) =>
        set((state) => {
          // Remove if already exists
          const filtered = state.recentItems.filter(
            (item) => item.block.id !== block.id
          );
          // Add to front
          const newItems = [
            { block, accessedAt: new Date() },
            ...filtered,
          ].slice(0, 20);
          return { recentItems: newItems };
        }),
      clearRecentItems: () => set({ recentItems: [] }),

      // Command history
      commandHistory: [],
      addToHistory: (command) =>
        set((state) => {
          const newHistory = [
            { command, executedAt: new Date() },
            ...state.commandHistory,
          ].slice(0, 50);
          return { commandHistory: newHistory };
        }),
      clearHistory: () => set({ commandHistory: [] }),

      // Favorites
      favorites: [],
      addFavorite: (block) =>
        set((state) => {
          if (state.favorites.some((f) => f.id === block.id)) return state;
          return { favorites: [...state.favorites, block] };
        }),
      removeFavorite: (blockId) =>
        set((state) => ({
          favorites: state.favorites.filter((f) => f.id !== blockId),
        })),
      isFavorite: (blockId) => get().favorites.some((f) => f.id === blockId),

      // UI state
      isOpen: false,
      setOpen: (open) => set({ isOpen: open }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
    }),
    {
      name: "signapps-command-bar",
      partialize: (state) => ({
        recentItems: state.recentItems.slice(0, 10), // Only persist 10 recent
        favorites: state.favorites,
        // Don't persist commandHistory (too large)
      }),
    }
  )
);
