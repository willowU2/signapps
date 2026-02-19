"use client";

import React, { useEffect, useMemo } from "react";
import { format, startOfDay, endOfDay, addDays, getHours, getMinutes, differenceInMinutes, isToday } from "date-fns";
import { useCalendarStore } from "@/stores/calendar-store";
import { useEvents } from "@/hooks/use-events";
import { Event } from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DayCalendarProps {
    selectedCalendarId?: string;
}

export function DayCalendar({ selectedCalendarId }: DayCalendarProps) {
    const { currentDate, selectEvent, selectedEventId } = useCalendarStore();
    const { events, fetchEvents, isLoading } = useEvents(selectedCalendarId);

    // Fetch events
    useEffect(() => {
        if (!selectedCalendarId) return;
        const start = startOfDay(currentDate);
        const end = endOfDay(currentDate);
        fetchEvents(start, end);
    }, [selectedCalendarId, currentDate, fetchEvents]);

    const handlePrevDay = () => {
        const newDate = addDays(currentDate, -1);
        useCalendarStore.getState().setCurrentDate(newDate);
    };

    const handleNextDay = () => {
        const newDate = addDays(currentDate, 1);
        useCalendarStore.getState().setCurrentDate(newDate);
    };

    const hours = Array.from({ length: 24 }, (_, i) => i);

    const getEventStyle = (event: Event) => {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        const startMinutes = getHours(start) * 60 + getMinutes(start);
        const duration = differenceInMinutes(end, start);

        return {
            top: `${(startMinutes / 1440) * 100}%`,
            height: `${(duration / 1440) * 100}%`,
            minHeight: '20px'
        };
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">
                    {format(currentDate, "MMMM d, yyyy")}
                </h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrevDay}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => useCalendarStore.setState({ currentDate: new Date() })}>
                        Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleNextDay}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Grid Header (Current Day) */}
            <div className="grid grid-cols-1 pl-16 border-b">
                <div className={`text-center py-2 font-semibold ${isToday(currentDate) ? "text-blue-600" : ""}`}>
                    <div>{format(currentDate, "EEEE")}</div>
                </div>
            </div>

            {/* Time Grid */}
            <div className="flex-1 overflow-y-auto relative">
                <div className="grid grid-cols-1 min-h-[1440px] pl-16 relative">
                    {/* Time Axis */}
                    <div className="absolute left-0 top-0 bottom-0 w-16 bg-muted/30 border-r z-10">
                        {hours.map((hour) => (
                            <div key={hour} className="h-[60px] text-right pr-2 text-xs text-muted-foreground -mt-2">
                                {hour === 0 ? "" : format(new Date().setHours(hour, 0, 0, 0), "h a")}
                            </div>
                        ))}
                    </div>

                    {/* Day Column */}
                    <div className="relative h-[1440px] border-r">
                        {/* Hour lines */}
                        {hours.map((hour) => (
                            <div key={hour} className="h-[60px] border-b border-dashed border-gray-100 dark:border-gray-800"></div>
                        ))}

                        {/* Events */}
                        {events.map((event) => (
                            <div
                                key={event.id}
                                onClick={() => selectEvent(event.id)}
                                className={`absolute left-2 right-2 rounded px-3 py-2 text-sm cursor-pointer border overflow-hidden ${selectedEventId === event.id
                                        ? "bg-blue-600 text-white z-20 shadow-lg"
                                        : "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-100 hover:bg-blue-200 z-10"
                                    }`}
                                style={getEventStyle(event)}
                            >
                                <div className="font-semibold">{event.title}</div>
                                <div className="text-xs opacity-80">
                                    {format(new Date(event.start_time), "h:mm a")} - {format(new Date(event.end_time), "h:mm a")}
                                </div>
                                {event.description && <div className="text-xs mt-1 line-clamp-2 opacity-70">{event.description}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
