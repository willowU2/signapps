"use client";

/**
 * Preferences Context
 *
 * React context and hooks for accessing user preferences.
 */

import * as React from "react";
import {
  usePreferencesStore,
  selectTheme,
  selectLayout,
  selectNotifications,
  selectEditor,
  selectDashboard,
  selectCalendar,
  selectStorage,
  selectMail,
  selectAccessibility,
  selectKeyboard,
  selectPrivacy,
  selectLocale,
  selectSyncStatus,
} from "./store";
import type {
  UserPreferences,
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
  SyncStatus,
  ThemeMode,
} from "./types";

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access all preferences
 */
export function usePreferences() {
  const preferences = usePreferencesStore((s) => s.preferences);
  const isInitialized = usePreferencesStore((s) => s.isInitialized);
  const syncStatus = usePreferencesStore((s) => s.syncStatus);
  const sync = usePreferencesStore((s) => s.sync);
  const reset = usePreferencesStore((s) => s.reset);

  return {
    preferences,
    isInitialized,
    syncStatus,
    sync,
    reset,
  };
}

/**
 * Theme preferences with setter
 */
export function useThemePreferences() {
  const theme = usePreferencesStore(selectTheme);
  const updateTheme = usePreferencesStore((s) => s.updateTheme);
  return { theme, updateTheme };
}

/**
 * Layout preferences with setter
 */
export function useLayoutPreferences() {
  const layout = usePreferencesStore(selectLayout);
  const updateLayout = usePreferencesStore((s) => s.updateLayout);
  return { layout, updateLayout };
}

/**
 * Notification preferences with setter
 */
export function useNotificationPreferences() {
  const notifications = usePreferencesStore(selectNotifications);
  const updateNotifications = usePreferencesStore((s) => s.updateNotifications);
  return { notifications, updateNotifications };
}

/**
 * Editor preferences with setter
 */
export function useEditorPreferences() {
  const editor = usePreferencesStore(selectEditor);
  const updateEditor = usePreferencesStore((s) => s.updateEditor);
  return { editor, updateEditor };
}

/**
 * Dashboard preferences with setter
 */
export function useDashboardPreferences() {
  const dashboard = usePreferencesStore(selectDashboard);
  const updateDashboard = usePreferencesStore((s) => s.updateDashboard);
  return { dashboard, updateDashboard };
}

/**
 * Calendar preferences with setter
 */
export function useCalendarPreferences() {
  const calendar = usePreferencesStore(selectCalendar);
  const updateCalendar = usePreferencesStore((s) => s.updateCalendar);
  return { calendar, updateCalendar };
}

/**
 * Storage preferences with setter
 */
export function useStoragePreferences() {
  const storage = usePreferencesStore(selectStorage);
  const updateStorage = usePreferencesStore((s) => s.updateStorage);
  return { storage, updateStorage };
}

/**
 * Mail preferences with setter
 */
export function useMailPreferences() {
  const mail = usePreferencesStore(selectMail);
  const updateMail = usePreferencesStore((s) => s.updateMail);
  return { mail, updateMail };
}

/**
 * Accessibility preferences with setter
 */
export function useAccessibilityPreferences() {
  const accessibility = usePreferencesStore(selectAccessibility);
  const updateAccessibility = usePreferencesStore((s) => s.updateAccessibility);
  return { accessibility, updateAccessibility };
}

/**
 * Keyboard preferences with setter
 */
export function useKeyboardPreferences() {
  const keyboard = usePreferencesStore(selectKeyboard);
  const updateKeyboard = usePreferencesStore((s) => s.updateKeyboard);
  return { keyboard, updateKeyboard };
}

/**
 * Privacy preferences with setter
 */
export function usePrivacyPreferences() {
  const privacy = usePreferencesStore(selectPrivacy);
  const updatePrivacy = usePreferencesStore((s) => s.updatePrivacy);
  return { privacy, updatePrivacy };
}

/**
 * Locale preferences with setter
 */
export function useLocalePreferences() {
  const locale = usePreferencesStore(selectLocale);
  const updateLocale = usePreferencesStore((s) => s.updateLocale);
  return { locale, updateLocale };
}

/**
 * Sync status only
 */
export function useSyncStatus() {
  return usePreferencesStore(selectSyncStatus);
}

// ============================================================================
// Theme Application Hook
// ============================================================================

/**
 * Apply theme preferences to document
 * Theme mode is handled by next-themes - we only apply additional settings
 */
export function useApplyTheme() {
  const { theme: themePrefs } = useThemePreferences();

  // Apply other theme settings (font scale, motion, contrast)
  // Theme mode is managed by next-themes directly via ThemeProvider
  React.useEffect(() => {
    const root = document.documentElement;

    // Apply font scale
    root.style.setProperty("--font-scale", String(themePrefs.fontScale));

    // Apply reduce motion
    root.classList.toggle("reduce-motion", themePrefs.reduceMotion);

    // Apply high contrast
    root.classList.toggle("high-contrast", themePrefs.highContrast);
  }, [themePrefs.fontScale, themePrefs.reduceMotion, themePrefs.highContrast]);
}

// ============================================================================
// Accessibility Application Hook
// ============================================================================

/**
 * Apply accessibility preferences to document
 */
export function useApplyAccessibility() {
  const { accessibility } = useAccessibilityPreferences();

  React.useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle("screen-reader-mode", accessibility.screenReaderMode);
    root.classList.toggle("keyboard-hints", accessibility.keyboardHints);
    root.classList.toggle("focus-indicators", accessibility.focusIndicators);
    root.classList.toggle("reduce-transparency", accessibility.reduceTransparency);
    root.classList.toggle("large-click-targets", accessibility.largeClickTargets);
  }, [accessibility]);
}

// ============================================================================
// Layout Application Hook
// ============================================================================

/**
 * Apply layout preferences
 */
export function useApplyLayout() {
  const { layout } = useLayoutPreferences();

  React.useEffect(() => {
    const root = document.documentElement;

    // Apply density
    root.setAttribute("data-density", layout.density);

    // Apply sidebar position
    root.setAttribute("data-sidebar-position", layout.sidebarPosition);
  }, [layout.density, layout.sidebarPosition]);
}

// ============================================================================
// Initialization Provider
// ============================================================================

interface PreferencesProviderProps {
  children: React.ReactNode;
}

export function PreferencesProvider({ children }: PreferencesProviderProps) {
  const initialize = usePreferencesStore((s) => s.initialize);
  const isInitialized = usePreferencesStore((s) => s.isInitialized);

  // Initialize on mount
  React.useEffect(() => {
    initialize();
  }, [initialize]);

  // Apply preferences
  useApplyTheme();
  useApplyAccessibility();
  useApplyLayout();

  return <>{children}</>;
}

// ============================================================================
// Sync Status Display Component
// ============================================================================

interface SyncStatusIndicatorProps {
  className?: string;
}

export function SyncStatusIndicator({ className }: SyncStatusIndicatorProps) {
  const syncStatus = useSyncStatus();

  if (syncStatus.isSyncing) {
    return (
      <span className={className} title="Synchronisation en cours...">
        <span className="inline-block h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
      </span>
    );
  }

  if (syncStatus.lastError) {
    return (
      <span className={className} title={`Erreur: ${syncStatus.lastError}`}>
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
      </span>
    );
  }

  if (syncStatus.pendingChanges > 0) {
    return (
      <span className={className} title={`${syncStatus.pendingChanges} modification(s) en attente`}>
        <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
      </span>
    );
  }

  return (
    <span className={className} title="Synchronisé">
      <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
    </span>
  );
}
