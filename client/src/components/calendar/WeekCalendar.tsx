"use client";

import React, { useEffect, useMemo, useRef, useCallback } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, addDays, getHours, getMinutes, differenceInMinutes } from "date-fns";
import { useCalendarStore, useCalendarSelection, useCalendarTimezones } from "@/stores/calendar-store";
import { useEvents } from "@/hooks/use-events";
import { Event } from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DragCreateLayer, useDragCreate, DragSelection } from "./drag-create-event";
import { MultiDayEventBars, isMultiDay } from "./multi-day-events";

interface WeekCalendarProps {
    selectedCalendarId?: string;
    onCreateEvent?: (startTime?: Date, endTime?: Date) => void;
}

export function WeekCalendar({ selectedCalendarId, onCreateEvent }: WeekCalendarProps) {
    // Granular selectors for optimized re-renders
    const currentDate = useCalendarStore((state) => state.currentDate);
    const setCurrentDate = useCalendarStore((state) => state.setCurrentDate);
    const { selectedEventId, selectEvent } = useCalendarSelection();
    const timezones = useCalendarTimezones();

    const { events, fetchEvents, isLoading } = useEvents(selectedCalendarId);

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

    // Fetch events
    useEffect(() => {
        if (!selectedCalendarId) return;
        fetchEvents(weekStart, weekEnd);
    }, [selectedCalendarId, currentDate, fetchEvents]); // weekStart/End depend on currentDate

    const weekDays = useMemo(() => {
        return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }, [weekStart, weekEnd]);

    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Separate multi-day events from timed events
    const singleDayEvents = useMemo(() => events.filter((e) => !isMultiDay(e)), [events])

    // Group single-day events by day for easier rendering
    const eventsByDay = useMemo(() => {
        const grouped = new Map<string, Event[]>();
        singleDayEvents.forEach((event) => {
            const date = new Date(event.start_time).toDateString();
            if (!grouped.has(date)) grouped.set(date, []);
            grouped.get(date)!.push(event);
        });
        return grouped;
    }, [singleDayEvents]);

    const handlePrevWeek = () => {
        const newDate = addDays(currentDate, -7);
        setCurrentDate(newDate);
    };

    const handleNextWeek = () => {
        const newDate = addDays(currentDate, 7);
        setCurrentDate(newDate);
    };

    // Drag-create handler
    const { handleCreate } = useDragCreate(useCallback((startTime: Date, endTime: Date) => {
        onCreateEvent?.(startTime, endTime)
    }, [onCreateEvent]))

    const getEventStyle = (event: Event) => {
        const start = new Date(event.start_time);
        const end = new Date(event.end_time);
        const startMinutes = getHours(start) * 60 + getMinutes(start);
        const duration = differenceInMinutes(end, start);

        // Top position matching the hour grid (row height = 48px or 3rem usually)
        // Let's assume 60px per hour for calculation or use percentages if using grid

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
                    {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
                </h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                        Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleNextWeek}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Grid Header */}
            <div className="flex flex-col border-b">
                <div className="flex">
                    {/* Timezone Headers */}
                    <div className="flex min-w-max border-r bg-muted/50">
                        {timezones.map((tz, i) => (
                            <div key={tz} className={`w-16 text-center py-2 text-xs font-medium text-muted-foreground ${i > 0 ? 'border-l' : ''}`}>
                                <span className="truncate block px-1" title={tz}>{tz.split('/').pop()?.replace('_', ' ') || tz}</span>
                            </div>
                        ))}
                    </div>
                    {/* Days Headers */}
                    {weekDays.map((day) => (
                        <div key={day.toString()} className={`flex-1 text-center py-2 border-r font-semibold min-w-[100px] ${isToday(day) ? "text-blue-600" : ""}`}>
                            <div>{format(day, "EEE")}</div>
                            <div className={`text-lg ${isToday(day) ? "bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto mt-1" : ""}`}>
                                {format(day, "d")}
                            </div>
                        </div>
                    ))}
                </div>
                {/* Multi-day events bar (IDEA-045) */}
                {events.some(isMultiDay) && (
                    <div className="flex border-t border-dashed border-border bg-muted/20">
                        <div className="flex min-w-max border-r" style={{ minWidth: `${timezones.length * 64}px` }} />
                        <div className="flex-1 relative px-1 py-1">
                            <MultiDayEventBars
                                events={events}
                                weekDays={weekDays}
                                onEventClick={selectEvent}
                                selectedEventId={selectedEventId}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Time Grid */}
            <div className="flex-1 overflow-y-auto relative">
                <div className="flex min-h-[1440px]"> {/* 60px * 24 = 1440px height */}
                    {/* Time Axes */}
                    <div className="flex min-w-max border-r bg-muted/30">
                        {timezones.map((tz, i) => (
                            <div key={tz} className={`w-16 ${i > 0 ? 'border-l border-border/50 dark:border-gray-800/50' : ''}`}>
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
                                            // Fallback if tz is invalid
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

                    {/* Days Columns */}
                    {weekDays.map((day) => (
                        <div key={day.toString()} className="border-r relative h-[1440px] flex-1 min-w-[100px]">
                            {/* Hour lines */}
                            {hours.map((hour) => (
                                <div key={hour} className="h-[60px] border-b border-dashed border-gray-100 dark:border-gray-800"></div>
                            ))}

                            {/* Drag-create layer (IDEA-043) */}
                            <DragCreateLayer day={day} hourHeight={60} onCreateEvent={handleCreate} />

                            {/* Events */}
                            {eventsByDay.get(day.toDateString())?.map((event) => (
                                <div
                                    key={event.id}
                                    onClick={() => selectEvent(event.id)}
                                    className={`absolute left-0.5 right-0.5 rounded px-2 py-1 text-xs cursor-pointer border overflow-hidden ${selectedEventId === event.id
                                        ? "bg-blue-600 text-white z-20 shadow-lg"
                                        : "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-100 hover:bg-blue-200 z-10"
                                        }`}
                                    style={getEventStyle(event)}
                                >
                                    <div className="font-semibold truncate">{event.title}</div>
                                    <div className="truncate text-[10px] opacity-80">{format(new Date(event.start_time), "h:mm a")}</div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
