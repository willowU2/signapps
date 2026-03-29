"use client";

import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Settings2, Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  notificationsApi,
  type Notification,
  type NotificationType,
  type NotificationPriority,
} from "@/lib/api/notifications";
import { usePageTitle } from '@/hooks/use-page-title';

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
  usePageTitle('Notifications');
  const [all, setAll] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(true);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState({
    email: true,
    push: true,
    info: true,
    warning: true,
    alert: true,
    success: true,
  });

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
    <AppLayout>
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

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm text-primary hover:underline transition"
            >
              Tout marquer comme lu
            </button>
          )}
          <button
            onClick={() => setShowPrefs(!showPrefs)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title="Préférences de notification"
          >
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Notification Preferences Panel */}
      {showPrefs && (
        <div className="rounded-xl border bg-card p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Préférences</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'email' as const, label: 'Notifications email' },
              { key: 'push' as const, label: 'Notifications push' },
              { key: 'info' as const, label: 'Infos' },
              { key: 'warning' as const, label: 'Avertissements' },
              { key: 'alert' as const, label: 'Alertes' },
              { key: 'success' as const, label: 'Succès' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) => setPrefs(p => ({ ...p, [key]: e.target.checked }))}
                  className="rounded border-input h-4 w-4 accent-primary"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

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
        <NotificationsEmptyState filter={filter} />
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
    </AppLayout>
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

function NotificationsEmptyState({ filter }: { filter: FilterMode }) {
  const messages: Record<string, { title: string; hint: string }> = {
    all:     { title: "Aucune notification",        hint: "Vous êtes à jour !" },
    unread:  { title: "Tout est lu",                hint: "Pas de notification non lue." },
    info:    { title: "Aucune info",                hint: "Aucune notification de type Infos." },
    warning: { title: "Aucun avertissement",        hint: "Tout semble se passer correctement." },
    alert:   { title: "Aucune alerte",              hint: "Aucun problème critique à signaler." },
    success: { title: "Aucune notification succès", hint: "Aucune action réussie récente." },
  };

  const { title, hint } = messages[filter] ?? messages.all;

  return (
    <EmptyState
      icon={Bell}
      context="empty"
      title={title}
      description={hint}
    />
  );
}
