"use client";

import { useCallback } from "react";
import { usePolling } from "@/hooks/use-polling";
import { useNotificationStore } from "@/stores/notification-store";
import { playNotificationSound } from "@/components/notifications/notification-sounds";

/**
 * GlobalPolling
 *
 * Centralized polling component that fetches real-time data at fixed intervals:
 * - Notification count: every 30 seconds
 * - Mail unread count: every 60 seconds (via sidebar badges / notification store)
 * - Chat messages: every 30 seconds (via sidebar badges)
 *
 * This component renders nothing; it only runs side-effects.
 * Mount it inside the Providers tree.
 */
export function GlobalPolling() {
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);

  // Poll notifications every 30 seconds
  const pollNotifications = useCallback(async () => {
    const prevCount = useNotificationStore
      .getState()
      .notifications.filter((n) => !n.read).length;
    await fetchNotifications();
    const newCount = useNotificationStore
      .getState()
      .notifications.filter((n) => !n.read).length;

    // Play sound if new unread notifications arrived
    if (newCount > prevCount && prevCount >= 0) {
      playNotificationSound("alert");
    }
  }, [fetchNotifications]);

  usePolling(pollNotifications, {
    interval: 30_000,
    requireAuth: true,
    pauseOnHidden: true,
  });

  return null;
}
