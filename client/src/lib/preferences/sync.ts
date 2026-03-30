/**
 * Cross-Device Sync
 *
 * Real-time synchronization of preferences across devices using SSE.
 */

import { useEffect, useRef, useCallback } from "react";
import { usePreferencesStore } from "./store";
import { getDeviceId, isOnline } from "./api";
import type { UserPreferences, PreferencesSection } from "./types";

// ============================================================================
// Types
// ============================================================================

interface SyncEvent {
  type: "update" | "reset" | "conflict";
  section?: PreferencesSection;
  data?: Partial<UserPreferences>;
  deviceId: string;
  timestamp: string;
}

interface SyncConnection {
  connect: () => void;
  disconnect: () => void;
  isConnecté: () => boolean;
}

// ============================================================================
// SSE Connection
// ============================================================================

const SYNC_ENDPOINT = "/api/v1/users/me/preferences/sync/stream";

/**
 * Create an SSE connection for real-time sync
 */
export function createSyncConnection(
  onEvent: (event: SyncEvent) => void,
  onError?: (error: Error) => void
): SyncConnection {
  let eventSource: EventSource | null = null;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  const connect = () => {
    if (typeof window === "undefined") return;
    if (!isOnline()) return;

    const deviceId = getDeviceId();
    const url = `${SYNC_ENDPOINT}?deviceId=${deviceId}`;

    try {
      eventSource = new EventSource(url, { withCredentials: true });

      eventSource.onopen = () => {
        reconnectAttempts = 0;
      };

      eventSource.onmessage = (e) => {
        try {
          const event: SyncEvent = JSON.parse(e.data);
          // Ignore events from this device
          if (event.deviceId !== deviceId) {
            onEvent(event);
          }
        } catch (err) {
          console.error("[Preferences Sync] Failed to parse event:", err);
        }
      };

      eventSource.onerror = () => {
        console.warn("[Preferences Sync] Connection error");
        disconnect();

        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          reconnectTimeout = setTimeout(connect, reconnectDelay * reconnectAttempts);
        } else {
          onError?.(new Error("Max reconnect attempts reached"));
        }
      };
    } catch (err) {
      console.error("[Preferences Sync] Failed to connect:", err);
      onError?.(err instanceof Error ? err : new Error("Échec de la connexion"));
    }
  };

  const disconnect = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  };

  const isConnecté = () => {
    return eventSource?.readyState === EventSource.OPEN;
  };

  return { connect, disconnect, isConnecté };
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Hook to enable real-time cross-device sync
 */
export function useCrossDeviceSync(enabled = true) {
  const connectionRef = useRef<SyncConnection | null>(null);
  const updateSection = usePreferencesStore((s) => s.updateSection);
  const sync = usePreferencesStore((s) => s.sync);

  const handleEvent = useCallback(
    (event: SyncEvent) => {
      switch (event.type) {
        case "update":
          if (event.section && event.data) {
            // Apply the update from another device
            // This bypasses the normal sync debouncing
            usePreferencesStore.setState((state) => ({
              preferences: {
                ...state.preferences,
                [event.section!]: {
                  ...state.preferences[event.section as PreferencesSection],
                  ...event.data,
                },
                lastSyncedAt: event.timestamp,
                lastModifiedBy: event.deviceId,
              },
            }));
          }
          break;

        case "reset":
          // Another device reset preferences, reload
          sync();
          break;

        case "conflict":
          // A conflict was detected, force a full sync
          console.warn("[Preferences Sync] Conflict detected, forcing sync");
          sync();
          break;
      }
    },
    [sync]
  );

  const handleError = useCallback((error: Error) => {
    console.error("[Preferences Sync] Error:", error.message);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    connectionRef.current = createSyncConnection(handleEvent, handleError);
    connectionRef.current.connect();

    // Listen for online/offline
    const handleOnline = () => {
      connectionRef.current?.connect();
    };

    const handleOffline = () => {
      connectionRef.current?.disconnect();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen for visibility changes (reconnect when tab becomes visible)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!connectionRef.current?.isConnecté()) {
          connectionRef.current?.connect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      connectionRef.current?.disconnect();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, handleEvent, handleError]);

  return {
    isConnecté: () => connectionRef.current?.isConnecté() ?? false,
    reconnect: () => connectionRef.current?.connect(),
    disconnect: () => connectionRef.current?.disconnect(),
  };
}

// ============================================================================
// Broadcast Channel (Same-Browser Sync)
// ============================================================================

const BROADCAST_CHANNEL_NAME = "signapps-preferences-sync";

interface BroadcastMessage {
  type: "update" | "reset";
  section?: PreferencesSection;
  data?: Record<string, unknown>;
  deviceId: string;
  timestamp: string;
}

/**
 * Hook to sync preferences across tabs in the same browser
 */
export function useBroadcastSync() {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("BroadcastChannel" in window)) return;

    const deviceId = getDeviceId();
    channelRef.current = new BroadcastChannel(BROADCAST_CHANNEL_NAME);

    channelRef.current.onmessage = (e: MessageEvent<BroadcastMessage>) => {
      const message = e.data;

      // Ignore messages from this tab
      if (message.deviceId === deviceId) return;

      if (message.type === "update" && message.section && message.data) {
        usePreferencesStore.setState((state) => ({
          preferences: {
            ...state.preferences,
            [message.section!]: {
              ...state.preferences[message.section as PreferencesSection],
              ...message.data,
            },
            lastSyncedAt: message.timestamp,
          },
        }));
      } else if (message.type === "reset") {
        usePreferencesStore.getState().sync();
      }
    };

    return () => {
      channelRef.current?.close();
    };
  }, []);

  const broadcast = useCallback(
    (type: "update" | "reset", section?: PreferencesSection, data?: Record<string, unknown>) => {
      if (!channelRef.current) return;

      const message: BroadcastMessage = {
        type,
        section,
        data,
        deviceId: getDeviceId(),
        timestamp: new Date().toISOString(),
      };

      channelRef.current.postMessage(message);
    },
    []
  );

  return { broadcast };
}

// ============================================================================
// Storage Event Listener (Fallback for older browsers)
// ============================================================================

/**
 * Hook to sync via localStorage events (fallback)
 */
export function useStorageSync(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "signapps-preferences" && e.newValue) {
        try {
          const { state } = JSON.parse(e.newValue);
          if (state?.preferences) {
            usePreferencesStore.setState({
              preferences: state.preferences,
            });
          }
        } catch (err) {
          console.error("[Storage Sync] Failed to parse:", err);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [enabled]);
}

// ============================================================================
// Combined Sync Provider
// ============================================================================

interface SyncConfig {
  /** Enable SSE cross-device sync */
  crossDevice?: boolean;
  /** Enable BroadcastChannel same-browser sync */
  broadcast?: boolean;
  /** Enable localStorage fallback */
  storageFallback?: boolean;
}

/**
 * Hook that enables all sync mechanisms
 */
export function usePreferencesSync(config: SyncConfig = {}) {
  const {
    crossDevice = true,
    broadcast = true,
    storageFallback = true,
  } = config;

  // Cross-device sync via SSE
  const sseSync = useCrossDeviceSync(crossDevice);

  // Same-browser sync via BroadcastChannel
  useBroadcastSync();

  // Fallback via localStorage events — called unconditionally; storageFallback
  // controls behaviour inside the hook to satisfy rules-of-hooks
  useStorageSync(storageFallback);

  return {
    isConnecté: sseSync.isConnecté,
    reconnect: sseSync.reconnect,
    disconnect: sseSync.disconnect,
  };
}
