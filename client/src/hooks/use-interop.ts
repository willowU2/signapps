"use client";

/**
 * useInterop — central hook for cross-module operations (Mail ↔ Tasks ↔ Calendar).
 * All 30 interoperability features share this hook.
 */

import { useCallback, useEffect, useState } from "react";
import { interopStore, type CrossLink, type ActivityEntry, type UnifiedNotification } from "@/lib/interop/store";

export function useInteropLinks(entityType: string, entityId: string) {
  const [links, setLinks] = useState<CrossLink[]>([]);

  useEffect(() => {
    if (!entityId) return;
    setLinks(interopStore.getLinksForEntity(entityType, entityId));
  }, [entityType, entityId]);

  const addLink = useCallback((link: Omit<CrossLink, "id" | "createdAt">) => {
    const entry = interopStore.addLink(link);
    setLinks(prev => [...prev, entry]);
    return entry;
  }, []);

  return { links, addLink, refresh: () => setLinks(interopStore.getLinksForEntity(entityType, entityId)) };
}

export function useInteropActivity(contactEmail?: string) {
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    if (contactEmail) {
      setActivity(interopStore.getActivityForContact(contactEmail));
    } else {
      setActivity(interopStore.getActivity().slice(0, 50));
    }
  }, [contactEmail]);

  const log = useCallback((entry: Omit<ActivityEntry, "id" | "createdAt">) => {
    const record = interopStore.logActivity(entry);
    setActivity(prev => [record, ...prev]);
    return record;
  }, []);

  return { activity, log };
}

export function useUnifiedNotifications() {
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(() => {
    const all = interopStore.getNotifications();
    setNotifications(all);
    setUnreadCount(all.filter(n => !n.read).length);
  }, []);

  useEffect(() => {
    refresh();
    // Poll every 30s for updates from other tabs
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const markRead = useCallback((id: string) => {
    interopStore.markRead(id);
    refresh();
  }, [refresh]);

  const markAllRead = useCallback(() => {
    interopStore.markAllRead();
    refresh();
  }, [refresh]);

  const add = useCallback((n: Omit<UnifiedNotification, "id" | "createdAt" | "read">) => {
    const record = interopStore.addNotification(n);
    refresh();
    return record;
  }, [refresh]);

  return { notifications, unreadCount, markRead, markAllRead, add, refresh };
}

/** Emit a custom DOM event so components can react without prop drilling */
export function emitInteropEvent(type: string, detail: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(`interop:${type}`, { detail }));
}

export function useInteropEventListener(type: string, handler: (detail: Record<string, unknown>) => void) {
  useEffect(() => {
    const listener = (e: Event) => handler((e as CustomEvent).detail);
    window.addEventListener(`interop:${type}`, listener);
    return () => window.removeEventListener(`interop:${type}`, listener);
  }, [type, handler]);
}
