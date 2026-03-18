/**
 * Upcoming Events Widget
 *
 * Affiche les événements à venir.
 */

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MapPin } from "lucide-react";
import { format, isToday, isTomorrow, addDays } from "date-fns";
import { fr } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { calendarApi } from "@/lib/api/calendar";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

interface EventItem {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  location?: string;
  all_day?: boolean;
  calendar_id?: string;
}

function formatEventDate(date: Date): string {
  if (isToday(date)) return "Aujourd'hui";
  if (isTomorrow(date)) return "Demain";
  return format(date, "EEEE d MMM", { locale: fr });
}

export function WidgetUpcomingEvents({ widget }: WidgetRenderProps) {
  const config = widget.config as {
    limit?: number;
    daysAhead?: number;
  };
  const limit = config.limit || 5;
  const daysAhead = config.daysAhead || 7;

  const { data: events, isLoading } = useQuery({
    queryKey: ["widget-events", limit, daysAhead],
    queryFn: async () => {
      // First get user's calendars
      const calendarsResponse = await calendarApi.listCalendars();
      const calendars = calendarsResponse.data || [];
      if (calendars.length === 0) return [];

      const now = new Date();
      const endDate = addDays(now, daysAhead);

      // Get events from all calendars
      const allEvents: EventItem[] = [];
      for (const cal of calendars) {
        try {
          const response = await calendarApi.listEvents(
            cal.id,
            now,
            endDate
          );
          const calEvents = (response.data || []) as EventItem[];
          allEvents.push(...calEvents);
        } catch {
          // Skip calendars that fail to load events
        }
      }

      return allEvents
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, limit);
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Événements à Venir
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group events by date
  const groupedEvents = React.useMemo(() => {
    if (!events) return new Map<string, EventItem[]>();
    const groups = new Map<string, EventItem[]>();
    events.forEach((event) => {
      const dateKey = format(new Date(event.start_time), "yyyy-MM-dd");
      const existing = groups.get(dateKey) || [];
      groups.set(dateKey, [...existing, event]);
    });
    return groups;
  }, [events]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Événements à Venir
          {events && events.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {events.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          {!events || events.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Aucun événement à venir
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(groupedEvents.entries()).map(([dateKey, dateEvents]) => {
                const date = new Date(dateKey);
                return (
                  <div key={dateKey}>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">
                      {formatEventDate(date)}
                    </div>
                    <div className="space-y-2">
                      {dateEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {format(new Date(event.start_time), "HH:mm")}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {event.title}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {event.all_day ? (
                                <span>Toute la journée</span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(event.start_time), "HH:mm")}
                                  {event.end_time && (
                                    <> - {format(new Date(event.end_time), "HH:mm")}</>
                                  )}
                                </span>
                              )}
                              {event.location && (
                                <span className="flex items-center gap-1 truncate">
                                  <MapPin className="h-3 w-3" />
                                  {event.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
