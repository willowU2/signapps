// cache-bust-v3
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { format, addMonths, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { useDraggable } from "@dnd-kit/core";
import {
  useCalendarStore,
  useCalendarSelection,
} from "@/stores/calendar-store";
import { calendarApi } from "@/lib/api/calendar";
import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

interface AgendaViewProps {
  selectedCalendarId?: string;
  onCreateEvent?: (startTime?: Date, endTime?: Date) => void;
}

/**
 * Wraps an agenda event row with dnd-kit draggable behavior.
 *
 * The event can be dragged out of the agenda list onto any droppable
 * "calendar-slot" target (month/week/day views, mini-calendar). The
 * drop handler lives in {@link CalendarHub.handleDragEnd}.
 */
function DraggableAgendaEvent({
  event,
  onSelect,
  children,
}: {
  event: AgendaEvent;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { event },
  });

  return (
    <div
      ref={setNodeRef}
      data-testid="agenda-event"
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={cn(
        "p-3 rounded-lg border border-border hover:bg-muted cursor-grab active:cursor-grabbing transition-colors",
        isDragging && "opacity-50",
      )}
    >
      {children}
    </div>
  );
}

export function AgendaView({
  selectedCalendarId,
  onCreateEvent,
}: AgendaViewProps) {
  const currentDate = useCalendarStore((s) => s.currentDate);
  const { selectEvent } = useCalendarSelection();
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Use provided calendarId or fetch first available
        let calId = selectedCalendarId ?? null;
        if (!calId) {
          const calsRes = await calendarApi.listCalendars().catch(() => null);
          const calendars = calsRes?.data;
          calId =
            Array.isArray(calendars) && calendars.length > 0
              ? calendars[0].id
              : null;
        }

        if (calId) {
          // Start at the beginning of today so earlier events of the current
          // day (already passed) still appear in the agenda.
          const start = startOfDay(currentDate);
          const end = addMonths(start, 3);
          const eventsRes = await calendarApi
            .listEvents(calId, start, end)
            .catch(() => null);
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

    return () => {
      cancelled = true;
    };
  }, [currentDate, selectedCalendarId]);

  const groupedEvents = useMemo(() => {
    const grouped = new Map<string, AgendaEvent[]>();

    if (!events || !Array.isArray(events) || events.length === 0) {
      return grouped;
    }

    const sorted = [...events].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );

    for (const event of sorted) {
      const dateKey = new Date(event.start_time).toDateString();
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(event);
    }

    return new Map(
      [...grouped.entries()].sort(
        (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime(),
      ),
    );
  }, [events]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Chargement…
      </div>
    );
  }

  if (!groupedEvents || groupedEvents.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-20 px-4">
        <p className="text-lg font-medium text-foreground mb-2">
          Aucun événement à venir
        </p>
        <p className="text-sm max-w-sm mb-6">
          Votre agenda est vide pour la période affichée. Les événements
          apparaîtront ici une fois créés.
        </p>
        <Button onClick={() => onCreateEvent?.()} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un événement
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 overflow-y-auto h-full">
      {Array.from(groupedEvents.entries()).map(([dateStr, dayEvents]) => {
        const date = new Date(dateStr);
        return (
          <div key={dateStr}>
            <div className="sticky top-0 bg-background py-2 border-b border-border z-10">
              <h3 className="font-semibold text-base capitalize">
                {format(date, "EEEE d MMMM yyyy", { locale: fr })}
              </h3>
              <p className="text-xs text-muted-foreground">
                {dayEvents.length} événement{dayEvents.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="space-y-2 py-3">
              {dayEvents.map((event) => (
                <DraggableAgendaEvent
                  key={event.id}
                  event={event}
                  onSelect={() => selectEvent(event.id)}
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <h4 className="font-medium text-sm">{event.title}</h4>
                    {event.is_all_day ? (
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                        Journée entière
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.start_time), "H:mm")}
                        {" – "}
                        {format(new Date(event.end_time), "H:mm")}
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                  {event.event_type && event.event_type !== "event" && (
                    <div className="mt-1">
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {event.event_type}
                      </span>
                    </div>
                  )}
                </DraggableAgendaEvent>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
