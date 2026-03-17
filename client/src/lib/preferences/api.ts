/**
 * Preferences Sync API
 *
 * API client for syncing user preferences with the backend.
 */

import { createApiClient, ServiceName } from "@/lib/api/factory";
import type { UserPreferences, PreferencesSection } from "./types";

const client = createApiClient(ServiceName.IDENTITY);

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
  const response = await client.get<SyncResponse>("/users/me/preferences");
  return response.data;
}

/**
 * Full sync - push local preferences to server
 */
export async function syncPreferences(request: SyncRequest): Promise<SyncResponse> {
  const response = await client.post<SyncResponse>("/users/me/preferences/sync", request);
  return response.data;
}

/**
 * Partial update - patch a specific section
 */
export async function patchPreferences(request: PatchRequest): Promise<SyncResponse> {
  const response = await client.patch<SyncResponse>(
    `/users/me/preferences/${request.section}`,
    {
      data: request.data,
      clientTimestamp: request.clientTimestamp,
      deviceId: request.deviceId,
    }
  );
  return response.data;
}

/**
 * Check for conflicts before sync
 */
export async function checkConflicts(clientTimestamp: string): Promise<ConflictInfo> {
  const response = await client.get<ConflictInfo>("/users/me/preferences/conflicts", {
    params: { clientTimestamp },
  });
  return response.data;
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferences(): Promise<SyncResponse> {
  const response = await client.post<SyncResponse>("/users/me/preferences/reset");
  return response.data;
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
  const response = await client.post<SyncResponse>("/users/me/preferences/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
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
  remote: UserPreferences
): UserPreferences {
  // Simple strategy: use remote as base, override with local changes
  // In production, you'd implement field-level merging based on timestamps
  const localTime = local.lastSyncedAt ? new Date(local.lastSyncedAt).getTime() : 0;
  const remoteTime = remote.lastSyncedAt ? new Date(remote.lastSyncedAt).getTime() : 0;

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
