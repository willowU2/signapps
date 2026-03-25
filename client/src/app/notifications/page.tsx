"use client";

import { useEffect, useState, useMemo } from "react";
import {
  notificationsApi,
  type Notification,
  type NotificationType,
  type NotificationPriority,
} from "@/lib/api/notifications";

// ─── Metadata maps ────────────────────────────────────────────────────────────

const TYPE_META: Record<
  NotificationType,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  info: {
    label: "Info",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="w-5 h-5"
      >
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
      </svg>
    ),
  },
  warning: {
    label: "Avertissement",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>
    ),
  },
  alert: {
    label: "Alerte",
    color: "text-red-500",
    bg: "bg-red-500/10",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="w-5 h-5"
      >
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
      </svg>
    ),
  },
  success: {
    label: "Succès",
    color: "text-green-500",
    bg: "bg-green-500/10",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="w-5 h-5"
      >
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
};

const PRIORITY_META: Record<
  NotificationPriority,
  { label: string; color: string }
> = {
  high:   { label: "Haute",   color: "bg-red-500/10 text-red-500" },
  medium: { label: "Moyenne", color: "bg-yellow-500/10 text-yellow-500" },
  low:    { label: "Basse",   color: "bg-muted text-muted-foreground" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Filter types ─────────────────────────────────────────────────────────────

type FilterMode = "all" | "unread" | NotificationType;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [all, setAll] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(true);

  // Merge server read flag with local optimistic state
  const notifications = useMemo<Notification[]>(
    () =>
      all.map((n) => ({
        ...n,
        read: n.read || readIds.has(n.id),
      })),
    [all, readIds]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    notificationsApi
      .list()
      .then((res) => {
        if (!cancelled) setAll(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setAll([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered list
  const filtered = useMemo<Notification[]>(() => {
    return notifications.filter((n) => {
      if (filter === "unread") return !n.read;
      if (filter !== "all") return (n.type ?? "info") === filter;
      return true;
    });
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markRead(id: string) {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function markAllRead() {
    setReadIds(new Set(all.map((n) => n.id)));
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary text-primary-foreground text-xs font-bold px-2.5 py-0.5 leading-none">
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-primary hover:underline transition"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            "all",
            "unread",
            "info",
            "warning",
            "alert",
            "success",
          ] as FilterMode[]
        ).map((f) => {
          const isActive = filter === f;
          const label =
            f === "all"
              ? "Toutes"
              : f === "unread"
              ? `Non lues${unreadCount > 0 ? ` (${unreadCount})` : ""}`
              : TYPE_META[f as NotificationType]?.label ?? f;

          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              onMarkRead={() => markRead(n.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Notification Card ────────────────────────────────────────────────────────

function NotificationCard({
  notification: n,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: () => void;
}) {
  const type = (n.type ?? "info") as NotificationType;
  const meta = TYPE_META[type] ?? TYPE_META.info;
  const priority = PRIORITY_META[n.priority ?? "low"] ?? PRIORITY_META.low;

  return (
    <div
      className={`flex gap-4 p-4 rounded-xl border transition-colors ${
        n.read
          ? "bg-background"
          : "bg-accent/30 border-primary/20"
      }`}
    >
      {/* Type icon */}
      <div
        className={`flex-shrink-0 mt-0.5 rounded-full p-2 ${meta.bg} ${meta.color}`}
      >
        {meta.icon}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3
              className={`font-semibold leading-tight ${
                n.read ? "text-foreground/70" : "text-foreground"
              }`}
            >
              {n.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
              {n.body}
            </p>
          </div>

          {/* Unread dot / mark read button */}
          {!n.read && (
            <button
              onClick={onMarkRead}
              title="Marquer comme lu"
              className="flex-shrink-0 mt-1 w-2.5 h-2.5 rounded-full bg-primary hover:opacity-70 transition-opacity"
              aria-label="Marquer comme lu"
            />
          )}
        </div>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {formatRelative(n.created_at)}
          </span>

          {n.source && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">{n.source}</span>
            </>
          )}

          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.color}`}
          >
            {priority.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterMode }) {
  const messages: Record<string, { title: string; hint: string }> = {
    all:     { title: "Aucune notification",       hint: "Vous êtes à jour !" },
    unread:  { title: "Tout est lu",               hint: "Pas de notification non lue." },
    info:    { title: "Aucune info",               hint: "Aucune notification de type Infos." },
    warning: { title: "Aucun avertissement",       hint: "Tout semble se passer correctement." },
    alert:   { title: "Aucune alerte",             hint: "Aucun problème critique à signaler." },
    success: { title: "Aucune notification succès",hint: "Aucune action réussie récente." },
  };

  const { title, hint } = messages[filter] ?? messages.all;

  return (
    <div className="text-center py-20 text-muted-foreground">
      <svg
        className="mx-auto mb-4 w-12 h-12 opacity-25"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm mt-1">{hint}</p>
    </div>
  );
}
