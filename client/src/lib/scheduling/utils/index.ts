/**
 * Scheduling Utilities
 *
 * Re-exports all utility functions for the scheduling module.
 */

export * from './event-layout';
export * from './overlap-calculator';
// Exclude findNextAvailableSlot from conflict-detection to avoid duplicate export
export {
  checkConflicts,
  checkResourceConflicts,
  checkAttendeeConflicts,
  findAvailableSlots,
  suggestAlternativeTimes,
  doTimesOverlap,
  calculateOverlap,
  isWithinWorkingHours,
  getConflictSeverityColor,
  formatConflictMessage,
  type ConflictResult,
  type Conflict,
  type ConflictCheckOptions,
  type AvailableSlot,
} from './conflict-detection';
export * from './availability-finder';
export * from './search-service';
export * from './ics-export';
export * from './ics-import';
