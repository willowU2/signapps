"use client";

// Feature 22: Notification → priority levels (urgent, normal, low)

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Bell, Info, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Priority = "urgent" | "normal" | "low";

interface PriorityNotification {
  id: string;
  title: string;
  message: string;
  priority: Priority;
  module: string;
  read: boolean;
  createdAt: string;
}

const PRIORITY_CONFIG: Record<
  Priority,
  {
    label: string;
    icon: React.ReactNode;
    class: string;
    badgeClass: string;
    order: number;
  }
> = {
  urgent: {
    label: "Urgent",
    icon: <AlertCircle className="size-3.5" />,
    class: "border-l-red-500 bg-red-50/50",
    badgeClass: "bg-red-100 text-red-800",
    order: 0,
  },
  normal: {
    label: "Normal",
    icon: <Bell className="size-3.5" />,
    class: "border-l-blue-500",
    badgeClass: "bg-blue-100 text-blue-800",
    order: 1,
  },
  low: {
    label: "Faible",
    icon: <Info className="size-3.5" />,
    class: "border-l-gray-400 opacity-70",
    badgeClass: "bg-muted text-muted-foreground",
    order: 2,
  },
};

const DEMO_NOTIFS: PriorityNotification[] = [
  {
    id: "n1",
    title: "Serveur de production hors ligne",
    message: "Le service Auth est inaccessible depuis 5 minutes.",
    priority: "urgent",
    module: "Monitoring",
    read: false,
    createdAt: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: "n2",
    title: "Jalon en retard",
    message: "API JWT dépasse l'échéance de 2 jours.",
    priority: "urgent",
    module: "Projets",
    read: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "n3",
    title: "Nouvelle tâche assignée",
    message: "Tests de charge — Sprint 4.",
    priority: "normal",
    module: "Tâches",
    read: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "n4",
    title: "Congé approuvé",
    message: "Alice Martin — 7 au 11 avril.",
    priority: "normal",
    module: "RH",
    read: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "n5",
    title: "Mise à jour des politiques",
    message: "Document RH v2.3 disponible.",
    priority: "low",
    module: "Docs",
    read: false,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "n6",
    title: "Rapport hebdomadaire",
    message: "Le recap de la semaine 13 est prêt.",
    priority: "low",
    module: "Rapports",
    read: true,
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
];

export function NotificationPriority() {
  const [filter, setFilter] = useState<Priority | "all">("all");
  const [read, setRead] = useState<Set<string>>(
    new Set(DEMO_NOTIFS.filter((n) => n.read).map((n) => n.id)),
  );
  const [showRead, setShowRead] = useState(false);

  const sorted = useMemo(() => {
    const base =
      filter === "all"
        ? DEMO_NOTIFS
        : DEMO_NOTIFS.filter((n) => n.priority === filter);
    return [...base].sort(
      (a, b) =>
        PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order,
    );
  }, [filter]);

  const visible = showRead ? sorted : sorted.filter((n) => !read.has(n.id));
  const urgentCount = DEMO_NOTIFS.filter(
    (n) => n.priority === "urgent" && !read.has(n.id),
  ).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4" />
            Notifications
            {urgentCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {urgentCount} urgent
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "urgent", "normal", "low"] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={filter === p ? "default" : "outline"}
              className="h-6 px-2 text-[10px]"
              onClick={() => setFilter(p)}
            >
              {p === "all" ? "Tous" : PRIORITY_CONFIG[p].label}
            </Button>
          ))}
        </div>

        <ScrollArea className="max-h-72">
          <div className="space-y-1.5">
            {visible.map((n) => {
              const cfg = PRIORITY_CONFIG[n.priority];
              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border-l-4 border border-border px-3 py-2",
                    cfg.class,
                  )}
                >
                  <span
                    className={
                      cfg.badgeClass.replace("bg-", "text-").split(" ")[0]
                    }
                  >
                    {cfg.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{n.title}</span>
                      <span
                        className={cn(
                          "text-[10px] rounded px-1 py-0.5",
                          cfg.badgeClass,
                        )}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {n.module}
                    </p>
                  </div>
                  {!read.has(n.id) && (
                    <button
                      className="shrink-0 text-[10px] text-blue-600 hover:underline mt-0.5"
                      onClick={() =>
                        setRead((prev) => new Set([...prev, n.id]))
                      }
                    >
                      Lu
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Button
          variant="ghost"
          size="sm"
          className="w-full h-6 text-[10px] gap-1"
          onClick={() => setShowRead(!showRead)}
        >
          {showRead ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
          {showRead ? "Masquer les lus" : `Afficher les lus (${read.size})`}
        </Button>
      </CardContent>
    </Card>
  );
}
