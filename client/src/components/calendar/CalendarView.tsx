"use client";

import React from "react";
import { useCalendarStore } from "@/stores/calendar-store";
import { MonthCalendar } from "./MonthCalendar";
import { WeekCalendar } from "./WeekCalendar";
import { DayCalendar } from "./DayCalendar";

interface CalendarViewProps {
    selectedCalendarId?: string;
}

export function CalendarView({ selectedCalendarId }: CalendarViewProps) {
    const { viewMode } = useCalendarStore();

    switch (viewMode) {
        case "week":
            return <WeekCalendar selectedCalendarId={selectedCalendarId} />;
        case "day":
            return <DayCalendar selectedCalendarId={selectedCalendarId} />;
        case "month":
        default:
            return <MonthCalendar selectedCalendarId={selectedCalendarId} />;
    }
}
