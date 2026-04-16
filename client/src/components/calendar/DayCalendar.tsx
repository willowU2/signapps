"use client";

import React, { useEffect, useCallback, useRef, useState } from "react";
import {
  format,
  startOfDay,
  endOfDay,
  getHours,
  getMinutes,
  differenceInMinutes,
  isToday,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DragCreateLayer, useDragCreate } from "./drag-create-event";
import { ResizeHandle, useEventResize } from "./resize-event";

// ────────────────────────────────────────────────────────────────────────────
// NowLine — red horizontal line at the current time
// ────────────────────────────────────────────────────────────────────────────

function NowLine({ hourHeight }: { hourHeight: number }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const top = (minutes / 60) * hourHeight;
  return (
    <div
      data-testid="calendar-now-line"
      className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
      style={{ top }}
    >
      <div className="h-2 w-2 rounded-full bg-red-500 -ml-1" />
      <div className="flex-1 h-px bg-red-500" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Draggable event card
// ────────────────────────────────────────────────────────────────────────────

interface DraggableEventCardProps {
  event: Event;
  isSelected: boolean;
  style: React.CSSProperties;
  onEventClick: (id: string) => void;
  onResizeCommit: (result: {
    event: Event;
    newStartTime?: Date;
    newEndTime?: Date;
  }) => void;
  hourHeight: number;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
}

function DraggableEventCard({
  event,
  isSelected,
  style,
  onEventClick,
  onResizeCommit,
  hourHeight,
  onEdit,
  onDuplicate,
  onDelete,
  onShare,
}: DraggableEventCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { event },
  });

  const start = new Date(event.start_time);
  const end = new Date(event.end_time);

  const card = (
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
      onDoubleClick={(e) => {
        e.stopPropagation();
        (onEdit ?? onEventClick)(event.id);
      }}
      className={cn(
        "absolute left-2 right-2 rounded px-3 py-2 text-sm border overflow-hidden select-none transition-shadow",
        isDragging
          ? "opacity-50 z-30 cursor-grabbing"
          : isSelected
            ? "bg-blue-600 text-white z-20 shadow-lg cursor-grab active:cursor-grabbing"
            : "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-100 hover:bg-blue-200 hover:shadow-sm z-10 cursor-grab active:cursor-grabbing",
      )}
      style={style}
    >
      {/* Top resize handle — change start time */}
      <ResizeHandle
        event={event}
        hourHeight={hourHeight}
        onResizeCommit={onResizeCommit}
        containerRef={containerRef as React.RefObject<HTMLElement>}
        edge="top"
      />
      <div className="font-semibold">{event.title}</div>
      <div className="text-xs opacity-80">
        {format(start, "H:mm")} – {format(end, "H:mm")}
      </div>
      {event.description && (
        <div className="text-xs mt-1 line-clamp-2 opacity-70">
          {event.description}
        </div>
      )}
      {/* Bottom resize handle */}
      <ResizeHandle
        event={event}
        hourHeight={hourHeight}
        onResizeCommit={onResizeCommit}
        containerRef={containerRef as React.RefObject<HTMLElement>}
        edge="bottom"
      />
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>{card}</TooltipTrigger>
          <TooltipContent side="top" align="start" className="max-w-xs">
            <div className="font-semibold">{event.title}</div>
            <div className="text-[11px] opacity-80">
              {format(start, "EEEE d MMM", { locale: fr })} ·{" "}
              {format(start, "HH:mm")} → {format(end, "HH:mm")}
            </div>
            {event.location && (
              <div className="text-[11px] mt-1 opacity-80">
                {event.location}
              </div>
            )}
            {event.description && (
              <div className="text-[11px] mt-1 opacity-80 line-clamp-3">
                {event.description}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => (onEdit ?? onEventClick)(event.id)}>
          Modifier
        </ContextMenuItem>
        {onDuplicate && (
          <ContextMenuItem onClick={() => onDuplicate(event.id)}>
            Dupliquer
          </ContextMenuItem>
        )}
        {onShare && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onShare(event.id)}>
              Partager
            </ContextMenuItem>
          </>
        )}
        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive"
              onClick={() => onDelete(event.id)}
            >
              Supprimer
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Droppable day column — receives drags from other views and highlights when
// an event is dragged over it. Drop data is consumed by CalendarHub's
// handleDragEnd to reschedule the event to the new day (time-of-day preserved).
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
  const todayBg = isToday(date) ? "bg-primary/5" : "";
  return (
    <div
      ref={setNodeRef}
      data-testid={`day-column-${dateStr}`}
      data-hour-height={hourHeight}
      className={cn(className, todayBg, isOver && "bg-primary/10")}
    >
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// DayCalendar
// ────────────────────────────────────────────────────────────────────────────

interface DayCalendarProps {
  selectedCalendarId?: string;
  onCreateEvent?: (startTime?: Date, endTime?: Date) => void;
  onEditEvent?: (id: string) => void;
  onDeleteEvent?: (id: string) => void;
  onDuplicateEvent?: (id: string) => void;
  onShareEvent?: (id: string) => void;
}

export function DayCalendar({
  selectedCalendarId,
  onCreateEvent,
  onEditEvent,
  onDeleteEvent,
  onDuplicateEvent,
  onShareEvent,
}: DayCalendarProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate);
  const { selectedEventId, selectEvent } = useCalendarSelection();
  const timezones = useCalendarTimezones();
  const { events, fetchEvents, updateEvent } = useEvents(selectedCalendarId);
  const hourHeight = 60;

  const handlePrevDay = useCallback(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  }, [currentDate, setCurrentDate]);

  const handleNextDay = useCallback(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  }, [currentDate, setCurrentDate]);

  const { handleResizeCommit } = useEventResize(
    useCallback(
      async (id: string, data: { start_time?: string; end_time?: string }) => {
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
    <TooltipProvider delayDuration={350}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
          <h2 className="text-base font-semibold">
            {isToday(currentDate)
              ? "Aujourd'hui"
              : format(currentDate, "EEEE d MMMM yyyy", { locale: fr })}
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevDay}
              aria-label="Précédent"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Aujourd'hui
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextDay}
              aria-label="Suivant"
            >
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
            className={cn(
              "flex-1 text-center py-2 border-r font-semibold min-w-[100px]",
              isToday(currentDate) && "text-blue-600 bg-primary/5",
            )}
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
            <DroppableDayColumn
              date={currentDate}
              hourHeight={hourHeight}
              className="flex-1 relative h-[1440px] border-r"
            >
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

              {/* Now line — only when viewing today */}
              {isToday(currentDate) && <NowLine hourHeight={hourHeight} />}

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
                  onEdit={onEditEvent}
                  onDuplicate={onDuplicateEvent}
                  onDelete={onDeleteEvent}
                  onShare={onShareEvent}
                />
              ))}
            </DroppableDayColumn>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
