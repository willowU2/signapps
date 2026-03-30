"use client";

/**
 * Feature 30: Unified "Today" view: emails + tasks + events combined
 */

import { useEffect, useState } from "react";
import { Mail, CheckSquare, CalendarDays, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { searchApi, mailApi } from "@/lib/api-mail";
import { calendarApi } from "@/lib/api/calendar";

interface TodayItem {
  id: string;
  type: "mail" | "task" | "event";
  title: string;
  subtitle?: string;
  time?: string;
  priority?: number;
  status?: string;
  href: string;
}

const TYPE_CONFIG = {
  mail: { icon: Mail, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", label: "Email" },
  task: { icon: CheckSquare, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", label: "Tâche" },
  event: { icon: CalendarDays, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30", label: "Événement" },
};

async function fetchTodayItems(): Promise<TodayItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const items: TodayItem[] = [];
  await Promise.allSettled([
    // Recent unread emails (top 5)
    mailApi.list({ folder_type: "inbox", limit: 5 }).then((emails: any[]) => {
      (Array.isArray(emails) ? emails : [])
        .filter((e: any) => !e.is_read)
        .slice(0, 5)
        .forEach((e: any) => items.push({ id: e.id, type: "mail", title: e.subject || "(Sans objet)", subtitle: `De : ${e.sender_name || e.sender}`, time: e.received_at, href: "/mail" }));
    }),
    // Tasks due today
    (async () => {
      const API = process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";
      const calsRes = await fetch(`${API}/calendars`, { credentials: "include" });
      if (!calsRes.ok) return;
      const cals = await calsRes.json();
      const calId = (cals.data ?? cals)?.[0]?.id;
      if (!calId) return;
      const res = await fetch(`${API}/calendars/${calId}/tasks?due_date=${today}&status=open,in_progress&limit=10`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      (data.data ?? data ?? []).forEach((t: any) => items.push({ id: t.id, type: "task", title: t.title, subtitle: t.description, priority: t.priority, status: t.status, href: "/tasks" }));
    })(),
    // Today's events
    (async () => {
      const { data: calendars } = await calendarApi.listCalendars();
      if (!Array.isArray(calendars) || calendars.length === 0) return;
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const { data: evList } = await calendarApi.listEvents(calendars[0].id, start, end);
      (Array.isArray(evList) ? evList : []).forEach((e: any) => items.push({ id: e.id, type: "event", title: e.title, subtitle: e.location, time: e.start_time, href: "/cal" }));
    })(),
    // Locally stored tasks
    (() => {
      const stored: any[] = JSON.parse(localStorage.getItem("email-tasks") || "[]");
      stored.filter(t => t.due_date?.slice(0, 10) === today && t.status !== "completed").slice(0, 3).forEach(t => items.push({ id: t.id, type: "task", title: t.title, status: t.status, href: "/tasks" }));
    })(),
  ]);
  return items.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
}

interface Props {
  className?: string;
  maxItems?: number;
}

export function TodayView({ className, maxItems = 20 }: Props) {
  const [items, setItems] = useState<TodayItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayItems().then(r => { setItems(r); setLoading(false); });
  }, []);

  const grouped = items.slice(0, maxItems).reduce<Record<string, TodayItem[]>>((acc, item) => {
    (acc[item.type] = acc[item.type] || []).push(item);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn("rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground", className)}>
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Rien de prévu pour aujourd'hui</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Clock className="h-5 w-5 text-muted-foreground" />
        Aujourd'hui — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
      </h2>
      {(["event", "task", "mail"] as const).map(type => {
        const typeItems = grouped[type];
        if (!typeItems?.length) return null;
        const cfg = TYPE_CONFIG[type];
        const Icon = cfg.icon;
        return (
          <div key={type} className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
              {cfg.label}s ({typeItems.length})
            </p>
            <div className="space-y-1">
              {typeItems.map(item => (
                <a key={item.id} href={item.href}
                  className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:opacity-90 transition-opacity group", cfg.bg)}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
                  </div>
                  {item.time && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(item.time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
