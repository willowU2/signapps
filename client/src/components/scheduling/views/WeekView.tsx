'use client';

/**
 * WeekView Component
 * Story 1.3.3: WeekView Component
 *
 * Full week calendar view with 7 day columns.
 * Optimized for desktop with responsive adaptations.
 * Supports drag & drop for moving and resizing TimeItems.
 */

import * as React from 'react';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  format,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCalendarStore } from '@/stores/scheduling/calendar-store';
import { useSchedulingStore } from '@/stores/scheduling/scheduling-store';
import { TimeGrid, useSlotClickHandler } from '../calendar/TimeGrid';
import { TimeItemBlock } from '../calendar/TimeItemBlock';
import { calculateItemPositions } from '@/lib/scheduling/utils/overlap-calculator';
import type { TimeItem, PositionedItem } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

interface WeekViewProps {
  className?: string;
  slotHeight?: number;
  items?: TimeItem[];
  onItemClick?: (item: TimeItem) => void;
  onItemDoubleClick?: (item: TimeItem) => void;
  onCreateItem?: (start: Date, end: Date) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function getItemDate(item: TimeItem): Date | null {
  if (!item.startTime) return null;
  return typeof item.startTime === 'string' ? parseISO(item.startTime) : item.startTime;
}

// ============================================================================
// Component
// ============================================================================

export function WeekView({
  className,
  slotHeight = 48,
  items: propItems,
  onItemClick,
  onItemDoubleClick,
  onCreateItem,
}: WeekViewProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const weekStartsOn = useCalendarStore((state) => state.weekStartsOn);
  const showWeekends = useCalendarStore((state) => state.showWeekends);
  const hourStart = useCalendarStore((state) => state.hourStart);
  const hourEnd = useCalendarStore((state) => state.hourEnd);
  const slotDuration = useCalendarStore((state) => state.slotDuration);
  const getDateRange = useCalendarStore((state) => state.getDateRange);

  // Get items from store if not provided
  const storeItems = useSchedulingStore((state) => state.timeItems);
  const isLoading = useSchedulingStore((state) => state.isLoading);
  const fetchTimeItems = useSchedulingStore((state) => state.fetchTimeItems);

  const items = propItems || storeItems;

  // Fetch items on mount (use currentDate as dependency to prevent infinite loops)
  const currentDateISO = currentDate.toISOString();
  React.useEffect(() => {
    if (!propItems) {
      const dateRange = getDateRange();
      fetchTimeItems(dateRange);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propItems, currentDateISO]);

  // Get days of the week
  const days = React.useMemo(() => {
    let allDays = eachDayOfInterval({
      start: startOfWeek(currentDate, { weekStartsOn }),
      end: endOfWeek(currentDate, { weekStartsOn }),
    });

    // Filter weekends if needed
    if (!showWeekends) {
      allDays = allDays.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
    }

    return allDays;
  }, [currentDate, weekStartsOn, showWeekends]);

  // Calculate positions for all items
  const positions = React.useMemo(() => {
    return calculateItemPositions(items, hourStart, hourEnd);
  }, [items, hourStart, hourEnd]);

  // Handle slot click
  const handleSlotClick = useSlotClickHandler({
    defaultDuration: slotDuration,
    onCreate: onCreateItem,
  });

  if (isLoading && items.length === 0) {
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
    <div className={cn('h-full', className)}>
      <TimeGrid
        items={items}
        positions={positions}
        slotHeight={slotHeight}
        onSlotClick={handleSlotClick}
        onItemClick={onItemClick}
        onItemDoubleClick={onItemDoubleClick}
      />
    </div>
  );
}

// ============================================================================
// Compact Week View (for mobile)
// ============================================================================

export function WeekViewCompact({
  className,
  items: propItems,
  onItemClick,
}: {
  className?: string;
  items?: TimeItem[];
  onItemClick?: (item: TimeItem) => void;
}) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const weekStartsOn = useCalendarStore((state) => state.weekStartsOn);
  const showWeekends = useCalendarStore((state) => state.showWeekends);

  // Get items from store if not provided
  const storeItems = useSchedulingStore((state) => state.timeItems);
  const items = propItems || storeItems;

  const dateRange = React.useMemo(
    () => ({
      start: startOfWeek(currentDate, { weekStartsOn }),
      end: endOfWeek(currentDate, { weekStartsOn }),
    }),
    [currentDate, weekStartsOn]
  );

  // Get days
  const days = React.useMemo(() => {
    let allDays = eachDayOfInterval(dateRange);
    if (!showWeekends) {
      allDays = allDays.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
    }
    return allDays;
  }, [dateRange, showWeekends]);

  return (
    <div className={cn('flex flex-col gap-2 p-2', className)}>
      {days.map((day) => {
        const dayItems = items.filter((item) => {
          const itemDate = getItemDate(item);
          return itemDate && isSameDay(itemDate, day);
        });

        return (
          <div key={day.toISOString()} className="rounded-lg border p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">
                {format(day, 'EEEE d', { locale: fr })}
              </span>
              <span className="text-xs text-muted-foreground">
                {dayItems.length} élément{dayItems.length !== 1 ? 's' : ''}
              </span>
            </div>

            {dayItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun élément</p>
            ) : (
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((item) => {
                  const startTime = getItemDate(item);
                  const endTime = item.endTime
                    ? typeof item.endTime === 'string'
                      ? parseISO(item.endTime)
                      : item.endTime
                    : null;

                  return (
                    <button
                      key={item.id}
                      onClick={() => onItemClick?.(item)}
                      className={cn(
                        'w-full text-left text-xs rounded px-2 py-1',
                        'hover:bg-accent transition-colors',
                        'border-l-2'
                      )}
                      style={{
                        borderLeftColor: item.color || 'hsl(var(--primary))',
                      }}
                    >
                      <div className="font-medium truncate">{item.title}</div>
                      <div className="text-muted-foreground">
                        {startTime && format(startTime, 'HH:mm', { locale: fr })}
                        {endTime && ` - ${format(endTime, 'HH:mm', { locale: fr })}`}
                      </div>
                    </button>
                  );
                })}
                {dayItems.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{dayItems.length - 3} autres
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
