/**
 * Availability Finder Service
 *
 * Finds available time slots across multiple participants and resources.
 * Supports working hours constraints, duration requirements, and timezone handling.
 */

import {
  addDays,
  addMinutes,
  startOfDay,
  endOfDay,
  setHours,
  setMinutes,
  isWeekend,
  isBefore,
  isAfter,
  areIntervalsOverlapping,
  differenceInMinutes,
  format,
  max,
  min,
} from 'date-fns';
import type {
  ScheduleBlock,
  TeamMember,
  AvailabilitySlot,
  WorkingHours,
  DaySchedule,
} from '../types/scheduling';

// ============================================================================
// Types
// ============================================================================

export interface AvailabilityQuery {
  /** IDs of participants to find availability for */
  participantIds: string[];
  /** Required meeting duration in minutes */
  duration: number;
  /** Date range to search within */
  dateRange: {
    start: Date;
    end: Date;
  };
  /** Optional working hours override */
  workingHours?: {
    start: number; // 0-23
    end: number; // 0-23
  };
  /** Whether to include weekends */
  includeWeekends?: boolean;
  /** Minimum gap between meetings in minutes */
  bufferMinutes?: number;
  /** Preferred times of day */
  preferredTimes?: ('morning' | 'afternoon' | 'evening')[];
  /** Timezone for calculations */
  timezone?: string;
}

export interface AvailabilityResult {
  /** Available time slots where all participants are free */
  slots: CommonSlot[];
  /** Participants with their individual availability */
  participantAvailability: ParticipantAvailability[];
  /** Statistics about the search */
  stats: AvailabilityStats;
}

export interface CommonSlot {
  start: Date;
  end: Date;
  /** Score based on preferences (higher is better) */
  score: number;
  /** Why this slot scored well */
  scoreReasons: string[];
  /** Participants available for this slot */
  availableParticipants: string[];
  /** Whether all participants are available */
  allAvailable: boolean;
}

export interface ParticipantAvailability {
  participantId: string;
  name: string;
  /** Busy periods for this participant */
  busySlots: BusySlot[];
  /** Free periods for this participant */
  freeSlots: FreeSlot[];
  /** Working hours if defined */
  workingHours?: WorkingHours;
}

export interface BusySlot {
  start: Date;
  end: Date;
  reason?: string;
  eventId?: string;
}

export interface FreeSlot {
  start: Date;
  end: Date;
  /** Duration in minutes */
  duration: number;
}

export interface AvailabilityStats {
  /** Total slots found */
  totalSlots: number;
  /** Slots where all participants are available */
  slotsWithAllAvailable: number;
  /** Busiest participant */
  busiestParticipant?: {
    id: string;
    name: string;
    busyPercentage: number;
  };
  /** Most available participant */
  mostAvailableParticipant?: {
    id: string;
    name: string;
    freePercentage: number;
  };
  /** Search date range */
  dateRange: {
    start: Date;
    end: Date;
  };
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WORKING_HOURS = { start: 9, end: 18 };
const DEFAULT_BUFFER_MINUTES = 0;
const SLOT_INCREMENT_MINUTES = 15; // Check availability in 15-minute increments

const TIME_PREFERENCE_HOURS: Record<string, { start: number; end: number }> = {
  morning: { start: 9, end: 12 },
  afternoon: { start: 13, end: 17 },
  evening: { start: 17, end: 20 },
};

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Find available time slots for a group of participants
 */
export function findAvailability(
  query: AvailabilityQuery,
  events: ScheduleBlock[],
  members: TeamMember[]
): AvailabilityResult {
  const {
    participantIds,
    duration,
    dateRange,
    workingHours = DEFAULT_WORKING_HOURS,
    includeWeekends = false,
    bufferMinutes = DEFAULT_BUFFER_MINUTES,
    preferredTimes = [],
  } = query;

  // Build participant availability maps
  const participantAvailability = buildParticipantAvailability(
    participantIds,
    events,
    members,
    dateRange,
    workingHours,
    includeWeekends,
    bufferMinutes
  );

  // Find common available slots
  const commonSlots = findCommonSlots(
    participantAvailability,
    duration,
    dateRange,
    workingHours,
    includeWeekends
  );

  // Score and sort slots
  const scoredSlots = scoreSlots(commonSlots, preferredTimes, participantIds);

  // Calculate statistics
  const stats = calculateStats(
    scoredSlots,
    participantAvailability,
    dateRange,
    participantIds
  );

  return {
    slots: scoredSlots,
    participantAvailability,
    stats,
  };
}

/**
 * Find the best meeting time for a group
 */
export function suggestBestMeetingTime(
  query: AvailabilityQuery,
  events: ScheduleBlock[],
  members: TeamMember[],
  limit: number = 5
): CommonSlot[] {
  const result = findAvailability(query, events, members);

  // Return top slots where all participants are available
  const allAvailableSlots = result.slots.filter((s) => s.allAvailable);

  if (allAvailableSlots.length > 0) {
    return allAvailableSlots.slice(0, limit);
  }

  // If no slots with all available, return best partial matches
  return result.slots.slice(0, limit);
}

/**
 * Check if a specific time works for all participants
 */
export function checkTimeSlot(
  start: Date,
  end: Date,
  participantIds: string[],
  events: ScheduleBlock[]
): { available: boolean; conflicts: Array<{ participantId: string; event: ScheduleBlock }> } {
  const conflicts: Array<{ participantId: string; event: ScheduleBlock }> = [];

  for (const participantId of participantIds) {
    // Get events where this participant is involved
    const participantEvents = events.filter(
      (e) =>
        e.attendees?.some((a) => a.id === participantId) ||
        (e.metadata?.organizerId === participantId)
    );

    for (const event of participantEvents) {
      if (!event.end) continue;

      if (
        areIntervalsOverlapping(
          { start, end },
          { start: event.start, end: event.end }
        )
      ) {
        conflicts.push({ participantId, event });
      }
    }
  }

  return {
    available: conflicts.length === 0,
    conflicts,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildParticipantAvailability(
  participantIds: string[],
  events: ScheduleBlock[],
  members: TeamMember[],
  dateRange: { start: Date; end: Date },
  workingHours: { start: number; end: number },
  includeWeekends: boolean,
  bufferMinutes: number
): ParticipantAvailability[] {
  return participantIds.map((participantId) => {
    const member = members.find((m) => m.id === participantId);
    const memberWorkingHours = member?.workingHours;

    // Get events where this participant is involved
    const participantEvents = events.filter(
      (e) =>
        e.attendees?.some((a) => a.id === participantId) ||
        (e.metadata?.organizerId === participantId)
    );

    // Build busy slots from events
    const busySlots: BusySlot[] = participantEvents
      .filter((e) => e.end && isWithinDateRange(e.start, dateRange))
      .map((e) => ({
        start: addMinutes(e.start, -bufferMinutes),
        end: addMinutes(e.end!, bufferMinutes),
        reason: e.title,
        eventId: e.id,
      }));

    // Build free slots
    const freeSlots = buildFreeSlots(
      busySlots,
      dateRange,
      memberWorkingHours || {
        timezone: 'Europe/Paris',
        schedule: buildDefaultSchedule(workingHours, includeWeekends),
      },
      includeWeekends
    );

    return {
      participantId,
      name: member?.name || participantId,
      busySlots,
      freeSlots,
      workingHours: memberWorkingHours,
    };
  });
}

function buildDefaultSchedule(
  workingHours: { start: number; end: number },
  includeWeekends: boolean
): Record<string, DaySchedule | undefined> {
  const daySchedule: DaySchedule = {
    start: `${workingHours.start.toString().padStart(2, '0')}:00`,
    end: `${workingHours.end.toString().padStart(2, '0')}:00`,
  };

  return {
    monday: daySchedule,
    tuesday: daySchedule,
    wednesday: daySchedule,
    thursday: daySchedule,
    friday: daySchedule,
    saturday: includeWeekends ? daySchedule : undefined,
    sunday: includeWeekends ? daySchedule : undefined,
  };
}

function buildFreeSlots(
  busySlots: BusySlot[],
  dateRange: { start: Date; end: Date },
  workingHours: WorkingHours,
  includeWeekends: boolean
): FreeSlot[] {
  const freeSlots: FreeSlot[] = [];
  let current = startOfDay(dateRange.start);
  const end = endOfDay(dateRange.end);

  while (isBefore(current, end)) {
    // Skip weekends if needed
    if (!includeWeekends && isWeekend(current)) {
      current = addDays(current, 1);
      continue;
    }

    // Get working hours for this day
    const dayName = format(current, 'EEEE').toLowerCase() as keyof typeof workingHours.schedule;
    const daySchedule = workingHours.schedule[dayName];

    if (!daySchedule) {
      current = addDays(current, 1);
      continue;
    }

    // Parse working hours
    const [startHour, startMin] = daySchedule.start.split(':').map(Number);
    const [endHour, endMin] = daySchedule.end.split(':').map(Number);

    let dayStart = setMinutes(setHours(current, startHour), startMin);
    const dayEnd = setMinutes(setHours(current, endHour), endMin);

    // Ensure we don't go before the query start
    dayStart = max([dayStart, dateRange.start]);

    // Find free periods within this day
    const dayBusySlots = busySlots
      .filter(
        (b) =>
          areIntervalsOverlapping(
            { start: dayStart, end: dayEnd },
            { start: b.start, end: b.end }
          )
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let slotStart = dayStart;

    for (const busy of dayBusySlots) {
      if (isBefore(slotStart, busy.start)) {
        const slotEnd = min([busy.start, dayEnd]);
        const duration = differenceInMinutes(slotEnd, slotStart);
        if (duration >= SLOT_INCREMENT_MINUTES) {
          freeSlots.push({ start: slotStart, end: slotEnd, duration });
        }
      }
      slotStart = max([slotStart, busy.end]);
    }

    // Add remaining time after last busy slot
    if (isBefore(slotStart, dayEnd)) {
      const duration = differenceInMinutes(dayEnd, slotStart);
      if (duration >= SLOT_INCREMENT_MINUTES) {
        freeSlots.push({ start: slotStart, end: dayEnd, duration });
      }
    }

    current = addDays(current, 1);
  }

  return freeSlots;
}

function findCommonSlots(
  participantAvailability: ParticipantAvailability[],
  duration: number,
  dateRange: { start: Date; end: Date },
  workingHours: { start: number; end: number },
  includeWeekends: boolean
): CommonSlot[] {
  const commonSlots: CommonSlot[] = [];

  if (participantAvailability.length === 0) return commonSlots;

  // Start with the first participant's free slots
  const firstParticipant = participantAvailability[0];

  for (const freeSlot of firstParticipant.freeSlots) {
    // Skip slots that are too short
    if (freeSlot.duration < duration) continue;

    // Generate candidate slots within this free period
    let slotStart = freeSlot.start;
    const slotEndLimit = addMinutes(freeSlot.end, -duration);

    while (isBefore(slotStart, slotEndLimit) || slotStart.getTime() === slotEndLimit.getTime()) {
      const slotEnd = addMinutes(slotStart, duration);

      // Check if this slot works for other participants
      const availableParticipants: string[] = [firstParticipant.participantId];

      for (let i = 1; i < participantAvailability.length; i++) {
        const participant = participantAvailability[i];
        const isAvailable = participant.freeSlots.some((fs) =>
          isSlotContained({ start: slotStart, end: slotEnd }, fs)
        );
        if (isAvailable) {
          availableParticipants.push(participant.participantId);
        }
      }

      commonSlots.push({
        start: slotStart,
        end: slotEnd,
        score: 0,
        scoreReasons: [],
        availableParticipants,
        allAvailable: availableParticipants.length === participantAvailability.length,
      });

      slotStart = addMinutes(slotStart, SLOT_INCREMENT_MINUTES);
    }
  }

  return commonSlots;
}

function isSlotContained(
  slot: { start: Date; end: Date },
  freeSlot: FreeSlot
): boolean {
  return (
    (isAfter(slot.start, freeSlot.start) || slot.start.getTime() === freeSlot.start.getTime()) &&
    (isBefore(slot.end, freeSlot.end) || slot.end.getTime() === freeSlot.end.getTime())
  );
}

function scoreSlots(
  slots: CommonSlot[],
  preferredTimes: ('morning' | 'afternoon' | 'evening')[],
  participantIds: string[]
): CommonSlot[] {
  return slots
    .map((slot) => {
      let score = 0;
      const scoreReasons: string[] = [];

      // Score based on number of available participants
      const availabilityScore = (slot.availableParticipants.length / participantIds.length) * 50;
      score += availabilityScore;
      if (slot.allAvailable) {
        scoreReasons.push('Tous les participants sont disponibles');
      } else {
        scoreReasons.push(
          `${slot.availableParticipants.length}/${participantIds.length} participants disponibles`
        );
      }

      // Score based on preferred times
      const hour = slot.start.getHours();
      for (const pref of preferredTimes) {
        const range = TIME_PREFERENCE_HOURS[pref];
        if (hour >= range.start && hour < range.end) {
          score += 20;
          scoreReasons.push(`Créneau ${pref === 'morning' ? 'matinée' : pref === 'afternoon' ? 'après-midi' : 'soirée'} préféré`);
          break;
        }
      }

      // Prefer earlier in the day (within working hours)
      if (hour >= 9 && hour <= 11) {
        score += 10;
        scoreReasons.push('Début de journée');
      }

      // Prefer slots not too close to lunch
      if (hour >= 12 && hour <= 14) {
        score -= 5;
      }

      // Prefer slots not too late
      if (hour >= 17) {
        score -= 10;
      }

      return { ...slot, score, scoreReasons };
    })
    .sort((a, b) => {
      // First sort by all available
      if (a.allAvailable && !b.allAvailable) return -1;
      if (!a.allAvailable && b.allAvailable) return 1;
      // Then by score
      if (b.score !== a.score) return b.score - a.score;
      // Then by date (earlier first)
      return a.start.getTime() - b.start.getTime();
    });
}

function calculateStats(
  slots: CommonSlot[],
  participantAvailability: ParticipantAvailability[],
  dateRange: { start: Date; end: Date },
  participantIds: string[]
): AvailabilityStats {
  const totalMinutes = differenceInMinutes(dateRange.end, dateRange.start);

  // Calculate busy percentages
  const busyPercentages = participantAvailability.map((pa) => {
    const busyMinutes = pa.busySlots.reduce((sum, slot) => {
      const slotStart = max([slot.start, dateRange.start]);
      const slotEnd = min([slot.end, dateRange.end]);
      return sum + Math.max(0, differenceInMinutes(slotEnd, slotStart));
    }, 0);
    return {
      id: pa.participantId,
      name: pa.name,
      busyPercentage: (busyMinutes / totalMinutes) * 100,
      freePercentage: ((totalMinutes - busyMinutes) / totalMinutes) * 100,
    };
  });

  const busiest = busyPercentages.reduce(
    (max, p) => (p.busyPercentage > max.busyPercentage ? p : max),
    busyPercentages[0]
  );

  const mostAvailable = busyPercentages.reduce(
    (max, p) => (p.freePercentage > max.freePercentage ? p : max),
    busyPercentages[0]
  );

  return {
    totalSlots: slots.length,
    slotsWithAllAvailable: slots.filter((s) => s.allAvailable).length,
    busiestParticipant: busiest
      ? { id: busiest.id, name: busiest.name, busyPercentage: busiest.busyPercentage }
      : undefined,
    mostAvailableParticipant: mostAvailable
      ? { id: mostAvailable.id, name: mostAvailable.name, freePercentage: mostAvailable.freePercentage }
      : undefined,
    dateRange,
  };
}

function isWithinDateRange(date: Date, range: { start: Date; end: Date }): boolean {
  return (
    (isAfter(date, range.start) || date.getTime() === range.start.getTime()) &&
    (isBefore(date, range.end) || date.getTime() === range.end.getTime())
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a slot for display
 */
export function formatSlotTime(slot: CommonSlot): string {
  const startStr = format(slot.start, 'EEEE d MMMM HH:mm');
  const endStr = format(slot.end, 'HH:mm');
  return `${startStr} - ${endStr}`;
}

/**
 * Group slots by day for display
 */
export function groupSlotsByDay(slots: CommonSlot[]): Map<string, CommonSlot[]> {
  const groups = new Map<string, CommonSlot[]>();

  for (const slot of slots) {
    const dayKey = format(slot.start, 'yyyy-MM-dd');
    const existing = groups.get(dayKey) || [];
    existing.push(slot);
    groups.set(dayKey, existing);
  }

  return groups;
}

/**
 * Get availability summary text
 */
export function getAvailabilitySummary(result: AvailabilityResult): string {
  const { stats } = result;

  if (stats.totalSlots === 0) {
    return 'Aucun créneau disponible trouvé dans la période sélectionnée.';
  }

  if (stats.slotsWithAllAvailable > 0) {
    return `${stats.slotsWithAllAvailable} créneau${stats.slotsWithAllAvailable > 1 ? 'x' : ''} où tous les participants sont disponibles.`;
  }

  return `${stats.totalSlots} créneau${stats.totalSlots > 1 ? 'x' : ''} trouvé${stats.totalSlots > 1 ? 's' : ''}, mais aucun ne convient à tous les participants.`;
}
