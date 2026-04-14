"use client";

import React, { useEffect, useMemo, useRef, useCallback } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  addDays,
  getHours,
  getMinutes,
  differenceInMinutes,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import {
  useCalendarStore,
  useCalendarSelection,
  useCalendarTimezones,
} from "@/stores/calendar-store";
import { useEvents } from "@/hooks/use-events";
import { Event } from "@/types/calendar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DragCreateLayer,
  useDragCreate,
  DragSelection,
} from "./drag-create-event";
import { MultiDayEventBars, isMultiDay } from "./multi-day-events";
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
      data-testid="calendar-event"
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(event.id);
      }}
      className={`absolute left-0.5 right-0.5 rounded px-2 py-1 text-xs cursor-pointer border overflow-hidden select-none ${
        isDragging
          ? "opacity-50 z-30"
          : isSelected
            ? "bg-blue-600 text-white z-20 shadow-lg"
            : "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-100 hover:bg-blue-200 z-10"
      }`}
      style={style}
    >
      <div className="font-semibold truncate">{event.title}</div>
      <div className="truncate text-[10px] opacity-80">
        {format(new Date(event.start_time), "H:mm")}
        {" – "}
        {format(new Date(event.end_time), "H:mm")}
      </div>
      {/* Resize handle — drag bottom edge to extend duration */}
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
// Droppable day column — highlights when an event is dragged over it so the
// user gets visual feedback. The drop data (`type: "calendar-slot"`, `date`)
// is picked up by CalendarHub.handleDragEnd to reschedule the event.
// ────────────────────────────────────────────────────────────────────────────

function DroppableDayColumn({
  date,
  children,
  className,
  hourHeight,
}: {
  date: Date;
  children: React.ReactNode;
  className?: string;
  hourHeight?: number;
}) {
  const dateStr = format(date, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${dateStr}`,
    data: { type: "calendar-slot", date: dateStr },
  });
  return (
    <div
      ref={setNodeRef}
      data-testid={`day-column-${dateStr}`}
      data-hour-height={hourHeight}
      className={cn(className, isOver && "bg-primary/5")}
    >
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// WeekCalendar
// ────────────────────────────────────────────────────────────────────────────

interface WeekCalendarProps {
  selectedCalendarId?: string;
  onCreateEvent?: (startTime?: Date, endTime?: Date) => void;
}

export function WeekCalendar({
  selectedCalendarId,
  onCreateEvent,
}: WeekCalendarProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate);
  const { selectedEventId, selectEvent } = useCalendarSelection();
  const timezones = useCalendarTimezones();

  const { events, fetchEvents, updateEvent } = useEvents(selectedCalendarId);
  const { handleResizeCommit } = useEventResize(
    useCallback(
      async (id: string, data: { start_time?: string; end_time: string }) => {
        return updateEvent(id, data);
      },
      [updateEvent],
    ),
  );

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const hourHeight = 60; // px per hour

  // Fetch events for current week — expand range by ±1 day so events that fall
  // near midnight don't disappear due to timezone shifts between the user's
  // local time and UTC-stored event timestamps.
  useEffect(() => {
    if (!selectedCalendarId) return;
    const fetchStart = new Date(weekStart);
    fetchStart.setDate(fetchStart.getDate() - 1);
    const fetchEnd = new Date(weekEnd);
    fetchEnd.setDate(fetchEnd.getDate() + 1);
    fetchEvents(fetchStart, fetchEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCalendarId, currentDate, fetchEvents]);

  const weekDays = useMemo(() => {
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [weekStart, weekEnd]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Separate multi-day events from timed events
  const singleDayEvents = useMemo(
    () => events.filter((e) => !isMultiDay(e)),
    [events],
  );

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
    setCurrentDate(addDays(currentDate, -7));
  };

  const handleNextWeek = () => {
    setCurrentDate(addDays(currentDate, 7));
  };

  // Drag-create handler: converts DragSelection to Date pair → opens EventForm
  const { handleCreate } = useDragCreate(
    useCallback(
      (startTime: Date, endTime: Date) => {
        onCreateEvent?.(startTime, endTime);
      },
      [onCreateEvent],
    ),
  );

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <h2 className="text-base font-semibold">
          {format(weekStart, "d MMM", { locale: fr })} –{" "}
          {format(weekEnd, "d MMM yyyy", { locale: fr })}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Aujourd'hui
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid Header */}
      <div className="flex flex-col border-b shrink-0">
        <div className="flex">
          {/* Timezone Headers */}
          <div className="flex min-w-max border-r bg-muted/50">
            {timezones.map((tz, i) => (
              <div
                key={tz}
                className={`w-16 text-center py-2 text-xs font-medium text-muted-foreground ${i > 0 ? "border-l" : ""}`}
              >
                <span className="truncate block px-1" title={tz}>
                  {tz.split("/").pop()?.replace("_", " ") || tz}
                </span>
              </div>
            ))}
          </div>
          {/* Days Headers */}
          {weekDays.map((day) => (
            <div
              key={day.toString()}
              className={`flex-1 text-center py-2 border-r font-semibold min-w-[100px] ${
                isToday(day) ? "text-blue-600" : ""
              }`}
            >
              <div className="text-xs text-muted-foreground">
                {format(day, "EEE")}
              </div>
              <div
                className={`text-lg mx-auto w-8 h-8 flex items-center justify-center rounded-full ${
                  isToday(day) ? "bg-blue-600 text-white" : ""
                }`}
              >
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>
        {/* Multi-day events bar */}
        {events.some(isMultiDay) && (
          <div className="flex border-t border-dashed border-border bg-muted/20">
            <div
              className="flex min-w-max border-r"
              style={{ minWidth: `${timezones.length * 64}px` }}
            />
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
        <div className="flex min-h-[1440px]">
          {/* Time Axes */}
          <div className="flex min-w-max border-r bg-muted/30">
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

          {/* Days Columns */}
          {weekDays.map((day) => (
            <DroppableDayColumn
              key={day.toString()}
              date={day}
              hourHeight={hourHeight}
              className="border-r relative h-[1440px] flex-1 min-w-[100px]"
            >
              {/* Hour lines */}
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-[60px] border-b border-dashed border-gray-100 dark:border-gray-800"
                />
              ))}

              {/* Drag-create layer — click+drag to create new event */}
              <DragCreateLayer
                day={day}
                hourHeight={hourHeight}
                onCreateEvent={handleCreate}
              />

              {/* Events */}
              {eventsByDay.get(day.toDateString())?.map((event) => (
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
            </DroppableDayColumn>
          ))}
        </div>
      </div>
    </div>
  );
}
