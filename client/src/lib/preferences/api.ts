/**
 * Preferences Sync API
 *
 * API client for syncing user preferences with the backend.
 */

import { createServiceClient, ServiceName } from "@/lib/api/factory";
import type { UserPreferences, PreferencesSection } from "./types";
import { DEFAULT_PREFERENCES } from "./types";

const client = createServiceClient(ServiceName.IDENTITY);

// ============================================================================
// Mappers
// ============================================================================

export function mapClientToServerPreferences(
  prefs: UserPreferences,
): Record<string, any> {
  return {
    theme: prefs.theme.mode,
    accent_color: prefs.theme.accentColor,
    font_size: prefs.theme.fontScale
      ? prefs.theme.fontScale.toString()
      : undefined,
    compact_mode: prefs.layout.density === "compact",
    language: prefs.locale.language,
    timezone: prefs.locale.timezone,
    date_format: prefs.locale.dateFormat,
    time_format: undefined,
    first_day_of_week: prefs.calendar.weekStartDay,
    notification_sound: prefs.notifications.soundEnabled,
    notification_desktop: prefs.notifications.channels.includes("push"),
    notification_email_digest: undefined,
    editor_autosave: prefs.editor.autoSaveInterval > 0,
    editor_autosave_interval: prefs.editor.autoSaveInterval,
    editor_spell_check: prefs.editor.spellCheck,
    editor_word_wrap: prefs.editor.wordWrap,
    calendar_default_view: prefs.calendar.defaultView,
    calendar_working_hours_start: prefs.calendar.workingHoursStart,
    calendar_working_hours_end: prefs.calendar.workingHoursEnd,
    calendar_show_weekends: prefs.calendar.showWeekends,
    drive_default_view: prefs.storage.viewMode,
    drive_sort_by: prefs.storage.sortBy,
    drive_sort_order: prefs.storage.sortDirection,
    keyboard_shortcuts_enabled: prefs.keyboard.enabled,
    reduce_motion: prefs.theme.reduceMotion,
    high_contrast: prefs.theme.highContrast,
    extra: {
      layout: prefs.layout,
      dashboard: prefs.dashboard,
      mail: prefs.mail,
      accessibility: prefs.accessibility,
      privacy: prefs.privacy,
    },
  };
}

export function mapServerToClientPreferences(
  serverPrefs: any,
): UserPreferences {
  // We start from DEFAULT_PREFERENCES to ensure all nested objects exist
  const prefs = JSON.parse(
    JSON.stringify(DEFAULT_PREFERENCES),
  ) as UserPreferences;

  if (!serverPrefs) return prefs;

  // Apply flat properties mapped to nested properties
  if (serverPrefs.theme) prefs.theme.mode = serverPrefs.theme;
  if (serverPrefs.accent_color)
    prefs.theme.accentColor = serverPrefs.accent_color;
  if (serverPrefs.font_size)
    prefs.theme.fontScale = parseFloat(serverPrefs.font_size);
  if (serverPrefs.compact_mode !== undefined)
    prefs.layout.density = serverPrefs.compact_mode ? "compact" : "comfortable";
  if (serverPrefs.reduce_motion !== undefined)
    prefs.theme.reduceMotion = serverPrefs.reduce_motion;
  if (serverPrefs.high_contrast !== undefined)
    prefs.theme.highContrast = serverPrefs.high_contrast;

  if (serverPrefs.language) prefs.locale.language = serverPrefs.language;
  if (serverPrefs.timezone) prefs.locale.timezone = serverPrefs.timezone;
  if (serverPrefs.date_format)
    prefs.locale.dateFormat = serverPrefs.date_format;
  if (serverPrefs.first_day_of_week !== undefined)
    prefs.calendar.weekStartDay = serverPrefs.first_day_of_week;

  if (serverPrefs.notification_sound !== undefined)
    prefs.notifications.soundEnabled = serverPrefs.notification_sound;
  if (serverPrefs.notification_desktop) {
    if (!prefs.notifications.channels.includes("push"))
      prefs.notifications.channels.push("push");
  } else {
    prefs.notifications.channels = prefs.notifications.channels.filter(
      (c) => c !== "push",
    );
  }

  if (serverPrefs.editor_autosave_interval !== undefined) {
    prefs.editor.autoSaveInterval = serverPrefs.editor_autosave_interval;
  }
  if (serverPrefs.editor_spell_check !== undefined)
    prefs.editor.spellCheck = serverPrefs.editor_spell_check;
  if (serverPrefs.editor_word_wrap !== undefined)
    prefs.editor.wordWrap = serverPrefs.editor_word_wrap;

  if (serverPrefs.calendar_default_view)
    prefs.calendar.defaultView = serverPrefs.calendar_default_view;
  if (serverPrefs.calendar_working_hours_start)
    prefs.calendar.workingHoursStart = serverPrefs.calendar_working_hours_start;
  if (serverPrefs.calendar_working_hours_end)
    prefs.calendar.workingHoursEnd = serverPrefs.calendar_working_hours_end;
  if (serverPrefs.calendar_show_weekends !== undefined)
    prefs.calendar.showWeekends = serverPrefs.calendar_show_weekends;

  if (serverPrefs.drive_default_view)
    prefs.storage.viewMode = serverPrefs.drive_default_view;
  if (serverPrefs.drive_sort_by)
    prefs.storage.sortBy = serverPrefs.drive_sort_by;
  if (serverPrefs.drive_sort_order)
    prefs.storage.sortDirection = serverPrefs.drive_sort_order;

  if (serverPrefs.keyboard_shortcuts_enabled !== undefined)
    prefs.keyboard.enabled = serverPrefs.keyboard_shortcuts_enabled;

  // Restore extra nested properties
  if (serverPrefs.extra) {
    if (serverPrefs.extra.layout)
      prefs.layout = { ...prefs.layout, ...serverPrefs.extra.layout };
    if (serverPrefs.extra.dashboard)
      prefs.dashboard = { ...prefs.dashboard, ...serverPrefs.extra.dashboard };
    if (serverPrefs.extra.mail)
      prefs.mail = { ...prefs.mail, ...serverPrefs.extra.mail };
    if (serverPrefs.extra.accessibility)
      prefs.accessibility = {
        ...prefs.accessibility,
        ...serverPrefs.extra.accessibility,
      };
    if (serverPrefs.extra.privacy)
      prefs.privacy = { ...prefs.privacy, ...serverPrefs.extra.privacy };
  }

  prefs.version = serverPrefs.version || prefs.version;
  prefs.lastSyncedAt =
    serverPrefs.last_synced_at || serverPrefs.lastSyncedAt || null;
  prefs.lastModifiedBy = serverPrefs.device_id || serverPrefs.deviceId || null;

  return prefs;
}

export function mapSyncResponse(data: any): SyncResponse {
  return {
    preferences: mapServerToClientPreferences(data.preferences),
    serverTimestamp:
      data.server_timestamp || data.serverTimestamp || new Date().toISOString(),
    conflictResolution: data.conflict_resolution || data.conflictResolution,
  };
}

// ============================================================================
// Types
// ============================================================================

export interface SyncResponse {
  preferences: UserPreferences;
  serverTimestamp: string;
  conflictResolution?: "client_wins" | "server_wins" | "merged";
}

export interface SyncRequest {
  preferences: UserPreferences;
  clientTimestamp: string;
  deviceId: string;
  forceOverwrite?: boolean;
}

export interface PatchRequest {
  section: PreferencesSection;
  data: Record<string, unknown>;
  clientTimestamp: string;
  deviceId: string;
}

export interface ConflictInfo {
  hasConflict: boolean;
  serverVersion: UserPreferences | null;
  clientVersion: UserPreferences | null;
  conflictFields: string[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch current preferences from server
 */
export async function fetchPreferences(): Promise<SyncResponse> {
  const response = await client.get<any>("/users/me/preferences");
  return mapSyncResponse(response.data);
}

/**
 * Full sync - push local preferences to server
 */
export async function syncPreferences(
  request: SyncRequest,
): Promise<SyncResponse> {
  const payload = {
    preferences: mapClientToServerPreferences(request.preferences),
    client_timestamp: request.clientTimestamp,
    device_id: request.deviceId,
    force_overwrite: request.forceOverwrite,
  };
  try {
    const response = await client.post<unknown>(
      "/users/me/preferences/sync",
      payload,
    );
    return mapSyncResponse(response.data);
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown } };
    if (e.response && e.response.data) {
      console.error("AXUM BACKEND ERROR DETAILS:", e.response.data);
    }
    throw err;
  }
}

/**
 * Partial update - patch a specific section
 */
export async function patchPreferences(
  request: PatchRequest,
): Promise<SyncResponse> {
  const response = await client.patch<any>(
    `/users/me/preferences/${request.section}`,
    {
      data: request.data,
      clientTimestamp: request.clientTimestamp,
      deviceId: request.deviceId,
    },
  );
  return mapSyncResponse(response.data);
}

/**
 * Check for conflicts before sync
 */
export async function checkConflicts(
  clientTimestamp: string,
): Promise<ConflictInfo> {
  const response = await client.get<any>("/users/me/preferences/conflicts", {
    params: { clientTimestamp },
  });
  return {
    hasConflict:
      response.data.has_conflict || response.data.hasConflict || false,
    serverVersion: response.data.server_version
      ? mapServerToClientPreferences(response.data.server_version)
      : null,
    clientVersion: response.data.client_version
      ? mapServerToClientPreferences(response.data.client_version)
      : null,
    conflictFields:
      response.data.conflict_fields || response.data.conflictFields || [],
  };
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferences(): Promise<SyncResponse> {
  const response = await client.post<any>("/users/me/preferences/reset");
  return mapSyncResponse(response.data);
}

/**
 * Export preferences as JSON
 */
export async function exportPreferences(): Promise<Blob> {
  const response = await client.get("/users/me/preferences/export", {
    responseType: "blob",
  });
  return response.data;
}

/**
 * Import preferences from JSON
 */
export async function importPreferences(file: File): Promise<SyncResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await client.post<any>(
    "/users/me/preferences/import",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return mapSyncResponse(response.data);
}

// ============================================================================
// Device ID Management
// ============================================================================

const DEVICE_ID_KEY = "signapps_device_id";

/**
 * Get or generate a unique device ID
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// ============================================================================
// Conflict Resolution
// ============================================================================

/**
 * Merge two preference objects, preferring newer values
 */
export function mergePreferences(
  local: UserPreferences,
  remote: UserPreferences,
): UserPreferences {
  // Simple strategy: use remote as base, override with local changes
  // In production, you'd implement field-level merging based on timestamps
  const localTime = local.lastSyncedAt
    ? new Date(local.lastSyncedAt).getTime()
    : 0;
  const remoteTime = remote.lastSyncedAt
    ? new Date(remote.lastSyncedAt).getTime()
    : 0;

  if (localTime > remoteTime) {
    return {
      ...remote,
      ...local,
      version: Math.max(local.version, remote.version),
      lastSyncedAt: new Date().toISOString(),
    };
  }

  return {
    ...local,
    ...remote,
    version: Math.max(local.version, remote.version),
    lastSyncedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Offline Queue
// ============================================================================

interface QueuedChange {
  id: string;
  section: PreferencesSection;
  data: Record<string, unknown>;
  timestamp: string;
}

const QUEUE_KEY = "signapps_preferences_queue";

/**
 * Add a change to the offline queue
 */
export function queueChange(change: Omit<QueuedChange, "id">): void {
  if (typeof window === "undefined") return;

  const queue = getQueue();
  queue.push({
    ...change,
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Get all queued changes
 */
export function getQueue(): QueuedChange[] {
  if (typeof window === "undefined") return [];

  const stored = localStorage.getItem(QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Clear the queue after successful sync
 */
export function clearQueue(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(QUEUE_KEY);
}

/**
 * Remove specific changes from queue
 */
export function removeFromQueue(ids: string[]): void {
  if (typeof window === "undefined") return;

  const queue = getQueue().filter((c) => !ids.includes(c.id));
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ============================================================================
// Sync Utilities
// ============================================================================

/**
 * Check if we're online
 */
export function isOnline(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}

/**
 * Debounce sync calls
 */
export function createSyncDebouncer(delay = 2000) {
  let timeout: NodeJS.Timeout | null = null;
  let pending: (() => Promise<void>) | null = null;

  return {
    schedule(fn: () => Promise<void>) {
      pending = fn;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        if (pending) {
          await pending();
          pending = null;
        }
      }, delay);
    },
    cancel() {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      pending = null;
    },
    flush() {
      if (timeout) clearTimeout(timeout);
      if (pending) {
        const fn = pending;
        pending = null;
        return fn();
      }
      return Promise.resolve();
    },
  };
}
