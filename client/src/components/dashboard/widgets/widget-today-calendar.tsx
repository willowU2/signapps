/**
 * Today's Calendar Widget
 *
 * Affiche les événements d'aujourd'hui.
 */

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  is_all_day?: boolean;
  color?: string;
}

export function WidgetTodayCalendar({ widget }: WidgetRenderProps) {
  const config = widget.config as {
    limit?: number;
  };
  const limit = config.limit || 5;

  const { data: events, isLoading } = useQuery({
    queryKey: ["widget-today-events", limit],
    queryFn: async () => {
      // Mock data - in production this would call calendarApi.listTodayEvents()
      const now = new Date();
      const mockEvents: CalendarEvent[] = [
        {
          id: "1",
          title: "Standup quotidien",
          start_time: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
          end_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
          color: "bg-blue-500",
        },
        {
          id: "2",
          title: "Révision de code - PR#123",
          start_time: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
          end_time: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
          color: "bg-purple-500",
        },
        {
          id: "3",
          title: "Déjeuner avec client",
          start_time: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
          end_time: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
          location: "Restaurant Le 6ème Étage",
          color: "bg-green-500",
        },
        {
          id: "4",
          title: "Planning session",
          start_time: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
          end_time: new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString(),
          color: "bg-red-500",
        },
      ];
      return mockEvents.slice(0, limit);
    },
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Agenda d'Aujourd'hui
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2">
                <Skeleton className="h-3 w-3 rounded-full mt-1" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Agenda d'Aujourd'hui
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
              Aucun événement aujourd'hui
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-2 rounded-lg border border-transparent hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                      event.color || "bg-blue-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">
                      {event.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTime(event.start_time)} -{" "}
                      {formatTime(event.end_time)}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
