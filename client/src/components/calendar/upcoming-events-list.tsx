"use client";

// IDEA-049: Upcoming events list view — chronological list of next events

import { useMemo } from "react";
import {
  format,
  isToday,
  isTomorrow,
  isThisWeek,
  formatDistanceToNow,
} from "date-fns";
import { Clock, MapPin, Users, CalendarDays } from "lucide-react";
import { Event } from "@/types/calendar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function getDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isThisWeek(date)) return format(date, "EEEE");
  return format(date, "MMMM d, yyyy");
}

function getRelativeTime(date: Date): string {
  if (isToday(date)) {
    const now = new Date();
    if (date < now) return "Ongoing";
    return `in ${formatDistanceToNow(date)}`;
  }
  return format(date, "EEE, MMM d");
}

function getDurationLabel(start: Date, end: Date): string {
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

interface UpcomingEventsListProps {
  events: Event[];
  onEventClick: (eventId: string) => void;
  selectedEventId?: string | null;
  maxItems?: number;
  compact?: boolean;
}

export function UpcomingEventsList({
  events,
  onEventClick,
  selectedEventId,
  maxItems = 50,
  compact = false,
}: UpcomingEventsListProps) {
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return [...events]
      .filter((e) => new Date(e.end_time) >= now)
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      )
      .slice(0, maxItems);
  }, [events, maxItems]);

  if (upcomingEvents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No upcoming events</p>
        <p className="text-xs mt-1">Your schedule is clear!</p>
      </div>
    );
  }

  // Group by date label
  const grouped = new Map<string, Event[]>();
  upcomingEvents.forEach((event) => {
    const label = getDateLabel(new Date(event.start_time));
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label)!.push(event);
  });

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([dateLabel, dayEvents]) => (
        <div key={dateLabel}>
          {/* Date header */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <h3
              className={cn(
                "text-sm font-bold",
                dateLabel === "Today" ? "text-blue-600" : "text-foreground",
              )}
            >
              {dateLabel}
            </h3>
            <div className="flex-1 h-px bg-border/60" />
            <span className="text-xs text-muted-foreground">
              {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-1.5">
            {dayEvents.map((event) => {
              const start = new Date(event.start_time);
              const end = new Date(event.end_time);
              const isSelected = selectedEventId === event.id;
              const isNow = start <= new Date() && end >= new Date();

              return (
                <button
                  key={event.id}
                  className={cn(
                    "w-full text-left flex items-start gap-3 p-2.5 rounded-xl border transition-all group",
                    isSelected
                      ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                      : "bg-background border-border/50 hover:bg-muted/40 hover:border-border",
                    isNow && "border-green-300 dark:border-green-800",
                  )}
                  onClick={() => onEventClick(event.id)}
                >
                  {/* Color indicator */}
                  <div
                    className={cn(
                      "w-1 self-stretch rounded-full shrink-0",
                      isNow ? "bg-green-500" : "bg-blue-500",
                    )}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "text-sm font-semibold truncate",
                          isSelected ? "text-blue-700" : "text-foreground",
                        )}
                      >
                        {event.title}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isNow && (
                          <Badge className="text-[10px] px-1.5 h-4 bg-green-100 text-green-700 border border-green-200">
                            NOW
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {getRelativeTime(start)}
                        </span>
                      </div>
                    </div>

                    {!compact && (
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {event.is_all_day
                            ? "All day"
                            : `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`}
                          {!event.is_all_day && (
                            <span className="text-muted-foreground/70">
                              ({getDurationLabel(start, end)})
                            </span>
                          )}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[120px]">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {event.location}
                          </span>
                        )}
                        {event.rrule && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 h-4 font-medium"
                          >
                            Recurring
                          </Badge>
                        )}
                      </div>
                    )}

                    {compact && !event.is_all_day && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(start, "HH:mm")} – {format(end, "HH:mm")}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
