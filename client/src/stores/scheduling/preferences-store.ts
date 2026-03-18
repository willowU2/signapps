/**
 * Unified Scheduling System - User Preferences Store
 * Story 1.1.5: User Preferences Store
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { ViewType, Scope, TimeOfDay } from '@/lib/scheduling/types';
import { schedulingApi } from '@/lib/scheduling/api';

// ============================================================================
// STATE INTERFACE
// ============================================================================

interface PreferencesState {
  // Energy Settings
  peakHoursStart: number; // e.g., 9
  peakHoursEnd: number; // e.g., 12

  // Pomodoro Settings
  pomodoroLength: number; // minutes, default 25
  shortBreakLength: number; // minutes, default 5
  longBreakLength: number; // minutes, default 15
  pomodorosUntilLongBreak: number; // default 4

  // Display Preferences
  showWeekends: boolean;
  show24Hour: boolean;
  defaultView: ViewType;
  defaultScope: Scope;
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday

  // Notification Settings
  reminderDefaults: number[]; // minutes before [15, 60]
  enableSoundNotifications: boolean;
  enableDesktopNotifications: boolean;

  // Energy-Aware Scheduling
  energyProfile: {
    morning: 'high' | 'medium' | 'low';
    midday: 'high' | 'medium' | 'low';
    afternoon: 'high' | 'medium' | 'low';
    evening: 'high' | 'medium' | 'low';
  };
  preferredDeepWorkTime: TimeOfDay;

  // Auto-Scheduling Preferences
  autoScheduleEnabled: boolean;
  respectBlockers: boolean;
  bufferBetweenMeetings: number; // minutes

  // Sync Status
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;

  // Actions
  updatePreferences: (updates: Partial<PreferencesState>) => void;
  setPeakHours: (start: number, end: number) => void;
  setPomodoroSettings: (length: number, breakLength: number) => void;
  setReminderDefaults: (minutes: number[]) => void;
  setEnergyProfile: (profile: PreferencesState['energyProfile']) => void;
  toggleAutoSchedule: () => void;
  syncWithServer: () => Promise<void>;
  loadFromServer: () => Promise<void>;
  reset: () => void;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const defaultEnergyProfile = {
  morning: 'high' as const,
  midday: 'medium' as const,
  afternoon: 'low' as const,
  evening: 'medium' as const,
};

const initialState = {
  // Energy Settings
  peakHoursStart: 9,
  peakHoursEnd: 12,

  // Pomodoro Settings
  pomodoroLength: 25,
  shortBreakLength: 5,
  longBreakLength: 15,
  pomodorosUntilLongBreak: 4,

  // Display Preferences
  showWeekends: true,
  show24Hour: true,
  defaultView: 'week' as ViewType,
  defaultScope: 'moi' as Scope,
  weekStartsOn: 1 as 0 | 1,

  // Notification Settings
  reminderDefaults: [15, 60],
  enableSoundNotifications: true,
  enableDesktopNotifications: true,

  // Energy-Aware Scheduling
  energyProfile: defaultEnergyProfile,
  preferredDeepWorkTime: 'morning' as TimeOfDay,

  // Auto-Scheduling
  autoScheduleEnabled: false,
  respectBlockers: true,
  bufferBetweenMeetings: 15,

  // Sync Status
  isSyncing: false,
  lastSyncedAt: null as string | null,
  syncError: null as string | null,
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const usePreferencesStore = create<PreferencesState>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // ======================================================================
        // UPDATE ACTIONS
        // ======================================================================

        updatePreferences: (updates: Partial<PreferencesState>) => {
          set((state) => {
            Object.assign(state, updates);
          });
        },

        setPeakHours: (start: number, end: number) => {
          set((state) => {
            state.peakHoursStart = Math.max(0, Math.min(23, start));
            state.peakHoursEnd = Math.max(state.peakHoursStart + 1, Math.min(24, end));
          });
        },

        setPomodoroSettings: (length: number, breakLength: number) => {
          set((state) => {
            state.pomodoroLength = Math.max(5, Math.min(60, length));
            state.shortBreakLength = Math.max(1, Math.min(30, breakLength));
          });
        },

        setReminderDefaults: (minutes: number[]) => {
          set((state) => {
            state.reminderDefaults = minutes.filter((m) => m > 0).sort((a, b) => a - b);
          });
        },

        setEnergyProfile: (profile: PreferencesState['energyProfile']) => {
          set((state) => {
            state.energyProfile = profile;
          });
        },

        toggleAutoSchedule: () => {
          set((state) => {
            state.autoScheduleEnabled = !state.autoScheduleEnabled;
          });
        },

        // ======================================================================
        // SYNC ACTIONS
        // ======================================================================

        syncWithServer: async () => {
          const state = get();
          set((s) => {
            s.isSyncing = true;
            s.syncError = null;
          });

          try {
            await schedulingApi.updatePreferences({
              peakHoursStart: state.peakHoursStart,
              peakHoursEnd: state.peakHoursEnd,
              pomodoroLength: state.pomodoroLength,
              breakLength: state.shortBreakLength,
              showWeekends: state.showWeekends,
              show24Hour: state.show24Hour,
              defaultView: state.defaultView,
              defaultScope: state.defaultScope,
              weekStartsOn: state.weekStartsOn,
              reminderDefaults: state.reminderDefaults,
            });

            set((s) => {
              s.isSyncing = false;
              s.lastSyncedAt = new Date().toISOString();
            });
          } catch (error) {
            set((s) => {
              s.isSyncing = false;
              s.syncError = error instanceof Error ? error.message : 'Sync failed';
            });
          }
        },

        loadFromServer: async () => {
          set((s) => {
            s.isSyncing = true;
            s.syncError = null;
          });

          try {
            const prefs = await schedulingApi.getPreferences();

            set((s) => {
              s.peakHoursStart = prefs.peakHoursStart;
              s.peakHoursEnd = prefs.peakHoursEnd;
              s.pomodoroLength = prefs.pomodoroLength;
              s.shortBreakLength = prefs.breakLength;
              s.showWeekends = prefs.showWeekends;
              s.show24Hour = prefs.show24Hour;
              s.defaultView = prefs.defaultView as ViewType;
              s.defaultScope = prefs.defaultScope as Scope;
              s.weekStartsOn = prefs.weekStartsOn as 0 | 1;
              s.reminderDefaults = prefs.reminderDefaults;
              s.isSyncing = false;
              s.lastSyncedAt = new Date().toISOString();
            });
          } catch (error) {
            set((s) => {
              s.isSyncing = false;
              s.syncError = error instanceof Error ? error.message : 'Load failed';
            });
          }
        },

        reset: () => {
          set((state) => {
            Object.assign(state, initialState);
          });
        },
      })),
      {
        name: 'scheduling-preferences',
        partialize: (state) => ({
          peakHoursStart: state.peakHoursStart,
          peakHoursEnd: state.peakHoursEnd,
          pomodoroLength: state.pomodoroLength,
          shortBreakLength: state.shortBreakLength,
          longBreakLength: state.longBreakLength,
          pomodorosUntilLongBreak: state.pomodorosUntilLongBreak,
          showWeekends: state.showWeekends,
          show24Hour: state.show24Hour,
          defaultView: state.defaultView,
          defaultScope: state.defaultScope,
          weekStartsOn: state.weekStartsOn,
          reminderDefaults: state.reminderDefaults,
          enableSoundNotifications: state.enableSoundNotifications,
          enableDesktopNotifications: state.enableDesktopNotifications,
          energyProfile: state.energyProfile,
          preferredDeepWorkTime: state.preferredDeepWorkTime,
          autoScheduleEnabled: state.autoScheduleEnabled,
          respectBlockers: state.respectBlockers,
          bufferBetweenMeetings: state.bufferBetweenMeetings,
        }),
      }
    ),
    { name: 'preferences-store' }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectPeakHours = (state: PreferencesState) => ({
  start: state.peakHoursStart,
  end: state.peakHoursEnd,
});

export const selectPomodoroSettings = (state: PreferencesState) => ({
  length: state.pomodoroLength,
  shortBreak: state.shortBreakLength,
  longBreak: state.longBreakLength,
  pomodorosUntilLongBreak: state.pomodorosUntilLongBreak,
});

export const selectDisplayPreferences = (state: PreferencesState) => ({
  showWeekends: state.showWeekends,
  show24Hour: state.show24Hour,
  defaultView: state.defaultView,
  defaultScope: state.defaultScope,
  weekStartsOn: state.weekStartsOn,
});

export const selectEnergyProfile = (state: PreferencesState) => state.energyProfile;
export const selectAutoScheduleEnabled = (state: PreferencesState) => state.autoScheduleEnabled;
export const selectIsSyncing = (state: PreferencesState) => state.isSyncing;

export default usePreferencesStore;
