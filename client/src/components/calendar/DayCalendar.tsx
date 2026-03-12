"use client";

import React, { useEffect, useMemo } from "react";
import { format, startOfDay, endOfDay, addDays, getHours, getMinutes, differenceInMinutes, isToday } from "date-fns";
import { useCalendarStore, useCalendarSelection, useCalendarTimezones } from "@/stores/calendar-store";
import { useEvents } from "@/hooks/use-events";
import { Event } from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DayCalendarProps {
    selectedCalendarId?: string;
}

export function DayCalendar({ selectedCalendarId }: DayCalendarProps) {
    // Granular selectors for optimized re-renders
    const currentDate = useCalendarStore((state) => state.currentDate);
    const setCurrentDate = useCalendarStore((state) => state.setCurrentDate);
    const { selectedEventId, selectEvent } = useCalendarSelection();
    const timezones = useCalendarTimezones();
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
        setCurrentDate(newDate);
    };

    const handleNextDay = () => {
        const newDate = addDays(currentDate, 1);
        setCurrentDate(newDate);
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
                    <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                        Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleNextDay}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Grid Header (Current Day) */}
            <div className="flex border-b">
                {/* Timezone Headers */}
                <div className="flex min-w-max border-r bg-muted/50">
                    {timezones.map((tz, i) => (
                        <div key={tz} className={`w-16 text-center py-2 text-xs font-medium text-muted-foreground ${i > 0 ? 'border-l' : ''}`}>
                            <span className="truncate block px-1" title={tz}>{tz.split('/').pop()?.replace('_', ' ') || tz}</span>
                        </div>
                    ))}
                </div>
                {/* Day Header */}
                <div className={`flex-1 text-center py-2 border-r font-semibold min-w-[100px] ${isToday(currentDate) ? "text-blue-600" : ""}`}>
                    <div>{format(currentDate, "EEEE")}</div>
                </div>
            </div>

            {/* Time Grid */}
            <div className="flex-1 overflow-y-auto relative">
                <div className="flex min-h-[1440px]">
                    {/* Time Axes */}
                    <div className="flex min-w-max border-r bg-muted/30 z-10 bg-background dark:bg-gray-950">
                        {timezones.map((tz, i) => (
                            <div key={tz} className={`w-16 ${i > 0 ? 'border-l border-gray-200/50 dark:border-gray-800/50' : ''}`}>
                                {hours.map((hour) => {
                                    const date = new Date();
                                    date.setHours(hour, 0, 0, 0);
                                    let timeStr = "";
                                    if (hour !== 0) {
                                        try {
                                            timeStr = new Intl.DateTimeFormat('en-US', {
                                                hour: 'numeric',
                                                timeZone: tz,
                                            }).format(date);
                                        } catch (e) {
                                            timeStr = format(date, "h a");
                                        }
                                    }
                                    return (
                                        <div key={hour} className="h-[60px] text-center px-1 text-[11px] text-muted-foreground -mt-2 truncate" title={timeStr}>
                                            {timeStr}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Day Column */}
                    <div className="flex-1 relative h-[1440px] border-r">
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
