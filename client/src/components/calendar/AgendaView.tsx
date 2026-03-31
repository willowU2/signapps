"use client";

import React, { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useCalendarStore } from "@/stores/calendar-store";
import { calendarApi } from "@/lib/api/calendar";

interface AgendaEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  location?: string;
  is_all_day?: boolean;
  event_type?: string;
}

export function AgendaView() {
  const currentDate = useCalendarStore((s) => s.currentDate);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const calsRes = await calendarApi.listCalendars().catch(() => null);
        const calendars = calsRes?.data;
        const calId = Array.isArray(calendars) && calendars.length > 0 ? calendars[0].id : null;

        if (calId) {
          const eventsRes = await calendarApi.listEvents(calId, currentDate).catch(() => null);
          const data = eventsRes?.data;
          if (!cancelled) {
            setEvents(Array.isArray(data) ? data : []);
          }
        } else {
          if (!cancelled) setEvents([]);
        }
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [currentDate]);

  const groupedEvents = useMemo(() => {
    const grouped = new Map<string, AgendaEvent[]>();

    // Triple-guard: ensure events is an array
    if (!events || !Array.isArray(events) || events.length === 0) {
      return grouped;
    }

    const sorted = [...events].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    for (const event of sorted) {
      const dateKey = new Date(event.start_time).toDateString();
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(event);
    }

    return new Map(
      [...grouped.entries()].sort((a, b) =>
        new Date(a[0]).getTime() - new Date(b[0]).getTime()
      )
    );
  }, [events]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (!groupedEvents || groupedEvents.size === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <p className="text-lg">Aucun événement à venir</p>
        <p className="text-sm mt-2">Les événements apparaîtront ici une fois créés.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 overflow-y-auto h-full">
      {Array.from(groupedEvents.entries()).map(([dateStr, dayEvents]) => {
        const date = new Date(dateStr);
        return (
          <div key={dateStr}>
            <div className="sticky top-0 bg-background py-2 border-b border-border">
              <h3 className="font-semibold text-lg">
                {format(date, "EEEE d MMMM yyyy", { locale: fr })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {dayEvents.length} événement{dayEvents.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="space-y-3 py-4">
              {dayEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-lg border border-border hover:bg-muted cursor-pointer transition"
                >
                  <div className="flex items-baseline justify-between mb-2">
                    <h4 className="font-semibold text-base">{event.title}</h4>
                    {event.is_all_day ? (
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                        Journée entière
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(event.start_time), "HH:mm")} - {format(new Date(event.end_time), "HH:mm")}
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>📍</span><span>{event.location}</span>
                    </div>
                  )}
                  {event.event_type && event.event_type !== "event" && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {event.event_type}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AgendaView;
