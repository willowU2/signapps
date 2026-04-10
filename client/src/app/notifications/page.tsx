"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Settings2,
  Bell,
  Trash2,
  CheckCheck,
  BellRing,
  MessageSquare,
  UserCheck,
  Clock,
  ThumbsUp,
  Share2,
  MessageCircle,
  Heart,
  Filter,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  notificationsApi,
  type NotificationItem,
  type NotificationType,
  type ListNotificationsParams,
} from "@/lib/api/notifications";
import { usePageTitle } from "@/hooks/use-page-title";
import { toast } from "sonner";

// ─── Type metadata ──────────────────────────────────────────────────────────

const TYPE_META: Record<
  NotificationType,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  system: {
    label: "Systeme",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    icon: <BellRing className="w-4 h-4" />,
  },
  mention: {
    label: "Mention",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    icon: <MessageSquare className="w-4 h-4" />,
  },
  assignment: {
    label: "Assignation",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    icon: <UserCheck className="w-4 h-4" />,
  },
  reminder: {
    label: "Rappel",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    icon: <Clock className="w-4 h-4" />,
  },
  approval: {
    label: "Approbation",
    color: "text-green-500",
    bg: "bg-green-500/10",
    icon: <ThumbsUp className="w-4 h-4" />,
  },
  share: {
    label: "Partage",
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    icon: <Share2 className="w-4 h-4" />,
  },
  comment: {
    label: "Commentaire",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    icon: <MessageCircle className="w-4 h-4" />,
  },
  reaction: {
    label: "Reaction",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    icon: <Heart className="w-4 h-4" />,
  },
};

const ALL_TYPES: NotificationType[] = [
  "system",
  "mention",
  "assignment",
  "reminder",
  "approval",
  "share",
  "comment",
  "reaction",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "A l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

const DATE_GROUP_ORDER: DateGroup[] = [
  "Aujourd'hui",
  "Hier",
  "Cette semaine",
  "Plus ancien",
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  usePageTitle("Notifications");
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<NotificationType | "all">("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  // Build query params
  const listParams = useMemo<ListNotificationsParams>(() => {
    const p: ListNotificationsParams = { limit: 100 };
    if (unreadOnly) p.unread_only = true;
    if (typeFilter !== "all") p.type = typeFilter;
    if (moduleFilter !== "all") p.module = moduleFilter;
    return p;
  }, [typeFilter, moduleFilter, unreadOnly]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const {
    data: notifications = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["notifications", listParams],
    queryFn: async () => {
      const res = await notificationsApi.list(listParams);
      return (res.data ?? []) as NotificationItem[];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: unreadData } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const res = await notificationsApi.unreadCount();
      return res.data;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const unreadCount =
    unreadData?.count ?? notifications.filter((n) => !n.read).length;

  // ── Mutations ────────────────────────────────────────────────────────────

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const prev = queryClient.getQueryData<NotificationItem[]>([
        "notifications",
        listParams,
      ]);
      queryClient.setQueryData<NotificationItem[]>(
        ["notifications", listParams],
        (old) =>
          old?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? [],
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["notifications", listParams], context.prev);
      }
      toast.error("Impossible de marquer la notification comme lue.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["notifications-unread-count"],
      });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: (res) => {
      const count = res.data?.updated ?? 0;
      toast.success(
        `${count} notification${count > 1 ? "s" : ""} marquee${count > 1 ? "s" : ""} comme lue${count > 1 ? "s" : ""}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["notifications-unread-count"],
      });
    },
    onError: () => {
      toast.error("Impossible de marquer toutes les notifications comme lues.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const prev = queryClient.getQueryData<NotificationItem[]>([
        "notifications",
        listParams,
      ]);
      queryClient.setQueryData<NotificationItem[]>(
        ["notifications", listParams],
        (old) => old?.filter((n) => n.id !== id) ?? [],
      );
      return { prev };
    },
    onSuccess: () => {
      toast.success("Notification supprimee.");
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["notifications", listParams], context.prev);
      }
      toast.error("Impossible de supprimer la notification.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["notifications-unread-count"],
      });
    },
  });

  // ── Derived data ─────────────────────────────────────────────────────────

  // Unique modules from current results for the module filter dropdown
  const availableModules = useMemo(() => {
    const set = new Set<string>();
    notifications.forEach((n) => {
      if (n.module) set.add(n.module);
    });
    return Array.from(set).sort();
  }, [notifications]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<DateGroup, NotificationItem[]>();
    for (const group of DATE_GROUP_ORDER) map.set(group, []);
    for (const n of notifications) {
      const g = getDateGroup(n.created_at);
      map.get(g)?.push(n);
    }
    return map;
  }, [notifications]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleMarkRead = useCallback(
    (id: string) => markReadMutation.mutate(id),
    [markReadMutation],
  );

  const handleDelete = useCallback(
    (id: string) => deleteMutation.mutate(id),
    [deleteMutation],
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <Badge className="rounded-full text-xs font-bold">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="gap-2"
              >
                <CheckCheck className="h-4 w-4" />
                Tout marquer comme lu
              </Button>
            )}
            <button
              onClick={() => setShowPrefs(true)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              title="Preferences de notification"
            >
              <Settings2 className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filtres:</span>
          </div>

          {/* Type filter */}
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as NotificationType | "all")}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {ALL_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_META[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Module filter */}
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les modules</SelectItem>
              {availableModules.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Unread only toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="unread-only"
              checked={unreadOnly}
              onCheckedChange={setUnreadOnly}
            />
            <Label htmlFor="unread-only" className="text-xs cursor-pointer">
              Non lues uniquement
            </Label>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : isError ? (
          <EmptyState
            icon={Bell}
            context="empty"
            title="Erreur de chargement"
            description="Impossible de charger les notifications. Verifiez votre connexion."
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            context="empty"
            title="Aucune notification"
            description={
              unreadOnly
                ? "Toutes vos notifications sont lues."
                : "Aucune notification pour le moment."
            }
          />
        ) : (
          <div className="space-y-6">
            {DATE_GROUP_ORDER.map((group) => {
              const items = grouped.get(group) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {group}
                  </h2>
                  <div className="space-y-2">
                    {items.map((n) => (
                      <NotificationCard
                        key={n.id}
                        notification={n}
                        onMarkRead={() => handleMarkRead(n.id)}
                        onDelete={() => handleDelete(n.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Preferences dialog */}
        <PreferencesDialog open={showPrefs} onOpenChange={setShowPrefs} />
      </div>
    </AppLayout>
  );
}

// ─── Notification Card ──────────────────────────────────────────────────────

function NotificationCard({
  notification: n,
  onMarkRead,
  onDelete,
}: {
  notification: NotificationItem;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const meta = TYPE_META[n.type] ?? TYPE_META.system;

  return (
    <div
      className={`flex gap-4 p-4 rounded-xl border transition-colors group ${
        n.read ? "bg-background" : "bg-accent/30 border-primary/20"
      }`}
    >
      <div
        className={`flex-shrink-0 mt-0.5 rounded-full p-2 ${meta.bg} ${meta.color}`}
      >
        {meta.icon}
      </div>
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
            {n.body && (
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                {n.body}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!n.read && (
              <button
                onClick={onMarkRead}
                title="Marquer comme lu"
                className="w-2.5 h-2.5 rounded-full bg-primary hover:opacity-70 transition-opacity"
                aria-label="Marquer comme lu"
              />
            )}
            <button
              onClick={onDelete}
              title="Supprimer"
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
              aria-label="Supprimer la notification"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {formatRelative(n.created_at)}
          </span>
          {n.module && (
            <>
              <span className="text-muted-foreground/40 text-xs">-</span>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {n.module}
              </Badge>
            </>
          )}
          <Badge
            variant="outline"
            className={`text-xs px-1.5 py-0 ${meta.color}`}
          >
            {meta.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ─── Preferences Dialog ─────────────────────────────────────────────────────

function PreferencesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const res = await notificationsApi.getPreferences();
      return res.data;
    },
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: notificationsApi.updatePreferences,
    onSuccess: () => {
      toast.success("Preferences mises a jour.");
      queryClient.invalidateQueries({
        queryKey: ["notification-preferences"],
      });
    },
    onError: () => {
      toast.error("Erreur lors de la sauvegarde.");
    },
  });

  const handleChannelToggle = (
    channel: "in_app" | "email" | "push",
    value: boolean,
  ) => {
    updateMutation.mutate({
      channels: {
        ...prefs?.channels,
        [channel]: value,
      },
    });
  };

  const handleDigestChange = (value: "none" | "daily" | "weekly") => {
    updateMutation.mutate({ digest_frequency: value });
  };

  const handleQuietHoursChange = (
    field: "quiet_hours_start" | "quiet_hours_end",
    value: string,
  ) => {
    updateMutation.mutate({ [field]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Preferences de notification
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Channels */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Canaux</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ch-inapp" className="text-sm">
                    In-app
                  </Label>
                  <Switch
                    id="ch-inapp"
                    checked={prefs?.channels?.in_app ?? true}
                    onCheckedChange={(v) => handleChannelToggle("in_app", v)}
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="ch-email" className="text-sm">
                    Email
                  </Label>
                  <Switch
                    id="ch-email"
                    checked={prefs?.channels?.email ?? false}
                    onCheckedChange={(v) => handleChannelToggle("email", v)}
                    disabled={updateMutation.isPending}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="ch-push" className="text-sm">
                    Push
                  </Label>
                  <Switch
                    id="ch-push"
                    checked={prefs?.channels?.push ?? false}
                    onCheckedChange={(v) => handleChannelToggle("push", v)}
                    disabled={updateMutation.isPending}
                  />
                </div>
              </div>
            </div>

            {/* Quiet hours */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Heures calmes</h3>
              <p className="text-xs text-muted-foreground">
                Les notifications push ne seront pas envoyees pendant ces
                heures.
              </p>
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label htmlFor="quiet-start" className="text-xs">
                    De
                  </Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    className="w-28 h-8 text-sm"
                    defaultValue={prefs?.quiet_hours_start ?? "22:00"}
                    onBlur={(e) =>
                      handleQuietHoursChange(
                        "quiet_hours_start",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="quiet-end" className="text-xs">
                    A
                  </Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    className="w-28 h-8 text-sm"
                    defaultValue={prefs?.quiet_hours_end ?? "08:00"}
                    onBlur={(e) =>
                      handleQuietHoursChange("quiet_hours_end", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            {/* Digest frequency */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Frequence du resume</h3>
              <Select
                value={prefs?.digest_frequency ?? "none"}
                onValueChange={(v) =>
                  handleDigestChange(v as "none" | "daily" | "weekly")
                }
                disabled={updateMutation.isPending}
              >
                <SelectTrigger className="w-full h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  <SelectItem value="daily">Quotidien</SelectItem>
                  <SelectItem value="weekly">Hebdomadaire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Muted modules note */}
            <p className="text-xs text-muted-foreground">
              Pour une configuration detaillee par evenement, rendez-vous dans{" "}
              <a
                href="/settings/notifications"
                className="text-primary hover:underline"
              >
                Parametres &rarr; Notifications
              </a>
              .
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skeletons ──────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4 rounded-xl border">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
