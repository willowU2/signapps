"use client";

/**
 * Feature 20: Unified notification center combining mail/tasks/calendar alerts
 */

import { useState } from "react";
import { Bell, Mail, CheckSquare, CalendarDays, Check, X, Video, Hand, Clock, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUnifiedNotifications } from "@/hooks/use-interop";
import type { UnifiedNotification } from "@/lib/interop/store";

const MODULE_ICON: Record<string, React.ReactNode> = {
  mail: <Mail className="h-4 w-4 text-blue-500" />,
  task: <CheckSquare className="h-4 w-4 text-emerald-500" />,
  calendar: <CalendarDays className="h-4 w-4 text-purple-500" />,
  meet: <Video className="h-4 w-4 text-green-500" />,
};

const MODULE_COLOR: Record<string, string> = {
  mail: "bg-blue-50 dark:bg-blue-950/30",
  task: "bg-emerald-50 dark:bg-emerald-950/30",
  calendar: "bg-purple-50 dark:bg-purple-950/30",
  meet: "bg-green-50 dark:bg-green-950/30",
};

// Phase 4b: Meet-specific icon override keyed on notification `type`.
const MEET_TYPE_ICON: Record<string, React.ReactNode> = {
  "meet.invited": <Video className="h-4 w-4 text-green-500" />,
  "meet.knock_received": <Hand className="h-4 w-4 text-amber-500" />,
  "meet.starting_soon": <Clock className="h-4 w-4 text-blue-500" />,
  "meet.recording_ready": <Film className="h-4 w-4 text-purple-500" />,
};

function meetCta(n: UnifiedNotification): { label: string; href: string } | null {
  if (n.sourceModule !== "meet") return null;
  const link = n.link ?? (n.metadata?.link as string | undefined);
  if (!link) return null;
  switch (n.type) {
    case "meet.invited":
    case "meet.starting_soon":
      return { label: "Rejoindre", href: link };
    case "meet.knock_received":
      return { label: "Ouvrir", href: link };
    case "meet.recording_ready":
      return { label: "Voir", href: link };
    default:
      return { label: "Ouvrir", href: link };
  }
}

function NotificationItem({ n, onMarkRead }: { n: UnifiedNotification; onMarkRead: (id: string) => void }) {
  const meetIcon = n.sourceModule === "meet" ? MEET_TYPE_ICON[n.type] : undefined;
  const icon = meetIcon ?? MODULE_ICON[n.sourceModule] ?? <Bell className="h-4 w-4" />;
  const cta = meetCta(n);

  return (
    <div className={cn("flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors", n.read ? "opacity-60" : MODULE_COLOR[n.sourceModule] ?? "bg-muted/30")}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{n.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          {new Date(n.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
        {cta && (
          <a
            href={cta.href}
            target={n.type === "meet.invited" || n.type === "meet.starting_soon" ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-green-700 dark:text-green-400 hover:underline"
            onClick={() => onMarkRead(n.id)}
          >
            {cta.label}
          </a>
        )}
      </div>
      {!n.read && (
        <button onClick={() => onMarkRead(n.id)} className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0" title="Marquer comme lu">
          <Check className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function UnifiedNotificationCenter({ className }: { className?: string }) {
  const { notifications, unreadCount, markRead, markAllRead } = useUnifiedNotifications();
  const [open, setOpen] = useState(false);

  const recent = notifications.slice(0, 50);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative", className)}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-xl" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
                Tout lire
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-[400px]">
          {recent.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Aucune notification
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {recent.map(n => (
                <NotificationItem key={n.id} n={n} onMarkRead={markRead} />
              ))}
            </div>
          )}
        </ScrollArea>
        {recent.length > 0 && (
          <div className="px-4 py-2 border-t text-center">
            <a href="/notifications" className="text-xs text-muted-foreground hover:text-foreground">
              Voir toutes les notifications
            </a>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
