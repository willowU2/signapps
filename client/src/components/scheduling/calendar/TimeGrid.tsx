'use client';

/**
 * TimeGrid Component
 * Story 1.3.1: TimeGrid Component
 *
 * Main calendar grid combining TimeGutter with multiple DayColumns.
 * Supports day, week, roster views with TimeItem rendering.
 */

import * as React from 'react';
import {
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  setHours,
  setMinutes,
  parseISO,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useCalendarStore } from '@/stores/scheduling/calendar-store';
import { usePreferencesStore } from '@/stores/scheduling/preferences-store';
import { TimeGutter, TimeGutterCompact } from './TimeGutter';
import { DayColumn, DayHeader } from './DayColumn';
import { AllDayItemBlock } from './TimeItemBlock';
import type { TimeItem, ViewType, PositionedItem } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

interface TimeGridProps {
  items: TimeItem[];
  positions?: PositionedItem[];
  className?: string;
  slotHeight?: number;
  onSlotClick?: (date: Date, hour: number, minute: number) => void;
  onItemClick?: (item: TimeItem) => void;
  onItemDoubleClick?: (item: TimeItem) => void;
  renderItem?: (item: TimeItem, position: PositionedItem) => React.ReactNode;
}

// ============================================================================
// Helpers
// ============================================================================

function getDaysForView(date: Date, view: ViewType, weekStartsOn: 0 | 1): Date[] {
  switch (view) {
    case 'day':
    case 'focus':
      return [date];

    case 'week':
    case 'roster':
      return eachDayOfInterval({
        start: startOfWeek(date, { weekStartsOn }),
        end: endOfWeek(date, { weekStartsOn }),
      });

    default:
      return [date];
  }
}

function getItemDate(item: TimeItem): Date | null {
  if (!item.startTime) return null;
  return typeof item.startTime === 'string' ? parseISO(item.startTime) : item.startTime;
}

// ============================================================================
// AllDayRow Component
// ============================================================================

function AllDayRow({
  days,
  items,
  onItemClick,
}: {
  days: Date[];
  items: TimeItem[];
  onItemClick?: (item: TimeItem) => void;
}) {
  // Filter all-day items
  const allDayItems = items.filter((item) => item.allDay);

  if (allDayItems.length === 0) return null;

  return (
    <div className="flex border-b">
      {/* Gutter spacer */}
      <div className="w-16 shrink-0 border-r bg-muted/30 p-1">
        <span className="text-xs text-muted-foreground">Journée</span>
      </div>

      {/* All-day items for each day */}
      <div className="flex flex-1">
        {days.map((day) => {
          const dayItems = allDayItems.filter((item) => {
            const itemDate = getItemDate(item);
            return itemDate && isSameDay(itemDate, day);
          });

          return (
            <div
              key={day.toISOString()}
              className="flex-1 border-r last:border-r-0 p-1 min-h-[32px] space-y-0.5"
            >
              {dayItems.map((item) => (
                <AllDayItemBlock
                  key={item.id}
                  item={item}
                  onClick={onItemClick}
                />
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
  items,
  positions = [],
  className,
  slotHeight = 48,
  onSlotClick,
  onItemClick,
  onItemDoubleClick,
  renderItem,
}: TimeGridProps) {
  const view = useCalendarStore((state) => state.view);
  const currentDate = useCalendarStore((state) => state.currentDate);
  const hourStart = useCalendarStore((state) => state.hourStart);
  const hourEnd = useCalendarStore((state) => state.hourEnd);
  const slotDuration = useCalendarStore((state) => state.slotDuration);
  const currentIndicatorPosition = useCurrentTimeIndicator(hourStart, hourEnd, slotHeight, slotDuration);
  const weekStartsOn = useCalendarStore((state) => state.weekStartsOn);
  const showWeekends = useCalendarStore((state) => state.showWeekends);
  const compactMode = useCalendarStore((state) => state.compactMode);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Get days to display based on view
  const days = React.useMemo(() => {
    let allDays = getDaysForView(currentDate, view, weekStartsOn);

    // Filter weekends if needed
    if (!showWeekends) {
      allDays = allDays.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
    }

    return allDays;
  }, [currentDate, view, weekStartsOn, showWeekends]);

  // Filter items for visible days
  const visibleItems = React.useMemo(() => {
    return items.filter((item) => {
      const itemDate = getItemDate(item);
      return itemDate && days.some((day) => isSameDay(itemDate, day));
    });
  }, [items, days]);

  // Scroll to current time on mount
  React.useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();

      // Calculate scroll position to center current time
      const slotsPerHour = 60 / slotDuration;
      const slotIndex = (currentHour - hourStart) * slotsPerHour;
      const scrollTop = slotIndex * slotHeight - 100; // 100px offset for context

      scrollRef.current.scrollTop = Math.max(0, scrollTop);
    }
  }, [slotHeight, slotDuration, hourStart]);

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

      {/* All-Day Items Row */}
      <AllDayRow
        days={days}
        items={visibleItems}
        onItemClick={onItemClick}
      />

      {/* Scrollable Grid */}
      <div ref={scrollRef} className="flex flex-1 overflow-auto">
        {/* Time Gutter */}
        <div className="sticky left-0 z-10 w-16 shrink-0 border-r bg-background">
          {compactMode ? (
            <TimeGutterCompact slotHeight={slotHeight} />
          ) : (
            <TimeGutter slotHeight={slotHeight} />
          )}
        </div>

        {/* Day Columns */}
        <div className="relative flex flex-1">
          {days.some((d) => isToday(d)) && currentIndicatorPosition !== null && currentIndicatorPosition >= 0 && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: currentIndicatorPosition }}
            >
              <div className="relative flex items-center">
                <div className="h-3 w-3 rounded-full bg-red-500 -ml-1.5" />
                <div className="flex-1 h-0.5 bg-red-500" />
              </div>
            </div>
          )}
          {days.map((day) => (
            <DayColumn
              key={day.toISOString()}
              date={day}
              items={visibleItems}
              positions={positions}
              slotHeight={slotHeight}
              onSlotClick={onSlotClick}
              onItemClick={onItemClick}
              onItemDoubleClick={onItemDoubleClick}
              renderItem={renderItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Hook for creating new item from slot click
// ============================================================================

export function useSlotClickHandler(options?: {
  defaultDuration?: number;
  onCreate?: (start: Date, end: Date) => void;
}) {
  const defaultDuration = options?.defaultDuration ?? 60;

  return React.useCallback(
    (date: Date, hour: number, minute: number) => {
      const start = setMinutes(setHours(date, hour), minute);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + defaultDuration);

      options?.onCreate?.(start, end);
    },
    [defaultDuration, options]
  );
}

// ============================================================================
// Current Time Indicator Hook
// ============================================================================

export function useCurrentTimeIndicator(
  hourStart: number,
  hourEnd: number,
  slotHeight: number,
  slotDuration: number
) {
  const [position, setPosition] = React.useState<number | null>(null);

  React.useEffect(() => {
    const updatePosition = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      if (currentHour < hourStart || currentHour >= hourEnd) {
        setPosition(null);
        return;
      }

      const minutesFromStart = (currentHour - hourStart) * 60 + currentMinute;
      const pixelsPerMinute = slotHeight / slotDuration;
      setPosition(minutesFromStart * pixelsPerMinute);
    };

    updatePosition();
    const interval = setInterval(updatePosition, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [hourStart, hourEnd, slotHeight, slotDuration]);

  return position;
}

export default TimeGrid;
