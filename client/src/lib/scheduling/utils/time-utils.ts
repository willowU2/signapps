/**
 * Unified Scheduling System - Date & Time Utilities
 * Story 1.1.6: Date & Time Utilities
 */

import {
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
  isYesterday,
  isThisWeek,
  isThisMonth,
  isSameDay,
  isSameWeek,
  isSameMonth,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addMinutes,
  addHours,
  addDays,
  addWeeks,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  parseISO,
  isValid,
  setHours,
  setMinutes,
  getHours,
  getMinutes,
  eachDayOfInterval,
  eachHourOfInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';

import type { TimeSlot, EnergyRequired, TimeOfDay } from '../types';

// ============================================================================
// DATE PARSING & VALIDATION
// ============================================================================

/**
 * Parse a date string (ISO8601) to Date object
 */
export function parseDate(dateString: string | undefined | null): Date | null {
  if (!dateString) return null;
  const date = parseISO(dateString);
  return isValid(date) ? date : null;
}

/**
 * Safely parse a date, returning current date if invalid
 */
export function parseDateSafe(dateString: string | undefined | null): Date {
  return parseDate(dateString) || new Date();
}

/**
 * Check if a date string is valid
 */
export function isValidDateString(dateString: string): boolean {
  return isValid(parseISO(dateString));
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Format date for display (e.g., "Lundi 18 Mars 2026")
 */
export function formatFullDate(date: Date): string {
  return format(date, 'EEEE d MMMM yyyy', { locale: fr });
}

/**
 * Format date short (e.g., "18 mars")
 */
export function formatShortDate(date: Date): string {
  return format(date, 'd MMM', { locale: fr });
}

/**
 * Format date for month header (e.g., "Mars 2026")
 */
export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy', { locale: fr });
}

/**
 * Format week range (e.g., "17 - 23 Mars 2026")
 */
export function formatWeekRange(date: Date, weekStartsOn: 0 | 1 = 1): string {
  const start = startOfWeek(date, { weekStartsOn });
  const end = endOfWeek(date, { weekStartsOn });

  if (isSameMonth(start, end)) {
    return `${format(start, 'd')} - ${format(end, 'd MMMM yyyy', { locale: fr })}`;
  }
  return `${format(start, 'd MMM', { locale: fr })} - ${format(end, 'd MMM yyyy', { locale: fr })}`;
}

/**
 * Format time (e.g., "14:30" or "2:30 PM")
 */
export function formatTime(date: Date, use24Hour: boolean = true): string {
  return format(date, use24Hour ? 'HH:mm' : 'h:mm a');
}

/**
 * Format time from hours and minutes
 */
export function formatTimeFromHoursMinutes(
  hour: number,
  minute: number = 0,
  use24Hour: boolean = true
): string {
  const date = setMinutes(setHours(new Date(), hour), minute);
  return formatTime(date, use24Hour);
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h${mins}`;
}

/**
 * Format relative time (e.g., "dans 2 heures", "il y a 3 jours")
 */
export function formatRelative(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true, locale: fr });
}

/**
 * Smart date format based on context
 */
export function formatSmartDate(date: Date): string {
  if (isToday(date)) {
    return "Aujourd'hui";
  }
  if (isTomorrow(date)) {
    return 'Demain';
  }
  if (isYesterday(date)) {
    return 'Hier';
  }
  if (isThisWeek(date)) {
    return format(date, 'EEEE', { locale: fr }); // Day name
  }
  if (isThisMonth(date)) {
    return format(date, 'EEEE d', { locale: fr }); // "Lundi 18"
  }
  return formatShortDate(date);
}

// ============================================================================
// DATE RANGES
// ============================================================================

/**
 * Get all days in a week
 */
export function getWeekDays(date: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const start = startOfWeek(date, { weekStartsOn });
  const end = endOfWeek(date, { weekStartsOn });
  return eachDayOfInterval({ start, end });
}

/**
 * Get all days in a month (including padding days from adjacent months)
 */
export function getMonthDays(date: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn });
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

/**
 * Check if two dates are in the same day
 */
export function areSameDay(date1: Date, date2: Date): boolean {
  return isSameDay(date1, date2);
}

/**
 * Check if a date is in a specific month
 */
export function isInMonth(date: Date, monthDate: Date): boolean {
  return isSameMonth(date, monthDate);
}

// ============================================================================
// TIME SLOTS
// ============================================================================

/**
 * Generate time slots for a day
 */
export function generateTimeSlots(
  hourStart: number = 6,
  hourEnd: number = 22,
  slotDuration: number = 30 // minutes
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const baseDate = new Date();

  for (let hour = hourStart; hour < hourEnd; hour++) {
    for (let minute = 0; minute < 60; minute += slotDuration) {
      const start = setMinutes(setHours(startOfDay(baseDate), hour), minute);
      const end = addMinutes(start, slotDuration);
      slots.push({ start, end, hour, minute });
    }
  }

  return slots;
}

/**
 * Get the time slot for a given date
 */
export function getTimeSlotForDate(
  date: Date,
  slotDuration: number = 30
): { hour: number; minute: number } {
  const hour = getHours(date);
  const minute = Math.floor(getMinutes(date) / slotDuration) * slotDuration;
  return { hour, minute };
}

/**
 * Snap a date to the nearest slot
 */
export function snapToSlot(date: Date, slotDuration: number = 30): Date {
  const { hour, minute } = getTimeSlotForDate(date, slotDuration);
  return setMinutes(setHours(date, hour), minute);
}

// ============================================================================
// DURATION CALCULATIONS
// ============================================================================

/**
 * Calculate duration between two dates in minutes
 */
export function getDurationMinutes(start: Date, end: Date): number {
  return differenceInMinutes(end, start);
}

/**
 * Calculate duration between two dates in hours
 */
export function getDurationHours(start: Date, end: Date): number {
  return differenceInHours(end, start);
}

/**
 * Add duration to a date
 */
export function addDuration(date: Date, minutes: number): Date {
  return addMinutes(date, minutes);
}

/**
 * Convert pomodoros to minutes
 */
export function pomodorosToMinutes(
  pomodoros: number,
  pomodoroLength: number = 25
): number {
  return pomodoros * pomodoroLength;
}

/**
 * Estimate pomodoros for a duration
 */
export function estimatePomodoros(
  durationMinutes: number,
  pomodoroLength: number = 25
): number {
  return Math.ceil(durationMinutes / pomodoroLength);
}

// ============================================================================
// ENERGY ZONES
// ============================================================================

interface EnergyZoneConfig {
  morningStart: number;
  morningEnd: number;
  middayEnd: number;
  afternoonEnd: number;
}

const defaultEnergyConfig: EnergyZoneConfig = {
  morningStart: 6,
  morningEnd: 12,
  middayEnd: 14,
  afternoonEnd: 18,
};

/**
 * Get energy level for a given hour
 */
export function getEnergyLevel(
  hour: number,
  config: Partial<EnergyZoneConfig> = {}
): EnergyRequired {
  const { morningStart, morningEnd, middayEnd, afternoonEnd } = {
    ...defaultEnergyConfig,
    ...config,
  };

  if (hour >= morningStart && hour < morningEnd) {
    return 'high'; // Morning peak
  }
  if (hour >= morningEnd && hour < middayEnd) {
    return 'medium'; // Midday
  }
  if (hour >= middayEnd && hour < afternoonEnd) {
    return 'low'; // Afternoon dip
  }
  return 'medium'; // Evening recovery
}

/**
 * Get time of day category
 */
export function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Get optimal hours for an energy level
 */
export function getOptimalHours(
  energyRequired: EnergyRequired,
  config: Partial<EnergyZoneConfig> = {}
): number[] {
  const { morningStart, morningEnd, middayEnd, afternoonEnd } = {
    ...defaultEnergyConfig,
    ...config,
  };

  switch (energyRequired) {
    case 'high':
      return Array.from(
        { length: morningEnd - morningStart },
        (_, i) => morningStart + i
      );
    case 'medium':
      return [
        ...Array.from({ length: middayEnd - morningEnd }, (_, i) => morningEnd + i),
        ...Array.from({ length: 4 }, (_, i) => afternoonEnd + i), // Evening
      ];
    case 'low':
      return Array.from(
        { length: afternoonEnd - middayEnd },
        (_, i) => middayEnd + i
      );
    default:
      return [];
  }
}

// ============================================================================
// OVERLAP DETECTION
// ============================================================================

interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Check if two time ranges overlap
 */
export function rangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
  return range1.start < range2.end && range1.end > range2.start;
}

/**
 * Check if a time is within a range
 */
export function isTimeInRange(time: Date, range: TimeRange): boolean {
  return time >= range.start && time < range.end;
}

/**
 * Get overlapping ranges from a list
 */
export function findOverlappingRanges(ranges: TimeRange[]): TimeRange[][] {
  const groups: TimeRange[][] = [];
  const sorted = [...ranges].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  for (const range of sorted) {
    // Find if this range overlaps with any existing group
    let addedToGroup = false;
    for (const group of groups) {
      if (group.some((r) => rangesOverlap(r, range))) {
        group.push(range);
        addedToGroup = true;
        break;
      }
    }
    if (!addedToGroup) {
      groups.push([range]);
    }
  }

  // Return only groups with more than one item (actual overlaps)
  return groups.filter((g) => g.length > 1);
}

// ============================================================================
// POSITION CALCULATIONS (for calendar rendering)
// ============================================================================

/**
 * Calculate the top position (percentage) for a time item
 */
export function calculateTopPosition(
  date: Date,
  hourStart: number,
  hourEnd: number
): number {
  const totalHours = hourEnd - hourStart;
  const hour = getHours(date);
  const minute = getMinutes(date);
  const hoursFromStart = hour - hourStart + minute / 60;
  return (hoursFromStart / totalHours) * 100;
}

/**
 * Calculate the height (percentage) for a duration
 */
export function calculateHeightPercentage(
  durationMinutes: number,
  hourStart: number,
  hourEnd: number
): number {
  const totalMinutes = (hourEnd - hourStart) * 60;
  return (durationMinutes / totalMinutes) * 100;
}

/**
 * Calculate pixel position from percentage
 */
export function percentageToPixels(
  percentage: number,
  containerHeight: number
): number {
  return (percentage / 100) * containerHeight;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const timeUtils = {
  // Parsing
  parseDate,
  parseDateSafe,
  isValidDateString,

  // Formatting
  formatFullDate,
  formatShortDate,
  formatMonthYear,
  formatWeekRange,
  formatTime,
  formatTimeFromHoursMinutes,
  formatDuration,
  formatRelative,
  formatSmartDate,

  // Date ranges
  getWeekDays,
  getMonthDays,
  areSameDay,
  isInMonth,

  // Time slots
  generateTimeSlots,
  getTimeSlotForDate,
  snapToSlot,

  // Duration
  getDurationMinutes,
  getDurationHours,
  addDuration,
  pomodorosToMinutes,
  estimatePomodoros,

  // Energy
  getEnergyLevel,
  getTimeOfDay,
  getOptimalHours,

  // Overlap
  rangesOverlap,
  isTimeInRange,
  findOverlappingRanges,

  // Position
  calculateTopPosition,
  calculateHeightPercentage,
  percentageToPixels,
};

export default timeUtils;
