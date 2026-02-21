//! Zustand store for calendar UI state

import { create } from "zustand";
import { Calendar, Event } from "@/types/calendar";

export type ViewMode = "month" | "week" | "day" | "agenda" | "year";

interface CalendarState {
  // View state
  viewMode: ViewMode;
  currentDate: Date;
  selectedCalendarIds: Set<string>;

  // Selection state
  selectedEventId: string | null;
  selectedCalendars: Calendar[];

  // Filter state
  filterText: string;

  // Data state
  events: Event[];
  calendars: Calendar[];
  isLoading: boolean;
  error: string | null;

  // Timezones
  timezones: string[];
  setTimezones: (timezones: string[]) => void;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setCurrentDate: (date: Date) => void;
  toggleCalendar: (calendarId: string) => void;
  selectEvent: (eventId: string | null) => void;
  setSelectedCalendars: (calendars: Calendar[]) => void;
  setFilterText: (text: string) => void;
  setEvents: (events: Event[]) => void;
  setCalendars: (calendars: Calendar[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Navigation
  nextMonth: () => void;
  prevMonth: () => void;
  today: () => void;
}

export const useCalendarStore = create<CalendarState>((set) => ({
  // Initial state
  viewMode: "month",
  currentDate: new Date(),
  selectedCalendarIds: new Set(),
  selectedEventId: null,
  selectedCalendars: [],
  filterText: "",
  events: [],
  calendars: [],
  timezones: [Intl.DateTimeFormat().resolvedOptions().timeZone, "UTC"], // Default to local and UTC
  isLoading: false,
  error: null,

  // Actions
  setTimezones: (timezones) => set({ timezones }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setCurrentDate: (date) => set({ currentDate: date }),
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
  setSelectedCalendars: (calendars) => set({ selectedCalendars: calendars }),
  setFilterText: (text) => set({ filterText: text }),
  setEvents: (events) => set({ events }),
  setCalendars: (calendars) => set({ calendars }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Navigation
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
}));
