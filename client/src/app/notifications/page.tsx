"use client";

// NT1: Notification center with tabs, service filters, date grouping, and bulk actions

import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Settings2, Bell, Trash2, CheckCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  notificationsApi,
  type Notification,
  type NotificationType,
  type NotificationPriority,
} from "@/lib/api/notifications";
import { usePageTitle } from '@/hooks/use-page-title';
import { toast } from "sonner";

// ─── Metadata maps ─────────────────────────────────────────────────────────────

const TYPE_META: Record<
  NotificationType,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  info: {
    label: "Info",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
  },
  alert: {
    label: "Alerte",
    color: "text-red-500",
    bg: "bg-red-500/10",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
};

const PRIORITY_META: Record<NotificationPriority, { label: string; color: string }> = {
  high:   { label: "Haute",   color: "bg-red-500/10 text-red-500" },
  medium: { label: "Moyenne", color: "bg-yellow-500/10 text-yellow-500" },
  low:    { label: "Basse",   color: "bg-muted text-muted-foreground" },
};

// ─── Known services ────────────────────────────────────────────────────────────

const KNOWN_SERVICES = ["mail", "calendar", "crm", "tasks", "docs", "drive", "hr", "billing"];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

type DateGroup = "Aujourd'hui" | "Hier" | "Cette semaine" | "Plus ancien";

function getDateGroup(iso: string): DateGroup {
  const now = new Date();
  const date = new Date(iso);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

  if (date >= todayStart) return "Aujourd'hui";
  if (date >= yesterdayStart) return "Hier";
  if (date >= weekStart) return "Cette semaine";
  return "Plus ancien";
}

const DATE_GROUP_ORDER: DateGroup[] = ["Aujourd'hui", "Hier", "Cette semaine", "Plus ancien"];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  usePageTitle('Notifications');
  const [all, setAll] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showPrefs, setShowPrefs] = useState(false);

  // Merge server read flag with local optimistic state
  const notifications = useMemo<Notification[]>(
    () =>
      all
        .filter(n => !deletedIds.has(n.id))
        .map(n => ({ ...n, read: n.read || readIds.has(n.id) })),
    [all, readIds, deletedIds]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    notificationsApi
      .list()
      .then(res => { if (!cancelled) setAll(res.data ?? []); })
      .catch(() => { if (!cancelled) setAll([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Detect known services from notification source
  const services = useMemo(() => {
    const found = new Set<string>();
    notifications.forEach(n => {
      if (n.source) {
        const s = n.source.toLowerCase().split(/[/\s]/)[0];
        found.add(s);
      }
    });
    return KNOWN_SERVICES.filter(s => found.has(s));
  }, [notifications]);

  // Filter by tab
  const filtered = useMemo<Notification[]>(() => {
    if (tab === "all") return notifications;
    if (tab === "unread") return notifications.filter(n => !n.read);
    return notifications.filter(n => {
      const s = n.source?.toLowerCase().split(/[/\s]/)[0] ?? '';
      return s === tab;
    });
  }, [notifications, tab]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<DateGroup, Notification[]>();
    for (const group of DATE_GROUP_ORDER) map.set(group, []);
    for (const n of filtered) {
      const g = getDateGroup(n.created_at);
      map.get(g)!.push(n);
    }
    return map;
  }, [filtered]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = async (id: string) => {
    // Optimistic update
    setReadIds(prev => { const s = new Set(prev); s.add(id); return s; });
    try {
      await notificationsApi.markRead(id);
    } catch {
      // Revert optimistic update on failure
      setReadIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const markAllRead = async () => {
    const prevReadIds = readIds;
    setReadIds(new Set(all.map(n => n.id)));
    try {
      await notificationsApi.markAllRead();
      toast.success("Toutes les notifications marquées comme lues.");
    } catch {
      setReadIds(prevReadIds);
      toast.error("Impossible de marquer toutes les notifications comme lues.");
    }
  };

  const deleteOld = () => {
    const oldIds = notifications
      .filter(n => getDateGroup(n.created_at) === "Plus ancien")
      .map(n => n.id);
    if (oldIds.length === 0) { toast.info("Aucune ancienne notification."); return; }
    // Client-side hide (backend doesn't expose a bulk delete endpoint)
    setDeletedIds(prev => { const s = new Set(prev); oldIds.forEach(id => s.add(id)); return s; });
    toast.success(`${oldIds.length} notification${oldIds.length > 1 ? 's' : ''} supprimée${oldIds.length > 1 ? 's' : ''}.`);
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <Badge className="rounded-full text-xs font-bold">{unreadCount}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
                <CheckCheck className="h-4 w-4" />
                Tout marquer comme lu
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={deleteOld} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Supprimer les anciennes
            </Button>
            <button
              onClick={() => setShowPrefs(!showPrefs)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              title="Préférences de notification"
            >
              <Settings2 className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Preferences panel */}
        {showPrefs && (
          <div className="rounded-xl border bg-card p-5 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Préférences</h2>
            <p className="text-sm text-muted-foreground">
              Les préférences détaillées sont disponibles dans{' '}
              <a href="/settings/notifications" className="text-primary hover:underline">Paramètres → Notifications</a>.
            </p>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all" className="text-xs">
              Toutes
              {notifications.length > 0 && (
                <span className="ml-1 text-muted-foreground">({notifications.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">
              Non lues
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{unreadCount}</Badge>
              )}
            </TabsTrigger>
            {services.map(s => (
              <TabsTrigger key={s} value={s} className="text-xs capitalize">{s}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <LoadingSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState icon={Bell} context="empty" title="Aucune notification" description="Pas de notification dans cet onglet." />
            ) : (
              <div className="space-y-6">
                {DATE_GROUP_ORDER.map(group => {
                  const items = grouped.get(group) ?? [];
                  if (items.length === 0) return null;
                  return (
                    <div key={group}>
                      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        {group}
                      </h2>
                      <div className="space-y-2">
                        {items.map(n => (
                          <NotificationCard key={n.id} notification={n} onMarkRead={() => markRead(n.id)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ─── Notification Card ──────────────────────────────────────────────────────────

function NotificationCard({ notification: n, onMarkRead }: { notification: Notification; onMarkRead: () => void }) {
  const type = (n.type ?? "info") as NotificationType;
  const meta = TYPE_META[type] ?? TYPE_META.info;
  const priority = PRIORITY_META[n.priority ?? "low"] ?? PRIORITY_META.low;

  return (
    <div className={`flex gap-4 p-4 rounded-xl border transition-colors ${n.read ? "bg-background" : "bg-accent/30 border-primary/20"}`}>
      <div className={`flex-shrink-0 mt-0.5 rounded-full p-2 ${meta.bg} ${meta.color}`}>
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className={`font-semibold leading-tight ${n.read ? "text-foreground/70" : "text-foreground"}`}>
              {n.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
          </div>
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
          <span className="text-xs text-muted-foreground">{formatRelative(n.created_at)}</span>
          {n.source && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground capitalize">{n.source}</span>
            </>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.color}`}>
            {priority.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Skeletons ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted" />)}
    </div>
  );
}
