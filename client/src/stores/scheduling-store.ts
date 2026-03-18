/**
 * Scheduling Store
 *
 * Zustand store for the Unified Scheduling UI.
 * Manages state for Calendar, Tasks, Resources, and Team views.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import {
  addDays,
  addWeeks,
  addMonths,
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
} from 'date-fns';
import type {
  ViewType,
  TabType,
  ScheduleBlock,
  SchedulingFilters,
  ViewConfig,
  DateRange,
  DEFAULT_VIEW_CONFIG,
} from '@/lib/scheduling/types/scheduling';

// ============================================================================
// State Interface
// ============================================================================

interface SchedulingState {
  // Navigation
  activeTab: TabType;
  activeView: ViewType;
  currentDate: Date;

  // Selection
  selectedBlockId: string | null;
  selectedBlockIds: Set<string>;

  // Data
  blocks: ScheduleBlock[];
  isLoading: boolean;
  error: string | null;

  // UI State
  isSidebarCollapsed: boolean;
  isCommandPaletteOpen: boolean;
  filters: SchedulingFilters;
  viewConfig: ViewConfig;

  // Undo/Redo
  undoStack: ScheduleBlock[][];
  redoStack: ScheduleBlock[][];
}

interface SchedulingActions {
  // Tab & View
  setActiveTab: (tab: TabType) => void;
  setActiveView: (view: ViewType) => void;

  // Date Navigation
  setCurrentDate: (date: Date) => void;
  goToToday: () => void;
  navigatePrev: () => void;
  navigateNext: () => void;
  getDateRange: () => DateRange;

  // Selection
  selectBlock: (id: string | null) => void;
  toggleBlockSelection: (id: string) => void;
  selectAllBlocks: () => void;
  clearSelection: () => void;

  // Data
  setBlocks: (blocks: ScheduleBlock[]) => void;
  addBlock: (block: ScheduleBlock) => void;
  updateBlock: (id: string, updates: Partial<ScheduleBlock>) => void;
  deleteBlock: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // UI
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  setFilters: (filters: Partial<SchedulingFilters>) => void;
  clearFilters: () => void;
  setViewConfig: (config: Partial<ViewConfig>) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pushUndoState: () => void;
}

// ============================================================================
// Default Values
// ============================================================================

const defaultViewConfig: ViewConfig = {
  slotDuration: 30,
  workingHoursStart: 9,
  workingHoursEnd: 18,
  firstDayOfWeek: 1,
  showWeekNumbers: true,
  compactMode: false,
};

const defaultFilters: SchedulingFilters = {
  showWeekends: true,
  showAllDay: true,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useSchedulingStore = create<SchedulingState & SchedulingActions>()(
  persist(
    (set, get) => ({
      // Initial State
      activeTab: 'my-day',
      activeView: 'week',
      currentDate: new Date(),
      selectedBlockId: null,
      selectedBlockIds: new Set(),
      blocks: [],
      isLoading: false,
      error: null,
      isSidebarCollapsed: false,
      isCommandPaletteOpen: false,
      filters: defaultFilters,
      viewConfig: defaultViewConfig,
      undoStack: [],
      redoStack: [],

      // ======================================================================
      // Tab & View Actions
      // ======================================================================

      setActiveTab: (tab) => set({ activeTab: tab }),

      setActiveView: (view) => set({ activeView: view }),

      // ======================================================================
      // Date Navigation
      // ======================================================================

      setCurrentDate: (date) => set({ currentDate: date }),

      goToToday: () => set({ currentDate: new Date() }),

      navigatePrev: () => {
        const { activeView, currentDate, viewConfig } = get();
        let newDate: Date;

        switch (activeView) {
          case 'day':
            newDate = addDays(currentDate, -1);
            break;
          case '3-day':
            newDate = addDays(currentDate, -3);
            break;
          case 'week':
            newDate = addWeeks(currentDate, -1);
            break;
          case 'month':
            newDate = addMonths(currentDate, -1);
            break;
          case 'agenda':
          default:
            newDate = addWeeks(currentDate, -1);
            break;
        }

        set({ currentDate: newDate });
      },

      navigateNext: () => {
        const { activeView, currentDate } = get();
        let newDate: Date;

        switch (activeView) {
          case 'day':
            newDate = addDays(currentDate, 1);
            break;
          case '3-day':
            newDate = addDays(currentDate, 3);
            break;
          case 'week':
            newDate = addWeeks(currentDate, 1);
            break;
          case 'month':
            newDate = addMonths(currentDate, 1);
            break;
          case 'agenda':
          default:
            newDate = addWeeks(currentDate, 1);
            break;
        }

        set({ currentDate: newDate });
      },

      getDateRange: (): DateRange => {
        const { activeView, currentDate, viewConfig } = get();

        switch (activeView) {
          case 'day':
            return {
              start: startOfDay(currentDate),
              end: endOfDay(currentDate),
            };
          case '3-day':
            return {
              start: startOfDay(currentDate),
              end: endOfDay(addDays(currentDate, 2)),
            };
          case 'week':
            return {
              start: startOfWeek(currentDate, { weekStartsOn: viewConfig.firstDayOfWeek }),
              end: endOfWeek(currentDate, { weekStartsOn: viewConfig.firstDayOfWeek }),
            };
          case 'month':
            return {
              start: startOfMonth(currentDate),
              end: endOfMonth(currentDate),
            };
          case 'agenda':
          default:
            return {
              start: startOfDay(currentDate),
              end: endOfDay(addDays(currentDate, 30)),
            };
        }
      },

      // ======================================================================
      // Selection
      // ======================================================================

      selectBlock: (id) => set({ selectedBlockId: id, selectedBlockIds: new Set(id ? [id] : []) }),

      toggleBlockSelection: (id) => {
        const { selectedBlockIds } = get();
        const updated = new Set(selectedBlockIds);
        if (updated.has(id)) {
          updated.delete(id);
        } else {
          updated.add(id);
        }
        set({
          selectedBlockIds: updated,
          selectedBlockId: updated.size === 1 ? Array.from(updated)[0] : null,
        });
      },

      selectAllBlocks: () => {
        const { blocks } = get();
        set({
          selectedBlockIds: new Set(blocks.map((b) => b.id)),
          selectedBlockId: null,
        });
      },

      clearSelection: () => set({ selectedBlockId: null, selectedBlockIds: new Set() }),

      // ======================================================================
      // Data Management
      // ======================================================================

      setBlocks: (blocks) => set({ blocks }),

      addBlock: (block) => {
        get().pushUndoState();
        set((state) => ({ blocks: [...state.blocks, block] }));
      },

      updateBlock: (id, updates) => {
        get().pushUndoState();
        set((state) => ({
          blocks: state.blocks.map((b) =>
            b.id === id ? { ...b, ...updates, updatedAt: new Date() } : b
          ),
        }));
      },

      deleteBlock: (id) => {
        get().pushUndoState();
        set((state) => ({
          blocks: state.blocks.filter((b) => b.id !== id),
          selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
          selectedBlockIds: new Set([...state.selectedBlockIds].filter((i) => i !== id)),
        }));
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      // ======================================================================
      // UI Actions
      // ======================================================================

      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),

      openCommandPalette: () => set({ isCommandPaletteOpen: true }),

      closeCommandPalette: () => set({ isCommandPaletteOpen: false }),

      toggleCommandPalette: () =>
        set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),

      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),

      clearFilters: () => set({ filters: defaultFilters }),

      setViewConfig: (config) =>
        set((state) => ({ viewConfig: { ...state.viewConfig, ...config } })),

      // ======================================================================
      // Undo/Redo
      // ======================================================================

      pushUndoState: () => {
        const { blocks, undoStack } = get();
        set({
          undoStack: [...undoStack.slice(-49), blocks],
          redoStack: [],
        });
      },

      undo: () => {
        const { undoStack, redoStack, blocks } = get();
        if (undoStack.length === 0) return;

        const previousState = undoStack[undoStack.length - 1];
        set({
          blocks: previousState,
          undoStack: undoStack.slice(0, -1),
          redoStack: [...redoStack, blocks],
        });
      },

      redo: () => {
        const { undoStack, redoStack, blocks } = get();
        if (redoStack.length === 0) return;

        const nextState = redoStack[redoStack.length - 1];
        set({
          blocks: nextState,
          redoStack: redoStack.slice(0, -1),
          undoStack: [...undoStack, blocks],
        });
      },

      canUndo: () => get().undoStack.length > 0,

      canRedo: () => get().redoStack.length > 0,
    }),
    {
      name: 'scheduling-storage',
      version: 1,
      partialize: (state) => ({
        activeTab: state.activeTab,
        activeView: state.activeView,
        isSidebarCollapsed: state.isSidebarCollapsed,
        filters: state.filters,
        viewConfig: state.viewConfig,
      }),
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

export const useSchedulingNavigation = () =>
  useSchedulingStore(
    useShallow((state) => ({
      activeTab: state.activeTab,
      activeView: state.activeView,
      currentDate: state.currentDate,
      setActiveTab: state.setActiveTab,
      setActiveView: state.setActiveView,
      setCurrentDate: state.setCurrentDate,
      goToToday: state.goToToday,
      navigatePrev: state.navigatePrev,
      navigateNext: state.navigateNext,
      getDateRange: state.getDateRange,
    }))
  );

export const useSchedulingSelection = () =>
  useSchedulingStore(
    useShallow((state) => ({
      selectedBlockId: state.selectedBlockId,
      selectedBlockIds: state.selectedBlockIds,
      selectBlock: state.selectBlock,
      toggleBlockSelection: state.toggleBlockSelection,
      clearSelection: state.clearSelection,
    }))
  );

export const useSchedulingData = () =>
  useSchedulingStore(
    useShallow((state) => ({
      blocks: state.blocks,
      isLoading: state.isLoading,
      error: state.error,
      setBlocks: state.setBlocks,
      addBlock: state.addBlock,
      updateBlock: state.updateBlock,
      deleteBlock: state.deleteBlock,
    }))
  );

export const useSchedulingUI = () =>
  useSchedulingStore(
    useShallow((state) => ({
      isSidebarCollapsed: state.isSidebarCollapsed,
      isCommandPaletteOpen: state.isCommandPaletteOpen,
      filters: state.filters,
      viewConfig: state.viewConfig,
      toggleSidebar: state.toggleSidebar,
      openCommandPalette: state.openCommandPalette,
      closeCommandPalette: state.closeCommandPalette,
      toggleCommandPalette: state.toggleCommandPalette,
      setFilters: state.setFilters,
      setViewConfig: state.setViewConfig,
    }))
  );

export const useSchedulingUndo = () =>
  useSchedulingStore(
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
    }))
  );
