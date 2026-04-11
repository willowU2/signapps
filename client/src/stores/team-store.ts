/**
 * Team Store
 *
 * Zustand store for My Team UI state.
 * Tracks manager status, pending action badge counts, and per-member filter toggles.
 */

import { create } from "zustand";

// ============================================================================
// State Interface
// ============================================================================

interface TeamState {
  /** Whether the current user has direct reports */
  hasReports: boolean;
  /** Number of pending actions requiring manager attention */
  pendingActionsCount: number;
  /** Per-member filter toggles (keyed by member id) */
  teamFilterActive: Record<string, boolean>;
}

interface TeamActions {
  setHasReports: (value: boolean) => void;
  setPendingActionsCount: (count: number) => void;
  toggleTeamFilter: (memberId: string) => void;
  isTeamFilterActive: (memberId: string) => boolean;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useTeamStore = create<TeamState & TeamActions>()((set, get) => ({
  // Initial state
  hasReports: false,
  pendingActionsCount: 0,
  teamFilterActive: {},

  // ── Actions ──────────────────────────────────────────────────────────────

  setHasReports: (value) => set({ hasReports: value }),

  setPendingActionsCount: (count) => set({ pendingActionsCount: count }),

  toggleTeamFilter: (memberId) =>
    set((state) => ({
      teamFilterActive: {
        ...state.teamFilterActive,
        [memberId]: !state.teamFilterActive[memberId],
      },
    })),

  isTeamFilterActive: (memberId) => !!get().teamFilterActive[memberId],
}));
