/**
 * Cache Store
 *
 * Zustand store for managing office cache state.
 */

import { create } from "zustand";
import type {
  CacheEntry,
  CacheStats,
  CachePerformance,
  CacheConfig,
  CacheType,
  CacheLocation,
  CacheInvalidateOptions,
  ListCacheEntriesParams,
} from "@/lib/office/cache/types";
import { cacheApi } from "@/lib/office/cache/api";

// ============================================================================
// Types
// ============================================================================

interface CacheState {
  // Entries
  entries: CacheEntry[];
  selectedEntry: CacheEntry | null;
  totalEntries: number;
  hasMoreEntries: boolean;

  // Stats & Performance
  stats: CacheStats | null;
  performance: CachePerformance | null;
  performanceHistory: CachePerformance[];

  // Config
  config: CacheConfig | null;

  // Filters
  typeFilter: CacheType | null;
  locationFilter: CacheLocation | null;
  sortBy: "size" | "accessedAt" | "hitCount" | "priority";
  sortOrder: "asc" | "desc";

  // Loading states
  isLoading: boolean;
  isLoadingStats: boolean;
  isInvalidating: boolean;
  isPrewarming: boolean;

  // Error
  error: string | null;

  // Pagination
  currentOffset: number;
  pageSize: number;

  // Actions - Entries
  loadEntries: (params?: ListCacheEntriesParams) => Promise<void>;
  loadMoreEntries: () => Promise<void>;
  refreshEntries: () => Promise<void>;
  selectEntry: (entry: CacheEntry | null) => void;
  deleteEntry: (key: string) => Promise<boolean>;

  // Actions - Cache Operations
  invalidateCache: (options: CacheInvalidateOptions) => Promise<number>;
  clearCache: () => Promise<number>;
  prewarmCache: (
    documentIds?: string[],
    types?: CacheType[],
  ) => Promise<number>;
  triggerCleanup: () => Promise<number>;

  // Actions - Stats
  loadStats: () => Promise<void>;
  loadPerformance: (period?: "1h" | "24h" | "7d" | "30d") => Promise<void>;
  loadPerformanceHistory: () => Promise<void>;

  // Actions - Config
  loadConfig: () => Promise<void>;
  updateConfig: (config: Partial<CacheConfig>) => Promise<boolean>;

  // Actions - Filters
  setTypeFilter: (type: CacheType | null) => void;
  setLocationFilter: (location: CacheLocation | null) => void;
  setSorting: (
    sortBy: "size" | "accessedAt" | "hitCount" | "priority",
    sortOrder: "asc" | "desc",
  ) => void;

  // Utility
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useCacheStore = create<CacheState>()((set, get) => ({
  // Initial state
  entries: [],
  selectedEntry: null,
  totalEntries: 0,
  hasMoreEntries: false,

  stats: null,
  performance: null,
  performanceHistory: [],

  config: null,

  typeFilter: null,
  locationFilter: null,
  sortBy: "accessedAt",
  sortOrder: "desc",

  isLoading: false,
  isLoadingStats: false,
  isInvalidating: false,
  isPrewarming: false,

  error: null,

  currentOffset: 0,
  pageSize: 50,

  // Entry Actions
  loadEntries: async (params?: ListCacheEntriesParams) => {
    const { typeFilter, locationFilter, sortBy, sortOrder, pageSize } = get();

    set({ isLoading: true, error: null, currentOffset: 0 });

    try {
      const response = await cacheApi.listCacheEntries({
        type: params?.type ?? typeFilter ?? undefined,
        location: params?.location ?? locationFilter ?? undefined,
        sortBy: params?.sortBy ?? sortBy,
        sortOrder: params?.sortOrder ?? sortOrder,
        limit: pageSize,
        offset: 0,
      });

      set({
        entries: response.entries,
        totalEntries: response.total,
        hasMoreEntries: response.hasMore,
        currentOffset: pageSize,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Erreur de chargement",
      });
    }
  },

  loadMoreEntries: async () => {
    const {
      hasMoreEntries,
      isLoading,
      currentOffset,
      typeFilter,
      locationFilter,
      sortBy,
      sortOrder,
      pageSize,
    } = get();

    if (!hasMoreEntries || isLoading) return;

    set({ isLoading: true });

    try {
      const response = await cacheApi.listCacheEntries({
        type: typeFilter ?? undefined,
        location: locationFilter ?? undefined,
        sortBy,
        sortOrder,
        limit: pageSize,
        offset: currentOffset,
      });

      set((state) => ({
        entries: [...state.entries, ...response.entries],
        hasMoreEntries: response.hasMore,
        currentOffset: currentOffset + pageSize,
        isLoading: false,
      }));
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Erreur de chargement",
      });
    }
  },

  refreshEntries: async () => {
    await get().loadEntries();
  },

  selectEntry: (entry: CacheEntry | null) => {
    set({ selectedEntry: entry });
  },

  deleteEntry: async (key: string) => {
    try {
      await cacheApi.deleteCacheEntry(key);

      set((state) => ({
        entries: state.entries.filter((e) => e.key !== key),
        totalEntries: state.totalEntries - 1,
        selectedEntry:
          state.selectedEntry?.key === key ? null : state.selectedEntry,
      }));

      // Refresh stats
      get().loadStats();

      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Erreur de suppression",
      });
      return false;
    }
  },

  // Cache Operations
  invalidateCache: async (options: CacheInvalidateOptions) => {
    set({ isInvalidating: true, error: null });

    try {
      const response = await cacheApi.invalidateCache(options);

      // Refresh entries and stats
      await Promise.all([get().loadEntries(), get().loadStats()]);

      set({ isInvalidating: false });
      return response.invalidatedCount;
    } catch (error) {
      set({
        isInvalidating: false,
        error: error instanceof Error ? error.message : "Erreur d'invalidation",
      });
      return 0;
    }
  },

  clearCache: async () => {
    set({ isInvalidating: true, error: null });

    try {
      const response = await cacheApi.clearCache();

      set({
        entries: [],
        totalEntries: 0,
        hasMoreEntries: false,
        selectedEntry: null,
        isInvalidating: false,
      });

      // Refresh stats
      await get().loadStats();

      return response.invalidatedCount;
    } catch (error) {
      set({
        isInvalidating: false,
        error: error instanceof Error ? error.message : "Erreur de vidage",
      });
      return 0;
    }
  },

  prewarmCache: async (documentIds?: string[], types?: CacheType[]) => {
    set({ isPrewarming: true, error: null });

    try {
      const response = await cacheApi.prewarmCache({ documentIds, types });
      set({ isPrewarming: false });
      return response.scheduled;
    } catch (error) {
      set({
        isPrewarming: false,
        error:
          error instanceof Error ? error.message : "Erreur de préchauffage",
      });
      return 0;
    }
  },

  triggerCleanup: async () => {
    set({ isInvalidating: true, error: null });

    try {
      const response = await cacheApi.triggerCleanup();

      // Refresh entries and stats
      await Promise.all([get().loadEntries(), get().loadStats()]);

      set({ isInvalidating: false });
      return response.invalidatedCount;
    } catch (error) {
      set({
        isInvalidating: false,
        error: error instanceof Error ? error.message : "Erreur de nettoyage",
      });
      return 0;
    }
  },

  // Stats Actions
  loadStats: async () => {
    set({ isLoadingStats: true });

    try {
      const stats = await cacheApi.getCacheStats();
      set({ stats, isLoadingStats: false });
    } catch (error) {
      set({ isLoadingStats: false });
    }
  },

  loadPerformance: async (period?: "1h" | "24h" | "7d" | "30d") => {
    try {
      const performance = await cacheApi.getCachePerformance(period);
      set({ performance });
    } catch (error) {
      // Silent fail
    }
  },

  loadPerformanceHistory: async () => {
    try {
      const history = await cacheApi.getCachePerformanceHistory("hour");
      set({ performanceHistory: history });
    } catch (error) {
      // Silent fail
    }
  },

  // Config Actions
  loadConfig: async () => {
    try {
      const config = await cacheApi.getCacheConfig();
      set({ config });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Erreur de chargement",
      });
    }
  },

  updateConfig: async (configUpdate: Partial<CacheConfig>) => {
    try {
      const config = await cacheApi.updateCacheConfig(configUpdate);
      set({ config });
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Erreur de mise à jour",
      });
      return false;
    }
  },

  // Filter Actions
  setTypeFilter: (type: CacheType | null) => {
    set({ typeFilter: type });
    get().loadEntries();
  },

  setLocationFilter: (location: CacheLocation | null) => {
    set({ locationFilter: location });
    get().loadEntries();
  },

  setSorting: (sortBy, sortOrder) => {
    set({ sortBy, sortOrder });
    get().loadEntries();
  },

  // Utility
  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      entries: [],
      selectedEntry: null,
      totalEntries: 0,
      hasMoreEntries: false,
      stats: null,
      performance: null,
      performanceHistory: [],
      config: null,
      typeFilter: null,
      locationFilter: null,
      sortBy: "accessedAt",
      sortOrder: "desc",
      error: null,
      currentOffset: 0,
    });
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectCacheStats = (state: CacheState) => state.stats;
export const selectCachePerformance = (state: CacheState) => state.performance;
export const selectCacheConfig = (state: CacheState) => state.config;
export const selectCacheEntries = (state: CacheState) => state.entries;

export default useCacheStore;
