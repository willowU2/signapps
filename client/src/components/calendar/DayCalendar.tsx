"use client";

import React, { useEffect, useCallback, useRef } from "react";
import {
  format,
  startOfDay,
  endOfDay,
  addDays,
  getHours,
  getMinutes,
  differenceInMinutes,
  isToday,
} from "date-fns";
import { useDraggable } from "@dnd-kit/core";
import {
  useCalendarStore,
  useCalendarSelection,
  useCalendarTimezones,
} from "@/stores/calendar-store";
import { useEvents } from "@/hooks/use-events";
import { Event } from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DragCreateLayer, useDragCreate } from "./drag-create-event";
import { ResizeHandle, useEventResize } from "./resize-event";

// ────────────────────────────────────────────────────────────────────────────
// Draggable event card
// ────────────────────────────────────────────────────────────────────────────

interface DraggableEventCardProps {
  event: Event;
  isSelected: boolean;
  style: React.CSSProperties;
  onEventClick: (id: string) => void;
  onResizeCommit: (result: { event: Event; newEndTime: Date }) => void;
  hourHeight: number;
}

function DraggableEventCard({
  event,
  isSelected,
  style,
  onEventClick,
  onResizeCommit,
  hourHeight,
}: DraggableEventCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { event },
  });

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        (
          containerRef as React.MutableRefObject<HTMLDivElement | null>
        ).current = el;
      }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(event.id);
      }}
      className={`absolute left-2 right-2 rounded px-3 py-2 text-sm cursor-pointer border overflow-hidden select-none ${
        isDragging
          ? "opacity-50 z-30"
          : isSelected
            ? "bg-blue-600 text-white z-20 shadow-lg"
            : "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-100 hover:bg-blue-200 z-10"
      }`}
      style={style}
    >
      <div className="font-semibold">{event.title}</div>
      <div className="text-xs opacity-80">
        {format(new Date(event.start_time), "H:mm")} –{" "}
        {format(new Date(event.end_time), "H:mm")}
      </div>
      {event.description && (
        <div className="text-xs mt-1 line-clamp-2 opacity-70">
          {event.description}
        </div>
      )}
      {/* Resize handle */}
      <ResizeHandle
        event={event}
        hourHeight={hourHeight}
        onResizeCommit={onResizeCommit}
        containerRef={containerRef as React.RefObject<HTMLElement>}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// DayCalendar
// ────────────────────────────────────────────────────────────────────────────

interface DayCalendarProps {
  selectedCalendarId?: string;
  onCreateEvent?: (startTime?: Date, endTime?: Date) => void;
}

export function DayCalendar({
  selectedCalendarId,
  onCreateEvent,
}: DayCalendarProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate);
  const { selectedEventId, selectEvent } = useCalendarSelection();
  const timezones = useCalendarTimezones();
  const { events, fetchEvents, updateEvent } = useEvents(selectedCalendarId);
  const hourHeight = 60;

  const { handleResizeCommit } = useEventResize(
    useCallback(
      async (id: string, data: { start_time?: string; end_time: string }) => {
        return updateEvent(id, data);
      },
      [updateEvent],
    ),
  );

  // Fetch events for current day — expand range by ±1 day so events near
  // midnight aren't filtered out due to timezone shifts between local and UTC.
  useEffect(() => {
    if (!selectedCalendarId) return;
    const start = startOfDay(currentDate);
    const end = endOfDay(currentDate);
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() + 1);
    fetchEvents(start, end);
  }, [selectedCalendarId, currentDate, fetchEvents]);

  const handlePrevDay = () => setCurrentDate(addDays(currentDate, -1));
  const handleNextDay = () => setCurrentDate(addDays(currentDate, 1));

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventStyle = (event: Event): React.CSSProperties => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const startMinutes = getHours(start) * 60 + getMinutes(start);
    const duration = Math.max(15, differenceInMinutes(end, start));
    return {
      top: `${(startMinutes / 1440) * 100}%`,
      height: `${(duration / 1440) * 100}%`,
      minHeight: "20px",
    };
  };

  // Drag-create handler
  const { handleCreate } = useDragCreate(
    useCallback(
      (startTime: Date, endTime: Date) => {
        onCreateEvent?.(startTime, endTime);
      },
      [onCreateEvent],
    ),
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <h2 className="text-base font-semibold">
          {isToday(currentDate)
            ? "Aujourd'hui"
            : format(currentDate, "EEEE d MMMM yyyy")}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Aujourd'hui
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid Header */}
      <div className="flex border-b shrink-0">
        <div className="flex min-w-max border-r bg-muted/50">
          {timezones.map((tz, i) => (
            <div
              key={tz}
              className={`w-16 text-center py-2 text-xs font-medium text-muted-foreground ${
                i > 0 ? "border-l" : ""
              }`}
            >
              <span className="truncate block px-1" title={tz}>
                {tz.split("/").pop()?.replace("_", " ") || tz}
              </span>
            </div>
          ))}
        </div>
        <div
          className={`flex-1 text-center py-2 border-r font-semibold min-w-[100px] ${
            isToday(currentDate) ? "text-blue-600" : ""
          }`}
        >
          <div className="text-xs text-muted-foreground">
            {format(currentDate, "EEE")}
          </div>
          <div
            className={`text-lg mx-auto w-8 h-8 flex items-center justify-center rounded-full ${
              isToday(currentDate) ? "bg-blue-600 text-white" : ""
            }`}
          >
            {format(currentDate, "d")}
          </div>
        </div>
      </div>

      {/* Time Grid */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="flex min-h-[1440px]">
          {/* Time Axes */}
          <div className="flex min-w-max border-r bg-muted/30 z-10 bg-background dark:bg-gray-950">
            {timezones.map((tz, i) => (
              <div
                key={tz}
                className={`w-16 ${i > 0 ? "border-l border-border/50" : ""}`}
              >
                {hours.map((hour) => {
                  const date = new Date();
                  date.setHours(hour, 0, 0, 0);
                  let timeStr = "";
                  if (hour !== 0) {
                    try {
                      timeStr = new Intl.DateTimeFormat("fr-FR", {
                        hour: "numeric",
                        timeZone: tz,
                      }).format(date);
                    } catch {
                      timeStr = format(date, "H:mm");
                    }
                  }
                  return (
                    <div
                      key={hour}
                      className="h-[60px] text-center px-1 text-[11px] text-muted-foreground -mt-2 truncate"
                      title={timeStr}
                    >
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
              <div
                key={hour}
                className="h-[60px] border-b border-dashed border-gray-100 dark:border-gray-800"
              />
            ))}

            {/* Drag-create layer */}
            <DragCreateLayer
              day={currentDate}
              hourHeight={hourHeight}
              onCreateEvent={handleCreate}
            />

            {/* Events */}
            {events.map((event) => (
              <DraggableEventCard
                key={event.id}
                event={event}
                isSelected={selectedEventId === event.id}
                style={getEventStyle(event)}
                onEventClick={selectEvent}
                onResizeCommit={handleResizeCommit}
                hourHeight={hourHeight}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
