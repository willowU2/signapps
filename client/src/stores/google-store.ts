/**
 * Google Store
 *
 * Zustand store for Google Workspace integration state.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  GoogleAuthState,
  GoogleDriveFile,
  SyncedDocument,
  SyncConflict,
  GoogleIntegrationSettings,
} from "@/lib/office/google/types";
import { DEFAULT_GOOGLE_SETTINGS } from "@/lib/office/google/types";
import { googleApi } from "@/lib/office/google/api";

// ============================================================================
// Types
// ============================================================================

interface GoogleState {
  // Auth state
  auth: GoogleAuthState;
  isAuthLoading: boolean;
  authError: string | null;

  // Drive state
  currentFolderId: string | null;
  driveFiles: GoogleDriveFile[];
  recentFiles: GoogleDriveFile[];
  isLoadingFiles: boolean;
  filesPageToken: string | null;
  hasMoreFiles: boolean;

  // Sync state
  syncedDocuments: SyncedDocument[];
  syncConflicts: SyncConflict[];
  isLoadingSync: boolean;
  isSyncing: string | null; // Document ID being synced

  // Settings
  settings: GoogleIntegrationSettings;

  // Error state
  error: string | null;

  // Actions - Auth
  checkAuthStatus: () => Promise<void>;
  initiateAuth: () => Promise<string | null>;
  disconnect: () => Promise<void>;

  // Actions - Drive
  listFiles: (folderId?: string, reset?: boolean) => Promise<void>;
  loadMoreFiles: () => Promise<void>;
  loadRecentFiles: () => Promise<void>;
  searchFiles: (query: string) => Promise<void>;
  navigateToFolder: (folderId: string | null) => void;

  // Actions - Import/Export
  importFile: (
    fileId: string,
    options?: { folderId?: string; keepSync?: boolean },
  ) => Promise<string | null>;
  exportFile: (
    documentId: string,
    options?: { googleFolderId?: string; keepSync?: boolean },
  ) => Promise<string | null>;

  // Actions - Sync
  loadSyncedDocuments: () => Promise<void>;
  loadSyncConflicts: () => Promise<void>;
  enableSync: (documentId: string, googleFileId: string) => Promise<boolean>;
  disableSync: (documentId: string) => Promise<boolean>;
  triggerSync: (documentId: string) => Promise<boolean>;
  resolveConflict: (
    documentId: string,
    resolution: "keepLocal" | "keepGoogle" | "keepBoth",
  ) => Promise<boolean>;

  // Actions - Settings
  updateSettings: (
    settings: Partial<GoogleIntegrationSettings>,
  ) => Promise<void>;

  // Utility
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useGoogleStore = create<GoogleState>()(
  persist(
    (set, get) => ({
      // Initial state
      auth: {
        isConnecté: false,
        scopes: [],
      },
      isAuthLoading: false,
      authError: null,

      currentFolderId: null,
      driveFiles: [],
      recentFiles: [],
      isLoadingFiles: false,
      filesPageToken: null,
      hasMoreFiles: false,

      syncedDocuments: [],
      syncConflicts: [],
      isLoadingSync: false,
      isSyncing: null,

      settings: DEFAULT_GOOGLE_SETTINGS,

      error: null,

      // Auth Actions
      checkAuthStatus: async () => {
        set({ isAuthLoading: true, authError: null });

        try {
          const auth = await googleApi.getAuthState();
          set({ auth, isAuthLoading: false });

          // Load synced documents if connected
          if (auth.isConnecté) {
            get().loadSyncedDocuments();
          }
        } catch (error) {
          set({
            auth: { isConnecté: false, scopes: [] },
            isAuthLoading: false,
            authError:
              error instanceof Error
                ? error.message
                : "Erreur d'authentification",
          });
        }
      },

      initiateAuth: async () => {
        set({ isAuthLoading: true, authError: null });

        try {
          const { authUrl } = await googleApi.initiateAuth();
          set({ isAuthLoading: false });
          return authUrl;
        } catch (error) {
          set({
            isAuthLoading: false,
            authError:
              error instanceof Error
                ? error.message
                : "Erreur d'authentification",
          });
          return null;
        }
      },

      disconnect: async () => {
        set({ isAuthLoading: true });

        try {
          await googleApi.disconnectGoogle();
          set({
            auth: { isConnecté: false, scopes: [] },
            driveFiles: [],
            recentFiles: [],
            syncedDocuments: [],
            syncConflicts: [],
            isAuthLoading: false,
          });
        } catch (error) {
          set({
            isAuthLoading: false,
            error:
              error instanceof Error ? error.message : "Erreur de déconnexion",
          });
        }
      },

      // Drive Actions
      listFiles: async (folderId?: string, reset = true) => {
        const { auth } = get();
        if (!auth.isConnecté) return;

        set({
          isLoadingFiles: true,
          error: null,
          currentFolderId: folderId ?? null,
        });

        if (reset) {
          set({ driveFiles: [], filesPageToken: null });
        }

        try {
          const response = await googleApi.listDriveFiles({
            folderId,
            pageSize: 50,
            orderBy: "modifiedTime",
          });

          set({
            driveFiles: reset
              ? response.files
              : [...get().driveFiles, ...response.files],
            filesPageToken: response.nextPageToken ?? null,
            hasMoreFiles: !!response.nextPageToken,
            isLoadingFiles: false,
          });
        } catch (error) {
          set({
            isLoadingFiles: false,
            error:
              error instanceof Error ? error.message : "Erreur de chargement",
          });
        }
      },

      loadMoreFiles: async () => {
        const {
          filesPageToken,
          hasMoreFiles,
          isLoadingFiles,
          currentFolderId,
        } = get();
        if (!hasMoreFiles || isLoadingFiles || !filesPageToken) return;

        set({ isLoadingFiles: true });

        try {
          const response = await googleApi.listDriveFiles({
            folderId: currentFolderId ?? undefined,
            pageToken: filesPageToken,
            pageSize: 50,
          });

          set({
            driveFiles: [...get().driveFiles, ...response.files],
            filesPageToken: response.nextPageToken ?? null,
            hasMoreFiles: !!response.nextPageToken,
            isLoadingFiles: false,
          });
        } catch (error) {
          set({
            isLoadingFiles: false,
            error:
              error instanceof Error ? error.message : "Erreur de chargement",
          });
        }
      },

      loadRecentFiles: async () => {
        const { auth } = get();
        if (!auth.isConnecté) return;

        try {
          const files = await googleApi.getRecentDriveFiles(10);
          set({ recentFiles: files });
        } catch (error) {
          // Silent fail for recent files
        }
      },

      searchFiles: async (query: string) => {
        const { auth } = get();
        if (!auth.isConnecté) return;

        set({ isLoadingFiles: true, error: null });

        try {
          const response = await googleApi.searchDriveFiles(query, {
            pageSize: 50,
          });
          set({
            driveFiles: response.files,
            filesPageToken: response.nextPageToken ?? null,
            hasMoreFiles: !!response.nextPageToken,
            isLoadingFiles: false,
          });
        } catch (error) {
          set({
            isLoadingFiles: false,
            error:
              error instanceof Error ? error.message : "Erreur de recherche",
          });
        }
      },

      navigateToFolder: (folderId: string | null) => {
        get().listFiles(folderId ?? undefined, true);
      },

      // Import/Export Actions
      importFile: async (fileId: string, options = {}) => {
        try {
          const result = await googleApi.importFromGoogle({
            fileId,
            folderId: options.folderId,
            keepSync: options.keepSync,
          });

          // Refresh synced documents if sync enabled
          if (result.syncEnabled) {
            get().loadSyncedDocuments();
          }

          return result.documentId;
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : "Erreur d'importation",
          });
          return null;
        }
      },

      exportFile: async (documentId: string, options = {}) => {
        try {
          const result = await googleApi.exportToGoogle({
            documentId,
            googleFolderId: options.googleFolderId,
            keepSync: options.keepSync,
            convertToNative: get().settings.defaultExportFormat === "native",
          });

          // Refresh synced documents if sync enabled
          if (result.syncEnabled) {
            get().loadSyncedDocuments();
          }

          return result.googleFileId;
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : "Erreur d'exportation",
          });
          return null;
        }
      },

      // Sync Actions
      loadSyncedDocuments: async () => {
        set({ isLoadingSync: true });

        try {
          const documents = await googleApi.getSyncedDocuments();
          set({ syncedDocuments: documents, isLoadingSync: false });
        } catch (error) {
          set({ isLoadingSync: false });
        }
      },

      loadSyncConflicts: async () => {
        try {
          const conflicts = await googleApi.getSyncConflicts();
          set({ syncConflicts: conflicts });
        } catch (error) {
          // Silent fail
        }
      },

      enableSync: async (documentId: string, googleFileId: string) => {
        try {
          const synced = await googleApi.enableSync(
            documentId,
            googleFileId,
            get().settings.defaultSyncDirection,
          );

          set((state) => ({
            syncedDocuments: [...state.syncedDocuments, synced],
          }));

          return true;
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Erreur de synchronisation",
          });
          return false;
        }
      },

      disableSync: async (documentId: string) => {
        try {
          await googleApi.disableSync(documentId);

          set((state) => ({
            syncedDocuments: state.syncedDocuments.filter(
              (d) => d.documentId !== documentId,
            ),
          }));

          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Erreur",
          });
          return false;
        }
      },

      triggerSync: async (documentId: string) => {
        set({ isSyncing: documentId });

        try {
          const synced = await googleApi.triggerSync(documentId);

          set((state) => ({
            syncedDocuments: state.syncedDocuments.map((d) =>
              d.documentId === documentId ? synced : d,
            ),
            isSyncing: null,
          }));

          // Check for conflicts
          get().loadSyncConflicts();

          return true;
        } catch (error) {
          set({
            isSyncing: null,
            error:
              error instanceof Error
                ? error.message
                : "Erreur de synchronisation",
          });
          return false;
        }
      },

      resolveConflict: async (documentId: string, resolution) => {
        try {
          const synced = await googleApi.resolveSyncConflict({
            documentId,
            resolution,
          });

          set((state) => ({
            syncedDocuments: state.syncedDocuments.map((d) =>
              d.documentId === documentId ? synced : d,
            ),
            syncConflicts: state.syncConflicts.filter(
              (c) => c.documentId !== documentId,
            ),
          }));

          return true;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Erreur",
          });
          return false;
        }
      },

      // Settings
      updateSettings: async (newSettings) => {
        try {
          const updated = await googleApi.updateSettings(newSettings);
          set({ settings: updated });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Erreur",
          });
        }
      },

      // Utility
      clearError: () => {
        set({ error: null, authError: null });
      },

      reset: () => {
        set({
          auth: { isConnecté: false, scopes: [] },
          driveFiles: [],
          recentFiles: [],
          syncedDocuments: [],
          syncConflicts: [],
          currentFolderId: null,
          error: null,
          authError: null,
        });
      },
    }),
    {
      name: "google-store",
      partialize: (state) => ({
        settings: state.settings,
      }),
    },
  ),
);

// ============================================================================
// Selectors
// ============================================================================

export const selectIsConnecté = (state: GoogleState) => state.auth.isConnecté;
export const selectDriveFiles = (state: GoogleState) => state.driveFiles;
export const selectSyncedDocuments = (state: GoogleState) =>
  state.syncedDocuments;
export const selectSyncConflicts = (state: GoogleState) => state.syncConflicts;
export const selectSettings = (state: GoogleState) => state.settings;

export default useGoogleStore;
