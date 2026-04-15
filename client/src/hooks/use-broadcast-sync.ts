"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const CHANNEL_NAME = "signapps-session-sync";

type SyncMessage = { type: "logout" } | { type: "notification"; count: number };

type NotificationHandler = (count: number) => void;

/**
 * useBroadcastSync
 *
 * Syncs auth state and notification badge count across browser tabs
 * using the BroadcastChannel API. When the user logs out in one tab,
 * all other open tabs are redirected to /login. When a new notification
 * arrives, the badge count is updated in all tabs.
 *
 * Usage:
 *   useBroadcastSync({ onNotification: (count) => setUnread(count) });
 *
 * To broadcast from within a tab:
 *   const { broadcastLogout, broadcastNotification } = useBroadcastSync();
 *   broadcastLogout();
 *   broadcastNotification(unreadCount);
 */
export function useBroadcastSync(options?: {
  onNotification?: NotificationHandler;
}) {
  const router = useRouter();
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (e: MessageEvent<SyncMessage>) => {
      const msg = e.data;

      switch (msg.type) {
        case "logout":
          // Another tab logged out — redirect this tab to login
          router.push("/login");
          break;

        case "notification":
          // Another tab received a notification — update badge count
          options?.onNotification?.(msg.count);
          break;
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [router, options]);

  const broadcastLogout = useCallback(() => {
    channelRef.current?.postMessage({ type: "logout" } satisfies SyncMessage);
  }, []);

  const broadcastNotification = useCallback((count: number) => {
    channelRef.current?.postMessage({
      type: "notification",
      count,
    } satisfies SyncMessage);
  }, []);

  return { broadcastLogout, broadcastNotification };
}
