"use client";

// Feature 19: Notification → mark all as read per module

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Check,
  CheckCheck,
  Bell,
  Briefcase,
  Users,
  CheckSquare,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type NotifModule = "projects" | "hr" | "tasks" | "calendar" | "all";

interface ModuleUnreadCount {
  module: NotifModule;
  label: string;
  icon: React.ReactNode;
  count: number;
  color: string;
}

const INITIAL_COUNTS: ModuleUnreadCount[] = [
  {
    module: "projects",
    label: "Projets",
    icon: <Briefcase className="size-3.5" />,
    count: 4,
    color: "text-blue-600",
  },
  {
    module: "hr",
    label: "RH",
    icon: <Users className="size-3.5" />,
    count: 2,
    color: "text-purple-600",
  },
  {
    module: "tasks",
    label: "Tâches",
    icon: <CheckSquare className="size-3.5" />,
    count: 7,
    color: "text-green-600",
  },
  {
    module: "calendar",
    label: "Calendrier",
    icon: <Calendar className="size-3.5" />,
    count: 1,
    color: "text-orange-600",
  },
];

export function NotificationMarkAllRead() {
  const [counts, setCounts] = useState<ModuleUnreadCount[]>(INITIAL_COUNTS);
  const [marking, setMarking] = useState<NotifModule | null>(null);

  const totalUnread = counts.reduce((acc, m) => acc + m.count, 0);

  async function markRead(module: NotifModule) {
    setMarking(module);
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (module === "all") {
      setCounts((prev) => prev.map((m) => ({ ...m, count: 0 })));
      toast.success("Toutes les notifications marquées comme lues");
    } else {
      const moduleLabel = counts.find((m) => m.module === module)?.label;
      setCounts((prev) =>
        prev.map((m) => (m.module === module ? { ...m, count: 0 } : m)),
      );
      toast.success(`Notifications ${moduleLabel} marquées comme lues`);
    }
    setMarking(null);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4" />
            Notifications
            {totalUnread > 0 && (
              <Badge className="size-5 justify-center p-0 text-[10px]">
                {totalUnread}
              </Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            disabled={totalUnread === 0 || marking !== null}
            onClick={() => markRead("all")}
          >
            <CheckCheck className="size-3.5" />
            Tout lire
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {counts.map((m) => (
          <div
            key={m.module}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-2 transition-opacity",
              m.count === 0 && "opacity-50",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={m.color}>{m.icon}</span>
              <span className="text-sm">{m.label}</span>
              {m.count > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {m.count}
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-[10px]"
              disabled={m.count === 0 || marking !== null}
              onClick={() => markRead(m.module)}
            >
              {marking === m.module ? (
                <span className="animate-pulse">...</span>
              ) : (
                <>
                  <Check className="size-3" /> Lu
                </>
              )}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
