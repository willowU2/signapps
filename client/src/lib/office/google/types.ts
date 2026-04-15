/**
 * Google Workspace Integration Types
 *
 * Type definitions for Google Drive, Docs, Sheets, and Slides integration.
 */

// ============================================================================
// Authentication Types
// ============================================================================

export interface GoogleAuthState {
  /** Whether the user is connected to Google */
  isConnecté: boolean;
  /** User's Google email */
  email?: string;
  /** User's Google name */
  name?: string;
  /** User's Google profile picture */
  picture?: string;
  /** Access token (managed by backend) */
  accessTokenExpiresAt?: string;
  /** Scopes granted */
  scopes: string[];
}

export interface GoogleAuthConfig {
  /** OAuth client ID */
  clientId: string;
  /** Required scopes */
  scopes: string[];
  /** Redirect URI */
  redirectUri: string;
}

// ============================================================================
// Google Drive Types
// ============================================================================

export type GoogleMimeType =
  | "application/vnd.google-apps.document"
  | "application/vnd.google-apps.spreadsheet"
  | "application/vnd.google-apps.presentation"
  | "application/vnd.google-apps.folder"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  | "application/pdf"
  | "text/plain"
  | "text/html";

export interface GoogleDriveFile {
  /** File ID */
  id: string;
  /** File name */
  name: string;
  /** MIME type */
  mimeType: GoogleMimeType | string;
  /** File size in bytes */
  size?: number;
  /** Created time */
  createdTime: string;
  /** Modified time */
  modifiedTime: string;
  /** Parent folder IDs */
  parents?: string[];
  /** Owner information */
  owners?: GoogleDriveUser[];
  /** Thumbnail link */
  thumbnailLink?: string;
  /** Icon link */
  iconLink?: string;
  /** Web view link */
  webViewLink?: string;
  /** Whether the user can edit */
  capabilities?: {
    canEdit: boolean;
    canComment: boolean;
    canShare: boolean;
    canDownload: boolean;
  };
  /** Starred status */
  starred: boolean;
  /** Trashed status */
  trashed: boolean;
}

export interface GoogleDriveUser {
  displayName: string;
  emailAddress: string;
  photoLink?: string;
}

export interface GoogleDriveFolder extends GoogleDriveFile {
  mimeType: "application/vnd.google-apps.folder";
}

export interface GoogleDriveListResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
  incompleteSearch?: boolean;
}

// ============================================================================
// Import/Export Types
// ============================================================================

export type ExportFormat = "docx" | "xlsx" | "pptx" | "pdf" | "html" | "txt";
export type ImportFormat = "gdoc" | "gsheet" | "gslide";

export interface ImportFromGoogleRequest {
  /** Google Drive file ID */
  fileId: string;
  /** Destination folder in our system */
  folderId?: string;
  /** New name for the imported file */
  newName?: string;
  /** Keep sync with Google (two-way sync) */
  keepSync?: boolean;
}

export interface ImportFromGoogleResponse {
  /** Created document ID in our system */
  documentId: string;
  /** Document name */
  name: string;
  /** Document type */
  type: "doc" | "sheet" | "slide";
  /** Whether sync is enabled */
  syncEnabled: boolean;
}

export interface ExportToGoogleRequest {
  /** Document ID in our system */
  documentId: string;
  /** Target folder ID in Google Drive */
  googleFolderId?: string;
  /** Name for the exported file */
  name?: string;
  /** Create as native Google format or keep as Office format */
  convertToNative?: boolean;
  /** Keep sync with our system */
  keepSync?: boolean;
}

export interface ExportToGoogleResponse {
  /** Created file ID in Google Drive */
  googleFileId: string;
  /** Web view link */
  webViewLink: string;
  /** Whether sync is enabled */
  syncEnabled: boolean;
}

// ============================================================================
// Sync Types
// ============================================================================

export type SyncStatus =
  | "synced"
  | "pending"
  | "conflict"
  | "error"
  | "disabled";

export type SyncDirection = "bidirectional" | "toGoogle" | "fromGoogle";

export interface SyncedDocument {
  /** Our document ID */
  documentId: string;
  /** Google file ID */
  googleFileId: string;
  /** Sync status */
  status: SyncStatus;
  /** Sync direction */
  direction: SyncDirection;
  /** Last sync time */
  lastSyncedAt?: string;
  /** Last modified locally */
  localModifiedAt: string;
  /** Last modified on Google */
  googleModifiedAt: string;
  /** Sync error message if any */
  errorMessage?: string;
}

export interface SyncConflict {
  /** Our document ID */
  documentId: string;
  /** Google file ID */
  googleFileId: string;
  /** Local version info */
  localVersion: {
    modifiedAt: string;
    modifiedBy: string;
    preview?: string;
  };
  /** Google version info */
  googleVersion: {
    modifiedAt: string;
    modifiedBy: string;
    preview?: string;
  };
}

export interface ResolveSyncConflictRequest {
  documentId: string;
  resolution: "keepLocal" | "keepGoogle" | "keepBoth";
}

// ============================================================================
// Picker Types
// ============================================================================

export interface GooglePickerConfig {
  /** View type */
  viewId:
    | "DOCS"
    | "SPREADSHEETS"
    | "PRESENTATIONS"
    | "FOLDERS"
    | "RECENTLY_MODIFIED";
  /** Allow multiple selection */
  multiSelect?: boolean;
  /** Filter by MIME types */
  mimeTypes?: string[];
  /** Starting folder ID */
  parentId?: string;
  /** Include shared drives */
  includeSharedDrives?: boolean;
}

export interface GooglePickerResult {
  /** Selected files */
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    url: string;
  }>;
  /** Picker action (picked, cancel) */
  action: "picked" | "cancel";
}

// ============================================================================
// Settings Types
// ============================================================================

export interface GoogleIntegrationSettings {
  /** Auto-sync enabled */
  autoSyncEnabled: boolean;
  /** Auto-sync interval in minutes */
  autoSyncInterval: number;
  /** Default sync direction */
  defaultSyncDirection: SyncDirection;
  /** Default export format */
  defaultExportFormat: "native" | "office";
  /** Show Google Drive in file picker */
  showInFilePicker: boolean;
  /** Notify on sync conflicts */
  notifyOnConflict: boolean;
}

export const DEFAULT_GOOGLE_SETTINGS: GoogleIntegrationSettings = {
  autoSyncEnabled: true,
  autoSyncInterval: 5,
  defaultSyncDirection: "bidirectional",
  defaultExportFormat: "native",
  showInFilePicker: true,
  notifyOnConflict: true,
};

// ============================================================================
// Labels
// ============================================================================

export const GOOGLE_MIME_TYPE_LABELS: Record<string, string> = {
  "application/vnd.google-apps.document": "Google Docs",
  "application/vnd.google-apps.spreadsheet": "Google Sheets",
  "application/vnd.google-apps.presentation": "Google Slides",
  "application/vnd.google-apps.folder": "Dossier",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "Document Word",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "Feuille Excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "Présentation PowerPoint",
  "application/pdf": "PDF",
};

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  synced: "Synchronisé",
  pending: "En attente",
  conflict: "Conflit",
  error: "Erreur",
  disabled: "Désactivé",
};

export const SYNC_STATUS_COLORS: Record<SyncStatus, string> = {
  synced:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  conflict:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  disabled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};
