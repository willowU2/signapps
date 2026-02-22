"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, Clock, MapPin, Video } from "lucide-react";

// Mock data representing today's events for the user
const TODAY_EVENTS = [
    {
        id: 1,
        title: "Daily Standup",
        time: "10:00 AM - 10:30 AM",
        description: "Sync with the engineering team.",
        type: "video",
        color: "border-blue-500",
    },
    {
        id: 2,
        title: "Q3 Planning Review",
        time: "01:00 PM - 02:30 PM",
        description: "Reviewing objectives and key results.",
        type: "location",
        location: "Conference Room A",
        color: "border-purple-500",
    },
    {
        id: 3,
        title: "1:1 with Sarah",
        time: "03:30 PM - 04:00 PM",
        description: "Weekly sync up.",
        type: "video",
        color: "border-green-500",
    },
    {
        id: 4,
        title: "Design System Sync",
        time: "05:00 PM - 06:00 PM",
        description: "Discussing new Right Sidebar components.",
        type: "location",
        location: "Online",
        color: "border-orange-500",
    }
];

export function CalendarWidget() {
    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
    });

    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)] pb-4">
            <div className="p-4 pb-2">
                <h3 className="text-lg font-semibold tracking-tight">{today}</h3>
                <p className="text-sm text-muted-foreground">{TODAY_EVENTS.length} events today</p>
            </div>

            <ScrollArea className="flex-1 px-4">
                <div className="space-y-4 pb-8">
                    {TODAY_EVENTS.map((event) => (
                        <Card key={event.id} className={`border-l-4 ${event.color} rounded-sm shadow-sm`}>
                            <CardHeader className="p-3 pb-2">
                                <div className="flex justify-between items-start gap-2">
                                    <CardTitle className="text-sm font-semibold leading-tight">{event.title}</CardTitle>
                                    {event.type === 'video' ? <Video className="h-3 w-3 text-muted-foreground shrink-0" /> : <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />}
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
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
