import { useEffect, useState, useCallback, useRef } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import { Awareness } from "y-protocols/awareness";
import { usePresenceStore } from "@/stores/presence-store";
import { COLLAB_ENABLED } from "@/lib/api/core";

interface UseYjsDocumentOptions {
  /**
   * WebSocket server URL (e.g., 'ws://localhost:3010')
   */
  wsUrl?: string;
  /**
   * Enable awareness (presence/cursors)
   */
  awareness?: boolean;
  /**
   * Enable IndexedDB persistence for offline support
   */
  enableOffline?: boolean;
  /**
   * Callback when document synced with server
   */
  onSync?: () => void;
  /**
   * Callback when loaded from IndexedDB
   */
  onOfflineLoad?: () => void;
  /**
   * Callback on errors
   */
  onError?: (error: Error) => void;
}

export function useYjsDocument(
  docId: string,
  options: UseYjsDocumentOptions = {},
) {
  const {
    wsUrl = COLLAB_URL,
    awareness: enableAwareness = true,
    enableOffline = true,
    onSync,
    onOfflineLoad,
    onError,
  } = options;

  const collabServerEnabled = COLLAB_ENABLED;

  const [ydoc] = useState<Y.Doc>(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const [isOfflineLoaded, setIsOfflineLoaded] = useState(false);

  // Store refs
  const idbProviderRef = useRef<IndexeddbPersistence | null>(null);
  const pendingUpdateCountRef = useRef(0);

  // Presence store for connection state
  const setConnectionStatus = usePresenceStore(
    (state) => state.setConnectionStatus,
  );
  const setSynced = usePresenceStore((state) => state.setSynced);
  const incrementPendingChanges = usePresenceStore(
    (state) => state.incrementPendingChanges,
  );
  const clearPendingChanges = usePresenceStore(
    (state) => state.clearPendingChanges,
  );

  useEffect(() => {
    let wsProvider: WebsocketProvider | null = null;
    let idbProvider: IndexeddbPersistence | null = null;

    try {
      // Set initial connection status
      setConnectionStatus("connecting");

      // Create IndexedDB persistence for offline support
      if (enableOffline) {
        idbProvider = new IndexeddbPersistence(`signapps-doc-${docId}`, ydoc);
        idbProviderRef.current = idbProvider;

        // Track when local data is loaded
        idbProvider.on("synced", () => {
          setIsOfflineLoaded(true);
          if (onOfflineLoad) {
            onOfflineLoad();
          }
          console.warn(`[useYjsDocument] Loaded offline data for ${docId}`);
        });
      }

      // Create WebSocket provider
      wsProvider = new WebsocketProvider(wsUrl, docId, ydoc, {
        // @ts-expect-error y-websocket WebsocketProviderOptions type omits `awareness` boolean; accepted at runtime
        awareness: enableAwareness,
        resyncInterval: 5000,
        connect: false, // Don't connect immediately to avoid console spam if offline
      });

      // Track pending changes when offline
      const handleUpdate = () => {
        if (wsProvider && !wsProvider.wsconnected) {
          pendingUpdateCountRef.current += 1;
          incrementPendingChanges();
        }
      };
      ydoc.on("update", handleUpdate);

      // Only connect if collaboration server is explicitly enabled
      if (collabServerEnabled) {
        const httpUrl = wsUrl
          .replace("ws://", "http://")
          .replace("wss://", "https://");
        fetch(httpUrl, { method: "HEAD", mode: "no-cors" })
          .then(() => {
            wsProvider?.connect();
          })
          .catch(() => {
            console.warn(
              `[useYjsDocument] Collaboration server at ${wsUrl} is offline. Running in offline mode.`,
            );
            setConnectionStatus("disconnected");
          });
      } else {
        console.warn(
          "[useYjsDocument] Running in offline mode (NEXT_PUBLIC_COLLAB_ENABLED not set)",
        );
        setConnectionStatus("disconnected");
      }

      // Listen for sync events
      wsProvider.on("sync", (syncedState: boolean) => {
        setIsSynced(syncedState);
        setSynced(syncedState);
        if (syncedState) {
          // Clear pending changes after successful sync
          pendingUpdateCountRef.current = 0;
          clearPendingChanges();
          if (onSync) {
            onSync();
          }
        }
      });

      // Handle connection state changes
      wsProvider.on("status", (event: { status: string }) => {
        if (event.status === "connected") {
          setConnectionStatus("connected");
        } else if (event.status === "disconnected") {
          setConnectionStatus("disconnected");
        }
      });

      wsProvider.on("connection-close", () => {
        setConnectionStatus("disconnected");
      });

      wsProvider.on("connection-error", (error: Error) => {
        setConnectionStatus("disconnected");
        if (onError) {
          onError(error);
        }
      });

      setProvider(wsProvider);
      setAwareness(wsProvider.awareness || null);

      return () => {
        ydoc.off("update", handleUpdate);
        wsProvider?.disconnect();
        wsProvider?.destroy();
        idbProvider?.destroy();
      };
    } catch (error) {
      setConnectionStatus("disconnected");
      const err = error instanceof Error ? error : new Error(String(error));
      if (onError) {
        onError(err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    docId,
    wsUrl,
    enableAwareness,
    enableOffline,
    onSync,
    onOfflineLoad,
    onError,
    setConnectionStatus,
    setSynced,
    incrementPendingChanges,
    clearPendingChanges,
  ]);

  // Helper to update local awareness state (e.g., cursor position)
  const updateAwareness = useCallback(
    (state: Record<string, any>) => {
      if (awareness) {
        awareness.setLocalState(state);
      }
    },
    [awareness],
  );

  // Helper to get shared text
  const getSharedText = useCallback(
    (name: string = "shared-text"): Y.Text | null => {
      if (!ydoc) return null;
      return ydoc.getText(name);
    },
    [ydoc],
  );

  // Helper to get shared map
  const getSharedMap = useCallback(
    (name: string = "shared-map"): Y.Map<any> | null => {
      if (!ydoc) return null;
      return ydoc.getMap(name);
    },
    [ydoc],
  );

  // Helper to get shared array
  const getSharedArray = useCallback(
    (name: string = "shared-array"): Y.Array<any> | null => {
      if (!ydoc) return null;
      return ydoc.getArray(name);
    },
    [ydoc],
  );

  // Force reconnect attempt
  const reconnect = useCallback(() => {
    if (provider && !provider.wsconnected) {
      setConnectionStatus("reconnecting");
      provider.connect();
    }
  }, [provider, setConnectionStatus]);

  return {
    ydoc,
    provider,
    awareness,
    isSynced,
    isOfflineLoaded,
    updateAwareness,
    getSharedText,
    getSharedMap,
    getSharedArray,
    reconnect,
  };
}
