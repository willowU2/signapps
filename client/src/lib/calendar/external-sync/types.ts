/**
 * External Calendar Sync Types
 *
 * Types for syncing with external calendar providers (Google, Microsoft, Apple).
 */

// ============================================================================
// Provider Types
// ============================================================================

export type CalendarProvider = "google" | "microsoft" | "apple" | "caldav";

export type SyncDirection = "import" | "export" | "bidirectional";

export type SyncStatus = "idle" | "syncing" | "success" | "error" | "paused";

export type ConflictResolution =
  | "local_wins"
  | "remote_wins"
  | "newest_wins"
  | "manual";

// ============================================================================
// Connection Types
// ============================================================================

export interface ProviderConnection {
  id: string;
  provider: CalendarProvider;
  account_email: string;
  account_name: string;
  is_connected: boolean;
  scopes: string[];
  token_expires_at: string | null;
  last_sync_at: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectProviderRequest {
  provider: CalendarProvider;
  redirect_uri: string;
}

export interface ConnectProviderResponse {
  auth_url: string;
  state: string;
}

export interface ProviderCallback {
  provider: CalendarProvider;
  code: string;
  state: string;
}

// ============================================================================
// External Calendar Types
// ============================================================================

export interface ExternalCalendar {
  id: string;
  provider: CalendarProvider;
  connection_id: string;
  external_id: string;
  name: string;
  description: string | null;
  color: string;
  is_primary: boolean;
  is_selected: boolean;
  access_role: "owner" | "writer" | "reader" | "freeBusyReader";
  sync_enabled: boolean;
  sync_direction: SyncDirection;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExternalCalendarListResponse {
  calendars: ExternalCalendar[];
  connection: ProviderConnection;
}

// ============================================================================
// Sync Configuration Types
// ============================================================================

export interface SyncConfig {
  id: string;
  connection_id: string;
  local_calendar_id: string;
  external_calendar_id: string;
  direction: SyncDirection;
  conflict_resolution: ConflictResolution;
  sync_past_days: number;
  sync_future_days: number;
  sync_interval_minutes: number;
  sync_deletions: boolean;
  sync_attendees: boolean;
  sync_reminders: boolean;
  sync_colors: boolean;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSyncConfigRequest {
  connection_id: string;
  local_calendar_id: string;
  external_calendar_id: string;
  direction: SyncDirection;
  conflict_resolution?: ConflictResolution;
  sync_past_days?: number;
  sync_future_days?: number;
  sync_interval_minutes?: number;
  sync_deletions?: boolean;
  sync_attendees?: boolean;
  sync_reminders?: boolean;
  sync_colors?: boolean;
}

export interface UpdateSyncConfigRequest {
  direction?: SyncDirection;
  conflict_resolution?: ConflictResolution;
  sync_past_days?: number;
  sync_future_days?: number;
  sync_interval_minutes?: number;
  sync_deletions?: boolean;
  sync_attendees?: boolean;
  sync_reminders?: boolean;
  sync_colors?: boolean;
  is_enabled?: boolean;
}

// ============================================================================
// Sync Log Types
// ============================================================================

export interface SyncLogEntry {
  id: string;
  sync_config_id: string;
  direction: "import" | "export";
  status: "success" | "partial" | "error";
  events_imported: number;
  events_exported: number;
  events_updated: number;
  events_deleted: number;
  conflicts_resolved: number;
  errors: string[];
  started_at: string;
  completed_at: string;
  duration_ms: number;
}

export interface SyncLogFilter {
  config_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}

// ============================================================================
// Conflict Types
// ============================================================================

export interface SyncConflict {
  id: string;
  sync_config_id: string;
  local_event_id: string;
  external_event_id: string;
  local_updated_at: string;
  external_updated_at: string;
  conflict_type: "update" | "delete" | "both_updated";
  local_data: Record<string, unknown>;
  external_data: Record<string, unknown>;
  resolved: boolean;
  resolution: "local" | "remote" | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ResolveConflictRequest {
  resolution: "local" | "remote";
}

// ============================================================================
// Provider-Specific Types
// ============================================================================

// Google Calendar specific
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  recurrence?: string[];
  attendees?: {
    email: string;
    displayName?: string;
    responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
  }[];
  reminders?: {
    useDefault: boolean;
    overrides?: {
      method: "email" | "popup";
      minutes: number;
    }[];
  };
  colorId?: string;
  status?: "confirmed" | "tentative" | "cancelled";
  created: string;
  updated: string;
}

// Microsoft Outlook specific
export interface OutlookCalendarEvent {
  id: string;
  subject: string;
  body?: {
    contentType: "text" | "html";
    content: string;
  };
  location?: {
    displayName: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      countryOrRegion?: string;
      postalCode?: string;
    };
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  recurrence?: {
    pattern: {
      type: "daily" | "weekly" | "absoluteMonthly" | "absoluteYearly";
      interval: number;
      daysOfWeek?: string[];
    };
    range: {
      type: "endDate" | "noEnd" | "numbered";
      startDate: string;
      endDate?: string;
    };
  };
  attendees?: {
    emailAddress: {
      name?: string;
      address: string;
    };
    status?: {
      response:
        | "none"
        | "organizer"
        | "tentativelyAccepted"
        | "accepted"
        | "declined"
        | "notResponded";
    };
  }[];
  showAs?: "free" | "tentative" | "busy" | "oof" | "workingElsewhere";
  createdDateTime: string;
  lastModifiedDateTime: string;
}

// ============================================================================
// UI Constants
// ============================================================================

export const PROVIDER_LABELS: Record<CalendarProvider, string> = {
  google: "Google Calendar",
  microsoft: "Microsoft Outlook",
  apple: "Apple iCloud",
  caldav: "CalDAV",
};

export const PROVIDER_ICONS: Record<CalendarProvider, string> = {
  google: "/icons/google-calendar.svg",
  microsoft: "/icons/outlook.svg",
  apple: "/icons/icloud.svg",
  caldav: "/icons/caldav.svg",
};

export const PROVIDER_COLORS: Record<CalendarProvider, string> = {
  google: "#4285F4",
  microsoft: "#0078D4",
  apple: "#007AFF",
  caldav: "#6B7280",
};

export const SYNC_DIRECTION_LABELS: Record<SyncDirection, string> = {
  import: "Import only",
  export: "Export only",
  bidirectional: "Two-way sync",
};

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  idle: "Ready",
  syncing: "Syncing...",
  success: "Synced",
  error: "Error",
  paused: "Paused",
};

export const SYNC_STATUS_COLORS: Record<SyncStatus, string> = {
  idle: "text-gray-500",
  syncing: "text-blue-500",
  success: "text-green-500",
  error: "text-red-500",
  paused: "text-yellow-500",
};

export const CONFLICT_RESOLUTION_LABELS: Record<ConflictResolution, string> = {
  local_wins: "Keep local changes",
  remote_wins: "Keep remote changes",
  newest_wins: "Keep newest",
  manual: "Resolve manually",
};
