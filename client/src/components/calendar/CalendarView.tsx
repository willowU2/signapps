"use client";

import React from "react";
import { useCalendarStore, useCalendarSelection } from "@/stores/calendar-store";
import { useEvents } from "@/hooks/use-events";
import { MonthCalendar } from "./MonthCalendar";
import { WeekCalendar } from "./WeekCalendar";
import { DayCalendar } from "./DayCalendar";
import { UpcomingEventsList } from "./upcoming-events-list";

interface CalendarViewProps {
    selectedCalendarId?: string;
    onCreateEvent?: (startTime?: Date, endTime?: Date) => void;
}

export function CalendarView({ selectedCalendarId, onCreateEvent }: CalendarViewProps) {
    // Granular selector - only re-render when viewMode changes
    const viewMode = useCalendarStore((state) => state.viewMode);
    const { selectedEventId, selectEvent } = useCalendarSelection();
    const { events } = useEvents(selectedCalendarId);

    switch (viewMode) {
        case "week":
            return <WeekCalendar selectedCalendarId={selectedCalendarId} onCreateEvent={onCreateEvent} />;
        case "day":
            return <DayCalendar selectedCalendarId={selectedCalendarId} />;
        case "agenda":
            return (
                <div className="flex-1 overflow-y-auto p-4">
                    <UpcomingEventsList
                        events={events}
                        onEventClick={selectEvent}
                        selectedEventId={selectedEventId}
                    />
                </div>
            );
        case "month":
        default:
            return <MonthCalendar selectedCalendarId={selectedCalendarId} />;
    }
}
