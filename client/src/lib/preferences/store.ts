/**
 * Preferences Store
 *
 * Zustand store for user preferences with local persistence and sync.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  UserPreferences,
  PreferencesSection,
  SyncStatus,
  ThemePreferences,
  LayoutPreferences,
  NotificationPreferences,
  EditorPreferences,
  DashboardPreferences,
  CalendarPreferences,
  StoragePreferences,
  MailPreferences,
  AccessibilityPreferences,
  KeyboardPreferences,
  PrivacyPreferences,
  LocalePreferences,
} from "./types";
import { DEFAULT_PREFERENCES } from "./types";
import {
  fetchPreferences,
  syncPreferences,
  patchPreferences,
  getDeviceId,
  queueChange,
  getQueue,
  clearQueue,
  isOnline,
  createSyncDebouncer,
  mergePreferences,
} from "./api";

// ============================================================================
// Store Types
// ============================================================================

interface PreferencesState {
  // Data
  preferences: UserPreferences;
  isInitialized: boolean;

  // Sync status
  syncStatus: SyncStatus;

  // Actions - General
  initialize: () => Promise<void>;
  reset: () => void;

  // Actions - Sync
  sync: () => Promise<void>;
  flushPendingChanges: () => Promise<void>;

  // Actions - Update sections
  updateTheme: (data: Partial<ThemePreferences>) => void;
  updateLayout: (data: Partial<LayoutPreferences>) => void;
  updateNotifications: (data: Partial<NotificationPreferences>) => void;
  updateEditor: (data: Partial<EditorPreferences>) => void;
  updateDashboard: (data: Partial<DashboardPreferences>) => void;
  updateCalendar: (data: Partial<CalendarPreferences>) => void;
  updateStorage: (data: Partial<StoragePreferences>) => void;
  updateMail: (data: Partial<MailPreferences>) => void;
  updateAccessibility: (data: Partial<AccessibilityPreferences>) => void;
  updateKeyboard: (data: Partial<KeyboardPreferences>) => void;
  updatePrivacy: (data: Partial<PrivacyPreferences>) => void;
  updateLocale: (data: Partial<LocalePreferences>) => void;

  // Actions - Generic update
  updateSection: <T extends PreferencesSection>(
    section: T,
    data: Partial<UserPreferences[T]>
  ) => void;
}

// ============================================================================
// Sync Debouncer
// ============================================================================

const syncDebouncer = createSyncDebouncer(2000);

// ============================================================================
// Store Implementation
// ============================================================================

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      // Initial state
      preferences: DEFAULT_PREFERENCES,
      isInitialized: false,
      syncStatus: {
        isSyncing: false,
        lastSyncedAt: null,
        lastError: null,
        pendingChanges: 0,
      },

      // Initialize - load from server and merge with local
      initialize: async () => {
        const state = get();
        if (state.isInitialized) return;

        try {
          set((s) => ({
            syncStatus: { ...s.syncStatus, isSyncing: true },
          }));

          if (isOnline()) {
            const response = await fetchPreferences();
            const merged = mergePreferences(state.preferences, response.preferences);

            set({
              preferences: merged,
              isInitialized: true,
              syncStatus: {
                isSyncing: false,
                lastSyncedAt: response.serverTimestamp,
                lastError: null,
                pendingChanges: 0,
              },
            });

            // Clear any offline queue after successful sync
            clearQueue();
          } else {
            // Offline - use local preferences
            set({
              isInitialized: true,
              syncStatus: {
                isSyncing: false,
                lastSyncedAt: state.preferences.lastSyncedAt,
                lastError: null,
                pendingChanges: getQueue().length,
              },
            });
          }
        } catch (error) {
          console.error("Failed to initialize preferences:", error);
          set({
            isInitialized: true,
            syncStatus: {
              isSyncing: false,
              lastSyncedAt: null,
              lastError: error instanceof Error ? error.message : "Unknown error",
              pendingChanges: getQueue().length,
            },
          });
        }
      },

      // Reset to defaults
      reset: () => {
        set({
          preferences: DEFAULT_PREFERENCES,
          syncStatus: {
            isSyncing: false,
            lastSyncedAt: null,
            lastError: null,
            pendingChanges: 0,
          },
        });
        clearQueue();
      },

      // Full sync to server
      sync: async () => {
        const state = get();

        if (!isOnline()) {
          set((s) => ({
            syncStatus: {
              ...s.syncStatus,
              lastError: "Offline - sync will resume when online",
            },
          }));
          return;
        }

        try {
          set((s) => ({
            syncStatus: { ...s.syncStatus, isSyncing: true, lastError: null },
          }));

          const response = await syncPreferences({
            preferences: state.preferences,
            clientTimestamp: new Date().toISOString(),
            deviceId: getDeviceId(),
          });

          set({
            preferences: response.preferences,
            syncStatus: {
              isSyncing: false,
              lastSyncedAt: response.serverTimestamp,
              lastError: null,
              pendingChanges: 0,
            },
          });

          clearQueue();
        } catch (error) {
          console.error("Sync failed:", error);
          set((s) => ({
            syncStatus: {
              ...s.syncStatus,
              isSyncing: false,
              lastError: error instanceof Error ? error.message : "Sync failed",
            },
          }));
        }
      },

      // Flush pending offline changes
      flushPendingChanges: async () => {
        const queue = getQueue();
        if (queue.length === 0) return;

        if (!isOnline()) return;

        try {
          set((s) => ({
            syncStatus: { ...s.syncStatus, isSyncing: true },
          }));

          // Process queue in order
          for (const change of queue) {
            await patchPreferences({
              section: change.section,
              data: change.data,
              clientTimestamp: change.timestamp,
              deviceId: getDeviceId(),
            });
          }

          clearQueue();

          set((s) => ({
            syncStatus: {
              ...s.syncStatus,
              isSyncing: false,
              pendingChanges: 0,
              lastSyncedAt: new Date().toISOString(),
            },
          }));
        } catch (error) {
          console.error("Failed to flush pending changes:", error);
          set((s) => ({
            syncStatus: {
              ...s.syncStatus,
              isSyncing: false,
              lastError: error instanceof Error ? error.message : "Flush failed",
            },
          }));
        }
      },

      // Generic section update
      updateSection: (section, data) => {
        const timestamp = new Date().toISOString();

        set((state) => ({
          preferences: {
            ...state.preferences,
            [section]: { ...state.preferences[section], ...data },
            lastSyncedAt: null, // Mark as dirty
            lastModifiedBy: getDeviceId(),
          },
          syncStatus: {
            ...state.syncStatus,
            pendingChanges: state.syncStatus.pendingChanges + 1,
          },
        }));

        // Queue for offline sync
        queueChange({
          section,
          data: data as Record<string, unknown>,
          timestamp,
        });

        // Schedule debounced sync
        syncDebouncer.schedule(() => get().sync());
      },

      // Section-specific updates (call generic updateSection)
      updateTheme: (data) => get().updateSection("theme", data),
      updateLayout: (data) => get().updateSection("layout", data),
      updateNotifications: (data) => get().updateSection("notifications", data),
      updateEditor: (data) => get().updateSection("editor", data),
      updateDashboard: (data) => get().updateSection("dashboard", data),
      updateCalendar: (data) => get().updateSection("calendar", data),
      updateStorage: (data) => get().updateSection("storage", data),
      updateMail: (data) => get().updateSection("mail", data),
      updateAccessibility: (data) => get().updateSection("accessibility", data),
      updateKeyboard: (data) => get().updateSection("keyboard", data),
      updatePrivacy: (data) => get().updateSection("privacy", data),
      updateLocale: (data) => get().updateSection("locale", data),
    }),
    {
      name: "signapps-preferences",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        isInitialized: state.isInitialized,
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectTheme = (state: PreferencesState) => state.preferences.theme;
export const selectLayout = (state: PreferencesState) => state.preferences.layout;
export const selectNotifications = (state: PreferencesState) => state.preferences.notifications;
export const selectEditor = (state: PreferencesState) => state.preferences.editor;
export const selectDashboard = (state: PreferencesState) => state.preferences.dashboard;
export const selectCalendar = (state: PreferencesState) => state.preferences.calendar;
export const selectStorage = (state: PreferencesState) => state.preferences.storage;
export const selectMail = (state: PreferencesState) => state.preferences.mail;
export const selectAccessibility = (state: PreferencesState) => state.preferences.accessibility;
export const selectKeyboard = (state: PreferencesState) => state.preferences.keyboard;
export const selectPrivacy = (state: PreferencesState) => state.preferences.privacy;
export const selectLocale = (state: PreferencesState) => state.preferences.locale;
export const selectSyncStatus = (state: PreferencesState) => state.syncStatus;

// ============================================================================
// Online/Offline Listener
// ============================================================================

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    const store = usePreferencesStore.getState();
    if (store.isInitialized) {
      store.flushPendingChanges();
    }
  });
}
