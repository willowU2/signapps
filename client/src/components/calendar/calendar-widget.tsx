"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, MapPin, Video, CalendarDays } from "lucide-react";
import { calendarApi } from "@/lib/api";
import type { Event, Calendar } from "@/types/calendar";

interface WidgetEvent {
    id: string;
    title: string;
    time: string;
    description?: string;
    type: "video" | "location";
    location?: string;
    color: string;
}

const COLOR_CLASSES = [
    "border-blue-500",
    "border-purple-500",
    "border-green-500",
    "border-orange-500",
    "border-pink-500",
    "border-cyan-500",
];

function formatEventTime(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const formatTime = (d: Date) =>
        d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return `${formatTime(startDate)} - ${formatTime(endDate)}`;
}

export function CalendarWidget() {
    const [events, setEvents] = useState<WidgetEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const today = new Date().toLocaleDateString("fr-FR", {
        weekday: "long",
        month: "long",
        day: "numeric",
    });

    useEffect(() => {
        const loadTodayEvents = async () => {
            try {
                setIsLoading(true);
                // Get all calendars
                const calResponse = await calendarApi.listCalendars();
                const calendars: Calendar[] = calResponse.data;

                if (calendars.length === 0) {
                    setEvents([]);
                    return;
                }

                // Get today's date range
                const now = new Date();
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

                // Fetch events from all calendars
                const allEvents: WidgetEvent[] = [];
                for (let i = 0; i < calendars.length; i++) {
                    const cal = calendars[i];
                    try {
                        const eventsResponse = await calendarApi.listEvents(cal.id, startOfDay, endOfDay);
                        const calEvents: Event[] = eventsResponse.data;
                        calEvents.forEach((evt) => {
                            const hasLocation = !!evt.location && evt.location.trim() !== "";
                            const isOnline = evt.location?.toLowerCase().includes("online") ||
                                evt.location?.toLowerCase().includes("zoom") ||
                                evt.location?.toLowerCase().includes("meet") ||
                                evt.location?.toLowerCase().includes("teams");
                            allEvents.push({
                                id: evt.id,
                                title: evt.title,
                                time: formatEventTime(evt.start_time, evt.end_time),
                                description: evt.description,
                                type: isOnline || !hasLocation ? "video" : "location",
                                location: hasLocation ? evt.location : undefined,
                                color: COLOR_CLASSES[i % COLOR_CLASSES.length],
                            });
                        });
                    } catch (err) {
                        console.debug(`Failed to fetch events for calendar ${cal.id}:`, err);
                    }
                }

                // Sort by start time (extracted from time string)
                allEvents.sort((a, b) => a.time.localeCompare(b.time));
                setEvents(allEvents);
            } catch (err) {
                console.debug("Failed to load today's events:", err);
                setEvents([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadTodayEvents();
    }, []);

    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)] pb-4">
            <div className="p-4 pb-2">
                <h3 className="text-lg font-semibold tracking-tight capitalize">{today}</h3>
                <p className="text-sm text-muted-foreground">
                    {isLoading ? "Chargement..." : `${events.length} événement${events.length !== 1 ? "s" : ""} aujourd'hui`}
                </p>
            </div>

            <ScrollArea className="flex-1 px-4">
                <div className="space-y-4 pb-8">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                            <CalendarDays className="h-5 w-5 animate-pulse mr-2" />
                            Chargement des événements...
                        </div>
                    ) : events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <CalendarDays className="h-8 w-8 mb-2" />
                            <p className="text-sm">Aucun événement aujourd'hui</p>
                        </div>
                    ) : (
                        events.map((event) => (
                            <Card key={event.id} className={`border-l-4 ${event.color} rounded-sm shadow-sm`}>
                                <CardHeader className="p-3 pb-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <CardTitle className="text-sm font-semibold leading-tight">{event.title}</CardTitle>
                                        {event.type === "video" ? (
                                            <Video className="h-3 w-3 text-muted-foreground shrink-0" />
                                        ) : (
                                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                        )}
                                    </div>
                                    <CardDescription className="text-xs flex items-center gap-1 mt-1">
                                        <Clock className="w-3 h-3" /> {event.time}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                                    {event.description}
                                    {event.location && (
                                        <div className="mt-1 font-medium text-foreground">{event.location}</div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
