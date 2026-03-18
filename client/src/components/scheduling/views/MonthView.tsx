'use client';

/**
 * MonthView Component
 *
 * Full month calendar grid with event indicators.
 * Shows compact event previews in each day cell.
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
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSchedulingNavigation, useSchedulingUI } from '@/stores/scheduling-store';
import { useEvents } from '@/lib/scheduling/api/calendar';
import { AllDayEventBlock } from '../calendar/EventBlock';
import type { ScheduleBlock } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface MonthViewProps {
  className?: string;
  maxEventsPerDay?: number;
  onEventClick?: (event: ScheduleBlock) => void;
  onDayClick?: (date: Date) => void;
  onCreateEvent?: (date: Date) => void;
}

// ============================================================================
// Day Cell Component
// ============================================================================

function DayCell({
  date,
  isCurrentMonth,
  events,
  maxEvents,
  onEventClick,
  onDayClick,
  onCreateEvent,
}: {
  date: Date;
  isCurrentMonth: boolean;
  events: ScheduleBlock[];
  maxEvents: number;
  onEventClick?: (event: ScheduleBlock) => void;
  onDayClick?: (date: Date) => void;
  onCreateEvent?: (date: Date) => void;
}) {
  const today = isToday(date);
  const visibleEvents = events.slice(0, maxEvents);
  const hiddenCount = events.length - maxEvents;

  return (
    <div
      className={cn(
        'min-h-[100px] border-b border-r p-1 transition-colors',
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
        {onCreateEvent && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onCreateEvent(date);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Events */}
      <div className="space-y-0.5">
        {visibleEvents.map((event) => (
          <button
            key={event.id}
            onClick={(e) => {
              e.stopPropagation();
              onEventClick?.(event);
            }}
            className={cn(
              'w-full text-left text-[11px] px-1.5 py-0.5 rounded truncate',
              'hover:opacity-80 transition-opacity',
              event.allDay ? 'text-white' : 'border-l-2'
            )}
            style={{
              backgroundColor: event.allDay
                ? event.color || 'hsl(var(--primary))'
                : `${event.color || 'hsl(var(--primary))'}10`,
              borderLeftColor: !event.allDay
                ? event.color || 'hsl(var(--primary))'
                : undefined,
            }}
          >
            {!event.allDay && (
              <span className="text-muted-foreground mr-1">
                {format(event.start, 'HH:mm', { locale: fr })}
              </span>
            )}
            <span className={event.allDay ? '' : 'font-medium'}>{event.title}</span>
          </button>
        ))}

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
  maxEventsPerDay = 3,
  onEventClick,
  onDayClick,
  onCreateEvent,
}: MonthViewProps) {
  const { currentDate, setCurrentDate, getDateRange } = useSchedulingNavigation();
  const { viewConfig, filters } = useSchedulingUI();

  // Calculate month boundaries with padding for week display
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: viewConfig.firstDayOfWeek });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: viewConfig.firstDayOfWeek });

  // Fetch events for the visible range
  const { data: events = [], isLoading } = useEvents({
    start: calendarStart,
    end: calendarEnd,
  });

  // Generate all days to display
  const days = React.useMemo(() => {
    let allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // Optionally filter weekends
    if (!filters.showWeekends) {
      allDays = allDays.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
    }

    return allDays;
  }, [calendarStart, calendarEnd, filters.showWeekends]);

  // Group events by day
  const eventsByDay = React.useMemo(() => {
    const grouped = new Map<string, ScheduleBlock[]>();

    for (const day of days) {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayEvents = events.filter((event) => isSameDay(event.start, day));
      // Sort: all-day events first, then by start time
      dayEvents.sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return a.start.getTime() - b.start.getTime();
      });
      grouped.set(dayKey, dayEvents);
    }

    return grouped;
  }, [days, events]);

  // Week day headers
  const weekDays = React.useMemo(() => {
    const firstWeek = days.slice(0, filters.showWeekends ? 7 : 5);
    return firstWeek.map((day) => format(day, 'EEE', { locale: fr }));
  }, [days, filters.showWeekends]);

  // Number of columns
  const columns = filters.showWeekends ? 7 : 5;

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
          const dayEvents = eventsByDay.get(dayKey) || [];

          return (
            <DayCell
              key={dayKey}
              date={day}
              isCurrentMonth={isSameMonth(day, currentDate)}
              events={dayEvents}
              maxEvents={maxEventsPerDay}
              onEventClick={onEventClick}
              onDayClick={onDayClick}
              onCreateEvent={onCreateEvent}
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
  const { currentDate, setCurrentDate } = useSchedulingNavigation();
  const { viewConfig } = useSchedulingUI();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: viewConfig.firstDayOfWeek });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: viewConfig.firstDayOfWeek });

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
