/**
 * Event Layout Utilities
 *
 * High-level utilities for calculating event layouts in calendar views.
 * Self-contained utilities for ScheduleBlock layout calculations.
 */

import { isSameDay, startOfDay, endOfDay } from "date-fns";
import type {
  ScheduleBlock,
  EventLayout,
  ViewConfig,
} from "../types/scheduling";

// ============================================================================
// Internal Layout Calculator for ScheduleBlock
// ============================================================================

interface BlockInterval {
  eventId: string;
  start: number; // minutes from midnight
  end: number;
  block: ScheduleBlock;
}

function toMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function calculateBlockLayout(
  blocks: ScheduleBlock[],
  options: {
    workingHoursStart: number;
    slotDuration: number;
    slotHeight: number;
  },
): Map<
  string,
  {
    top: number;
    height: number;
    left: number;
    width: number;
    column: number;
    totalColumns: number;
  }
> {
  const { workingHoursStart, slotDuration, slotHeight } = options;
  const pixelsPerMinute = slotHeight / slotDuration;
  const layouts = new Map<
    string,
    {
      top: number;
      height: number;
      left: number;
      width: number;
      column: number;
      totalColumns: number;
    }
  >();

  if (blocks.length === 0) return layouts;

  // Convert to intervals
  const intervals: BlockInterval[] = blocks
    .filter((b) => b.start)
    .map((block) => {
      const endTime = block.end || new Date(block.start.getTime() + 3600000); // Default 1 hour
      return {
        eventId: block.id,
        start: toMinutes(block.start),
        end: toMinutes(endTime),
        block,
      };
    })
    .sort((a, b) => a.start - b.start);

  // Find overlapping groups
  interface OverlapGroup {
    intervals: BlockInterval[];
    columns: Map<string, number>;
    maxColumns: number;
  }
  const groups: OverlapGroup[] = [];
  let currentGroup: BlockInterval[] = [];
  let currentGroupEnd = 0;

  for (const interval of intervals) {
    if (currentGroup.length === 0 || interval.start < currentGroupEnd) {
      currentGroup.push(interval);
      currentGroupEnd = Math.max(currentGroupEnd, interval.end);
    } else {
      if (currentGroup.length > 0) {
        groups.push(assignBlockColumns(currentGroup));
      }
      currentGroup = [interval];
      currentGroupEnd = interval.end;
    }
  }
  if (currentGroup.length > 0) {
    groups.push(assignBlockColumns(currentGroup));
  }

  // Calculate layouts for each group
  for (const group of groups) {
    const columnWidth = 100 / group.maxColumns;
    const padding = group.maxColumns > 1 ? 1 : 0;

    for (const interval of group.intervals) {
      const column = group.columns.get(interval.eventId) ?? 0;
      const startMinutes =
        (interval.block.start.getHours() - workingHoursStart) * 60 +
        interval.block.start.getMinutes();
      const endTime =
        interval.block.end ||
        new Date(interval.block.start.getTime() + 3600000);
      const endMinutes =
        (endTime.getHours() - workingHoursStart) * 60 + endTime.getMinutes();

      const top = startMinutes * pixelsPerMinute;
      const height = Math.max(
        (endMinutes - startMinutes) * pixelsPerMinute,
        20,
      );
      const left = column * columnWidth + padding;
      const width = columnWidth - padding * 2;

      layouts.set(interval.eventId, {
        top,
        height,
        left,
        width,
        column,
        totalColumns: group.maxColumns,
      });
    }
  }

  return layouts;
}

function assignBlockColumns(intervals: BlockInterval[]): {
  intervals: BlockInterval[];
  columns: Map<string, number>;
  maxColumns: number;
} {
  const columns = new Map<string, number>();
  const columnEnds: number[] = [];

  const sorted = [...intervals].sort((a, b) => {
    const startDiff = a.start - b.start;
    if (startDiff !== 0) return startDiff;
    return b.end - b.start - (a.end - a.start);
  });

  for (const interval of sorted) {
    let column = -1;
    for (let i = 0; i < columnEnds.length; i++) {
      if (columnEnds[i] <= interval.start) {
        column = i;
        break;
      }
    }

    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(0);
    }

    columns.set(interval.eventId, column);
    columnEnds[column] = interval.end;
  }

  return { intervals, columns, maxColumns: columnEnds.length };
}

// ============================================================================
// Types
// ============================================================================

export interface LayoutOptions {
  viewConfig: ViewConfig;
  slotHeight: number;
  date?: Date;
  days?: Date[];
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Calculate layouts for events on a single day
 */
export function calculateDayLayouts(
  events: ScheduleBlock[],
  date: Date,
  options: LayoutOptions,
): EventLayout[] {
  const { viewConfig, slotHeight } = options;

  // Filter events for this day (excluding all-day events)
  const dayEvents = events.filter(
    (event) => !event.allDay && isSameDay(event.start, date),
  );

  if (dayEvents.length === 0) return [];

  // Calculate layouts using internal block layout calculator
  const layouts = calculateBlockLayout(dayEvents, {
    workingHoursStart: viewConfig.workingHoursStart,
    slotDuration: viewConfig.slotDuration,
    slotHeight,
  });

  // Convert to EventLayout format
  return dayEvents.map((event) => {
    const layout = layouts.get(event.id);
    if (!layout) {
      // Fallback layout
      return {
        block: event,
        top: 0,
        height: 48,
        left: 0,
        width: 100,
        column: 0,
        totalColumns: 1,
      };
    }

    return {
      block: event,
      top: layout.top,
      height: layout.height,
      left: layout.left,
      width: layout.width,
      column: layout.column,
      totalColumns: layout.totalColumns,
    };
  });
}

/**
 * Calculate layouts for events across multiple days
 */
export function calculateMultiDayLayouts(
  events: ScheduleBlock[],
  days: Date[],
  options: LayoutOptions,
): Map<string, EventLayout[]> {
  const layoutsByDay = new Map<string, EventLayout[]>();

  for (const day of days) {
    const dayKey = startOfDay(day).toISOString();
    const dayLayouts = calculateDayLayouts(events, day, options);
    layoutsByDay.set(dayKey, dayLayouts);
  }

  return layoutsByDay;
}

/**
 * Get all-day events for a set of days
 */
export function getAllDayEvents(
  events: ScheduleBlock[],
  days: Date[],
): ScheduleBlock[] {
  return events.filter((event) => {
    if (!event.allDay) return false;

    // Check if event falls on any of the visible days
    return days.some((day) => {
      const eventStart = startOfDay(event.start);
      const eventEnd = event.end ? endOfDay(event.end) : endOfDay(event.start);
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);

      return eventStart <= dayEnd && eventEnd >= dayStart;
    });
  });
}

/**
 * Filter events by time range
 */
export function filterEventsByTimeRange(
  events: ScheduleBlock[],
  start: Date,
  end: Date,
): ScheduleBlock[] {
  return events.filter((event) => {
    const eventStart = event.start;
    const eventEnd = event.end || event.start;

    return eventStart < end && eventEnd > start;
  });
}

/**
 * Group events by day
 */
export function groupEventsByDay(
  events: ScheduleBlock[],
  days: Date[],
): Map<string, ScheduleBlock[]> {
  const grouped = new Map<string, ScheduleBlock[]>();

  for (const day of days) {
    const dayKey = startOfDay(day).toISOString();
    const dayEvents = events.filter((event) => isSameDay(event.start, day));
    grouped.set(dayKey, dayEvents);
  }

  return grouped;
}

// ============================================================================
// Layout Helpers
// ============================================================================

/**
 * Check if an event spans multiple days
 */
export function isMultiDayEvent(event: ScheduleBlock): boolean {
  if (!event.end) return false;
  return !isSameDay(event.start, event.end);
}

/**
 * Calculate the visual position of an event within a time range
 */
export function calculateEventPosition(
  event: ScheduleBlock,
  options: {
    workingHoursStart: number;
    workingHoursEnd: number;
    slotDuration: number;
    slotHeight: number;
  },
): { top: number; height: number } {
  const { workingHoursStart, workingHoursEnd, slotDuration, slotHeight } =
    options;
  const pixelsPerMinute = slotHeight / slotDuration;

  // Clamp event times to working hours
  const startHour = Math.max(event.start.getHours(), workingHoursStart);
  const startMinute =
    event.start.getHours() >= workingHoursStart ? event.start.getMinutes() : 0;

  const endHour = event.end
    ? Math.min(event.end.getHours(), workingHoursEnd)
    : Math.min(startHour + 1, workingHoursEnd);
  const endMinute =
    event.end && event.end.getHours() <= workingHoursEnd
      ? event.end.getMinutes()
      : 0;

  const startMinutes = (startHour - workingHoursStart) * 60 + startMinute;
  const endMinutes = (endHour - workingHoursStart) * 60 + endMinute;

  const top = startMinutes * pixelsPerMinute;
  const height = Math.max((endMinutes - startMinutes) * pixelsPerMinute, 20);

  return { top, height };
}

/**
 * Get the duration of an event in minutes
 */
export function getEventDuration(event: ScheduleBlock): number {
  if (!event.end) return 60; // Default 1 hour

  const diffMs = event.end.getTime() - event.start.getTime();
  return Math.round(diffMs / 60000);
}

/**
 * Check if two events overlap in time
 */
export function eventsOverlap(a: ScheduleBlock, b: ScheduleBlock): boolean {
  const aEnd = a.end || new Date(a.start.getTime() + 3600000); // Default 1 hour
  const bEnd = b.end || new Date(b.start.getTime() + 3600000);

  return a.start < bEnd && b.start < aEnd;
}
