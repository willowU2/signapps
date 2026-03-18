'use client';

/**
 * DayView Component
 * Story 1.3.4: DayView Component
 *
 * Single day calendar view with full TimeItem details.
 * Uses TimeGrid for rendering with day-specific optimizations.
 * Supports drag & drop for moving and resizing TimeItems.
 */

import * as React from 'react';
import { parseISO } from 'date-fns';
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

interface DayViewProps {
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

export function DayView({
  className,
  slotHeight = 48,
  items: propItems,
  onItemClick,
  onItemDoubleClick,
  onCreateItem,
}: DayViewProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const hourStart = useCalendarStore((state) => state.hourStart);
  const hourEnd = useCalendarStore((state) => state.hourEnd);
  const slotDuration = useCalendarStore((state) => state.slotDuration);
  const getDateRange = useCalendarStore((state) => state.getDateRange);

  // Get items from store if not provided
  const storeItems = useSchedulingStore((state) => state.timeItems);
  const isLoading = useSchedulingStore((state) => state.isLoading);
  const fetchTimeItems = useSchedulingStore((state) => state.fetchTimeItems);

  const items = propItems || storeItems;

  // Fetch items on mount
  React.useEffect(() => {
    if (!propItems) {
      const dateRange = getDateRange();
      fetchTimeItems(dateRange);
    }
  }, [propItems, fetchTimeItems, getDateRange]);

  // Calculate positions for all items
  const positions = React.useMemo(() => {
    return calculateItemPositions(items, hourStart, hourEnd);
  }, [items, hourStart, hourEnd]);

  // Handle slot click (create new item)
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
// Focus View (enhanced day view with focus blocks)
// ============================================================================

export function FocusView({
  className,
  slotHeight = 48,
  items: propItems,
  onItemClick,
  onItemDoubleClick,
  onCreateItem,
}: DayViewProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const hourStart = useCalendarStore((state) => state.hourStart);
  const hourEnd = useCalendarStore((state) => state.hourEnd);
  const slotDuration = useCalendarStore((state) => state.slotDuration);
  const getDateRange = useCalendarStore((state) => state.getDateRange);

  // Get items from store if not provided
  const storeItems = useSchedulingStore((state) => state.timeItems);
  const isLoading = useSchedulingStore((state) => state.isLoading);
  const fetchTimeItems = useSchedulingStore((state) => state.fetchTimeItems);

  const items = propItems || storeItems;

  // Fetch items on mount
  React.useEffect(() => {
    if (!propItems) {
      const dateRange = getDateRange();
      fetchTimeItems(dateRange);
    }
  }, [propItems, fetchTimeItems, getDateRange]);

  // Filter focus-relevant items (tasks and blockers)
  const focusItems = React.useMemo(() => {
    return items.filter((item) =>
      item.type === 'task' || item.type === 'blocker' || item.type === 'milestone'
    );
  }, [items]);

  // Calculate positions for focus items
  const positions = React.useMemo(() => {
    return calculateItemPositions(focusItems, hourStart, hourEnd);
  }, [focusItems, hourStart, hourEnd]);

  // Handle slot click (create new item)
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
    <div className={cn('h-full flex flex-col', className)}>
      {/* Focus Header */}
      <div className="shrink-0 border-b p-4 bg-primary/5">
        <h2 className="text-lg font-semibold">Mode Focus</h2>
        <p className="text-sm text-muted-foreground">
          {focusItems.length} tâche{focusItems.length !== 1 ? 's' : ''} à accomplir
        </p>
      </div>

      {/* TimeGrid */}
      <div className="flex-1 overflow-hidden">
        <TimeGrid
          items={focusItems}
          positions={positions}
          slotHeight={slotHeight}
          onSlotClick={handleSlotClick}
          onItemClick={onItemClick}
          onItemDoubleClick={onItemDoubleClick}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 3-Day View
// ============================================================================

export function ThreeDayView({
  className,
  slotHeight = 48,
  items: propItems,
  onItemClick,
  onItemDoubleClick,
  onCreateItem,
}: DayViewProps) {
  const currentDate = useCalendarStore((state) => state.currentDate);
  const hourStart = useCalendarStore((state) => state.hourStart);
  const hourEnd = useCalendarStore((state) => state.hourEnd);
  const slotDuration = useCalendarStore((state) => state.slotDuration);
  const getDateRange = useCalendarStore((state) => state.getDateRange);

  // Get items from store if not provided
  const storeItems = useSchedulingStore((state) => state.timeItems);
  const isLoading = useSchedulingStore((state) => state.isLoading);
  const fetchTimeItems = useSchedulingStore((state) => state.fetchTimeItems);

  const items = propItems || storeItems;

  // Fetch items on mount
  React.useEffect(() => {
    if (!propItems) {
      const dateRange = getDateRange();
      fetchTimeItems(dateRange);
    }
  }, [propItems, fetchTimeItems, getDateRange]);

  // Calculate positions for all items
  const positions = React.useMemo(() => {
    return calculateItemPositions(items, hourStart, hourEnd);
  }, [items, hourStart, hourEnd]);

  // Handle slot click (create new item)
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

export default DayView;
