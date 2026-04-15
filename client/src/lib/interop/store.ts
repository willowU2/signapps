"use client";

/**
 * Interoperability store — cross-module data links (Mail ↔ Tasks ↔ Calendar)
 * Uses localStorage as persistence layer when no API is available.
 */

export interface CrossLink {
  id: string;
  sourceType: "mail" | "task" | "event" | "document";
  sourceId: string;
  sourceTitle: string;
  targetType: "mail" | "task" | "event" | "document";
  targetId: string;
  targetTitle: string;
  relation: string; // "created_from" | "linked" | "follow_up" | ...
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  type:
    | "mail_sent"
    | "mail_received"
    | "task_created"
    | "task_completed"
    | "task_status_changed"
    | "event_created";
  contactEmail?: string;
  title: string;
  description?: string;
  entityId: string;
  entityType: "mail" | "task" | "event";
  createdAt: string;
}

export interface UnifiedNotification {
  id: string;
  sourceModule: "mail" | "task" | "calendar";
  type: string;
  title: string;
  body: string;
  entityId?: string;
  read: boolean;
  createdAt: string;
}

const LINKS_KEY = "interop:crosslinks";
const ACTIVITY_KEY = "interop:activity";
const NOTIFICATIONS_KEY = "interop:notifications";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

export const interopStore = {
  // Cross-links
  getLinks(): CrossLink[] {
    return read<CrossLink>(LINKS_KEY);
  },
  addLink(link: Omit<CrossLink, "id" | "createdAt">): CrossLink {
    const links = this.getLinks();
    const entry: CrossLink = {
      ...link,
      id: `cl_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    save(LINKS_KEY, [...links, entry]);
    return entry;
  },
  getLinksBySource(type: string, id: string): CrossLink[] {
    return this.getLinks().filter(
      (l) => l.sourceType === type && l.sourceId === id,
    );
  },
  getLinksByTarget(type: string, id: string): CrossLink[] {
    return this.getLinks().filter(
      (l) => l.targetType === type && l.targetId === id,
    );
  },
  getLinksForEntity(type: string, id: string): CrossLink[] {
    return this.getLinks().filter(
      (l) =>
        (l.sourceType === type && l.sourceId === id) ||
        (l.targetType === type && l.targetId === id),
    );
  },

  // Activity feed
  getActivity(): ActivityEntry[] {
    return read<ActivityEntry>(ACTIVITY_KEY);
  },
  logActivity(entry: Omit<ActivityEntry, "id" | "createdAt">): ActivityEntry {
    const all = this.getActivity();
    const record: ActivityEntry = {
      ...entry,
      id: `act_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    save(ACTIVITY_KEY, [record, ...all].slice(0, 500));
    return record;
  },
  getActivityForContact(email: string): ActivityEntry[] {
    return this.getActivity().filter((a) => a.contactEmail === email);
  },

  // Notifications
  getNotifications(): UnifiedNotification[] {
    return read<UnifiedNotification>(NOTIFICATIONS_KEY);
  },
  addNotification(
    n: Omit<UnifiedNotification, "id" | "createdAt" | "read">,
  ): UnifiedNotification {
    const all = this.getNotifications();
    const record: UnifiedNotification = {
      ...n,
      id: `notif_${Date.now()}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    save(NOTIFICATIONS_KEY, [record, ...all].slice(0, 200));
    return record;
  },
  markRead(id: string) {
    const all = this.getNotifications().map((n) =>
      n.id === id ? { ...n, read: true } : n,
    );
    save(NOTIFICATIONS_KEY, all);
  },
  markAllRead() {
    const all = this.getNotifications().map((n) => ({ ...n, read: true }));
    save(NOTIFICATIONS_KEY, all);
  },
  unreadCount(): number {
    return this.getNotifications().filter((n) => !n.read).length;
  },
};
