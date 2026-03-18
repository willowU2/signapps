'use client';

/**
 * DayColumn Component
 *
 * Single day column for the calendar grid.
 * Handles event placement, drag/drop zones, and click interactions.
 */

import * as React from 'react';
import { format, isToday, isSameDay, setHours, setMinutes, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSchedulingUI, useSchedulingSelection } from '@/stores/scheduling-store';
import type { ScheduleBlock, EventLayout } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface DayColumnProps {
  date: Date;
  events: ScheduleBlock[];
  layouts?: EventLayout[];
  slotHeight?: number;
  className?: string;
  onSlotClick?: (date: Date, hour: number, minute: number) => void;
  onEventClick?: (event: ScheduleBlock) => void;
  renderEvent?: (layout: EventLayout) => React.ReactNode;
}

interface TimeSlotProps {
  date: Date;
  hour: number;
  minute: number;
  height: number;
  isWorkingHour: boolean;
  onClick?: () => void;
}

// ============================================================================
// TimeSlot Component
// ============================================================================

function TimeSlot({ date, hour, minute, height, isWorkingHour, onClick }: TimeSlotProps) {
  const isCurrentHour = new Date().getHours() === hour && isToday(date);
  const isHalfHour = minute === 30;

  return (
    <div
      className={cn(
        'relative border-b border-border/50 transition-colors',
        isWorkingHour ? 'bg-background' : 'bg-muted/30',
        isHalfHour && 'border-dashed',
        'hover:bg-accent/30 cursor-pointer',
        isCurrentHour && 'bg-primary/5'
      )}
      style={{ height }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${format(setMinutes(setHours(date, hour), minute), 'EEEE d MMMM, HH:mm', { locale: fr })}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    />
  );
}

// ============================================================================
// CurrentTimeIndicator Component
// ============================================================================

function CurrentTimeIndicator({ slotHeight, workingHoursStart }: { slotHeight: number; workingHoursStart: number }) {
  const [position, setPosition] = React.useState<number | null>(null);

  React.useEffect(() => {
    const updatePosition = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Calculate position relative to working hours start
      const minutesFromStart = (currentHour - workingHoursStart) * 60 + currentMinute;
      const pixelsPerMinute = slotHeight / 30; // slotHeight is for 30min slots typically

      setPosition(minutesFromStart * pixelsPerMinute);
    };

    updatePosition();
    const interval = setInterval(updatePosition, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [slotHeight, workingHoursStart]);

  if (position === null || position < 0) return null;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: position }}
    >
      <div className="relative flex items-center">
        <div className="h-3 w-3 rounded-full bg-red-500 -ml-1.5" />
        <div className="flex-1 h-0.5 bg-red-500" />
      </div>
    </div>
  );
}

// ============================================================================
// DayHeader Component
// ============================================================================

export function DayHeader({
  date,
  className,
  compact = false,
}: {
  date: Date;
  className?: string;
  compact?: boolean;
}) {
  const today = isToday(date);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-2 border-b',
        today && 'bg-primary/5',
        className
      )}
    >
      <span
        className={cn(
          'text-xs uppercase tracking-wider',
          today ? 'text-primary font-medium' : 'text-muted-foreground'
        )}
      >
        {format(date, compact ? 'EEE' : 'EEEE', { locale: fr })}
      </span>
      <span
        className={cn(
          'text-2xl font-bold',
          today
            ? 'bg-primary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center'
            : 'text-foreground'
        )}
      >
        {format(date, 'd')}
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DayColumn({
  date,
  events,
  layouts = [],
  slotHeight = 48,
  className,
  onSlotClick,
  onEventClick,
  renderEvent,
}: DayColumnProps) {
  const { viewConfig } = useSchedulingUI();
  const { selectedBlockId, selectBlock } = useSchedulingSelection();
  const { workingHoursStart, workingHoursEnd, slotDuration } = viewConfig;

  // Generate time slots
  const slots = React.useMemo(() => {
    const result: { hour: number; minute: number }[] = [];
    const slotsPerHour = 60 / slotDuration;

    for (let hour = workingHoursStart; hour <= workingHoursEnd; hour++) {
      for (let slotIndex = 0; slotIndex < slotsPerHour; slotIndex++) {
        const minute = slotIndex * slotDuration;
        result.push({ hour, minute });
      }
    }

    return result;
  }, [workingHoursStart, workingHoursEnd, slotDuration]);

  // Filter events for this day
  const dayEvents = React.useMemo(() => {
    return events.filter((event) => isSameDay(event.start, date));
  }, [events, date]);

  // Use provided layouts or create simple ones
  const eventLayouts = React.useMemo(() => {
    if (layouts.length > 0) {
      return layouts.filter((l) => isSameDay(l.block.start, date));
    }

    // Simple layout calculation (no overlap handling)
    return dayEvents.map((event) => {
      const startMinutes =
        (event.start.getHours() - workingHoursStart) * 60 +
        event.start.getMinutes();
      const endMinutes = event.end
        ? (event.end.getHours() - workingHoursStart) * 60 +
          event.end.getMinutes()
        : startMinutes + 60;

      const pixelsPerMinute = slotHeight / slotDuration;
      const top = startMinutes * pixelsPerMinute;
      const height = Math.max((endMinutes - startMinutes) * pixelsPerMinute, 20);

      return {
        block: event,
        top,
        height,
        left: 0,
        width: 100,
        column: 0,
        totalColumns: 1,
      } as EventLayout;
    });
  }, [layouts, dayEvents, date, workingHoursStart, slotHeight, slotDuration]);

  const handleSlotClick = (hour: number, minute: number) => {
    onSlotClick?.(date, hour, minute);
  };

  const handleEventClick = (event: ScheduleBlock) => {
    selectBlock(event.id);
    onEventClick?.(event);
  };

  return (
    <div className={cn('relative flex-1 border-r last:border-r-0', className)}>
      {/* Time Slots */}
      <div className="relative">
        {slots.map((slot) => (
          <TimeSlot
            key={`${slot.hour}-${slot.minute}`}
            date={date}
            hour={slot.hour}
            minute={slot.minute}
            height={slotHeight}
            isWorkingHour={
              slot.hour >= viewConfig.workingHoursStart &&
              slot.hour < viewConfig.workingHoursEnd
            }
            onClick={() => handleSlotClick(slot.hour, slot.minute)}
          />
        ))}

        {/* Current Time Indicator */}
        {isToday(date) && (
          <CurrentTimeIndicator
            slotHeight={slotHeight}
            workingHoursStart={workingHoursStart}
          />
        )}

        {/* Events */}
        {eventLayouts.map((layout) => (
          <div
            key={layout.block.id}
            className={cn(
              'absolute rounded-md px-2 py-1 text-xs cursor-pointer overflow-hidden',
              'border-l-4 shadow-sm transition-all',
              'hover:shadow-md hover:z-10',
              selectedBlockId === layout.block.id && 'ring-2 ring-primary ring-offset-1'
            )}
            style={{
              top: layout.top,
              height: layout.height,
              left: `${layout.left}%`,
              width: `${layout.width}%`,
              backgroundColor: layout.block.color
                ? `${layout.block.color}20`
                : 'hsl(var(--primary) / 0.1)',
              borderLeftColor: layout.block.color || 'hsl(var(--primary))',
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleEventClick(layout.block);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleEventClick(layout.block);
              }
            }}
          >
            {renderEvent ? (
              renderEvent(layout)
            ) : (
              <>
                <div className="font-medium truncate">{layout.block.title}</div>
                {layout.height > 40 && (
                  <div className="text-muted-foreground truncate">
                    {format(layout.block.start, 'HH:mm', { locale: fr })}
                    {layout.block.end &&
                      ` - ${format(layout.block.end, 'HH:mm', { locale: fr })}`}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DayColumn;
