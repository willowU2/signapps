/**
 * User Preferences Types
 *
 * Defines the schema for user-specific settings that sync across devices.
 */

// ============================================================================
// Theme Preferences
// ============================================================================

export type ThemeMode = "light" | "dark" | "system";
export type AccentColor =
  | "indigo"
  | "blue"
  | "green"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "yellow";

export interface ThemePreferences {
  /** Theme mode */
  mode: ThemeMode;
  /** Accent color override (null = use tenant default) */
  accentColor: AccentColor | null;
  /** Reduce animations */
  reduceMotion: boolean;
  /** High contrast mode */
  highContrast: boolean;
  /** Font size scale (0.8 - 1.4) */
  fontScale: number;
}

// ============================================================================
// Layout Preferences
// ============================================================================

export type SidebarPosition = "left" | "right";
export type SidebarMode = "expanded" | "collapsed" | "auto";
export type DensityMode = "comfortable" | "compact" | "spacious";

export interface LayoutPreferences {
  /** Sidebar position */
  sidebarPosition: SidebarPosition;
  /** Sidebar default state */
  sidebarMode: SidebarMode;
  /** UI density */
  density: DensityMode;
  /** Show breadcrumbs */
  showBreadcrumbs: boolean;
  /** Show page titles */
  showPageTitles: boolean;
  /** Fixed header */
  fixedHeader: boolean;
}

// ============================================================================
// Notification Preferences
// ============================================================================

export type NotificationChannel = "email" | "push" | "in_app";

export interface NotificationPreferences {
  /** Enable notifications globally */
  enabled: boolean;
  /** Channels enabled */
  channels: NotificationChannel[];
  /** Do not disturb mode */
  doNotDisturb: boolean;
  /** DND schedule (24h format) */
  dndSchedule: {
    enabled: boolean;
    startTime: string; // "22:00"
    endTime: string; // "08:00"
  };
  /** Per-category settings */
  categories: {
    tasks: boolean;
    calendar: boolean;
    mail: boolean;
    chat: boolean;
    mentions: boolean;
    system: boolean;
  };
  /** Sound enabled */
  soundEnabled: boolean;
  /** Sound volume (0-100) */
  soundVolume: number;
}

// ============================================================================
// Editor Preferences
// ============================================================================

export type EditorFontFamily = "default" | "mono" | "serif" | "sans";

export interface EditorPreferences {
  /** Default font family */
  fontFamily: EditorFontFamily;
  /** Font size (px) */
  fontSize: number;
  /** Line height (multiplier) */
  lineHeight: number;
  /** Show line numbers */
  showLineNumbers: boolean;
  /** Word wrap */
  wordWrap: boolean;
  /** Auto-save interval (seconds, 0 = disabled) */
  autoSaveInterval: number;
  /** Spell check enabled */
  spellCheck: boolean;
  /** Spell check language */
  spellCheckLanguage: string;
}

// ============================================================================
// Dashboard Preferences
// ============================================================================

export interface DashboardPreferences {
  /** Active preset name */
  activePreset: string | null;
  /** Custom widget layout (JSON string of GridLayout) */
  customLayout: string | null;
  /** Last modified timestamp */
  lastModified: string | null;
}

// ============================================================================
// Calendar Preferences
// ============================================================================

export type CalendarView = "month" | "week" | "day" | "agenda";
export type WeekStartDay = 0 | 1 | 6; // Sunday, Monday, Saturday

export interface CalendarPreferences {
  /** Default view */
  defaultView: CalendarView;
  /** First day of week */
  weekStartDay: WeekStartDay;
  /** Show weekends */
  showWeekends: boolean;
  /** Show week numbers */
  showWeekNumbers: boolean;
  /** Working hours start */
  workingHoursStart: string; // "09:00"
  /** Working hours end */
  workingHoursEnd: string; // "18:00"
  /** Default event duration (minutes) */
  defaultEventDuration: number;
  /** Default reminder (minutes before) */
  defaultReminder: number;
}

// ============================================================================
// Storage/Drive Preferences
// ============================================================================

export type FileViewMode = "grid" | "list" | "details";
export type FileSortBy = "name" | "modified" | "size" | "type";
export type SortDirection = "asc" | "desc";

export interface StoragePreferences {
  /** Default view mode */
  viewMode: FileViewMode;
  /** Sort by field */
  sortBy: FileSortBy;
  /** Sort direction */
  sortDirection: SortDirection;
  /** Show hidden files */
  showHidden: boolean;
  /** Preview on single click */
  previewOnClick: boolean;
  /** Thumbnail size (px) */
  thumbnailSize: number;
}

// ============================================================================
// Mail Preferences
// ============================================================================

export type MailDensity = "default" | "comfortable" | "compact";

export interface MailPreferences {
  /** Display density */
  density: MailDensity;
  /** Preview pane position */
  previewPane: "right" | "bottom" | "none";
  /** Auto-mark as read delay (seconds) */
  markAsReadDelay: number;
  /** Default signature ID */
  defaultSignatureId: string | null;
  /** Send confirmation */
  confirmSend: boolean;
  /** Group by conversation */
  conversationView: boolean;
}

// ============================================================================
// Accessibility Preferences
// ============================================================================

export interface AccessibilityPreferences {
  /** Screen reader optimizations */
  screenReaderMode: boolean;
  /** Keyboard navigation hints */
  keyboardHints: boolean;
  /** Focus indicators */
  focusIndicators: boolean;
  /** Reduce transparency */
  reduceTransparency: boolean;
  /** Large click targets */
  largeClickTargets: boolean;
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

export interface KeyboardShortcut {
  /** Shortcut ID */
  id: string;
  /** Key combination (e.g., "Ctrl+K", "Cmd+Shift+P") */
  keys: string;
  /** Whether it's customized from default */
  isCustom: boolean;
}

export interface KeyboardPreferences {
  /** Enable keyboard shortcuts */
  enabled: boolean;
  /** Custom shortcuts (overrides defaults) */
  shortcuts: KeyboardShortcut[];
}

// ============================================================================
// Privacy Preferences
// ============================================================================

export interface PrivacyPreferences {
  /** Show online status */
  showOnlineStatus: boolean;
  /** Show activity status */
  showActivityStatus: boolean;
  /** Allow read receipts */
  readReceipts: boolean;
  /** Allow typing indicators */
  typingIndicators: boolean;
  /** Profile visibility */
  profileVisibility: "everyone" | "team" | "private";
}

// ============================================================================
// Locale / Regional Preferences
// ============================================================================

export type DateFormat = "dd/mm/yyyy" | "mm/dd/yyyy" | "yyyy-mm-dd";
export type NumberFormat = "fr" | "en"; // fr: 1 234,56 | en: 1,234.56

export interface LocalePreferences {
  /** Preferred language code */
  language: string;
  /** Date format */
  dateFormat: DateFormat;
  /** Number format */
  numberFormat: NumberFormat;
  /** Timezone (IANA) */
  timezone: string;
}

// ============================================================================
// Complete User Preferences
// ============================================================================

export interface UserPreferences {
  /** Version for migrations */
  version: number;
  /** Theme settings */
  theme: ThemePreferences;
  /** Layout settings */
  layout: LayoutPreferences;
  /** Notification settings */
  notifications: NotificationPreferences;
  /** Editor settings */
  editor: EditorPreferences;
  /** Dashboard settings */
  dashboard: DashboardPreferences;
  /** Calendar settings */
  calendar: CalendarPreferences;
  /** Storage/Drive settings */
  storage: StoragePreferences;
  /** Mail settings */
  mail: MailPreferences;
  /** Accessibility settings */
  accessibility: AccessibilityPreferences;
  /** Keyboard shortcuts */
  keyboard: KeyboardPreferences;
  /** Privacy settings */
  privacy: PrivacyPreferences;
  /** Locale/regional settings */
  locale: LocalePreferences;
  /** Last synced timestamp */
  lastSyncedAt: string | null;
  /** Device ID that last modified */
  lastModifiedBy: string | null;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_PREFERENCES: UserPreferences = {
  version: 1,
  theme: {
    mode: "system",
    accentColor: null,
    reduceMotion: false,
    highContrast: false,
    fontScale: 1,
  },
  layout: {
    sidebarPosition: "left",
    sidebarMode: "expanded",
    density: "comfortable",
    showBreadcrumbs: true,
    showPageTitles: true,
    fixedHeader: true,
  },
  notifications: {
    enabled: true,
    channels: ["in_app", "push"],
    doNotDisturb: false,
    dndSchedule: {
      enabled: false,
      startTime: "22:00",
      endTime: "08:00",
    },
    categories: {
      tasks: true,
      calendar: true,
      mail: true,
      chat: true,
      mentions: true,
      system: true,
    },
    soundEnabled: true,
    soundVolume: 50,
  },
  editor: {
    fontFamily: "default",
    fontSize: 16,
    lineHeight: 1.6,
    showLineNumbers: false,
    wordWrap: true,
    autoSaveInterval: 30,
    spellCheck: true,
    spellCheckLanguage: "fr",
  },
  dashboard: {
    activePreset: null,
    customLayout: null,
    lastModified: null,
  },
  calendar: {
    defaultView: "week",
    weekStartDay: 1,
    showWeekends: true,
    showWeekNumbers: false,
    workingHoursStart: "09:00",
    workingHoursEnd: "18:00",
    defaultEventDuration: 60,
    defaultReminder: 15,
  },
  storage: {
    viewMode: "grid",
    sortBy: "modified",
    sortDirection: "desc",
    showHidden: false,
    previewOnClick: true,
    thumbnailSize: 120,
  },
  mail: {
    density: "default",
    previewPane: "right",
    markAsReadDelay: 3,
    defaultSignatureId: null,
    confirmSend: false,
    conversationView: true,
  },
  accessibility: {
    screenReaderMode: false,
    keyboardHints: true,
    focusIndicators: true,
    reduceTransparency: false,
    largeClickTargets: false,
  },
  keyboard: {
    enabled: true,
    shortcuts: [],
  },
  privacy: {
    showOnlineStatus: true,
    showActivityStatus: true,
    readReceipts: true,
    typingIndicators: true,
    profileVisibility: "team",
  },
  locale: {
    language: "fr",
    dateFormat: "dd/mm/yyyy",
    numberFormat: "fr",
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris",
  },
  lastSyncedAt: null,
  lastModifiedBy: null,
};

// ============================================================================
// Utility Types
// ============================================================================

export type PreferencesSection = keyof Omit<
  UserPreferences,
  "version" | "lastSyncedAt" | "lastModifiedBy"
>;

export interface PreferencesUpdate<T extends PreferencesSection> {
  section: T;
  data: Partial<UserPreferences[T]>;
}

export interface SyncStatus {
  /** Whether sync is in progress */
  isSyncing: boolean;
  /** Last successful sync timestamp */
  lastSyncedAt: string | null;
  /** Last sync error */
  lastError: string | null;
  /** Pending changes count */
  pendingChanges: number;
}
