/**
 * Office Google Integration Components
 *
 * Components for Google Workspace integration.
 */

// Components
export { GoogleDriveBrowser } from './google-drive-browser';

// Types
export type {
  GoogleAuthState,
  GoogleDriveFile,
  GoogleDriveFolder,
  GoogleDriveListResponse,
  SyncedDocument,
  SyncConflict,
  SyncStatus,
  SyncDirection,
  ImportFromGoogleRequest,
  ImportFromGoogleResponse,
  ExportToGoogleRequest,
  ExportToGoogleResponse,
  GoogleIntegrationSettings,
} from '@/lib/office/google/types';

// Constants
export {
  GOOGLE_MIME_TYPE_LABELS,
  SYNC_STATUS_LABELS,
  SYNC_STATUS_COLORS,
  DEFAULT_GOOGLE_SETTINGS,
} from '@/lib/office/google/types';

// API
export { googleApi } from '@/lib/office/google/api';

// Store
export { useGoogleStore } from '@/stores/google-store';
