'use client';

/**
 * TimeGrid Component
 *
 * Main calendar grid combining TimeGutter with multiple DayColumns.
 * Supports day, 3-day, and week views.
 */

import * as React from 'react';
import {
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  setHours,
  setMinutes,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useSchedulingUI, useSchedulingNavigation } from '@/stores/scheduling-store';
import { TimeGutter, TimeGutterCompact } from './TimeGutter';
import { DayColumn, DayHeader } from './DayColumn';
import type { ScheduleBlock, EventLayout, ViewType } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface TimeGridProps {
  events: ScheduleBlock[];
  layouts?: EventLayout[];
  className?: string;
  slotHeight?: number;
  onSlotClick?: (date: Date, hour: number, minute: number) => void;
  onEventClick?: (event: ScheduleBlock) => void;
  renderEvent?: (layout: EventLayout) => React.ReactNode;
}

// ============================================================================
// Helpers
// ============================================================================

function getDaysForView(date: Date, view: ViewType, firstDayOfWeek: 0 | 1 | 6): Date[] {
  switch (view) {
    case 'day':
      return [date];

    case '3-day':
      return [date, addDays(date, 1), addDays(date, 2)];

    case 'week':
      return eachDayOfInterval({
        start: startOfWeek(date, { weekStartsOn: firstDayOfWeek }),
        end: endOfWeek(date, { weekStartsOn: firstDayOfWeek }),
      });

    default:
      return [date];
  }
}

// ============================================================================
// AllDayRow Component
// ============================================================================

function AllDayRow({
  days,
  events,
  onEventClick,
}: {
  days: Date[];
  events: ScheduleBlock[];
  onEventClick?: (event: ScheduleBlock) => void;
}) {
  // Filter all-day events
  const allDayEvents = events.filter((e) => e.allDay);

  if (allDayEvents.length === 0) return null;

  return (
    <div className="flex border-b">
      {/* Gutter spacer */}
      <div className="w-16 shrink-0 border-r bg-muted/30 p-1">
        <span className="text-xs text-muted-foreground">Journée</span>
      </div>

      {/* All-day events for each day */}
      <div className="flex flex-1">
        {days.map((day) => {
          const dayEvents = allDayEvents.filter((e) => isSameDay(e.start, day));

          return (
            <div
              key={day.toISOString()}
              className="flex-1 border-r last:border-r-0 p-1 min-h-[32px]"
            >
              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => onEventClick?.(event)}
                  className={cn(
                    'w-full text-left text-xs px-2 py-0.5 rounded truncate',
                    'hover:opacity-80 transition-opacity'
                  )}
                  style={{
                    backgroundColor: event.color || 'hsl(var(--primary))',
                    color: 'white',
                  }}
                >
                  {event.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TimeGrid({
  events,
  layouts = [],
  className,
  slotHeight = 48,
  onSlotClick,
  onEventClick,
  renderEvent,
}: TimeGridProps) {
  const { viewConfig, filters } = useSchedulingUI();
  const { activeView, currentDate } = useSchedulingNavigation();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Get days to display based on view
  const days = React.useMemo(() => {
    let allDays = getDaysForView(currentDate, activeView, viewConfig.firstDayOfWeek);

    // Filter weekends if needed
    if (!filters.showWeekends) {
      allDays = allDays.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
    }

    return allDays;
  }, [currentDate, activeView, viewConfig.firstDayOfWeek, filters.showWeekends]);

  // Filter events for visible days
  const visibleEvents = React.useMemo(() => {
    return events.filter((event) =>
      days.some((day) => isSameDay(event.start, day))
    );
  }, [events, days]);

  // Scroll to current time on mount
  React.useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();

      // Calculate scroll position to center current time
      const slotsPerHour = 60 / viewConfig.slotDuration;
      const slotIndex = (currentHour - viewConfig.workingHoursStart) * slotsPerHour;
      const scrollTop = slotIndex * slotHeight - 100; // 100px offset for context

      scrollRef.current.scrollTop = Math.max(0, scrollTop);
    }
  }, [slotHeight, viewConfig.slotDuration, viewConfig.workingHoursStart]);

  // Calculate total height
  const totalSlots =
    ((viewConfig.workingHoursEnd - viewConfig.workingHoursStart + 1) * 60) /
    viewConfig.slotDuration;

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header Row */}
      <div className="flex shrink-0 border-b">
        {/* Gutter spacer */}
        <div className="w-16 shrink-0 border-r" />

        {/* Day Headers */}
        <div className="flex flex-1">
          {days.map((day) => (
            <DayHeader
              key={day.toISOString()}
              date={day}
              compact={days.length > 3}
              className="flex-1 border-r last:border-r-0"
            />
          ))}
        </div>
      </div>

      {/* All-Day Events Row */}
      {filters.showAllDay && (
        <AllDayRow
          days={days}
          events={visibleEvents}
          onEventClick={onEventClick}
        />
      )}

      {/* Scrollable Grid */}
      <div ref={scrollRef} className="flex flex-1 overflow-auto">
        {/* Time Gutter */}
        <div className="sticky left-0 z-10 w-16 shrink-0 border-r bg-background">
          {viewConfig.compactMode ? (
            <TimeGutterCompact slotHeight={slotHeight} />
          ) : (
            <TimeGutter slotHeight={slotHeight} />
          )}
        </div>

        {/* Day Columns */}
        <div className="flex flex-1">
          {days.map((day) => (
            <DayColumn
              key={day.toISOString()}
              date={day}
              events={visibleEvents}
              layouts={layouts}
              slotHeight={slotHeight}
              onSlotClick={onSlotClick}
              onEventClick={onEventClick}
              renderEvent={renderEvent}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Hook for creating new event from slot click
// ============================================================================

export function useSlotClickHandler(options?: {
  defaultDuration?: number;
  onCreate?: (start: Date, end: Date) => void;
}) {
  const defaultDuration = options?.defaultDuration ?? 60;

  return React.useCallback(
    (date: Date, hour: number, minute: number) => {
      const start = setMinutes(setHours(date, hour), minute);
      const end = addDays(start, 0); // Clone date
      end.setMinutes(end.getMinutes() + defaultDuration);

      options?.onCreate?.(start, end);
    },
    [defaultDuration, options]
  );
}

export default TimeGrid;
