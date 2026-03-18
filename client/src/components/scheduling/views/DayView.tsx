'use client';

/**
 * DayView Component
 *
 * Single day calendar view with full event details.
 * Uses TimeGrid for rendering with day-specific optimizations.
 */

import * as React from 'react';
import { format, setHours, setMinutes, addMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSchedulingNavigation, useSchedulingUI } from '@/stores/scheduling-store';
import { useEvents, useCreateEvent } from '@/lib/scheduling/api/calendar';
import { TimeGrid, useSlotClickHandler } from '../calendar/TimeGrid';
import { EventBlock } from '../calendar/EventBlock';
import { calculateDayLayouts } from '@/lib/scheduling/utils/event-layout';
import type { ScheduleBlock, EventLayout } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface DayViewProps {
  className?: string;
  slotHeight?: number;
  onEventClick?: (event: ScheduleBlock) => void;
  onCreateEvent?: (start: Date, end: Date) => void;
}

// ============================================================================
// Component
// ============================================================================

export function DayView({
  className,
  slotHeight = 48,
  onEventClick,
  onCreateEvent,
}: DayViewProps) {
  const { currentDate, getDateRange } = useSchedulingNavigation();
  const { viewConfig } = useSchedulingUI();
  const dateRange = getDateRange();

  // Fetch events
  const { data: events = [], isLoading } = useEvents({
    start: dateRange.start,
    end: dateRange.end,
  });

  // Calculate layouts
  const layouts = React.useMemo(() => {
    return calculateDayLayouts(events, currentDate, {
      viewConfig,
      slotHeight,
    });
  }, [events, currentDate, viewConfig, slotHeight]);

  // Handle slot click (create new event)
  const handleSlotClick = useSlotClickHandler({
    defaultDuration: viewConfig.slotDuration,
    onCreate: onCreateEvent,
  });

  // Render event
  const renderEvent = React.useCallback(
    (layout: EventLayout) => (
      <EventBlock
        key={layout.block.id}
        layout={layout}
        onClick={onEventClick}
      />
    ),
    [onEventClick]
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
    <div className={cn('h-full', className)}>
      <TimeGrid
        events={events}
        layouts={layouts}
        slotHeight={slotHeight}
        onSlotClick={handleSlotClick}
        onEventClick={onEventClick}
        renderEvent={renderEvent}
      />
    </div>
  );
}

// ============================================================================
// 3-Day View
// ============================================================================

export function ThreeDayView({
  className,
  slotHeight = 48,
  onEventClick,
  onCreateEvent,
}: DayViewProps) {
  const { getDateRange } = useSchedulingNavigation();
  const { viewConfig } = useSchedulingUI();
  const dateRange = getDateRange();

  // Fetch events
  const { data: events = [], isLoading } = useEvents({
    start: dateRange.start,
    end: dateRange.end,
  });

  // Handle slot click
  const handleSlotClick = useSlotClickHandler({
    defaultDuration: viewConfig.slotDuration,
    onCreate: onCreateEvent,
  });

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
    <div className={cn('h-full', className)}>
      <TimeGrid
        events={events}
        slotHeight={slotHeight}
        onSlotClick={handleSlotClick}
        onEventClick={onEventClick}
      />
    </div>
  );
}

export default DayView;
