"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

// ============================================================================
// Store Interface
// ============================================================================

interface ChatState {
  // UI State
  selectedChannel: string | null;

  // Actions
  setSelectedChannel: (channelId: string | null) => void;
  clearSelectedChannel: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      // Initial state
      selectedChannel: null,

      // ========================================
      // Actions
      // ========================================

      setSelectedChannel: (channelId) => set({ selectedChannel: channelId }),
      clearSelectedChannel: () => set({ selectedChannel: null }),
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        selectedChannel: state.selectedChannel,
      }),
    }
  )
);

// ============================================================================
// Granular Selector Hooks (optimized for minimal re-renders)
// ============================================================================

export const useSelectedChannel = () => useChatStore((state) => state.selectedChannel);

export const useChatActions = () =>
  useChatStore(
    useShallow((state) => ({
      setSelectedChannel: state.setSelectedChannel,
      clearSelectedChannel: state.clearSelectedChannel,
    }))
  );
