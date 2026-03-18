/**
 * Conflict Detection Utilities
 *
 * Functions for detecting scheduling conflicts between events,
 * tasks, and resource bookings.
 */

import { areIntervalsOverlapping, addMinutes, subMinutes, isWithinInterval } from 'date-fns';
import type { ScheduleBlock, DateRange } from '../types/scheduling';

// ============================================================================
// Types
// ============================================================================

export interface ConflictCheckOptions {
  /** Buffer time in minutes before/after events */
  bufferMinutes?: number;
  /** Check resource conflicts */
  checkResources?: boolean;
  /** IDs to exclude from conflict check (e.g., the event being edited) */
  excludeIds?: string[];
}

export interface Conflict {
  type: 'overlap' | 'resource' | 'attendee';
  event: ScheduleBlock;
  overlapStart: Date;
  overlapEnd: Date;
  overlapMinutes: number;
  severity: 'warning' | 'error';
}

export interface ConflictResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
  totalOverlapMinutes: number;
}

export interface AvailableSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

// ============================================================================
// Core Conflict Detection
// ============================================================================

/**
 * Check if two time ranges overlap
 */
export function doTimesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
  bufferMinutes = 0
): boolean {
  const adjustedStart1 = subMinutes(start1, bufferMinutes);
  const adjustedEnd1 = addMinutes(end1, bufferMinutes);

  return areIntervalsOverlapping(
    { start: adjustedStart1, end: adjustedEnd1 },
    { start: start2, end: end2 }
  );
}

/**
 * Calculate overlap duration between two time ranges
 */
export function calculateOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): { start: Date; end: Date; minutes: number } | null {
  const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
  const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));

  if (overlapStart >= overlapEnd) {
    return null;
  }

  const minutes = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60000);
  return { start: overlapStart, end: overlapEnd, minutes };
}

/**
 * Check for conflicts between a proposed event and existing events
 */
export function checkConflicts(
  proposedStart: Date,
  proposedEnd: Date,
  existingEvents: ScheduleBlock[],
  options: ConflictCheckOptions = {}
): ConflictResult {
  const {
    bufferMinutes = 0,
    checkResources = false,
    excludeIds = [],
  } = options;

  const conflicts: Conflict[] = [];

  for (const event of existingEvents) {
    // Skip excluded events
    if (excludeIds.includes(event.id)) continue;

    // Skip all-day events for time conflicts (they don't have specific times)
    if (event.allDay) continue;

    const eventEnd = event.end || addMinutes(event.start, 60);

    // Check time overlap
    if (doTimesOverlap(proposedStart, proposedEnd, event.start, eventEnd, bufferMinutes)) {
      const overlap = calculateOverlap(proposedStart, proposedEnd, event.start, eventEnd);

      if (overlap) {
        conflicts.push({
          type: 'overlap',
          event,
          overlapStart: overlap.start,
          overlapEnd: overlap.end,
          overlapMinutes: overlap.minutes,
          severity: overlap.minutes >= 30 ? 'error' : 'warning',
        });
      }
    }
  }

  const totalOverlapMinutes = conflicts.reduce((sum, c) => sum + c.overlapMinutes, 0);

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    totalOverlapMinutes,
  };
}

/**
 * Check for resource conflicts
 */
export function checkResourceConflicts(
  resourceId: string,
  proposedStart: Date,
  proposedEnd: Date,
  existingBookings: ScheduleBlock[],
  excludeIds: string[] = []
): Conflict[] {
  const conflicts: Conflict[] = [];

  const resourceBookings = existingBookings.filter(
    (b) => b.resourceId === resourceId && !excludeIds.includes(b.id)
  );

  for (const booking of resourceBookings) {
    const bookingEnd = booking.end || addMinutes(booking.start, 60);

    if (doTimesOverlap(proposedStart, proposedEnd, booking.start, bookingEnd)) {
      const overlap = calculateOverlap(proposedStart, proposedEnd, booking.start, bookingEnd);

      if (overlap) {
        conflicts.push({
          type: 'resource',
          event: booking,
          overlapStart: overlap.start,
          overlapEnd: overlap.end,
          overlapMinutes: overlap.minutes,
          severity: 'error', // Resource conflicts are always errors
        });
      }
    }
  }

  return conflicts;
}

/**
 * Check for attendee conflicts (if attendee has conflicting events)
 */
export function checkAttendeeConflicts(
  attendeeId: string,
  proposedStart: Date,
  proposedEnd: Date,
  attendeeEvents: ScheduleBlock[],
  excludeIds: string[] = []
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const event of attendeeEvents) {
    if (excludeIds.includes(event.id)) continue;
    if (event.allDay) continue;

    const eventEnd = event.end || addMinutes(event.start, 60);

    if (doTimesOverlap(proposedStart, proposedEnd, event.start, eventEnd)) {
      const overlap = calculateOverlap(proposedStart, proposedEnd, event.start, eventEnd);

      if (overlap) {
        conflicts.push({
          type: 'attendee',
          event,
          overlapStart: overlap.start,
          overlapEnd: overlap.end,
          overlapMinutes: overlap.minutes,
          severity: 'warning', // Attendee conflicts are warnings (they can still be invited)
        });
      }
    }
  }

  return conflicts;
}

// ============================================================================
// Available Slot Finding
// ============================================================================

/**
 * Find available time slots within a date range
 */
export function findAvailableSlots(
  dateRange: DateRange,
  existingEvents: ScheduleBlock[],
  options: {
    minDurationMinutes?: number;
    workingHoursStart?: number;
    workingHoursEnd?: number;
    bufferMinutes?: number;
  } = {}
): AvailableSlot[] {
  const {
    minDurationMinutes = 30,
    workingHoursStart = 9,
    workingHoursEnd = 18,
    bufferMinutes = 0,
  } = options;

  const slots: AvailableSlot[] = [];

  // Filter to non-all-day events within the range
  const relevantEvents = existingEvents
    .filter((e) => !e.allDay)
    .filter((e) => {
      const eventEnd = e.end || addMinutes(e.start, 60);
      return doTimesOverlap(dateRange.start, dateRange.end, e.start, eventEnd);
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Iterate through each day in the range
  const currentDate = new Date(dateRange.start);
  currentDate.setHours(workingHoursStart, 0, 0, 0);

  while (currentDate < dateRange.end) {
    const dayStart = new Date(currentDate);
    dayStart.setHours(workingHoursStart, 0, 0, 0);

    const dayEnd = new Date(currentDate);
    dayEnd.setHours(workingHoursEnd, 0, 0, 0);

    // Skip if outside our range
    if (dayEnd <= dateRange.start || dayStart >= dateRange.end) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Get events for this day
    const dayEvents = relevantEvents.filter((e) => {
      const eventEnd = e.end || addMinutes(e.start, 60);
      return doTimesOverlap(dayStart, dayEnd, e.start, eventEnd);
    });

    // Find gaps between events
    let slotStart = dayStart;

    for (const event of dayEvents) {
      const eventStart = subMinutes(event.start, bufferMinutes);
      const eventEnd = addMinutes(event.end || addMinutes(event.start, 60), bufferMinutes);

      // If there's a gap before this event
      if (eventStart > slotStart) {
        const gapEnd = eventStart;
        const durationMinutes = Math.round((gapEnd.getTime() - slotStart.getTime()) / 60000);

        if (durationMinutes >= minDurationMinutes) {
          slots.push({
            start: new Date(slotStart),
            end: new Date(gapEnd),
            durationMinutes,
          });
        }
      }

      // Move slot start to after this event
      if (eventEnd > slotStart) {
        slotStart = eventEnd;
      }
    }

    // Check for gap after last event until end of day
    if (slotStart < dayEnd) {
      const durationMinutes = Math.round((dayEnd.getTime() - slotStart.getTime()) / 60000);

      if (durationMinutes >= minDurationMinutes) {
        slots.push({
          start: new Date(slotStart),
          end: new Date(dayEnd),
          durationMinutes,
        });
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}

/**
 * Find the next available slot of a specific duration
 */
export function findNextAvailableSlot(
  startFrom: Date,
  durationMinutes: number,
  existingEvents: ScheduleBlock[],
  options: {
    maxDaysToSearch?: number;
    workingHoursStart?: number;
    workingHoursEnd?: number;
    bufferMinutes?: number;
  } = {}
): AvailableSlot | null {
  const {
    maxDaysToSearch = 14,
    workingHoursStart = 9,
    workingHoursEnd = 18,
    bufferMinutes = 0,
  } = options;

  const endSearch = addMinutes(startFrom, maxDaysToSearch * 24 * 60);

  const slots = findAvailableSlots(
    { start: startFrom, end: endSearch },
    existingEvents,
    {
      minDurationMinutes: durationMinutes,
      workingHoursStart,
      workingHoursEnd,
      bufferMinutes,
    }
  );

  // Return the first slot that can accommodate the duration
  for (const slot of slots) {
    if (slot.durationMinutes >= durationMinutes) {
      return {
        start: slot.start,
        end: addMinutes(slot.start, durationMinutes),
        durationMinutes,
      };
    }
  }

  return null;
}

/**
 * Suggest alternative times when there's a conflict
 */
export function suggestAlternativeTimes(
  proposedStart: Date,
  proposedEnd: Date,
  existingEvents: ScheduleBlock[],
  options: {
    maxSuggestions?: number;
    workingHoursStart?: number;
    workingHoursEnd?: number;
  } = {}
): AvailableSlot[] {
  const {
    maxSuggestions = 3,
    workingHoursStart = 9,
    workingHoursEnd = 18,
  } = options;

  const durationMinutes = Math.round(
    (proposedEnd.getTime() - proposedStart.getTime()) / 60000
  );

  const suggestions: AvailableSlot[] = [];

  // Search from the proposed start date
  const endSearch = addMinutes(proposedStart, 7 * 24 * 60); // Search up to 7 days

  const slots = findAvailableSlots(
    { start: proposedStart, end: endSearch },
    existingEvents,
    {
      minDurationMinutes: durationMinutes,
      workingHoursStart,
      workingHoursEnd,
    }
  );

  for (const slot of slots) {
    if (slot.durationMinutes >= durationMinutes) {
      suggestions.push({
        start: slot.start,
        end: addMinutes(slot.start, durationMinutes),
        durationMinutes,
      });

      if (suggestions.length >= maxSuggestions) {
        break;
      }
    }
  }

  return suggestions;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a time is within working hours
 */
export function isWithinWorkingHours(
  time: Date,
  workingHoursStart = 9,
  workingHoursEnd = 18
): boolean {
  const hour = time.getHours();
  return hour >= workingHoursStart && hour < workingHoursEnd;
}

/**
 * Get conflict severity color
 */
export function getConflictSeverityColor(severity: 'warning' | 'error'): string {
  return severity === 'error' ? 'text-destructive' : 'text-yellow-600';
}

/**
 * Format conflict for display
 */
export function formatConflictMessage(conflict: Conflict): string {
  const eventTitle = conflict.event.title;

  switch (conflict.type) {
    case 'overlap':
      return `Conflit avec "${eventTitle}" (${conflict.overlapMinutes} min de chevauchement)`;
    case 'resource':
      return `Ressource déjà réservée par "${eventTitle}"`;
    case 'attendee':
      return `Participant occupé: "${eventTitle}"`;
    default:
      return `Conflit avec "${eventTitle}"`;
  }
}
