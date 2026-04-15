/**
 * External Calendar Sync API
 *
 * API client for managing external calendar connections and syncing.
 */

import { calendarApi } from "@/lib/api";
import type {
  CalendarProvider,
  ProviderConnection,
  ConnectProviderRequest,
  ConnectProviderResponse,
  ProviderCallback,
  ExternalCalendar,
  ExternalCalendarListResponse,
  SyncConfig,
  CreateSyncConfigRequest,
  UpdateSyncConfigRequest,
  SyncLogEntry,
  SyncLogFilter,
  SyncConflict,
  ResolveConflictRequest,
} from "./types";

// ============================================================================
// Base Path
// ============================================================================

const SYNC_API_PATH = "/external-sync";

// ============================================================================
// Connection API
// ============================================================================

/**
 * Get all provider connections for current user
 */
export async function getConnections(): Promise<ProviderConnection[]> {
  const response = await calendarApi.get<ProviderConnection[]>(
    `${SYNC_API_PATH}/connections`,
  );
  return response.data;
}

/**
 * Get a specific connection
 */
export async function getConnection(
  connectionId: string,
): Promise<ProviderConnection> {
  const response = await calendarApi.get<ProviderConnection>(
    `${SYNC_API_PATH}/connections/${connectionId}`,
  );
  return response.data;
}

/**
 * Initiate OAuth flow for a provider
 */
export async function connectProvider(
  request: ConnectProviderRequest,
): Promise<ConnectProviderResponse> {
  const response = await calendarApi.post<ConnectProviderResponse>(
    `${SYNC_API_PATH}/connections/connect`,
    request,
  );
  return response.data;
}

/**
 * Complete OAuth callback
 */
export async function handleCallback(
  callback: ProviderCallback,
): Promise<ProviderConnection> {
  const response = await calendarApi.post<ProviderConnection>(
    `${SYNC_API_PATH}/connections/callback`,
    callback,
  );
  return response.data;
}

/**
 * Disconnect a provider
 */
export async function disconnectProvider(connectionId: string): Promise<void> {
  await calendarApi.delete(`${SYNC_API_PATH}/connections/${connectionId}`);
}

/**
 * Refresh a provider token
 */
export async function refreshToken(
  connectionId: string,
): Promise<ProviderConnection> {
  const response = await calendarApi.post<ProviderConnection>(
    `${SYNC_API_PATH}/connections/${connectionId}/refresh`,
  );
  return response.data;
}

// ============================================================================
// External Calendars API
// ============================================================================

/**
 * List all external calendars from a connection
 */
export async function listExternalCalendars(
  connectionId: string,
): Promise<ExternalCalendarListResponse> {
  const response = await calendarApi.get<ExternalCalendarListResponse>(
    `${SYNC_API_PATH}/connections/${connectionId}/calendars`,
  );
  return response.data;
}

/**
 * Toggle calendar selection for sync
 */
export async function toggleCalendarSelection(
  connectionId: string,
  externalCalendarId: string,
  selected: boolean,
): Promise<ExternalCalendar> {
  const response = await calendarApi.patch<ExternalCalendar>(
    `${SYNC_API_PATH}/connections/${connectionId}/calendars/${externalCalendarId}`,
    { is_selected: selected },
  );
  return response.data;
}

// ============================================================================
// Sync Configuration API
// ============================================================================

/**
 * Get all sync configurations
 */
export async function getSyncConfigs(): Promise<SyncConfig[]> {
  const response = await calendarApi.get<SyncConfig[]>(
    `${SYNC_API_PATH}/configs`,
  );
  return response.data;
}

/**
 * Get sync config for a local calendar
 */
export async function getSyncConfigForCalendar(
  localCalendarId: string,
): Promise<SyncConfig | null> {
  const response = await calendarApi.get<SyncConfig | null>(
    `${SYNC_API_PATH}/configs/by-calendar/${localCalendarId}`,
  );
  return response.data;
}

/**
 * Create a new sync configuration
 */
export async function createSyncConfig(
  request: CreateSyncConfigRequest,
): Promise<SyncConfig> {
  const response = await calendarApi.post<SyncConfig>(
    `${SYNC_API_PATH}/configs`,
    request,
  );
  return response.data;
}

/**
 * Update a sync configuration
 */
export async function updateSyncConfig(
  configId: string,
  request: UpdateSyncConfigRequest,
): Promise<SyncConfig> {
  const response = await calendarApi.patch<SyncConfig>(
    `${SYNC_API_PATH}/configs/${configId}`,
    request,
  );
  return response.data;
}

/**
 * Delete a sync configuration
 */
export async function deleteSyncConfig(configId: string): Promise<void> {
  await calendarApi.delete(`${SYNC_API_PATH}/configs/${configId}`);
}

/**
 * Enable/disable a sync configuration
 */
export async function toggleSyncConfig(
  configId: string,
  enabled: boolean,
): Promise<SyncConfig> {
  return updateSyncConfig(configId, { is_enabled: enabled });
}

// ============================================================================
// Sync Operations API
// ============================================================================

/**
 * Trigger immediate sync for a configuration
 */
export async function triggerSync(configId: string): Promise<SyncLogEntry> {
  const response = await calendarApi.post<SyncLogEntry>(
    `${SYNC_API_PATH}/configs/${configId}/sync`,
  );
  return response.data;
}

/**
 * Trigger sync for all enabled configurations
 */
export async function triggerSyncAll(): Promise<{ triggered: number }> {
  const response = await calendarApi.post<{ triggered: number }>(
    `${SYNC_API_PATH}/sync-all`,
  );
  return response.data;
}

// ============================================================================
// Sync Logs API
// ============================================================================

/**
 * Get sync logs
 */
export async function getSyncLogs(
  filter?: SyncLogFilter,
): Promise<{ logs: SyncLogEntry[]; total: number }> {
  const params = new URLSearchParams();
  if (filter?.config_id) params.set("config_id", filter.config_id);
  if (filter?.status) params.set("status", filter.status);
  if (filter?.from_date) params.set("from_date", filter.from_date);
  if (filter?.to_date) params.set("to_date", filter.to_date);

  const response = await calendarApi.get<{
    logs: SyncLogEntry[];
    total: number;
  }>(`${SYNC_API_PATH}/logs?${params.toString()}`);
  return response.data;
}

/**
 * Get sync logs for a specific configuration
 */
export async function getConfigSyncLogs(
  configId: string,
  limit = 20,
): Promise<SyncLogEntry[]> {
  const response = await calendarApi.get<SyncLogEntry[]>(
    `${SYNC_API_PATH}/configs/${configId}/logs?limit=${limit}`,
  );
  return response.data;
}

// ============================================================================
// Conflicts API
// ============================================================================

/**
 * Get unresolved conflicts
 */
export async function getConflicts(): Promise<SyncConflict[]> {
  const response = await calendarApi.get<SyncConflict[]>(
    `${SYNC_API_PATH}/conflicts`,
  );
  return response.data;
}

/**
 * Get conflicts for a specific configuration
 */
export async function getConfigConflicts(
  configId: string,
): Promise<SyncConflict[]> {
  const response = await calendarApi.get<SyncConflict[]>(
    `${SYNC_API_PATH}/configs/${configId}/conflicts`,
  );
  return response.data;
}

/**
 * Resolve a conflict
 */
export async function resolveConflict(
  conflictId: string,
  request: ResolveConflictRequest,
): Promise<SyncConflict> {
  const response = await calendarApi.post<SyncConflict>(
    `${SYNC_API_PATH}/conflicts/${conflictId}/resolve`,
    request,
  );
  return response.data;
}

/**
 * Resolve all conflicts for a configuration
 */
export async function resolveAllConflicts(
  configId: string,
  resolution: "local" | "remote",
): Promise<{ resolved: number }> {
  const response = await calendarApi.post<{ resolved: number }>(
    `${SYNC_API_PATH}/configs/${configId}/conflicts/resolve-all`,
    { resolution },
  );
  return response.data;
}

// ============================================================================
// Export API Object
// ============================================================================

export const externalSyncApi = {
  // Connections
  getConnections,
  getConnection,
  connectProvider,
  handleCallback,
  disconnectProvider,
  refreshToken,

  // External Calendars
  listExternalCalendars,
  toggleCalendarSelection,

  // Sync Configs
  getSyncConfigs,
  getSyncConfigForCalendar,
  createSyncConfig,
  updateSyncConfig,
  deleteSyncConfig,
  toggleSyncConfig,

  // Sync Operations
  triggerSync,
  triggerSyncAll,

  // Logs
  getSyncLogs,
  getConfigSyncLogs,

  // Conflicts
  getConflicts,
  getConfigConflicts,
  resolveConflict,
  resolveAllConflicts,
};
