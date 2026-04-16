//! Zustand store for calendar UI state

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { Calendar, Event } from "@/types/calendar";
import type {
  TimeItem,
  UpdateTimeItemInput,
  CreateTimeItemInput,
  Scope,
} from "@/lib/scheduling/types";
import { schedulingApi } from "@/lib/scheduling/api/scheduling-api";

// Re-export usePreferencesStore for convenience
export { usePreferencesStore } from "@/stores/scheduling/preferences-store";

export type ViewMode = "month" | "week" | "day" | "agenda" | "year";
export type ViewType =
  | "day"
  | "week"
  | "month"
  | "agenda"
  | "timeline"
  | "kanban"
  | "heatmap"
  | "roster"
  | "tasks"
  | "availability"
  | "presence";

interface LayerConfig {
  layer_id: string;
  enabled: boolean;
  opacity: number;
  color_override?: string;
}

const DEFAULT_LAYERS: LayerConfig[] = [
  { layer_id: "my-events", enabled: true, opacity: 100 },
  { layer_id: "my-tasks", enabled: true, opacity: 100 },
  { layer_id: "team-leaves", enabled: false, opacity: 100 },
  { layer_id: "rooms", enabled: false, opacity: 100 },
  { layer_id: "equipment", enabled: false, opacity: 100 },
  { layer_id: "vehicles", enabled: false, opacity: 100 },
  { layer_id: "projects", enabled: false, opacity: 100 },
  { layer_id: "team-shifts", enabled: false, opacity: 100 },
  { layer_id: "external", enabled: false, opacity: 100 },
];

interface CalendarState {
  // Legacy view state (kept for backward compatibility)
  viewMode: ViewMode;
  selectedCalendarIds: Set<string>;
  selectedEventId: string | null;
  selectedCalendars: Calendar[];
  filterText: string;
  events: Event[];
  calendars: Calendar[];
  isLoading: boolean;
  error: string | null;
  timezones: string[];

  // Unified view
  view: ViewType;
  setView: (view: ViewType) => void;

  // Date navigation
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  navigateForward: () => void;
  navigateBack: () => void;
  goToToday: () => void;

  // Layers
  layers: LayerConfig[];
  setLayers: (layers: LayerConfig[]) => void;
  toggleLayer: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;

  // Colleagues overlay
  selectedColleagues: string[];
  toggleColleague: (id: string) => void;

  // Resources overlay
  selectedResources: string[];
  toggleResource: (id: string) => void;

  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  layerPanelOpen: boolean;
  setLayerPanelOpen: (open: boolean) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Legacy actions
  setTimezones: (timezones: string[]) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleCalendar: (calendarId: string) => void;
  selectEvent: (eventId: string | null) => void;
  setSelectedCalendars: (calendars: Calendar[]) => void;
  setFilterText: (text: string) => void;
  setEvents: (events: Event[]) => void;
  setCalendars: (calendars: Calendar[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Legacy navigation (kept for backward compatibility)
  nextMonth: () => void;
  prevMonth: () => void;
  today: () => void;

  // TimeItems (scheduling store mirror for view components)
  timeItems: TimeItem[];
  isLoadingTimeItems: boolean;
  weekStartsOn: 0 | 1;
  scope: Scope | null;
  fetchTimeItems: (range: { start: Date; end: Date }) => Promise<void>;
  updateTimeItem: (id: string, updates: UpdateTimeItemInput) => Promise<void>;
  createTimeItem: (input: CreateTimeItemInput) => Promise<TimeItem>;

  // Undo stack — records recently-destructive actions so Ctrl+Z can revert them.
  // Minimal shape: only delete is tracked for now (most common "oops" action).
  undoStack: UndoAction[];
  pushUndo: (action: UndoAction) => void;
  popUndo: () => UndoAction | null;
  clearUndo: () => void;
}

/** A reversible action tracked in the calendar undo stack. */
export type UndoAction = { type: "delete"; event: Event };

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      // ---- Legacy state ----
      viewMode: "month" as ViewMode,
      selectedCalendarIds: new Set(),
      selectedEventId: null as string | null,
      selectedCalendars: [] as Calendar[],
      filterText: "",
      events: [] as Event[],
      calendars: [] as Calendar[],
      timezones: [Intl.DateTimeFormat().resolvedOptions().timeZone, "UTC"],
      isLoading: false,
      error: null as string | null,

      // ---- Unified view ----
      view: "month" as ViewType,
      setView: (view) => set({ view }),

      // ---- Date navigation ----
      currentDate: new Date(),
      setCurrentDate: (date) => set({ currentDate: date }),
      navigateForward: () =>
        set((state) => {
          const next = new Date(state.currentDate);
          switch (state.view) {
            case "day":
              next.setDate(next.getDate() + 1);
              break;
            case "week":
            case "timeline":
            case "roster":
            case "availability":
            case "presence":
              next.setDate(next.getDate() + 7);
              break;
            default:
              next.setMonth(next.getMonth() + 1);
          }
          return { currentDate: next };
        }),
      navigateBack: () =>
        set((state) => {
          const prev = new Date(state.currentDate);
          switch (state.view) {
            case "day":
              prev.setDate(prev.getDate() - 1);
              break;
            case "week":
            case "timeline":
            case "roster":
            case "availability":
            case "presence":
              prev.setDate(prev.getDate() - 7);
              break;
            default:
              prev.setMonth(prev.getMonth() - 1);
          }
          return { currentDate: prev };
        }),
      goToToday: () => set({ currentDate: new Date() }),

      // ---- Layers ----
      layers: DEFAULT_LAYERS,
      setLayers: (layers) => set({ layers }),
      toggleLayer: (layerId) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.layer_id === layerId ? { ...l, enabled: !l.enabled } : l,
          ),
        })),
      setLayerOpacity: (layerId, opacity) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.layer_id === layerId ? { ...l, opacity } : l,
          ),
        })),

      // ---- Colleagues overlay ----
      selectedColleagues: [] as string[],
      toggleColleague: (id) =>
        set((state) => ({
          selectedColleagues: state.selectedColleagues.includes(id)
            ? state.selectedColleagues.filter((c) => c !== id)
            : [...state.selectedColleagues, id],
        })),

      // ---- Resources overlay ----
      selectedResources: [] as string[],
      toggleResource: (id) =>
        set((state) => ({
          selectedResources: state.selectedResources.includes(id)
            ? state.selectedResources.filter((r) => r !== id)
            : [...state.selectedResources, id],
        })),

      // ---- UI ----
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      layerPanelOpen: false,
      setLayerPanelOpen: (open) => set({ layerPanelOpen: open }),

      // ---- Search ----
      searchQuery: "",
      setSearchQuery: (query) => set({ searchQuery: query }),

      // ---- Legacy actions ----
      setTimezones: (timezones) => set({ timezones }),
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleCalendar: (calendarId) =>
        set((state) => {
          const updated = new Set(state.selectedCalendarIds);
          if (updated.has(calendarId)) {
            updated.delete(calendarId);
          } else {
            updated.add(calendarId);
          }
          return { selectedCalendarIds: updated };
        }),
      selectEvent: (eventId) => set({ selectedEventId: eventId }),
      setSelectedCalendars: (calendars) =>
        set({ selectedCalendars: calendars }),
      setFilterText: (text) => set({ filterText: text }),
      setEvents: (events) => set({ events }),
      setCalendars: (calendars) => set({ calendars }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      // ---- Legacy navigation ----
      nextMonth: () =>
        set((state) => {
          const next = new Date(state.currentDate);
          next.setMonth(next.getMonth() + 1);
          return { currentDate: next };
        }),
      prevMonth: () =>
        set((state) => {
          const prev = new Date(state.currentDate);
          prev.setMonth(prev.getMonth() - 1);
          return { currentDate: prev };
        }),
      today: () => set({ currentDate: new Date() }),

      // ---- TimeItems (scheduling) ----
      timeItems: [] as TimeItem[],
      isLoadingTimeItems: false,
      weekStartsOn: 1 as 0 | 1,
      scope: null as Scope | null,
      fetchTimeItems: async (range) => {
        set({ isLoadingTimeItems: true });
        try {
          const response = await schedulingApi.getTimeItemsInRange(
            range.start.toISOString(),
            range.end.toISOString(),
          );
          set({ timeItems: response, isLoadingTimeItems: false });
        } catch {
          set({ isLoadingTimeItems: false });
        }
      },
      updateTimeItem: async (id, updates) => {
        const item = await schedulingApi.updateTimeItem(id, updates);
        set((state) => ({
          timeItems: state.timeItems.map((t) => (t.id === id ? item : t)),
        }));
      },
      createTimeItem: async (input) => {
        const item = await schedulingApi.createTimeItem(input);
        set((state) => ({ timeItems: [...state.timeItems, item] }));
        return item;
      },

      // ---- Undo stack ----
      undoStack: [] as UndoAction[],
      pushUndo: (action) =>
        set((state) => ({
          // Cap the stack at 20 to avoid unbounded growth
          undoStack: [...state.undoStack.slice(-19), action],
        })),
      popUndo: (): UndoAction | null => {
        const stack = get().undoStack;
        if (stack.length === 0) return null;
        const action = stack[stack.length - 1];
        set({ undoStack: stack.slice(0, -1) });
        return action;
      },
      clearUndo: () => set({ undoStack: [] }),
    }),
    {
      name: "signapps-calendar",
      partialize: (state: CalendarState) => ({
        view: state.view,
        layers: state.layers,
        sidebarOpen: state.sidebarOpen,
        layerPanelOpen: state.layerPanelOpen,
        selectedColleagues: state.selectedColleagues,
        selectedResources: state.selectedResources,
      }),
      // JSON has no Set — after rehydration, anything that was serialised as
      // an array must be reconstructed as a Set to preserve the expected type.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (
          state.selectedCalendarIds &&
          !(state.selectedCalendarIds instanceof Set)
        ) {
          state.selectedCalendarIds = new Set(
            state.selectedCalendarIds as unknown as string[],
          );
        }
      },
    },
  ),
);

// ============================================================================
// Granular selector hooks for optimized re-renders
// ============================================================================

export const useCalendarViewState = () =>
  useCalendarStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
      currentDate: state.currentDate,
    })),
  );

export const useCalendarNavigation = () =>
  useCalendarStore(
    useShallow((state) => ({
      nextMonth: state.nextMonth,
      prevMonth: state.prevMonth,
      today: state.today,
      setCurrentDate: state.setCurrentDate,
    })),
  );

export const useCalendarSelection = () =>
  useCalendarStore(
    useShallow((state) => ({
      selectedEventId: state.selectedEventId,
      selectEvent: state.selectEvent,
    })),
  );

export const useCalendarData = () =>
  useCalendarStore(
    useShallow((state) => ({
      events: state.events,
      calendars: state.calendars,
      isLoading: state.isLoading,
    })),
  );

export const useCalendarTimezones = () =>
  useCalendarStore((state) => state.timezones);
