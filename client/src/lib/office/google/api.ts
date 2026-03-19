/**
 * Google Workspace Integration API
 *
 * API client for Google Drive, Docs, Sheets, and Slides integration.
 */

import { getClient, ServiceName } from '@/lib/api/factory';

const api = getClient(ServiceName.OFFICE);
import type {
  GoogleAuthState,
  GoogleDriveFile,
  GoogleDriveListResponse,
  ImportFromGoogleRequest,
  ImportFromGoogleResponse,
  ExportToGoogleRequest,
  ExportToGoogleResponse,
  SyncedDocument,
  SyncConflict,
  ResolveSyncConflictRequest,
  GoogleIntegrationSettings,
} from './types';

const GOOGLE_BASE = '/api/v1/integrations/google';

// ============================================================================
// Authentication
// ============================================================================

/**
 * Get current Google authentication state
 */
export async function getAuthState(): Promise<GoogleAuthState> {
  const response = await api.get<GoogleAuthState>(`${GOOGLE_BASE}/auth/status`);
  return response.data;
}

/**
 * Initiate Google OAuth flow
 * Returns the authorization URL to redirect the user to
 */
export async function initiateAuth(
  scopes?: string[]
): Promise<{ authUrl: string }> {
  const response = await api.post<{ authUrl: string }>(
    `${GOOGLE_BASE}/auth/initiate`,
    { scopes }
  );
  return response.data;
}

/**
 * Handle OAuth callback (called after user authorizes)
 */
export async function handleAuthCallback(
  code: string,
  state: string
): Promise<GoogleAuthState> {
  const response = await api.post<GoogleAuthState>(
    `${GOOGLE_BASE}/auth/callback`,
    { code, state }
  );
  return response.data;
}

/**
 * Disconnect Google account
 */
export async function disconnectGoogle(): Promise<void> {
  await api.post(`${GOOGLE_BASE}/auth/disconnect`);
}

/**
 * Refresh Google access token
 */
export async function refreshToken(): Promise<GoogleAuthState> {
  const response = await api.post<GoogleAuthState>(`${GOOGLE_BASE}/auth/refresh`);
  return response.data;
}

// ============================================================================
// Google Drive - Browse
// ============================================================================

/**
 * List files in Google Drive
 */
export async function listDriveFiles(params?: {
  folderId?: string;
  query?: string;
  mimeTypes?: string[];
  pageToken?: string;
  pageSize?: number;
  orderBy?: 'name' | 'modifiedTime' | 'createdTime';
  includeTrash?: boolean;
}): Promise<GoogleDriveListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.folderId) queryParams.append('folderId', params.folderId);
  if (params?.query) queryParams.append('query', params.query);
  if (params?.mimeTypes?.length) queryParams.append('mimeTypes', params.mimeTypes.join(','));
  if (params?.pageToken) queryParams.append('pageToken', params.pageToken);
  if (params?.pageSize) queryParams.append('pageSize', String(params.pageSize));
  if (params?.orderBy) queryParams.append('orderBy', params.orderBy);
  if (params?.includeTrash) queryParams.append('includeTrash', 'true');

  const response = await api.get<GoogleDriveListResponse>(
    `${GOOGLE_BASE}/drive/files?${queryParams.toString()}`
  );
  return response.data;
}

/**
 * Get a specific file from Google Drive
 */
export async function getDriveFile(fileId: string): Promise<GoogleDriveFile> {
  const response = await api.get<GoogleDriveFile>(
    `${GOOGLE_BASE}/drive/files/${fileId}`
  );
  return response.data;
}

/**
 * Search files in Google Drive
 */
export async function searchDriveFiles(
  query: string,
  options?: {
    mimeTypes?: string[];
    pageSize?: number;
  }
): Promise<GoogleDriveListResponse> {
  return listDriveFiles({
    query,
    mimeTypes: options?.mimeTypes,
    pageSize: options?.pageSize,
  });
}

/**
 * Get recent files from Google Drive
 */
export async function getRecentDriveFiles(
  limit = 20
): Promise<GoogleDriveFile[]> {
  const response = await listDriveFiles({
    pageSize: limit,
    orderBy: 'modifiedTime',
  });
  return response.files;
}

/**
 * Get starred files from Google Drive
 */
export async function getStarredDriveFiles(): Promise<GoogleDriveFile[]> {
  const response = await api.get<GoogleDriveListResponse>(
    `${GOOGLE_BASE}/drive/files/starred`
  );
  return response.data.files;
}

// ============================================================================
// Import/Export
// ============================================================================

/**
 * Import a file from Google Drive
 */
export async function importFromGoogle(
  request: ImportFromGoogleRequest
): Promise<ImportFromGoogleResponse> {
  const response = await api.post<ImportFromGoogleResponse>(
    `${GOOGLE_BASE}/import`,
    request
  );
  return response.data;
}

/**
 * Export a document to Google Drive
 */
export async function exportToGoogle(
  request: ExportToGoogleRequest
): Promise<ExportToGoogleResponse> {
  const response = await api.post<ExportToGoogleResponse>(
    `${GOOGLE_BASE}/export`,
    request
  );
  return response.data;
}

/**
 * Import multiple files from Google Drive
 */
export async function importMultipleFromGoogle(
  requests: ImportFromGoogleRequest[]
): Promise<ImportFromGoogleResponse[]> {
  const response = await api.post<ImportFromGoogleResponse[]>(
    `${GOOGLE_BASE}/import/batch`,
    { files: requests }
  );
  return response.data;
}

// ============================================================================
// Sync
// ============================================================================

/**
 * Get all synced documents
 */
export async function getSyncedDocuments(): Promise<SyncedDocument[]> {
  const response = await api.get<SyncedDocument[]>(`${GOOGLE_BASE}/sync`);
  return response.data;
}

/**
 * Get sync status for a specific document
 */
export async function getSyncStatus(documentId: string): Promise<SyncedDocument | null> {
  try {
    const response = await api.get<SyncedDocument>(
      `${GOOGLE_BASE}/sync/${documentId}`
    );
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Enable sync for a document
 */
export async function enableSync(
  documentId: string,
  googleFileId: string,
  direction?: 'bidirectional' | 'toGoogle' | 'fromGoogle'
): Promise<SyncedDocument> {
  const response = await api.post<SyncedDocument>(`${GOOGLE_BASE}/sync`, {
    documentId,
    googleFileId,
    direction,
  });
  return response.data;
}

/**
 * Disable sync for a document
 */
export async function disableSync(documentId: string): Promise<void> {
  await api.delete(`${GOOGLE_BASE}/sync/${documentId}`);
}

/**
 * Manually trigger sync for a document
 */
export async function triggerSync(documentId: string): Promise<SyncedDocument> {
  const response = await api.post<SyncedDocument>(
    `${GOOGLE_BASE}/sync/${documentId}/trigger`
  );
  return response.data;
}

/**
 * Get all sync conflicts
 */
export async function getSyncConflicts(): Promise<SyncConflict[]> {
  const response = await api.get<SyncConflict[]>(`${GOOGLE_BASE}/sync/conflicts`);
  return response.data;
}

/**
 * Resolve a sync conflict
 */
export async function resolveSyncConflict(
  request: ResolveSyncConflictRequest
): Promise<SyncedDocument> {
  const response = await api.post<SyncedDocument>(
    `${GOOGLE_BASE}/sync/conflicts/resolve`,
    request
  );
  return response.data;
}

// ============================================================================
// Settings
// ============================================================================

/**
 * Get Google integration settings
 */
export async function getSettings(): Promise<GoogleIntegrationSettings> {
  const response = await api.get<GoogleIntegrationSettings>(
    `${GOOGLE_BASE}/settings`
  );
  return response.data;
}

/**
 * Update Google integration settings
 */
export async function updateSettings(
  settings: Partial<GoogleIntegrationSettings>
): Promise<GoogleIntegrationSettings> {
  const response = await api.patch<GoogleIntegrationSettings>(
    `${GOOGLE_BASE}/settings`,
    settings
  );
  return response.data;
}

// ============================================================================
// Picker
// ============================================================================

/**
 * Get Google Picker configuration
 */
export async function getPickerConfig(): Promise<{
  apiKey: string;
  clientId: string;
  developerKey: string;
}> {
  const response = await api.get<{
    apiKey: string;
    clientId: string;
    developerKey: string;
  }>(`${GOOGLE_BASE}/picker/config`);
  return response.data;
}

// ============================================================================
// Export All
// ============================================================================

export const googleApi = {
  // Auth
  getAuthState,
  initiateAuth,
  handleAuthCallback,
  disconnectGoogle,
  refreshToken,
  // Drive
  listDriveFiles,
  getDriveFile,
  searchDriveFiles,
  getRecentDriveFiles,
  getStarredDriveFiles,
  // Import/Export
  importFromGoogle,
  exportToGoogle,
  importMultipleFromGoogle,
  // Sync
  getSyncedDocuments,
  getSyncStatus,
  enableSync,
  disableSync,
  triggerSync,
  getSyncConflicts,
  resolveSyncConflict,
  // Settings
  getSettings,
  updateSettings,
  // Picker
  getPickerConfig,
};

export default googleApi;
