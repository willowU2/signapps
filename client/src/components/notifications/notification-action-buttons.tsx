"use client";

// Feature 16: Notification → action buttons (approve, reject, view)

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, Eye, Clock, Bell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ActionType = "approve" | "reject" | "view" | "snooze";
type NotifStatus = "pending" | "approved" | "rejected" | "viewed";

interface ActionableNotification {
  id: string;
  title: string;
  message: string;
  module: "projects" | "hr" | "tasks" | "calendar";
  actions: ActionType[];
  status: NotifStatus;
  createdAt: string;
  metadata?: Record<string, string>;
}

const MODULE_COLOR: Record<ActionableNotification["module"], string> = {
  projects: "border-l-blue-500",
  hr: "border-l-purple-500",
  tasks: "border-l-green-500",
  calendar: "border-l-orange-500",
};

const DEMO_NOTIFS: ActionableNotification[] = [
  {
    id: "n1",
    title: "Demande de congé",
    message: "Alice Martin demande 5 jours du 7 au 11 avril.",
    module: "hr",
    actions: ["approve", "reject", "view"],
    status: "pending",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    metadata: { employee: "Alice Martin", days: "5" },
  },
  {
    id: "n2",
    title: "Validation budget",
    message: "Dépassement de 2 000€ sur le projet Analytics.",
    module: "projects",
    actions: ["approve", "reject"],
    status: "pending",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "n3",
    title: "Invitation réunion",
    message: "Sprint review — vendredi 4 avril à 14h.",
    module: "calendar",
    actions: ["approve", "reject", "snooze"],
    status: "pending",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "n4",
    title: "Tâche assignée",
    message: "Tests de charge sur l'API JWT vous a été assignée.",
    module: "tasks",
    actions: ["view"],
    status: "viewed",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const ACTION_LABELS: Record<
  ActionType,
  {
    label: string;
    variant: "default" | "destructive" | "outline" | "secondary";
    icon: React.ReactNode;
  }
> = {
  approve: {
    label: "Approuver",
    variant: "default",
    icon: <Check className="size-3" />,
  },
  reject: {
    label: "Rejeter",
    variant: "destructive",
    icon: <X className="size-3" />,
  },
  view: { label: "Voir", variant: "outline", icon: <Eye className="size-3" /> },
  snooze: {
    label: "Reporter",
    variant: "secondary",
    icon: <Clock className="size-3" />,
  },
};

export function NotificationActionButtons() {
  const [notifs, setNotifs] = useState<ActionableNotification[]>(DEMO_NOTIFS);

  function handleAction(id: string, action: ActionType) {
    setNotifs((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              status:
                action === "approve"
                  ? "approved"
                  : action === "reject"
                    ? "rejected"
                    : "viewed",
            }
          : n,
      ),
    );

    const messages: Record<ActionType, string> = {
      approve: "Demande approuvée",
      reject: "Demande rejetée",
      view: "Ouverture...",
      snooze: "Reporté d'une heure",
    };
    toast(messages[action]);
  }

  const pending = notifs.filter((n) => n.status === "pending");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4" />
          Actions requises
        </CardTitle>
        {pending.length > 0 && (
          <Badge variant="destructive">{pending.length}</Badge>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-96">
          <div className="space-y-2">
            {notifs.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "rounded-lg border-l-4 border border-border pl-3 pr-2 py-2.5",
                  MODULE_COLOR[n.module],
                  n.status !== "pending" && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                  </div>
                  {n.status !== "pending" && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {n.status === "approved"
                        ? "Approuvé"
                        : n.status === "rejected"
                          ? "Rejeté"
                          : "Vu"}
                    </Badge>
                  )}
                </div>
                {n.status === "pending" && (
                  <div className="flex flex-wrap gap-1.5">
                    {n.actions.map((action) => {
                      const cfg = ACTION_LABELS[action];
                      return (
                        <Button
                          key={action}
                          size="sm"
                          variant={cfg.variant}
                          className="h-6 gap-1 px-2 text-[10px]"
                          onClick={() => handleAction(n.id, action)}
                        >
                          {cfg.icon} {cfg.label}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
