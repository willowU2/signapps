"use client";
import { useEffect, useState, useCallback } from "react";
import { format, parseISO, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Mail,
  Phone,
  Calendar,
  StickyNote,
  TrendingUp,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { activitiesApi } from "@/lib/api/crm";
import { calendarApi } from "@/lib/api/calendar";
import { searchApi, type Email } from "@/lib/api-mail";
import type { Event } from "@/types/calendar";

// ── Types ─────────────────────────────────────────────────────────────────────

type TimelineItemType = "email" | "call" | "meeting" | "note" | "deal_change";

interface TimelineItem {
  id: string;
  type: TimelineItemType;
  date: string;
  title: string;
  summary: string;
  sourceUrl?: string;
  sourceLabel?: string;
}

// ── Icon config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  TimelineItemType,
  { icon: React.ElementType; dot: string; badge: string; label: string }
> = {
  email: {
    icon: Mail,
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    label: "Email",
  },
  call: {
    icon: Phone,
    dot: "bg-green-500",
    badge:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    label: "Appel",
  },
  meeting: {
    icon: Calendar,
    dot: "bg-purple-500",
    badge:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    label: "Réunion",
  },
  note: {
    icon: StickyNote,
    dot: "bg-amber-500",
    badge:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    label: "Note",
  },
  deal_change: {
    icon: TrendingUp,
    dot: "bg-rose-500",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
    label: "Changement deal",
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  contactId?: string;
  contactEmail?: string;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ActivityTimeline({ contactId, contactEmail }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const merged: TimelineItem[] = [];

    // 1. CRM activities
    try {
      const crmActs = contactId
        ? activitiesApi.byContact(contactId)
        : activitiesApi.list();
      crmActs.forEach((a) => {
        merged.push({
          id: `crm-${a.id}`,
          type: a.type === "phone" ? "call" : (a.type as TimelineItemType),
          date: a.date,
          title:
            a.type === "email"
              ? "Email"
              : a.type === "phone"
                ? "Appel"
                : a.type === "meeting"
                  ? "Réunion"
                  : "Note",
          summary: a.content,
          sourceLabel: a.author,
        });
      });
    } catch {
      // CRM is localStorage-based, never fails
    }

    // 2. Mail search (by contact email)
    if (contactEmail) {
      try {
        const mails: Email[] = await searchApi.search({
          q: contactEmail,
          limit: 20,
        });
        mails.forEach((m) => {
          const date = m.received_at ?? m.sent_at ?? m.created_at;
          if (!date) return;
          merged.push({
            id: `mail-${m.id}`,
            type: "email",
            date,
            title: m.subject ?? "Email",
            summary: (m.body_text ?? "").slice(0, 120),
            sourceUrl: `/mail?id=${m.id}`,
            sourceLabel: "Messagerie",
          });
        });
      } catch {
        // Mail API unavailable — skip silently
      }
    }

    // 3. Calendar events (filter by attendee email)
    if (contactEmail) {
      try {
        const calendars = await calendarApi.listCalendars();
        const now = new Date();
        const past = new Date(now);
        past.setMonth(past.getMonth() - 3);
        const future = new Date(now);
        future.setMonth(future.getMonth() + 1);

        for (const cal of Array.isArray(calendars) ? calendars : []) {
          try {
            const events = await calendarApi.listEvents(cal.id, past, future);
            (Array.isArray(events) ? events : []).forEach((ev: Event) => {
              const attendees = ev.attendees ?? [];
              const match = attendees.some(
                (a) =>
                  (a.email ?? "").toLowerCase() === contactEmail.toLowerCase(),
              );
              if (!match) return;
              merged.push({
                id: `cal-${ev.id}`,
                type: "meeting",
                date: ev.start_time,
                title: ev.title ?? "Réunion",
                summary: ev.description ?? "",
                sourceUrl: `/calendar?event=${ev.id}`,
                sourceLabel: cal.name ?? "Calendrier",
              });
            });
          } catch {
            // skip calendar
          }
        }
      } catch {
        // Calendar API unavailable — skip silently
      }
    }

    // Sort by date descending
    merged.sort((a, b) => {
      const da = isValid(new Date(a.date)) ? new Date(a.date).getTime() : 0;
      const db = isValid(new Date(b.date)) ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    setItems(merged);
    setLoading(false);
  }, [contactId, contactEmail]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Chargement du fil d&apos;activités…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive">{error}</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={load}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Mail className="size-10 mx-auto mb-3 opacity-30" />
        <p className="text-muted-foreground text-sm">
          Aucune activité trouvée pour ce contact.
        </p>
      </Card>
    );
  }

  return (
    <div className="relative space-y-4 pl-8">
      {/* Vertical line */}
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

      {items.map((item) => {
        const cfg = TYPE_CONFIG[item.type];
        const Icon = cfg.icon;

        let formattedDate = item.date;
        try {
          const d = parseISO(item.date);
          if (isValid(d)) {
            formattedDate = format(d, "d MMM yyyy, HH:mm", { locale: fr });
          }
        } catch {
          // keep raw
        }

        return (
          <div key={item.id} className="relative">
            {/* Dot */}
            <div
              className={`absolute -left-6 top-3 size-4 rounded-full border-2 border-background ${cfg.dot}`}
            />

            <Card className="p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.badge}`}
                  >
                    {cfg.label}
                  </span>
                  {item.sourceLabel && (
                    <Badge variant="outline" className="text-[10px] h-4">
                      {item.sourceLabel}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    {formattedDate}
                  </span>
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Ouvrir la source"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>

              <p className="text-sm font-medium leading-snug">{item.title}</p>
              {item.summary && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.summary}
                </p>
              )}
            </Card>
          </div>
        );
      })}
    </div>
  );
}
