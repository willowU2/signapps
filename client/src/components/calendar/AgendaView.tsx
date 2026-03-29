"use client";

import React, { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { Event } from "@/types/calendar";
import { useCalendarStore } from "@/stores/calendar-store";

interface AgendaViewProps {
  events: Event[];
  onEventClick: (eventId: string) => void;
}

export function AgendaView({ events, onEventClick }: AgendaViewProps) {
  const { currentDate, selectedEventId } = useCalendarStore();

  // Group events by date starting from currentDate
  const groupedEvents = useMemo(() => {
    const grouped = new Map<string, Event[]>();

    // Sort events by start time
    const sorted = [...events].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    sorted.forEach((event) => {
      const eventDate = new Date(event.start_time);
      if (eventDate >= currentDate) {
        const dateKey = eventDate.toDateString();
        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, []);
        }
        grouped.get(dateKey)!.push(event);
      }
    });

    // Sort dates
    return new Map(
      [...grouped.entries()].sort((a, b) =>
        new Date(a[0]).getTime() - new Date(b[0]).getTime()
      )
    );
  }, [events, currentDate]);

  if (groupedEvents.size === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <p>No upcoming events</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(groupedEvents.entries()).map(([dateStr, dayEvents]) => {
        const date = new Date(dateStr);

        return (
          <div key={dateStr}>
            {/* Date header */}
            <div className="sticky top-0 bg-background py-2 border-b">
              <h3 className="font-semibold text-lg">
                {format(date, "EEEE, MMMM d, yyyy")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Events for this day */}
            <div className="space-y-3 py-4">
              {dayEvents.map((event) => {
                const startTime = new Date(event.start_time);
                const endTime = new Date(event.end_time);
                const isSelected = selectedEventId === event.id;

                return (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-50"
                        : "border-border hover:border-border hover:bg-muted"
                    }`}
                  >
                    {/* Time and title */}
                    <div className="flex items-baseline justify-between mb-2">
                      <h4 className="font-semibold text-base">{event.title}</h4>
                      {event.is_all_day ? (
                        <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                          All day
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    {event.description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {event.description}
                      </p>
                    )}

                    {event.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>📍</span>
                        <span>{event.location}</span>
                      </div>
                    )}

                    {/* Recurring indicator */}
                    {event.rrule && (
                      <div className="mt-2 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit">
                        Recurring: {event.rrule.split(";")[0].replace("FREQ=", "")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
