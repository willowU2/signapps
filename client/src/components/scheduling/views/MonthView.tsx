'use client';
import { SpinnerInfinity } from 'spinners-react';


/**
 * MonthView Component
 * Story 1.3.5: MonthView Component
 *
 * Full month calendar grid with TimeItem indicators.
 * Shows compact item previews in each day cell.
 */

import * as React from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  addMonths,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCalendarStore } from '@/stores/scheduling/calendar-store';
import { useSchedulingStore } from '@/stores/scheduling/scheduling-store';
import type { TimeItem } from '@/lib/scheduling/types';

// ============================================================================
// Types
// ============================================================================

interface MonthViewProps {
  className?: string;
  maxItemsPerDay?: number;
  items?: TimeItem[];
  onItemClick?: (item: TimeItem) => void;
  onDayClick?: (date: Date) => void;
  onCreateItem?: (date: Date) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function getItemDate(item: TimeItem): Date | null {
  if (!item.startTime) return null;
  return typeof item.startTime === 'string' ? parseISO(item.startTime) : item.startTime;
}

// ============================================================================
// Day Cell Component
// ============================================================================

function DayCell({
  date,
  isCurrentMonth,
  items,
  maxItems,
  onItemClick,
  onDayClick,
  onCreateItem,
}: {
  date: Date;
  isCurrentMonth: boolean;
  items: TimeItem[];
  maxItems: number;
  onItemClick?: (item: TimeItem) => void;
  onDayClick?: (date: Date) => void;
  onCreateItem?: (date: Date) => void;
}) {
  const today = isToday(date);
  const visibleItems = items.slice(0, maxItems);
  const hiddenCount = items.length - maxItems;

  return (
    <div
      className={cn(
        'min-h-[100px] border-b border-r p-1 transition-colors group',
        'hover:bg-accent/30 cursor-pointer',
        !isCurrentMonth && 'bg-muted/30 text-muted-foreground'
      )}
      onClick={() => onDayClick?.(date)}
    >
      {/* Day Number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center text-sm font-medium',
            today &&
              'rounded-full bg-primary text-primary-foreground'
          )}
        >
          {format(date, 'd')}
        </span>
        {onCreateItem && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onCreateItem(date);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Items */}
      <div className="space-y-0.5">
        {visibleItems.map((item) => {
          const startTime = getItemDate(item);

          return (
            <button
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                onItemClick?.(item);
              }}
              className={cn(
                'w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate',
                'hover:opacity-80 transition-opacity',
                item.allDay ? 'text-white' : 'border-l-2'
              )}
              style={{
                backgroundColor: item.allDay
                  ? item.color || 'hsl(var(--primary))'
                  : `${item.color || 'hsl(var(--primary))'}10`,
                borderLeftColor: !item.allDay
                  ? item.color || 'hsl(var(--primary))'
                  : undefined,
              }}
            >
              {!item.allDay && startTime && (
                <span className="text-muted-foreground mr-1">
                  {format(startTime, 'HH:mm', { locale: fr })}
                </span>
              )}
              <span className={item.allDay ? '' : 'font-medium'}>{item.title}</span>
            </button>
          );
        })}

        {hiddenCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDayClick?.(date);
            }}
            className="w-full text-left text-[11px] px-1.5 py-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            +{hiddenCount} autres
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MonthView({
  className,
  maxItemsPerDay = 3,
  items: propItems,
  onItemClick,
  onDayClick,
  onCreateItem,
}: MonthViewProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const weekStartsOn = useCalendarStore((state) => state.weekStartsOn);
  const showWeekends = useCalendarStore((state) => state.showWeekends);

  // Get items from store if not provided
  const storeItems = useSchedulingStore((state) => state.timeItems);
  const isLoading = useSchedulingStore((state) => state.isLoading);
  const fetchTimeItems = useSchedulingStore((state) => state.fetchTimeItems);

  const items = propItems || storeItems;

  // Calculate month boundaries with padding for week display (memoized to prevent infinite loops)
  const { calendarStart, calendarEnd } = React.useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    return {
      calendarStart: startOfWeek(monthStart, { weekStartsOn }),
      calendarEnd: endOfWeek(monthEnd, { weekStartsOn }),
    };
  }, [currentDate, weekStartsOn]);

  // Fetch items on mount and when date range changes
  const calendarStartISO = calendarStart.toISOString();
  const calendarEndISO = calendarEnd.toISOString();

  React.useEffect(() => {
    if (!propItems) {
      fetchTimeItems({ start: calendarStart, end: calendarEnd });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propItems, calendarStartISO, calendarEndISO]);

  // Generate all days to display
  const days = React.useMemo(() => {
    let allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // Optionally filter weekends
    if (!showWeekends) {
      allDays = allDays.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
    }

    return allDays;
  }, [calendarStart, calendarEnd, showWeekends]);

  // Group items by day
  const itemsByDay = React.useMemo(() => {
    const grouped = new Map<string, TimeItem[]>();

    for (const day of days) {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayItems = items.filter((item) => {
        const itemDate = getItemDate(item);
        return itemDate && isSameDay(itemDate, day);
      });
      // Sort: all-day items first, then by start time
      dayItems.sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        const aDate = getItemDate(a);
        const bDate = getItemDate(b);
        if (!aDate || !bDate) return 0;
        return aDate.getTime() - bDate.getTime();
      });
      grouped.set(dayKey, dayItems);
    }

    return grouped;
  }, [days, items]);

  // Week day headers
  const weekDays = React.useMemo(() => {
    const firstWeek = days.slice(0, showWeekends ? 7 : 5);
    return firstWeek.map((day) => format(day, 'EEE', { locale: fr }));
  }, [days, showWeekends]);

  // Number of columns
  const columns = showWeekends ? 7 : 5;

  if (isLoading && items.length === 0) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="flex flex-col items-center gap-2">
          <SpinnerInfinity size={32} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Week Day Headers */}
      <div
        className="grid border-b bg-muted/30"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {weekDays.map((day, index) => (
          <div
            key={index}
            className="py-2 text-center text-sm font-medium text-muted-foreground capitalize border-r last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div
        className="grid flex-1"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {days.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayItems = itemsByDay.get(dayKey) || [];

          return (
            <DayCell
              key={dayKey}
              date={day}
              isCurrentMonth={isSameMonth(day, currentDate)}
              items={dayItems}
              maxItems={maxItemsPerDay}
              onItemClick={onItemClick}
              onDayClick={onDayClick}
              onCreateItem={onCreateItem}
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Mini Month View (for sidebar)
// ============================================================================

export function MiniMonthView({
  className,
  onDateSelect,
}: {
  className?: string;
  onDateSelect?: (date: Date) => void;
}) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const setCurrentDate = useCalendarStore((state) => state.setCurrentDate);
  const weekStartsOn = useCalendarStore((state) => state.weekStartsOn);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = days.slice(0, 7).map((d) => format(d, 'EEEEE', { locale: fr }));

  const handleDateClick = (date: Date) => {
    setCurrentDate(date);
    onDateSelect?.(date);
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: fr })}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setCurrentDate(addMonths(currentDate, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map((day, i) => (
          <div key={i} className="text-center text-[10px] text-muted-foreground uppercase">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              className={cn(
                'h-7 w-7 flex items-center justify-center text-xs rounded',
                'hover:bg-accent transition-colors',
                !isCurrentMonth && 'text-muted-foreground/50',
                today && 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MonthView;
