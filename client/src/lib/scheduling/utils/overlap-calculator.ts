/**
 * Unified Scheduling System - Overlap Calculator
 * Story 1.3.7: Overlap Calculator
 *
 * Calculates overlapping event groups and assigns columns for proper rendering.
 * Uses a sweep-line algorithm for efficient O(n log n) overlap detection.
 */

import type { TimeItem, OverlapGroup, PositionedItem } from "../types";
import { parseDate } from "./time-utils";

// Re-export PositionedItem for backwards compatibility
export type { PositionedItem } from "../types";

interface TimeRange {
  start: Date;
  end: Date;
  id: string;
}

interface EventInterval {
  eventId: string;
  start: number; // minutes from midnight
  end: number;
  item: TimeItem;
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

/**
 * Check if two time ranges overlap
 */
function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && a.end > b.start;
}

/**
 * Convert TimeItem to TimeRange
 */
function itemToRange(item: TimeItem): TimeRange | null {
  const start = parseDate(item.startTime);
  const end = parseDate(item.endTime);

  if (!start) return null;

  // If no end time, use duration or default to 1 hour
  let endTime = end;
  if (!endTime) {
    const durationMs = (item.duration || 60) * 60 * 1000;
    endTime = new Date(start.getTime() + durationMs);
  }

  return {
    start,
    end: endTime,
    id: item.id,
  };
}

// ============================================================================
// Main Algorithm
// ============================================================================

/**
 * Find all overlapping groups of items
 * Returns groups where items overlap and need column assignment
 */
export function findOverlapGroups(items: TimeItem[]): OverlapGroup[] {
  if (items.length === 0) return [];

  // Convert to intervals
  const intervals: EventInterval[] = items
    .map((item) => {
      const range = itemToRange(item);
      if (!range) return null;
      return {
        eventId: item.id,
        start: toMinutes(range.start),
        end: toMinutes(range.end),
        item,
      };
    })
    .filter((x): x is EventInterval => x !== null);

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
 * Assign columns to items within a group
 * Uses a greedy algorithm to minimize columns
 */
function assignColumns(intervals: EventInterval[]): OverlapGroup {
  const columns = new Map<string, number>();
  const columnEnds: number[] = []; // Track when each column becomes free

  // Sort by start time, then by duration (longer first)
  const sorted = [...intervals].sort((a, b) => {
    const startDiff = a.start - b.start;
    if (startDiff !== 0) return startDiff;
    // If same start, put longer items first
    return b.end - b.start - (a.end - a.start);
  });

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
    items: intervals.map((i) => i.item),
    maxOverlap: columnEnds.length,
    columns,
  };
}

/**
 * Group overlapping items together (alias for findOverlapGroups)
 */
export function groupOverlappingItems(items: TimeItem[]): OverlapGroup[] {
  return findOverlapGroups(items);
}

// ============================================================================
// Position Calculations
// ============================================================================

/**
 * Calculate positions for items in a day column
 */
export function calculateItemPositions(
  items: TimeItem[],
  hourStart: number,
  hourEnd: number,
): PositionedItem[] {
  const totalMinutes = (hourEnd - hourStart) * 60;
  const dayStartMinutes = hourStart * 60;

  // Group overlapping items
  const groups = findOverlapGroups(items);
  const positioned: PositionedItem[] = [];

  for (const group of groups) {
    const totalColumns = group.maxOverlap;

    for (const item of group.items) {
      const range = itemToRange(item);
      if (!range) continue;

      const column = group.columns.get(item.id) || 0;

      // Calculate time positions
      const startMinutes = toMinutes(range.start);
      const endMinutes = toMinutes(range.end);

      const top = ((startMinutes - dayStartMinutes) / totalMinutes) * 100;
      const height = ((endMinutes - startMinutes) / totalMinutes) * 100;

      // Calculate horizontal positions
      const width = 100 / totalColumns;
      const left = column * width;

      positioned.push({
        item,
        column,
        totalColumns,
        top: Math.max(0, top),
        height: Math.min(100 - Math.max(0, top), height),
        left,
        width,
      });
    }
  }

  return positioned;
}

/**
 * Calculate positions with margins for better visibility
 */
export function calculateItemPositionsWithMargins(
  items: TimeItem[],
  hourStart: number,
  hourEnd: number,
  marginPx: number = 2,
): (PositionedItem & { marginLeft: number; marginRight: number })[] {
  const positions = calculateItemPositions(items, hourStart, hourEnd);

  return positions.map((pos) => ({
    ...pos,
    marginLeft: pos.column > 0 ? marginPx : 0,
    marginRight: pos.column < pos.totalColumns - 1 ? marginPx : 0,
  }));
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
  },
): Map<string, { top: number; height: number; left: number; width: number }> {
  const { workingHoursStart, slotDuration, slotHeight } = options;
  const pixelsPerMinute = slotHeight / slotDuration;
  const layouts = new Map<
    string,
    { top: number; height: number; left: number; width: number }
  >();

  const columnWidth = 100 / group.maxOverlap;
  const padding = group.maxOverlap > 1 ? 1 : 0; // 1% padding between columns

  for (const item of group.items) {
    const range = itemToRange(item);
    if (!range) continue;

    const column = group.columns.get(item.id) ?? 0;
    const startMinutes =
      (range.start.getHours() - workingHoursStart) * 60 +
      range.start.getMinutes();
    const endMinutes =
      (range.end.getHours() - workingHoursStart) * 60 + range.end.getMinutes();

    const top = startMinutes * pixelsPerMinute;
    const height = Math.max((endMinutes - startMinutes) * pixelsPerMinute, 20);
    const left = column * columnWidth + padding;
    const width = columnWidth - padding * 2;

    layouts.set(item.id, { top, height, left, width });
  }

  return layouts;
}

/**
 * Full layout calculation for all items
 */
export function calculateAllLayouts(
  items: TimeItem[],
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
  const groups = findOverlapGroups(items);
  const allLayouts = new Map<
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

  for (const group of groups) {
    const groupLayouts = calculateGroupLayout(group, options);

    for (const [itemId, layout] of groupLayouts) {
      allLayouts.set(itemId, {
        ...layout,
        column: group.columns.get(itemId) ?? 0,
        totalColumns: group.maxOverlap,
      });
    }
  }

  return allLayouts;
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Find all conflicts (overlapping items)
 */
export function findConflicts(items: TimeItem[]): TimeItem[][] {
  const groups = findOverlapGroups(items);
  // Return only groups with more than 1 item (actual conflicts)
  return groups.filter((g) => g.items.length > 1).map((g) => g.items);
}

/**
 * Check if a new item would conflict with existing items
 */
export function wouldConflict(
  newItem: TimeItem,
  existingItems: TimeItem[],
): TimeItem[] {
  const newRange = itemToRange(newItem);
  if (!newRange) return [];

  const conflicts: TimeItem[] = [];

  for (const item of existingItems) {
    if (item.id === newItem.id) continue;
    const range = itemToRange(item);
    if (range && rangesOverlap(newRange, range)) {
      conflicts.push(item);
    }
  }

  return conflicts;
}

/**
 * Find the next available slot that doesn't conflict
 */
export function findNextAvailableSlot(
  duration: number, // minutes
  after: Date,
  existingItems: TimeItem[],
  hourStart: number = 6,
  hourEnd: number = 22,
  slotDuration: number = 30,
): Date | null {
  // Convert existing items to ranges
  const ranges = existingItems
    .map(itemToRange)
    .filter((r): r is TimeRange => r !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Start from the next slot boundary
  let candidate = new Date(after);
  const minutes = candidate.getMinutes();
  const roundedMinutes = Math.ceil(minutes / slotDuration) * slotDuration;
  candidate.setMinutes(roundedMinutes, 0, 0);

  // Search for up to 7 days
  const maxDate = new Date(after);
  maxDate.setDate(maxDate.getDate() + 7);

  while (candidate < maxDate) {
    const hour = candidate.getHours();

    // Skip outside working hours
    if (hour < hourStart) {
      candidate.setHours(hourStart, 0, 0, 0);
      continue;
    }

    if (hour >= hourEnd) {
      // Move to next day
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(hourStart, 0, 0, 0);
      continue;
    }

    // Check if this slot is available
    const slotEnd = new Date(candidate.getTime() + duration * 60 * 1000);

    // Make sure we don't go past end of day
    if (
      slotEnd.getHours() > hourEnd ||
      (slotEnd.getHours() === hourEnd && slotEnd.getMinutes() > 0)
    ) {
      // Move to next day
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(hourStart, 0, 0, 0);
      continue;
    }

    const testRange: TimeRange = {
      start: candidate,
      end: slotEnd,
      id: "test",
    };

    const hasConflict = ranges.some((r) => rangesOverlap(testRange, r));

    if (!hasConflict) {
      return candidate;
    }

    // Move to next slot
    candidate = new Date(candidate.getTime() + slotDuration * 60 * 1000);
  }

  return null;
}

// ============================================================================
// Exports
// ============================================================================

export const overlapCalculator = {
  findOverlapGroups,
  groupOverlappingItems,
  calculateItemPositions,
  calculateItemPositionsWithMargins,
  calculateGroupLayout,
  calculateAllLayouts,
  findConflicts,
  wouldConflict,
  findNextAvailableSlot,
};

export default overlapCalculator;
