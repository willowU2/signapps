"use client";

import { useState, useEffect } from "react";
import { offlineSyncQueue } from "@/lib/offline-sync";

interface OnlineStatus {
  /** Whether the browser currently reports a network connection */
  isOnline: boolean;
  /** Number of mutations waiting to be replayed when back online */
  queueSize: number;
}

/**
 * useOnlineStatus — V2-13: Push Notifications & Offline Sync foundation
 *
 * Returns the current network status and the size of the offline mutation
 * queue. Subscribes to browser 'online'/'offline' events and re-reads the
 * queue size whenever connectivity changes.
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [queueSize, setQueueSize] = useState<number>(
    offlineSyncQueue.getQueueSize(),
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Queue will be processed by OfflineSyncQueue's own 'online' listener;
      // refresh the size once it settles.
      setTimeout(() => setQueueSize(offlineSyncQueue.getQueueSize()), 500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setQueueSize(offlineSyncQueue.getQueueSize());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, queueSize };
}
