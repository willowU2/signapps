/**
 * Unified Scheduling System - Calendar Navigation Store
 * Story 1.1.4: Calendar Navigation Store
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
} from 'date-fns';
import type { ViewType, DateRange } from '@/lib/scheduling/types';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface CalendarState {
  // Navigation
  currentDate: Date;
  view: ViewType;

  // Display Settings
  hourStart: number; // e.g., 6 (6 AM)
  hourEnd: number; // e.g., 22 (10 PM)
  slotDuration: number; // minutes (15, 30, 60)
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday

  // Energy Zones
  morningEnd: number; // Hour when morning ends (e.g., 12)
  afternoonStart: number; // Hour when afternoon starts (e.g., 14)

  // Display Options
  showWeekends: boolean;
  show24Hour: boolean;
  showEnergyZones: boolean;
  compactMode: boolean;

  // Actions
  setView: (view: ViewType) => void;
  setCurrentDate: (date: Date) => void;
  navigateToDate: (date: Date) => void;
  navigateRelative: (direction: 'prev' | 'next') => void;
  goToToday: () => void;

  // Settings
  setHourRange: (start: number, end: number) => void;
  setSlotDuration: (duration: number) => void;
  setWeekStartsOn: (day: 0 | 1) => void;
  setEnergyZones: (morningEnd: number, afternoonStart: number) => void;
  toggleWeekends: () => void;
  toggle24Hour: () => void;
  toggleEnergyZones: () => void;
  toggleCompactMode: () => void;

  // Computed
  getDateRange: () => DateRange;
  getVisibleDays: () => Date[];
  getTimeSlots: () => { hour: number; minute: number }[];
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const initialState = {
  currentDate: new Date(),
  view: 'week' as ViewType,
  hourStart: 0,
  hourEnd: 24,
  slotDuration: 30,
  weekStartsOn: 1 as 0 | 1, // Monday
  morningEnd: 12,
  afternoonStart: 14,
  showWeekends: true,
  show24Hour: true,
  showEnergyZones: true,
  compactMode: false,
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const useCalendarStore = create<CalendarState>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // ======================================================================
        // NAVIGATION ACTIONS
        // ======================================================================

        setView: (view: ViewType) => {
          set((state) => {
            state.view = view;
          });
        },

        setCurrentDate: (date: Date) => {
          set((state) => {
            state.currentDate = date;
          });
        },

        navigateToDate: (date: Date) => {
          set((state) => {
            state.currentDate = date;
          });
        },

        navigateRelative: (direction: 'prev' | 'next') => {
          const { view, currentDate } = get();
          let newDate: Date;

          switch (view) {
            case 'day':
            case 'focus':
              newDate = direction === 'next'
                ? addDays(currentDate, 1)
                : subDays(currentDate, 1);
              break;
            case 'week':
            case 'roster':
              newDate = direction === 'next'
                ? addWeeks(currentDate, 1)
                : subWeeks(currentDate, 1);
              break;
            case 'month':
            case 'heatmap':
              newDate = direction === 'next'
                ? addMonths(currentDate, 1)
                : subMonths(currentDate, 1);
              break;
            case 'agenda':
            case 'timeline':
            case 'kanban':
            default:
              // For these views, navigate by week
              newDate = direction === 'next'
                ? addWeeks(currentDate, 1)
                : subWeeks(currentDate, 1);
              break;
          }

          set((state) => {
            state.currentDate = newDate;
          });
        },

        goToToday: () => {
          set((state) => {
            state.currentDate = new Date();
          });
        },

        // ======================================================================
        // SETTINGS ACTIONS
        // ======================================================================

        setHourRange: (start: number, end: number) => {
          set((state) => {
            state.hourStart = Math.max(0, Math.min(23, start));
            state.hourEnd = Math.max(state.hourStart + 1, Math.min(24, end));
          });
        },

        setSlotDuration: (duration: number) => {
          set((state) => {
            // Valid durations: 15, 30, 60
            state.slotDuration = [15, 30, 60].includes(duration) ? duration : 30;
          });
        },

        setWeekStartsOn: (day: 0 | 1) => {
          set((state) => {
            state.weekStartsOn = day;
          });
        },

        setEnergyZones: (morningEnd: number, afternoonStart: number) => {
          set((state) => {
            state.morningEnd = morningEnd;
            state.afternoonStart = afternoonStart;
          });
        },

        toggleWeekends: () => {
          set((state) => {
            state.showWeekends = !state.showWeekends;
          });
        },

        toggle24Hour: () => {
          set((state) => {
            state.show24Hour = !state.show24Hour;
          });
        },

        toggleEnergyZones: () => {
          set((state) => {
            state.showEnergyZones = !state.showEnergyZones;
          });
        },

        toggleCompactMode: () => {
          set((state) => {
            state.compactMode = !state.compactMode;
          });
        },

        // ======================================================================
        // COMPUTED GETTERS
        // ======================================================================

        getDateRange: (): DateRange => {
          const { view, currentDate, weekStartsOn } = get();

          switch (view) {
            case 'day':
            case 'focus':
              return {
                start: startOfDay(currentDate),
                end: endOfDay(currentDate),
              };
            case 'week':
            case 'roster':
              return {
                start: startOfWeek(currentDate, { weekStartsOn }),
                end: endOfWeek(currentDate, { weekStartsOn }),
              };
            case 'month':
            case 'heatmap':
              return {
                start: startOfMonth(currentDate),
                end: endOfMonth(currentDate),
              };
            case 'agenda':
            case 'timeline':
            case 'kanban':
            default:
              // Show 4 weeks for these views
              return {
                start: startOfWeek(currentDate, { weekStartsOn }),
                end: endOfWeek(addWeeks(currentDate, 3), { weekStartsOn }),
              };
          }
        },

        getVisibleDays: (): Date[] => {
          const { view, currentDate, weekStartsOn, showWeekends } = get();
          const days: Date[] = [];

          switch (view) {
            case 'day':
            case 'focus':
              days.push(startOfDay(currentDate));
              break;
            case 'week':
            case 'roster': {
              const weekStart = startOfWeek(currentDate, { weekStartsOn });
              for (let i = 0; i < 7; i++) {
                const day = addDays(weekStart, i);
                const dayOfWeek = day.getDay();
                // Skip weekends if not showing them
                if (!showWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
                  continue;
                }
                days.push(day);
              }
              break;
            }
            case 'month':
            case 'heatmap': {
              const monthStart = startOfMonth(currentDate);
              const monthEnd = endOfMonth(currentDate);
              const gridStart = startOfWeek(monthStart, { weekStartsOn });
              const gridEnd = endOfWeek(monthEnd, { weekStartsOn });

              let current = gridStart;
              while (current <= gridEnd) {
                days.push(current);
                current = addDays(current, 1);
              }
              break;
            }
            default: {
              // 4 weeks for other views
              const start = startOfWeek(currentDate, { weekStartsOn });
              for (let i = 0; i < 28; i++) {
                const day = addDays(start, i);
                const dayOfWeek = day.getDay();
                if (!showWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
                  continue;
                }
                days.push(day);
              }
            }
          }

          return days;
        },

        getTimeSlots: (): { hour: number; minute: number }[] => {
          const { hourStart, hourEnd, slotDuration } = get();
          const slots: { hour: number; minute: number }[] = [];

          for (let hour = hourStart; hour < hourEnd; hour++) {
            for (let minute = 0; minute < 60; minute += slotDuration) {
              slots.push({ hour, minute });
            }
          }

          return slots;
        },
      })),
      {
        name: 'calendar-store-v2',
        partialize: (state) => ({
          view: state.view,
          hourStart: state.hourStart,
          hourEnd: state.hourEnd,
          slotDuration: state.slotDuration,
          weekStartsOn: state.weekStartsOn,
          morningEnd: state.morningEnd,
          afternoonStart: state.afternoonStart,
          showWeekends: state.showWeekends,
          show24Hour: state.show24Hour,
          showEnergyZones: state.showEnergyZones,
          compactMode: state.compactMode,
        }),
      }
    ),
    { name: 'calendar-store-v2' }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectCurrentDate = (state: CalendarState) => state.currentDate;
export const selectView = (state: CalendarState) => state.view;
export const selectHourRange = (state: CalendarState) => ({
  start: state.hourStart,
  end: state.hourEnd,
});
export const selectSlotDuration = (state: CalendarState) => state.slotDuration;
export const selectWeekStartsOn = (state: CalendarState) => state.weekStartsOn;
export const selectShowWeekends = (state: CalendarState) => state.showWeekends;
export const selectShow24Hour = (state: CalendarState) => state.show24Hour;
export const selectShowEnergyZones = (state: CalendarState) => state.showEnergyZones;
export const selectCompactMode = (state: CalendarState) => state.compactMode;
export const selectEnergyZones = (state: CalendarState) => ({
  morningEnd: state.morningEnd,
  afternoonStart: state.afternoonStart,
});

export default useCalendarStore;
