"use client";

import React, { useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from "date-fns";
import { useCalendarStore } from "@/stores/calendar-store";
import { useEvents } from "@/hooks/use-events";
import { Event } from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonthCalendarProps {
  selectedCalendarId?: string;
}

export function MonthCalendar({ selectedCalendarId }: MonthCalendarProps) {
  const { currentDate, nextMonth, prevMonth, selectEvent, selectedEventId } = useCalendarStore();
  const { events, fetchEvents, isLoading } = useEvents(selectedCalendarId);

  // Fetch events for current month when it changes
  useEffect(() => {
    if (!selectedCalendarId) return;

    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    // Expand range to include full weeks
    const monthStart = new Date(start);
    monthStart.setDate(monthStart.getDate() - monthStart.getDay());
    const monthEnd = new Date(end);
    monthEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

    fetchEvents(monthStart, monthEnd);
  }, [selectedCalendarId, currentDate, fetchEvents]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Generate calendar grid (6 rows x 7 cols)
  const calendarDays = useMemo(() => {
    const start = new Date(monthStart);
    start.setDate(start.getDate() - monthStart.getDay());
    const end = new Date(monthEnd);
    end.setDate(end.getDate() + (6 - monthEnd.getDay()));

    return eachDayOfInterval({ start, end });
  }, [monthStart, monthEnd]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, Event[]>();
    events.forEach((event) => {
      const date = new Date(event.start_time).toDateString();
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(event);
    });
    return grouped;
  }, [events]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeks = Array.from({ length: 6 }, (_, i) => calendarDays.slice(i * 7, (i + 1) * 7));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{format(currentDate, "MMMM yyyy")}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => useCalendarStore.setState({ currentDate: new Date() })}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-muted">
          {weekDays.map((day) => (
            <div key={day} className="p-3 text-center font-semibold text-sm">
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7">
            {week.map((day, dayIdx) => {
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isTodayDate = isToday(day);
              const dayStr = day.toDateString();
              const dayEvents = eventsByDate.get(dayStr) || [];

              return (
                <div
                  key={dayIdx}
                  className={`min-h-32 p-2 border-r border-b ${
                    !isCurrentMonth ? "bg-muted/50" : ""
                  } ${isTodayDate ? "bg-blue-50" : ""}`}
                >
                  {/* Day number */}
                  <div
                    className={`text-sm font-semibold mb-2 ${
                      isTodayDate ? "bg-blue-500 text-white rounded w-6 h-6 flex items-center justify-center" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </div>

                  {/* Events */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        onClick={() => selectEvent(event.id)}
                        className={`text-xs p-1 rounded cursor-pointer truncate ${
                          selectedEventId === event.id
                            ? "bg-blue-600 text-white"
                            : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                        }`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {isLoading && <div className="text-center text-muted-foreground">Loading events...</div>}
    </div>
  );
}
