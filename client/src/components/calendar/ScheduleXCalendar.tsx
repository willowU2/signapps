"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ScheduleXCalendar as SXCalendar, useNextCalendarApp } from "@schedule-x/react";
import {
    createViewDay,
    createViewMonthAgenda,
    createViewMonthGrid,
    createViewWeek,
} from "@schedule-x/calendar";
import "@schedule-x/theme-default/dist/index.css";
import { useCalendarStore, useCalendarSelection } from "@/stores/calendar-store";
import { useEvents } from "@/hooks/use-events";
import { Event as CalendarEvent } from "@/types/calendar";
import { format } from "date-fns";

// Schedule-X event type
interface ScheduleXEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
    calendarId?: string;
}

// Map view modes
const viewModeMap: Record<string, string> = {
    month: "month-grid",
    week: "week",
    day: "day",
    agenda: "month-agenda",
};

interface ScheduleXCalendarProps {
    selectedCalendarId?: string;
}

export function ScheduleXCalendar({ selectedCalendarId }: ScheduleXCalendarProps) {
    const [mounted, setMounted] = useState(false);

    // Store state
    const viewMode = useCalendarStore((state) => state.viewMode);
    const currentDate = useCalendarStore((state) => state.currentDate);
    const setCurrentDate = useCalendarStore((state) => state.setCurrentDate);
    const { selectEvent } = useCalendarSelection();

    // Fetch events
    const { events, fetchEvents } = useEvents(selectedCalendarId);

    // Convert events to Schedule-X format
    const scheduleXEvents = useMemo((): ScheduleXEvent[] => {
        return events.map((event: CalendarEvent) => ({
            id: event.id,
            title: event.title,
            start: format(new Date(event.start_time), "yyyy-MM-dd HH:mm"),
            end: format(new Date(event.end_time), "yyyy-MM-dd HH:mm"),
            description: event.description || undefined,
            location: event.location || undefined,
            calendarId: "default",
        }));
    }, [events]);

    // Create calendar app using Schedule-X hook for Next.js
    const calendarApp = useNextCalendarApp({
        views: [
            createViewMonthGrid(),
            createViewWeek(),
            createViewDay(),
            createViewMonthAgenda(),
        ],
        defaultView: viewModeMap[viewMode] || "month-grid",
        selectedDate: format(currentDate, "yyyy-MM-dd"),
        events: scheduleXEvents,
        locale: "fr-FR",
        firstDayOfWeek: 1, // Monday
        dayBoundaries: {
            start: "06:00",
            end: "22:00",
        },
        weekOptions: {
            gridHeight: 800,
            nDays: 7,
            eventWidth: 95,
        },
        monthGridOptions: {
            nEventsPerDay: 4,
        },
        callbacks: {
            onEventClick: (event: ScheduleXEvent) => {
                selectEvent(event.id);
            },
            onClickDate: (date: string) => {
                setCurrentDate(new Date(date));
            },
            onSelectedDateUpdate: (date: string) => {
                setCurrentDate(new Date(date));
            },
        },
        calendars: {
            default: {
                colorName: "default",
                lightColors: {
                    main: "#3b82f6",
                    container: "#dbeafe",
                    onContainer: "#1e3a8a",
                },
                darkColors: {
                    main: "#60a5fa",
                    container: "#1e3a8a",
                    onContainer: "#dbeafe",
                },
            },
            work: {
                colorName: "work",
                lightColors: {
                    main: "#10b981",
                    container: "#d1fae5",
                    onContainer: "#065f46",
                },
                darkColors: {
                    main: "#34d399",
                    container: "#065f46",
                    onContainer: "#d1fae5",
                },
            },
            personal: {
                colorName: "personal",
                lightColors: {
                    main: "#8b5cf6",
                    container: "#ede9fe",
                    onContainer: "#5b21b6",
                },
                darkColors: {
                    main: "#a78bfa",
                    container: "#5b21b6",
                    onContainer: "#ede9fe",
                },
            },
        },
    });

    // Update calendar when events change
    useEffect(() => {
        if (calendarApp && scheduleXEvents.length > 0) {
            // Clear existing events
            const existingEvents = calendarApp.events.getAll();
            existingEvents.forEach((event: ScheduleXEvent) => {
                calendarApp.events.remove(event.id);
            });
            // Add new events
            scheduleXEvents.forEach((event) => {
                calendarApp.events.add(event);
            });
        }
    }, [calendarApp, scheduleXEvents]);

    // Update view mode when store changes
    useEffect(() => {
        if (calendarApp) {
            const scheduleXView = viewModeMap[viewMode] || "month-grid";
            calendarApp.setView(scheduleXView);
        }
    }, [calendarApp, viewMode]);

    // Update selected date when store changes
    useEffect(() => {
        if (calendarApp) {
            calendarApp.setDate(format(currentDate, "yyyy-MM-dd"));
        }
    }, [calendarApp, currentDate]);

    // Fetch events on mount and when calendar changes
    useEffect(() => {
        if (selectedCalendarId) {
            const start = new Date(currentDate);
            start.setMonth(start.getMonth() - 1);
            const end = new Date(currentDate);
            end.setMonth(end.getMonth() + 1);
            fetchEvents(start, end);
        }
    }, [selectedCalendarId, currentDate, fetchEvents]);

    // Handle client-side mounting
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !calendarApp) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-muted-foreground">
                    Chargement du calendrier...
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full schedule-x-wrapper">
            <style jsx global>{`
                .schedule-x-wrapper {
                    --sx-color-primary: hsl(var(--primary));
                    --sx-color-background: hsl(var(--background));
                    --sx-color-surface: hsl(var(--card));
                    --sx-color-on-surface: hsl(var(--foreground));
                    --sx-color-border: hsl(var(--border));
                }

                .sx-react-calendar-wrapper {
                    height: 100% !important;
                }

                .sx__calendar-wrapper {
                    height: 100% !important;
                    background: hsl(var(--background));
                    border-radius: 0.5rem;
                }

                .sx__month-grid,
                .sx__week-grid,
                .sx__day-grid {
                    background: hsl(var(--card));
                }

                .sx__month-grid-day {
                    border-color: hsl(var(--border)) !important;
                }

                .sx__month-grid-day__header {
                    color: hsl(var(--muted-foreground));
                }

                .sx__month-grid-day--is-today .sx__month-grid-day__header {
                    background: hsl(var(--primary));
                    color: hsl(var(--primary-foreground));
                    border-radius: 50%;
                }

                .sx__time-grid-day {
                    border-color: hsl(var(--border)) !important;
                }

                .sx__week-grid__date-label {
                    color: hsl(var(--foreground));
                }

                .sx__event {
                    border-radius: 4px;
                    font-size: 0.75rem;
                }

                .dark .sx__calendar-wrapper {
                    color-scheme: dark;
                }
            `}</style>
            <SXCalendar calendarApp={calendarApp} />
        </div>
    );
}

export default ScheduleXCalendar;
