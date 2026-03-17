/**
 * User Preferences Module
 *
 * Provides user-specific settings with local persistence and cross-device sync.
 */

// Types
export type {
  ThemeMode,
  AccentColor,
  ThemePreferences,
  SidebarPosition,
  SidebarMode,
  DensityMode,
  LayoutPreferences,
  NotificationChannel,
  NotificationPreferences,
  EditorFontFamily,
  EditorPreferences,
  DashboardPreferences,
  CalendarView,
  WeekStartDay,
  CalendarPreferences,
  FileViewMode,
  FileSortBy,
  SortDirection,
  StoragePreferences,
  MailDensity,
  MailPreferences,
  AccessibilityPreferences,
  KeyboardShortcut,
  KeyboardPreferences,
  PrivacyPreferences,
  UserPreferences,
  PreferencesSection,
  PreferencesUpdate,
  SyncStatus,
} from "./types";

export { DEFAULT_PREFERENCES } from "./types";

// Store
export {
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
  selectSyncStatus,
} from "./store";

// Context & Hooks
export {
  usePreferences,
  useThemePreferences,
  useLayoutPreferences,
  useNotificationPreferences,
  useEditorPreferences,
  useDashboardPreferences,
  useCalendarPreferences,
  useStoragePreferences,
  useMailPreferences,
  useAccessibilityPreferences,
  useKeyboardPreferences,
  usePrivacyPreferences,
  useSyncStatus,
  useApplyTheme,
  useApplyAccessibility,
  useApplyLayout,
  PreferencesProvider,
  SyncStatusIndicator,
} from "./context";

// API
export {
  fetchPreferences,
  syncPreferences,
  patchPreferences,
  checkConflicts,
  resetPreferences,
  exportPreferences,
  importPreferences,
  getDeviceId,
  mergePreferences,
  queueChange,
  getQueue,
  clearQueue,
  removeFromQueue,
  isOnline,
  createSyncDebouncer,
} from "./api";

// Sync
export {
  createSyncConnection,
  useCrossDeviceSync,
  useBroadcastSync,
  useStorageSync,
  usePreferencesSync,
} from "./sync";

// UI Panels
export {
  ThemePanel,
  LayoutPanel,
  NotificationsPanel,
  EditorPanel,
  CalendarPanel,
  StoragePanel,
  PrivacyPanel,
  AccessibilityPanel,
  PreferencesPage,
} from "./panels";
