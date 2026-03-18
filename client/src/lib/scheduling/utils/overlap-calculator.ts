/**
 * Overlap Calculator
 *
 * Calculates overlapping event groups and assigns columns for proper rendering.
 * Uses a sweep-line algorithm for efficient O(n log n) overlap detection.
 */

import type { ScheduleBlock } from '../types/scheduling';

// ============================================================================
// Types
// ============================================================================

export interface OverlapGroup {
  events: ScheduleBlock[];
  columns: Map<string, number>; // eventId -> column index
  maxColumns: number;
}

interface EventInterval {
  eventId: string;
  start: number; // minutes from midnight
  end: number;
  event: ScheduleBlock;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert Date to minutes from midnight
 */
function toMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Check if two intervals overlap
 */
function intervalsOverlap(a: EventInterval, b: EventInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

// ============================================================================
// Main Algorithm
// ============================================================================

/**
 * Find all overlapping groups of events
 * Returns groups where events overlap and need column assignment
 */
export function findOverlapGroups(events: ScheduleBlock[]): OverlapGroup[] {
  if (events.length === 0) return [];

  // Convert to intervals
  const intervals: EventInterval[] = events.map((event) => ({
    eventId: event.id,
    start: toMinutes(event.start),
    end: event.end ? toMinutes(event.end) : toMinutes(event.start) + 60, // Default 1 hour
    event,
  }));

  // Sort by start time
  intervals.sort((a, b) => a.start - b.start);

  const groups: OverlapGroup[] = [];
  let currentGroup: EventInterval[] = [];
  let currentGroupEnd = 0;

  for (const interval of intervals) {
    // Check if this interval overlaps with current group
    if (currentGroup.length === 0 || interval.start < currentGroupEnd) {
      // Add to current group
      currentGroup.push(interval);
      currentGroupEnd = Math.max(currentGroupEnd, interval.end);
    } else {
      // Start a new group
      if (currentGroup.length > 0) {
        groups.push(assignColumns(currentGroup));
      }
      currentGroup = [interval];
      currentGroupEnd = interval.end;
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(assignColumns(currentGroup));
  }

  return groups;
}

/**
 * Assign columns to events within a group
 * Uses a greedy algorithm to minimize columns
 */
function assignColumns(intervals: EventInterval[]): OverlapGroup {
  const columns = new Map<string, number>();
  const columnEnds: number[] = []; // Track when each column becomes free

  // Sort by start time (should already be sorted, but ensure it)
  const sorted = [...intervals].sort((a, b) => a.start - b.start);

  for (const interval of sorted) {
    // Find the first column that's free (ended before this event starts)
    let column = -1;
    for (let i = 0; i < columnEnds.length; i++) {
      if (columnEnds[i] <= interval.start) {
        column = i;
        break;
      }
    }

    // If no free column, create a new one
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(0);
    }

    // Assign the column and update its end time
    columns.set(interval.eventId, column);
    columnEnds[column] = interval.end;
  }

  return {
    events: intervals.map((i) => i.event),
    columns,
    maxColumns: columnEnds.length,
  };
}

/**
 * Calculate layout positions for a single group
 */
export function calculateGroupLayout(
  group: OverlapGroup,
  options: {
    workingHoursStart: number;
    slotDuration: number;
    slotHeight: number;
  }
): Map<string, { top: number; height: number; left: number; width: number }> {
  const { workingHoursStart, slotDuration, slotHeight } = options;
  const pixelsPerMinute = slotHeight / slotDuration;
  const layouts = new Map<string, { top: number; height: number; left: number; width: number }>();

  const columnWidth = 100 / group.maxColumns;
  const padding = group.maxColumns > 1 ? 1 : 0; // 1% padding between columns

  for (const event of group.events) {
    const column = group.columns.get(event.id) ?? 0;
    const startMinutes =
      (event.start.getHours() - workingHoursStart) * 60 + event.start.getMinutes();
    const endMinutes = event.end
      ? (event.end.getHours() - workingHoursStart) * 60 + event.end.getMinutes()
      : startMinutes + 60;

    const top = startMinutes * pixelsPerMinute;
    const height = Math.max((endMinutes - startMinutes) * pixelsPerMinute, 20);
    const left = column * columnWidth + padding;
    const width = columnWidth - padding * 2;

    layouts.set(event.id, { top, height, left, width });
  }

  return layouts;
}

/**
 * Full layout calculation for all events
 */
export function calculateAllLayouts(
  events: ScheduleBlock[],
  options: {
    workingHoursStart: number;
    slotDuration: number;
    slotHeight: number;
  }
): Map<string, { top: number; height: number; left: number; width: number; column: number; totalColumns: number }> {
  const groups = findOverlapGroups(events);
  const allLayouts = new Map<string, { top: number; height: number; left: number; width: number; column: number; totalColumns: number }>();

  for (const group of groups) {
    const groupLayouts = calculateGroupLayout(group, options);

    for (const [eventId, layout] of groupLayouts) {
      allLayouts.set(eventId, {
        ...layout,
        column: group.columns.get(eventId) ?? 0,
        totalColumns: group.maxColumns,
      });
    }
  }

  return allLayouts;
}
