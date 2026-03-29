"use client";

import React, { useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from "date-fns";
import { useCalendarStore, useCalendarSelection } from "@/stores/calendar-store";
import { useEvents } from "@/hooks/use-events";
import { Event } from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";

// Separate component needed because useDroppable is a hook
function DroppableDay({ day, isCurrentMonth, isTodayDate, dayEvents, selectedEventId, selectEvent, format }: any) {
  const dayStr = day.toDateString();
  const { isOver, setNodeRef } = useDroppable({
    id: `calendar-day-${dayStr}`,
    data: {
      type: "calendar-slot",
      date: day.toISOString(),
    }
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-r border-border p-1 flex flex-col relative transition-colors ${
        !isCurrentMonth ? "bg-muted/50" : "bg-background"
      } ${isOver ? "bg-blue-50 ring-2 ring-blue-500 z-10" : ""}`}
    >
      {/* Day number */}
      <div className="flex justify-center mb-1">
        <div
          className={`text-[12px] font-medium w-6 h-6 flex items-center justify-center rounded-full ${
            isTodayDate 
              ? "bg-[#1a73e8] text-white" 
              : isCurrentMonth ? "text-[#3c4043]" : "text-[#70757a]"
          }`}
        >
          {format(day, "d")}
        </div>
      </div>

      {/* Events Container */}
      <div className="flex-1 space-y-[2px] overflow-y-auto px-1 hide-scrollbar">
        {dayEvents.slice(0, 4).map((event: any) => (
          <div
            key={event.id}
            onClick={(e) => {
              e.stopPropagation();
              selectEvent(event.id);
            }}
            className={`text-[11px] px-2 py-[2px] rounded-sm cursor-pointer truncate font-medium leading-tight ${
              selectedEventId === event.id
                ? "bg-blue-800 text-white ring-1 ring-blue-900"
                : "bg-[#039be5] text-white hover:opacity-90"
            }`}
          >
            {event.title}
          </div>
        ))}
        {dayEvents.length > 4 && (
          <div className="text-[11px] font-medium text-[#3c4043] hover:bg-muted rounded px-1 cursor-pointer">
            {dayEvents.length - 4} autres
          </div>
        )}
      </div>
    </div>
  );
}

interface MonthCalendarProps {
  selectedCalendarId?: string;
}

export function MonthCalendar({ selectedCalendarId }: MonthCalendarProps) {
  // Granular selectors for optimized re-renders
  const currentDate = useCalendarStore((state) => state.currentDate);
  const { selectedEventId, selectEvent } = useCalendarSelection();
  const { events, fetchEvents, isLoading } = useEvents(selectedCalendarId);

  // Fetch events for current month when it changes
  useEffect(() => {
    if (!selectedCalendarId) return;

    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    // Expand range to include full weeks
    const monthStart = new Date(start);
    monthStart.setDate(monthStart.getDate() - monthStart.getDay());
    const monthEnd = new Date(end);
    monthEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

    fetchEvents(monthStart, monthEnd);
  }, [selectedCalendarId, currentDate, fetchEvents]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Generate calendar grid (6 rows x 7 cols)
  const calendarDays = useMemo(() => {
    const start = new Date(monthStart);
    start.setDate(start.getDate() - monthStart.getDay());
    const end = new Date(monthEnd);
    end.setDate(end.getDate() + (6 - monthEnd.getDay()));

    return eachDayOfInterval({ start, end });
  }, [monthStart, monthEnd]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, Event[]>();
    events.forEach((event) => {
      const date = new Date(event.start_time).toDateString();
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(event);
    });
    return grouped;
  }, [events]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeks = Array.from({ length: 6 }, (_, i) => calendarDays.slice(i * 7, (i + 1) * 7));

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map((day) => (
          <div key={day} className="py-2 text-center text-[11px] font-medium text-[#70757a] uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex-1 grid grid-cols-7 border-b border-border min-h-[100px]">
            {week.map((day, dayIdx) => {
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isTodayDate = isToday(day);
              const dayStr = day.toDateString();
              const dayEvents = eventsByDate.get(dayStr) || [];

              return (
                <DroppableDay 
                  key={dayIdx} 
                  day={day} 
                  isCurrentMonth={isCurrentMonth} 
                  isTodayDate={isTodayDate} 
                  dayEvents={dayEvents} 
                  selectedEventId={selectedEventId} 
                  selectEvent={selectEvent} 
                  format={format} 
                />
              );
            })}
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center pointer-events-none">
          <span className="text-[#5f6368] text-sm">Chargement...</span>
        </div>
      )}
    </div>
  );
}
