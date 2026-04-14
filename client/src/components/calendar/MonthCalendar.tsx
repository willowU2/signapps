"use client";

import React, { useEffect, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  startOfDay,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import {
  useCalendarStore,
  useCalendarSelection,
} from "@/stores/calendar-store";
import { useEvents } from "@/hooks/use-events";
import { Event } from "@/types/calendar";
import { useDroppable, useDraggable } from "@dnd-kit/core";

// ────────────────────────────────────────────────────────────────────────────
// DroppableDay — each cell in month grid is a DnD drop target
// ────────────────────────────────────────────────────────────────────────────

interface DroppableDayProps {
  day: Date;
  isCurrentMonth: boolean;
  isTodayDate: boolean;
  dayEvents: Event[];
  selectedEventId: string | null;
  selectEvent: (id: string) => void;
  onCreateEvent?: (startTime?: Date, endTime?: Date) => void;
}

function DroppableDay({
  day,
  isCurrentMonth,
  isTodayDate,
  dayEvents,
  selectedEventId,
  selectEvent,
  onCreateEvent,
}: DroppableDayProps) {
  const dayStr = day.toDateString();
  const dayIso = format(day, "yyyy-MM-dd");
  const { isOver, setNodeRef } = useDroppable({
    id: `calendar-day-${dayStr}`,
    data: {
      type: "calendar-slot",
      date: dayIso,
    },
  });

  return (
    <div
      ref={setNodeRef}
      data-testid={`day-cell-${dayIso}`}
      className={`border-r border-border p-1 flex flex-col relative transition-colors cursor-pointer ${
        !isCurrentMonth ? "bg-muted/50" : "bg-background"
      } ${isOver ? "bg-blue-50 ring-2 ring-blue-500 ring-inset z-10" : ""}`}
      onClick={() => onCreateEvent?.(startOfDay(day))}
    >
      {/* Day number */}
      <div className="flex justify-center mb-1">
        <div
          className={`text-[12px] font-medium w-6 h-6 flex items-center justify-center rounded-full ${
            isTodayDate
              ? "bg-[#1a73e8] text-white"
              : isCurrentMonth
                ? "text-[#3c4043] dark:text-gray-200"
                : "text-[#70757a]"
          }`}
        >
          {format(day, "d")}
        </div>
      </div>

      {/* Events */}
      <div className="flex-1 space-y-[2px] overflow-y-auto px-1 hide-scrollbar">
        {dayEvents.slice(0, 4).map((event) => (
          <DraggableMonthEvent
            key={event.id}
            event={event}
            isSelected={selectedEventId === event.id}
            onSelect={() => selectEvent(event.id)}
          />
        ))}
        {dayEvents.length > 4 && (
          <div className="text-[11px] font-medium text-[#3c4043] dark:text-gray-400 hover:bg-muted rounded px-1 cursor-pointer">
            {dayEvents.length - 4} autres
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// DraggableMonthEvent — individual event card that can be picked up and
// dropped onto another DroppableDay cell.
// ────────────────────────────────────────────────────────────────────────────

interface DraggableMonthEventProps {
  event: Event;
  isSelected: boolean;
  onSelect: () => void;
}

function DraggableMonthEvent({
  event,
  isSelected,
  onSelect,
}: DraggableMonthEventProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { event },
  });

  return (
    <div
      ref={setNodeRef}
      data-testid="calendar-event"
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`text-[11px] px-2 py-[2px] rounded-sm cursor-pointer truncate font-medium leading-tight ${
        isDragging
          ? "opacity-50"
          : isSelected
            ? "bg-blue-800 text-white ring-1 ring-blue-900"
            : "bg-[#039be5] text-white hover:opacity-90"
      }`}
    >
      {event.title}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MonthCalendar
// ────────────────────────────────────────────────────────────────────────────

interface MonthCalendarProps {
  selectedCalendarId?: string;
  onCreateEvent?: (startTime?: Date, endTime?: Date) => void;
}

export function MonthCalendar({
  selectedCalendarId,
  onCreateEvent,
}: MonthCalendarProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const { selectedEventId, selectEvent } = useCalendarSelection();
  const { events, fetchEvents, isLoading } = useEvents(selectedCalendarId);

  // Fetch events for current month when it changes
  useEffect(() => {
    if (!selectedCalendarId) return;

    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    // Expand range to include full weeks visible in the grid (Monday-start)
    const monthStart = startOfWeek(start, { weekStartsOn: 1 });
    const monthEnd = endOfWeek(end, { weekStartsOn: 1 });

    fetchEvents(monthStart, monthEnd);
  }, [selectedCalendarId, currentDate, fetchEvents]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Generate calendar grid (Monday-start weeks spanning the visible month)
  const calendarDays = useMemo(() => {
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [monthStart, monthEnd]);

  // Group events by date — multi-day events are added to every day they span.
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, Event[]>();
    for (const event of events) {
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= end) {
        const key = cursor.toDateString();
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(event);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return grouped;
  }, [events]);

  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const numWeeks = Math.ceil(calendarDays.length / 7);
  const weeks = Array.from({ length: numWeeks }, (_, i) =>
    calendarDays.slice(i * 7, (i + 1) * 7),
  );

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-[11px] font-medium text-[#70757a] uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {weeks.map((week, weekIdx) => (
          <div
            key={weekIdx}
            className="flex-1 grid grid-cols-7 border-b border-border min-h-[100px]"
          >
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
                  onCreateEvent={onCreateEvent}
                />
              );
            })}
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center pointer-events-none">
          <span className="text-[#5f6368] text-sm">Chargement…</span>
        </div>
      )}
    </div>
  );
}
