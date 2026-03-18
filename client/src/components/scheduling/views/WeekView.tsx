'use client';

/**
 * WeekView Component
 *
 * Full week calendar view with 7 day columns.
 * Optimized for desktop with responsive adaptations.
 * Supports drag & drop for moving and resizing events.
 */

import * as React from 'react';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  format,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSchedulingNavigation, useSchedulingUI } from '@/stores/scheduling-store';
import { useEvents, useMoveEvent } from '@/lib/scheduling/api/calendar';
import { TimeGrid, useSlotClickHandler } from '../calendar/TimeGrid';
import { DraggableEventBlock } from '../calendar/DraggableEventBlock';
import {
  calculateMultiDayLayouts,
  getAllDayEvents,
} from '@/lib/scheduling/utils/event-layout';
import { useEventDrag, useDragPreview } from '@/lib/scheduling/hooks/use-event-drag';
import type { ScheduleBlock, EventLayout } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface WeekViewProps {
  className?: string;
  slotHeight?: number;
  onEventClick?: (event: ScheduleBlock) => void;
  onCreateEvent?: (start: Date, end: Date) => void;
}

// ============================================================================
// Component
// ============================================================================

export function WeekView({
  className,
  slotHeight = 48,
  onEventClick,
  onCreateEvent,
}: WeekViewProps) {
  const { currentDate, getDateRange } = useSchedulingNavigation();
  const { viewConfig, filters } = useSchedulingUI();
  const dateRange = getDateRange();

  // Fetch events
  const { data: events = [], isLoading } = useEvents({
    start: dateRange.start,
    end: dateRange.end,
  });

  // Move event mutation
  const moveEvent = useMoveEvent();

  // Drag & Drop
  const { dragState, containerRef, handlers } = useEventDrag({
    slotHeight,
    slotDuration: viewConfig.slotDuration,
    workingHoursStart: viewConfig.workingHoursStart,
    workingHoursEnd: viewConfig.workingHoursEnd,
    onEventMove: (eventId, start, end) => {
      moveEvent.mutate({ eventId, start, end });
    },
  });

  // Drag preview
  const dragPreview = useDragPreview(
    dragState,
    slotHeight,
    viewConfig.slotDuration,
    viewConfig.workingHoursStart
  );

  // Get days of the week
  const days = React.useMemo(() => {
    let allDays = eachDayOfInterval({
      start: startOfWeek(currentDate, { weekStartsOn: viewConfig.firstDayOfWeek }),
      end: endOfWeek(currentDate, { weekStartsOn: viewConfig.firstDayOfWeek }),
    });

    // Filter weekends if needed
    if (!filters.showWeekends) {
      allDays = allDays.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
    }

    return allDays;
  }, [currentDate, viewConfig.firstDayOfWeek, filters.showWeekends]);

  // Calculate layouts for all days
  const layoutsByDay = React.useMemo(() => {
    return calculateMultiDayLayouts(events, days, {
      viewConfig,
      slotHeight,
    });
  }, [events, days, viewConfig, slotHeight]);

  // Get all-day events
  const allDayEvents = React.useMemo(() => {
    return getAllDayEvents(events, days);
  }, [events, days]);

  // Handle slot click
  const handleSlotClick = useSlotClickHandler({
    defaultDuration: viewConfig.slotDuration,
    onCreate: onCreateEvent,
  });

  // Render event with drag support
  const renderEvent = React.useCallback(
    (layout: EventLayout) => {
      const isDraggingThis =
        dragState.isDragging && dragState.eventId === layout.block.id;

      return (
        <DraggableEventBlock
          key={layout.block.id}
          layout={layout}
          dragState={dragState}
          previewLayout={isDraggingThis ? dragPreview : null}
          onClick={onEventClick}
          onDragStart={handlers.onDragStart}
        />
      );
    },
    [onEventClick, dragState, dragPreview, handlers.onDragStart]
  );

  if (isLoading) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('h-full', className)}>
      <TimeGrid
        events={events}
        slotHeight={slotHeight}
        onSlotClick={handleSlotClick}
        onEventClick={onEventClick}
        renderEvent={renderEvent}
      />
    </div>
  );
}

// ============================================================================
// Compact Week View (for mobile)
// ============================================================================

export function WeekViewCompact({
  className,
  onEventClick,
}: {
  className?: string;
  onEventClick?: (event: ScheduleBlock) => void;
}) {
  const { currentDate } = useSchedulingNavigation();
  const { viewConfig, filters } = useSchedulingUI();
  const dateRange = React.useMemo(
    () => ({
      start: startOfWeek(currentDate, { weekStartsOn: viewConfig.firstDayOfWeek }),
      end: endOfWeek(currentDate, { weekStartsOn: viewConfig.firstDayOfWeek }),
    }),
    [currentDate, viewConfig.firstDayOfWeek]
  );

  const { data: events = [] } = useEvents(dateRange);

  // Get days
  const days = React.useMemo(() => {
    let allDays = eachDayOfInterval(dateRange);
    if (!filters.showWeekends) {
      allDays = allDays.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
    }
    return allDays;
  }, [dateRange, filters.showWeekends]);

  return (
    <div className={cn('flex flex-col gap-2 p-2', className)}>
      {days.map((day) => {
        const dayEvents = events.filter((e) => isSameDay(e.start, day));

        return (
          <div key={day.toISOString()} className="rounded-lg border p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">
                {format(day, 'EEEE d', { locale: fr })}
              </span>
              <span className="text-xs text-muted-foreground">
                {dayEvents.length} événement{dayEvents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {dayEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun événement</p>
            ) : (
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onEventClick?.(event)}
                    className={cn(
                      'w-full text-left text-xs rounded px-2 py-1',
                      'hover:bg-accent transition-colors',
                      'border-l-2'
                    )}
                    style={{
                      borderLeftColor: event.color || 'hsl(var(--primary))',
                    }}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="text-muted-foreground">
                      {format(event.start, 'HH:mm', { locale: fr })}
                      {event.end && ` - ${format(event.end, 'HH:mm', { locale: fr })}`}
                    </div>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{dayEvents.length - 3} autres
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default WeekView;
