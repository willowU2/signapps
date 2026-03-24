'use client';

/**
 * TimeGutter Component
 *
 * Vertical time indicators for the calendar grid.
 * Shows hour labels from start to end of working hours.
 */

import * as React from 'react';
import { format, setHours, setMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCalendarStore } from '@/stores/scheduling/calendar-store';

// ============================================================================
// Types
// ============================================================================

interface TimeGutterProps {
  className?: string;
  slotHeight?: number;
}

// ============================================================================
// Component
// ============================================================================

export function TimeGutter({ className, slotHeight = 48 }: TimeGutterProps) {
  const hourStart = useCalendarStore((state) => state.hourStart);
  const hourEnd = useCalendarStore((state) => state.hourEnd);
  const slotDuration = useCalendarStore((state) => state.slotDuration);

  // Generate time slots
  const slots = React.useMemo(() => {
    const result: { hour: number; minute: number; label: string }[] = [];
    const slotsPerHour = 60 / slotDuration;

    for (let hour = hourStart; hour <= hourEnd; hour++) {
      for (let slotIndex = 0; slotIndex < slotsPerHour; slotIndex++) {
        const minute = slotIndex * slotDuration;
        const date = setMinutes(setHours(new Date(), hour), minute);

        // Only show label for full hours
        const label = minute === 0 ? format(date, 'HH:mm', { locale: fr }) : '';

        result.push({ hour, minute, label });
      }
    }

    return result;
  }, [hourStart, hourEnd, slotDuration]);

  return (
    <div className={cn('flex flex-col', className)}>
      {slots.map((slot, index) => (
        <div
          key={`${slot.hour}-${slot.minute}`}
          className={cn(
            'relative flex items-start justify-end pr-2 text-xs text-muted-foreground',
            slot.minute === 0 && 'font-medium'
          )}
          style={{ height: slotHeight }}
        >
          {slot.label && (
            <span className="absolute -top-2 right-2">{slot.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Compact Version (for mobile)
// ============================================================================

export function TimeGutterCompact({ className, slotHeight = 36 }: TimeGutterProps) {
  const hourStart = useCalendarStore((state) => state.hourStart);
  const hourEnd = useCalendarStore((state) => state.hourEnd);

  // Only show full hours for compact view
  const hours = React.useMemo(() => {
    const result: number[] = [];
    for (let hour = hourStart; hour <= hourEnd; hour++) {
      result.push(hour);
    }
    return result;
  }, [hourStart, hourEnd]);

  return (
    <div className={cn('flex flex-col', className)}>
      {hours.map((hour) => (
        <div
          key={hour}
          className="relative flex items-start justify-end pr-1 text-[10px] text-muted-foreground"
          style={{ height: slotHeight }}
        >
          <span className="absolute -top-1.5 right-1">{hour}h</span>
        </div>
      ))}
    </div>
  );
}

export default TimeGutter;
