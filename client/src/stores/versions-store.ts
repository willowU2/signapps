/**
 * Versions Store
 *
 * Zustand store for document version history management.
 */

import { create } from "zustand";
import type {
  DocumentVersion,
  VersionDiff,
  VersionType,
} from "@/lib/office/versions/types";
import { versionsApi } from "@/lib/office/versions/api";

// ============================================================================
// Types
// ============================================================================

interface VersionsState {
  // Current document context
  documentId: string | null;

  // Versions list
  versions: DocumentVersion[];
  totalVersions: number;
  currentPage: number;
  pageSize: number;
  hasMore: boolean;

  // Filters
  typeFilter: VersionType | "all";
  starredOnly: boolean;
  dateRange: { from?: string; to?: string };

  // Loading states
  isLoading: boolean;
  isLoadingMore: boolean;
  isCreating: boolean;
  isRestoring: boolean;
  isComparing: boolean;

  // Selected versions for comparison
  selectedVersions: string[];

  // Comparison result
  comparisonResult: VersionDiff | null;

  // Version preview
  previewVersionId: string | null;
  previewContent: Record<string, unknown> | null;
  isLoadingPreview: boolean;

  // Error state
  error: string | null;

  // Actions
  setDocumentId: (documentId: string) => void;
  fetchVersions: (reset?: boolean) => Promise<void>;
  fetchMoreVersions: () => Promise<void>;
  createVersion: (
    label?: string,
    description?: string,
  ) => Promise<DocumentVersion | null>;
  restoreVersion: (
    versionId: string,
    createBackup?: boolean,
  ) => Promise<boolean>;
  deleteVersion: (versionId: string) => Promise<boolean>;
  starVersion: (versionId: string) => Promise<void>;
  unstarVersion: (versionId: string) => Promise<void>;
  updateVersionMetadata: (
    versionId: string,
    data: { label?: string; description?: string },
  ) => Promise<void>;
  toggleVersionSelection: (versionId: string) => void;
  clearSelection: () => void;
  compareSelectedVersions: () => Promise<void>;
  compareVersions: (sourceId: string, targetId: string) => Promise<void>;
  clearComparison: () => void;
  loadVersionPreview: (versionId: string) => Promise<void>;
  clearPreview: () => void;
  setTypeFilter: (type: VersionType | "all") => void;
  setStarredOnly: (starredOnly: boolean) => void;
  setDateRange: (range: { from?: string; to?: string }) => void;
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useVersionsStore = create<VersionsState>((set, get) => ({
  // Initial state
  documentId: null,
  versions: [],
  totalVersions: 0,
  currentPage: 1,
  pageSize: 20,
  hasMore: false,

  typeFilter: "all",
  starredOnly: false,
  dateRange: {},

  isLoading: false,
  isLoadingMore: false,
  isCreating: false,
  isRestoring: false,
  isComparing: false,

  selectedVersions: [],
  comparisonResult: null,

  previewVersionId: null,
  previewContent: null,
  isLoadingPreview: false,

  error: null,

  // Actions
  setDocumentId: (documentId: string) => {
    const current = get().documentId;
    if (current !== documentId) {
      set({
        documentId,
        versions: [],
        totalVersions: 0,
        currentPage: 1,
        selectedVersions: [],
        comparisonResult: null,
        previewVersionId: null,
        previewContent: null,
      });
      get().fetchVersions(true);
    }
  },

  fetchVersions: async (reset = false) => {
    const { documentId, typeFilter, starredOnly, dateRange, pageSize } = get();
    if (!documentId) return;

    set({ isLoading: true, error: null });
    if (reset) {
      set({ currentPage: 1, versions: [] });
    }

    try {
      const response = await versionsApi.getVersions({
        documentId,
        page: 1,
        pageSize,
        type: typeFilter,
        starredOnly,
        fromDate: dateRange.from,
        toDate: dateRange.to,
      });

      set({
        versions: response.versions,
        totalVersions: response.total,
        hasMore: response.hasMore,
        currentPage: 1,
        isLoading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Erreur lors du chargement",
        isLoading: false,
      });
    }
  },

  fetchMoreVersions: async () => {
    const {
      documentId,
      hasMore,
      isLoadingMore,
      currentPage,
      typeFilter,
      starredOnly,
      dateRange,
      pageSize,
      versions,
    } = get();

    if (!documentId || !hasMore || isLoadingMore) return;

    set({ isLoadingMore: true, error: null });

    try {
      const response = await versionsApi.getVersions({
        documentId,
        page: currentPage + 1,
        pageSize,
        type: typeFilter,
        starredOnly,
        fromDate: dateRange.from,
        toDate: dateRange.to,
      });

      set({
        versions: [...versions, ...response.versions],
        hasMore: response.hasMore,
        currentPage: currentPage + 1,
        isLoadingMore: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Erreur lors du chargement",
        isLoadingMore: false,
      });
    }
  },

  createVersion: async (label?: string, description?: string) => {
    const { documentId } = get();
    if (!documentId) return null;

    set({ isCreating: true, error: null });

    try {
      const version = await versionsApi.createVersion({
        documentId,
        label,
        description,
      });

      set((state) => ({
        versions: [version, ...state.versions],
        totalVersions: state.totalVersions + 1,
        isCreating: false,
      }));

      return version;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Erreur lors de la création",
        isCreating: false,
      });
      return null;
    }
  },

  restoreVersion: async (versionId: string, createBackup = true) => {
    const { documentId } = get();
    if (!documentId) return false;

    set({ isRestoring: true, error: null });

    try {
      const result = await versionsApi.restoreDocumentVersion(
        documentId,
        versionId,
        createBackup,
      );

      // Add new versions to the list
      set((state) => {
        const newVersions = [result.newVersion];
        if (result.backupVersion) {
          newVersions.unshift(result.backupVersion);
        }
        return {
          versions: [...newVersions, ...state.versions],
          totalVersions: state.totalVersions + newVersions.length,
          isRestoring: false,
        };
      });

      return true;
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la restauration",
        isRestoring: false,
      });
      return false;
    }
  },

  deleteVersion: async (versionId: string) => {
    const { documentId } = get();
    if (!documentId) return false;

    try {
      await versionsApi.deleteVersion(documentId, versionId);

      set((state) => ({
        versions: state.versions.filter((v) => v.id !== versionId),
        totalVersions: state.totalVersions - 1,
        selectedVersions: state.selectedVersions.filter(
          (id) => id !== versionId,
        ),
      }));

      return true;
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la suppression",
      });
      return false;
    }
  },

  starVersion: async (versionId: string) => {
    const { documentId } = get();
    if (!documentId) return;

    try {
      await versionsApi.starVersion(documentId, versionId);

      set((state) => ({
        versions: state.versions.map((v) =>
          v.id === versionId ? { ...v, isStarred: true } : v,
        ),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Erreur",
      });
    }
  },

  unstarVersion: async (versionId: string) => {
    const { documentId } = get();
    if (!documentId) return;

    try {
      await versionsApi.unstarVersion(documentId, versionId);

      set((state) => ({
        versions: state.versions.map((v) =>
          v.id === versionId ? { ...v, isStarred: false } : v,
        ),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Erreur",
      });
    }
  },

  updateVersionMetadata: async (
    versionId: string,
    data: { label?: string; description?: string },
  ) => {
    const { documentId } = get();
    if (!documentId) return;

    try {
      const updated = await versionsApi.updateVersion(
        documentId,
        versionId,
        data,
      );

      set((state) => ({
        versions: state.versions.map((v) => (v.id === versionId ? updated : v)),
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la mise à jour",
      });
    }
  },

  toggleVersionSelection: (versionId: string) => {
    set((state) => {
      const isSelected = state.selectedVersions.includes(versionId);
      if (isSelected) {
        return {
          selectedVersions: state.selectedVersions.filter(
            (id) => id !== versionId,
          ),
        };
      } else if (state.selectedVersions.length < 2) {
        return {
          selectedVersions: [...state.selectedVersions, versionId],
        };
      }
      return state;
    });
  },

  clearSelection: () => {
    set({ selectedVersions: [], comparisonResult: null });
  },

  compareSelectedVersions: async () => {
    const { selectedVersions, documentId } = get();
    if (selectedVersions.length !== 2 || !documentId) return;

    // Sort by version number to determine source and target
    const versions = get().versions;
    const [v1, v2] = selectedVersions.map(
      (id) => versions.find((v) => v.id === id)!,
    );
    const [source, target] =
      v1.versionNumber < v2.versionNumber ? [v1, v2] : [v2, v1];

    await get().compareVersions(source.id, target.id);
  },

  compareVersions: async (sourceId: string, targetId: string) => {
    const { documentId } = get();
    if (!documentId) return;

    set({ isComparing: true, error: null });

    try {
      const diff = await versionsApi.compareDocumentVersions(
        documentId,
        sourceId,
        targetId,
      );

      set({
        comparisonResult: diff,
        isComparing: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la comparaison",
        isComparing: false,
      });
    }
  },

  clearComparison: () => {
    set({ comparisonResult: null });
  },

  loadVersionPreview: async (versionId: string) => {
    const { documentId } = get();
    if (!documentId) return;

    set({ isLoadingPreview: true, previewVersionId: versionId });

    try {
      const { content } = await versionsApi.getVersionContent(
        documentId,
        versionId,
      );

      set({
        previewContent: content,
        isLoadingPreview: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Erreur lors du chargement",
        isLoadingPreview: false,
      });
    }
  },

  clearPreview: () => {
    set({ previewVersionId: null, previewContent: null });
  },

  setTypeFilter: (type: VersionType | "all") => {
    set({ typeFilter: type });
    get().fetchVersions(true);
  },

  setStarredOnly: (starredOnly: boolean) => {
    set({ starredOnly });
    get().fetchVersions(true);
  },

  setDateRange: (range: { from?: string; to?: string }) => {
    set({ dateRange: range });
    get().fetchVersions(true);
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      documentId: null,
      versions: [],
      totalVersions: 0,
      currentPage: 1,
      hasMore: false,
      typeFilter: "all",
      starredOnly: false,
      dateRange: {},
      selectedVersions: [],
      comparisonResult: null,
      previewVersionId: null,
      previewContent: null,
      error: null,
    });
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectVersions = (state: VersionsState) => state.versions;
export const selectSelectedVersions = (state: VersionsState) =>
  state.selectedVersions;
export const selectComparisonResult = (state: VersionsState) =>
  state.comparisonResult;
export const selectIsLoading = (state: VersionsState) => state.isLoading;
export const selectIsComparing = (state: VersionsState) => state.isComparing;
export const selectError = (state: VersionsState) => state.error;

export default useVersionsStore;
