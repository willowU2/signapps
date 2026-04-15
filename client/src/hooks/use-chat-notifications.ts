"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * IDEA-139: Desktop push notifications via the Notification API.
 * Shows a desktop notification for new messages when the tab is not focused.
 */
export function useChatNotifications(enabled: boolean = true) {
  const permissionRef = useRef<NotificationPermission>("default");

  // Request permission on mount
  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification === "undefined") return;
    permissionRef.current = Notification.permission;
    if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        permissionRef.current = p;
      });
    }
  }, [enabled]);

  const notify = useCallback(
    (senderName: string, preview: string, channelName?: string) => {
      if (!enabled) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      // Only notify when the tab is hidden or the page is not focused
      if (document.visibilityState === "visible" && document.hasFocus()) return;

      const title = channelName
        ? `${senderName} in #${channelName}`
        : senderName;
      const body =
        preview.length > 100 ? preview.slice(0, 100) + "..." : preview;

      const notification = new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: `chat-${channelName || "dm"}`,
        silent: false,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    },
    [enabled],
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined")
      return "denied" as NotificationPermission;
    const permission = await Notification.requestPermission();
    permissionRef.current = permission;
    return permission;
  }, []);

  const currentPermission = (): NotificationPermission => {
    if (typeof Notification === "undefined") return "denied";
    return Notification.permission;
  };

  return { notify, requestPermission, currentPermission };
}
