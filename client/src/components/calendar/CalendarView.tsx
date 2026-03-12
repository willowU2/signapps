"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useCalendarStore } from "@/stores/calendar-store";
import { MonthCalendar } from "./MonthCalendar";
import { WeekCalendar } from "./WeekCalendar";
import { DayCalendar } from "./DayCalendar";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Dynamic import Schedule-X to avoid SSR issues
const ScheduleXCalendar = dynamic(
    () => import("./ScheduleXCalendar").then((mod) => mod.ScheduleXCalendar),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        ),
    }
);

interface CalendarViewProps {
    selectedCalendarId?: string;
}

export function CalendarView({ selectedCalendarId }: CalendarViewProps) {
    // Granular selector - only re-render when viewMode changes
    const viewMode = useCalendarStore((state) => state.viewMode);
    const [useScheduleX, setUseScheduleX] = useState(true);

    // Use Schedule-X by default for better UX
    if (useScheduleX) {
        return (
            <div className="h-full flex flex-col">
                <div className="flex justify-end p-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUseScheduleX(false)}
                        className="text-xs text-muted-foreground"
                    >
                        Vue classique
                    </Button>
                </div>
                <div className="flex-1">
                    <ScheduleXCalendar selectedCalendarId={selectedCalendarId} />
                </div>
            </div>
        );
    }

    // Classic view fallback
    const renderClassicView = () => {
        switch (viewMode) {
            case "week":
                return <WeekCalendar selectedCalendarId={selectedCalendarId} />;
            case "day":
                return <DayCalendar selectedCalendarId={selectedCalendarId} />;
            case "month":
            default:
                return <MonthCalendar selectedCalendarId={selectedCalendarId} />;
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-end p-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUseScheduleX(true)}
                    className="text-xs text-muted-foreground"
                >
                    Vue Schedule-X
                </Button>
            </div>
            <div className="flex-1">
                {renderClassicView()}
            </div>
        </div>
    );
}
