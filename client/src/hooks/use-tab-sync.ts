"use client";

import { useEffect, useCallback } from "react";

type TabSyncMessage = {
  type: "auth-change" | "theme-change" | "logout" | "data-update";
  payload?: unknown;
  tabId: string;
};

const TAB_ID =
  typeof crypto !== "undefined"
    ? crypto.randomUUID()
    : Math.random().toString(36);

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel("signapps-tab-sync");
    } catch {
      return null;
    }
  }
  return channel;
}

export function useTabSync(onMessage: (msg: TabSyncMessage) => void) {
  useEffect(() => {
    const ch = getChannel();
    if (!ch) return;

    const handler = (e: MessageEvent<TabSyncMessage>) => {
      if (e.data.tabId !== TAB_ID) {
        onMessage(e.data);
      }
    };

    ch.addEventListener("message", handler);
    return () => ch.removeEventListener("message", handler);
  }, [onMessage]);

  const broadcast = useCallback(
    (type: TabSyncMessage["type"], payload?: unknown) => {
      const ch = getChannel();
      if (!ch) return;
      ch.postMessage({ type, payload, tabId: TAB_ID } satisfies TabSyncMessage);
    },
    [],
  );

  return { broadcast, tabId: TAB_ID };
}
