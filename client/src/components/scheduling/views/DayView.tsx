'use client';

/**
 * DayView Component
 *
 * Single day calendar view with full event details.
 * Uses TimeGrid for rendering with day-specific optimizations.
 * Supports drag & drop for moving and resizing events.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useSchedulingNavigation, useSchedulingUI } from '@/stores/scheduling-store';
import { useEvents, useMoveEvent } from '@/lib/scheduling/api/calendar';
import { TimeGrid, useSlotClickHandler } from '../calendar/TimeGrid';
import { DraggableEventBlock } from '../calendar/DraggableEventBlock';
import { calculateDayLayouts } from '@/lib/scheduling/utils/event-layout';
import { useEventDrag, useDragPreview } from '@/lib/scheduling/hooks/use-event-drag';
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
  const { currentDate, getDateRange } = useSchedulingNavigation();
  const { viewConfig } = useSchedulingUI();
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

  // Calculate layouts
  const layouts = React.useMemo(() => {
    return calculateDayLayouts(events, currentDate, {
      viewConfig,
      slotHeight,
    });
  }, [events, currentDate, viewConfig, slotHeight]);

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
        layouts={layouts}
        slotHeight={slotHeight}
        onSlotClick={handleSlotClick}
        onEventClick={onEventClick}
        renderEvent={renderEvent}
      />
    </div>
  );
}

export default DayView;
