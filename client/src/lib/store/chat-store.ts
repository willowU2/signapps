"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { User } from "@/lib/api/identity";

// ============================================================================
// Store Interface
// ============================================================================

interface ChatState {
  // UI State
  selectedChannel: string | null;
  selectedChannelName: string | null;
  isDm: boolean | null;
  usersMap: Record<string, User>;
  hiddenDms: string[];

  // Actions
  setSelectedChannel: (
    channelId: string | null,
    channelName?: string,
    isDm?: boolean,
  ) => void;
  setUsersMap: (map: Record<string, User>) => void;
  clearSelectedChannel: () => void;
  hideDm: (dmId: string) => void;
  unhideDm: (dmId: string) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      // Initial state
      selectedChannel: null,
      selectedChannelName: null,
      isDm: null,
      usersMap: {},
      hiddenDms: [],

      // ========================================
      // Actions
      // ========================================

      setSelectedChannel: (channelId, channelName, isDm) =>
        set({
          selectedChannel: channelId,
          selectedChannelName: channelName || channelId,
          isDm: isDm ?? false,
        }),
      setUsersMap: (map) => set({ usersMap: map }),
      clearSelectedChannel: () =>
        set({ selectedChannel: null, selectedChannelName: null, isDm: null }),
      hideDm: (dmId) =>
        set((state) => ({
          hiddenDms: [...new Set([...state.hiddenDms, dmId])],
        })),
      unhideDm: (dmId) =>
        set((state) => ({
          hiddenDms: state.hiddenDms.filter((id) => id !== dmId),
        })),
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({
        selectedChannel: state.selectedChannel,
        selectedChannelName: state.selectedChannelName,
        isDm: state.isDm,
        hiddenDms: state.hiddenDms,
      }),
    },
  ),
);

// ============================================================================
// Granular Selector Hooks (optimized for minimal re-renders)
// ============================================================================

export const useSelectedChannel = () =>
  useChatStore((state) => state.selectedChannel);
export const useSelectedChannelName = () =>
  useChatStore((state) => state.selectedChannelName);
export const useIsDm = () => useChatStore((state) => state.isDm);
export const useUsersMap = () => useChatStore((state) => state.usersMap);

/**
 * Return a single user from usersMap keyed by `userId` with a `username`
 * fallback. Unlike `useUsersMap`, the returned selector depends only on
 * the specific user — consumers re-render only when THIS user changes,
 * not on any modification of the map.
 *
 * Prefer this over `useUsersMap()` for per-message usage where you only
 * need one user (e.g. MessageItem rendering a single sender).
 */
export const useUser = (
  userId: string | undefined,
  username?: string,
): User | undefined =>
  useChatStore((state) => {
    if (!userId && !username) return undefined;
    if (userId && state.usersMap[userId]) return state.usersMap[userId];
    if (username) {
      return Object.values(state.usersMap).find((u) => u.username === username);
    }
    return undefined;
  });

export const useHiddenDms = () => useChatStore((state) => state.hiddenDms);

export const useChatActions = () =>
  useChatStore(
    useShallow((state) => ({
      setSelectedChannel: state.setSelectedChannel,
      setUsersMap: state.setUsersMap,
      clearSelectedChannel: state.clearSelectedChannel,
      hideDm: state.hideDm,
      unhideDm: state.unhideDm,
    })),
  );
