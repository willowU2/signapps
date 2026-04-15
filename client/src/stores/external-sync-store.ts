/**
 * External Sync Store
 *
 * Zustand store for managing external calendar sync state.
 */

import { create } from "zustand";
import type {
  CalendarProvider,
  ProviderConnection,
  ExternalCalendar,
  SyncConfig,
  SyncLogEntry,
  SyncConflict,
  SyncStatus,
} from "@/lib/calendar/external-sync/types";
import { externalSyncApi } from "@/lib/calendar/external-sync/api";

// ============================================================================
// Types
// ============================================================================

interface ExternalSyncState {
  // Connections
  connections: ProviderConnection[];
  selectedConnectionId: string | null;

  // External Calendars
  externalCalendars: Record<string, ExternalCalendar[]>; // keyed by connection_id

  // Sync Configs
  syncConfigs: SyncConfig[];

  // Logs
  syncLogs: SyncLogEntry[];

  // Conflicts
  conflicts: SyncConflict[];
  unresolvedConflictCount: number;

  // Loading states
  isLoadingConnections: boolean;
  isLoadingCalendars: boolean;
  isLoadingConfigs: boolean;
  isLoadingLogs: boolean;
  isLoadingConflicts: boolean;
  isSyncing: boolean;

  // Error
  error: string | null;

  // OAuth state
  pendingOAuthState: string | null;

  // Actions - Connections
  loadConnections: () => Promise<void>;
  connectProvider: (
    provider: CalendarProvider,
    redirectUri: string,
  ) => Promise<string>;
  handleOAuthCallback: (
    provider: CalendarProvider,
    code: string,
    state: string,
  ) => Promise<void>;
  disconnectProvider: (connectionId: string) => Promise<void>;
  refreshToken: (connectionId: string) => Promise<void>;
  setSelectedConnection: (connectionId: string | null) => void;

  // Actions - External Calendars
  loadExternalCalendars: (connectionId: string) => Promise<void>;
  toggleCalendarSelection: (
    connectionId: string,
    externalCalendarId: string,
    selected: boolean,
  ) => Promise<void>;

  // Actions - Sync Configs
  loadSyncConfigs: () => Promise<void>;
  createSyncConfig: (
    config: Parameters<typeof externalSyncApi.createSyncConfig>[0],
  ) => Promise<SyncConfig>;
  updateSyncConfig: (
    configId: string,
    updates: Parameters<typeof externalSyncApi.updateSyncConfig>[1],
  ) => Promise<void>;
  deleteSyncConfig: (configId: string) => Promise<void>;
  toggleSyncConfig: (configId: string, enabled: boolean) => Promise<void>;

  // Actions - Sync Operations
  triggerSync: (configId: string) => Promise<void>;
  triggerSyncAll: () => Promise<void>;

  // Actions - Logs
  loadSyncLogs: (configId?: string) => Promise<void>;

  // Actions - Conflicts
  loadConflicts: () => Promise<void>;
  resolveConflict: (
    conflictId: string,
    resolution: "local" | "remote",
  ) => Promise<void>;
  resolveAllConflicts: (
    configId: string,
    resolution: "local" | "remote",
  ) => Promise<void>;

  // Utility
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useExternalSyncStore = create<ExternalSyncState>()((set, get) => ({
  // Initial state
  connections: [],
  selectedConnectionId: null,
  externalCalendars: {},
  syncConfigs: [],
  syncLogs: [],
  conflicts: [],
  unresolvedConflictCount: 0,
  isLoadingConnections: false,
  isLoadingCalendars: false,
  isLoadingConfigs: false,
  isLoadingLogs: false,
  isLoadingConflicts: false,
  isSyncing: false,
  error: null,
  pendingOAuthState: null,

  // Connection Actions
  loadConnections: async () => {
    set({ isLoadingConnections: true, error: null });

    try {
      const connections = await externalSyncApi.getConnections();
      set({ connections, isLoadingConnections: false });
    } catch (error) {
      set({
        isLoadingConnections: false,
        error:
          error instanceof Error ? error.message : "Failed to load connections",
      });
    }
  },

  connectProvider: async (provider, redirectUri) => {
    set({ error: null });

    try {
      const response = await externalSyncApi.connectProvider({
        provider,
        redirect_uri: redirectUri,
      });
      set({ pendingOAuthState: response.state });
      return response.auth_url;
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to initiate connection",
      });
      throw error;
    }
  },

  handleOAuthCallback: async (provider, code, state) => {
    const { pendingOAuthState } = get();

    if (state !== pendingOAuthState) {
      set({ error: "Invalid OAuth state" });
      return;
    }

    set({ isLoadingConnections: true, error: null });

    try {
      const connection = await externalSyncApi.handleCallback({
        provider,
        code,
        state,
      });
      set((state) => ({
        connections: [...state.connections, connection],
        selectedConnectionId: connection.id,
        pendingOAuthState: null,
        isLoadingConnections: false,
      }));
    } catch (error) {
      set({
        isLoadingConnections: false,
        pendingOAuthState: null,
        error: error instanceof Error ? error.message : "OAuth callback failed",
      });
    }
  },

  disconnectProvider: async (connectionId) => {
    set({ error: null });

    try {
      await externalSyncApi.disconnectProvider(connectionId);
      set((state) => ({
        connections: state.connections.filter((c) => c.id !== connectionId),
        externalCalendars: Object.fromEntries(
          Object.entries(state.externalCalendars).filter(
            ([key]) => key !== connectionId,
          ),
        ),
        syncConfigs: state.syncConfigs.filter(
          (c) => c.connection_id !== connectionId,
        ),
        selectedConnectionId:
          state.selectedConnectionId === connectionId
            ? null
            : state.selectedConnectionId,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to disconnect",
      });
    }
  },

  refreshToken: async (connectionId) => {
    set({ error: null });

    try {
      const connection = await externalSyncApi.refreshToken(connectionId);
      set((state) => ({
        connections: state.connections.map((c) =>
          c.id === connectionId ? connection : c,
        ),
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to refresh token",
      });
    }
  },

  setSelectedConnection: (connectionId) => {
    set({ selectedConnectionId: connectionId });
  },

  // External Calendars Actions
  loadExternalCalendars: async (connectionId) => {
    set({ isLoadingCalendars: true, error: null });

    try {
      const response =
        await externalSyncApi.listExternalCalendars(connectionId);
      set((state) => ({
        externalCalendars: {
          ...state.externalCalendars,
          [connectionId]: response.calendars,
        },
        isLoadingCalendars: false,
      }));
    } catch (error) {
      set({
        isLoadingCalendars: false,
        error:
          error instanceof Error ? error.message : "Failed to load calendars",
      });
    }
  },

  toggleCalendarSelection: async (
    connectionId,
    externalCalendarId,
    selected,
  ) => {
    set({ error: null });

    try {
      const updated = await externalSyncApi.toggleCalendarSelection(
        connectionId,
        externalCalendarId,
        selected,
      );
      set((state) => ({
        externalCalendars: {
          ...state.externalCalendars,
          [connectionId]:
            state.externalCalendars[connectionId]?.map((c) =>
              c.id === updated.id ? updated : c,
            ) || [],
        },
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to toggle calendar",
      });
    }
  },

  // Sync Config Actions
  loadSyncConfigs: async () => {
    set({ isLoadingConfigs: true, error: null });

    try {
      const configs = await externalSyncApi.getSyncConfigs();
      set({ syncConfigs: configs, isLoadingConfigs: false });
    } catch (error) {
      set({
        isLoadingConfigs: false,
        error:
          error instanceof Error ? error.message : "Failed to load configs",
      });
    }
  },

  createSyncConfig: async (config) => {
    set({ error: null });

    try {
      const created = await externalSyncApi.createSyncConfig(config);
      set((state) => ({
        syncConfigs: [...state.syncConfigs, created],
      }));
      return created;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Impossible de créer config",
      });
      throw error;
    }
  },

  updateSyncConfig: async (configId, updates) => {
    set({ error: null });

    try {
      const updated = await externalSyncApi.updateSyncConfig(configId, updates);
      set((state) => ({
        syncConfigs: state.syncConfigs.map((c) =>
          c.id === configId ? updated : c,
        ),
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Impossible de mettre à jour config",
      });
    }
  },

  deleteSyncConfig: async (configId) => {
    set({ error: null });

    try {
      await externalSyncApi.deleteSyncConfig(configId);
      set((state) => ({
        syncConfigs: state.syncConfigs.filter((c) => c.id !== configId),
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Impossible de supprimer config",
      });
    }
  },

  toggleSyncConfig: async (configId, enabled) => {
    set({ error: null });

    try {
      const updated = await externalSyncApi.toggleSyncConfig(configId, enabled);
      set((state) => ({
        syncConfigs: state.syncConfigs.map((c) =>
          c.id === configId ? updated : c,
        ),
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to toggle config",
      });
    }
  },

  // Sync Operations
  triggerSync: async (configId) => {
    set({ isSyncing: true, error: null });

    try {
      const log = await externalSyncApi.triggerSync(configId);
      set((state) => ({
        syncLogs: [log, ...state.syncLogs],
        isSyncing: false,
      }));
    } catch (error) {
      set({
        isSyncing: false,
        error: error instanceof Error ? error.message : "Sync failed",
      });
    }
  },

  triggerSyncAll: async () => {
    set({ isSyncing: true, error: null });

    try {
      await externalSyncApi.triggerSyncAll();
      // Reload logs after sync
      await get().loadSyncLogs();
      set({ isSyncing: false });
    } catch (error) {
      set({
        isSyncing: false,
        error: error instanceof Error ? error.message : "Sync failed",
      });
    }
  },

  // Logs Actions
  loadSyncLogs: async (configId) => {
    set({ isLoadingLogs: true, error: null });

    try {
      const filter = configId ? { config_id: configId } : undefined;
      const { logs } = await externalSyncApi.getSyncLogs(filter);
      set({ syncLogs: logs, isLoadingLogs: false });
    } catch (error) {
      set({
        isLoadingLogs: false,
        error: error instanceof Error ? error.message : "Failed to load logs",
      });
    }
  },

  // Conflict Actions
  loadConflicts: async () => {
    set({ isLoadingConflicts: true, error: null });

    try {
      const conflicts = await externalSyncApi.getConflicts();
      set({
        conflicts,
        unresolvedConflictCount: conflicts.filter((c) => !c.resolved).length,
        isLoadingConflicts: false,
      });
    } catch (error) {
      set({
        isLoadingConflicts: false,
        error:
          error instanceof Error ? error.message : "Failed to load conflicts",
      });
    }
  },

  resolveConflict: async (conflictId, resolution) => {
    set({ error: null });

    try {
      const resolved = await externalSyncApi.resolveConflict(conflictId, {
        resolution,
      });
      set((state) => ({
        conflicts: state.conflicts.map((c) =>
          c.id === conflictId ? resolved : c,
        ),
        unresolvedConflictCount: state.unresolvedConflictCount - 1,
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to resolve conflict",
      });
    }
  },

  resolveAllConflicts: async (configId, resolution) => {
    set({ error: null });

    try {
      const { resolved } = await externalSyncApi.resolveAllConflicts(
        configId,
        resolution,
      );
      set((state) => ({
        conflicts: state.conflicts.map((c) =>
          c.sync_config_id === configId
            ? { ...c, resolved: true, resolution }
            : c,
        ),
        unresolvedConflictCount: state.unresolvedConflictCount - resolved,
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to resolve conflicts",
      });
    }
  },

  // Utility
  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      connections: [],
      selectedConnectionId: null,
      externalCalendars: {},
      syncConfigs: [],
      syncLogs: [],
      conflicts: [],
      unresolvedConflictCount: 0,
      error: null,
      pendingOAuthState: null,
    });
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectConnections = (state: ExternalSyncState) =>
  state.connections;
export const selectSelectedConnection = (state: ExternalSyncState) =>
  state.connections.find((c) => c.id === state.selectedConnectionId);
export const selectGoogleConnection = (state: ExternalSyncState) =>
  state.connections.find((c) => c.provider === "google");
export const selectMicrosoftConnection = (state: ExternalSyncState) =>
  state.connections.find((c) => c.provider === "microsoft");
export const selectHasUnresolvedConflicts = (state: ExternalSyncState) =>
  state.unresolvedConflictCount > 0;
export const selectIsSyncing = (state: ExternalSyncState) => state.isSyncing;

export default useExternalSyncStore;
