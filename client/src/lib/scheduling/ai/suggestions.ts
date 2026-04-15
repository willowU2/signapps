/**
 * AI Scheduling Suggestions Service
 *
 * Analyzes user patterns and provides intelligent scheduling suggestions
 * including optimal time blocks, conflict resolutions, and optimizations.
 */

import {
  startOfDay,
  endOfDay,
  addDays,
  addHours,
  addMinutes,
  differenceInMinutes,
  getDay,
  getHours,
  setHours,
  setMinutes,
  isBefore,
  isAfter,
  isWithinInterval,
  eachDayOfInterval,
  format,
} from "date-fns";
import { fr } from "date-fns/locale";
import type {
  ScheduleBlock,
  SchedulingSuggestion,
  Task,
  DateRange,
  ConflictInfo,
  WorkloadData,
  ViewConfig,
} from "../types/scheduling";

// ============================================================================
// Types
// ============================================================================

export interface SuggestionContext {
  events: ScheduleBlock[];
  tasks: Task[];
  workload?: WorkloadData[];
  config: ViewConfig;
  now?: Date;
}

export interface PatternAnalysis {
  preferredMeetingTimes: { hour: number; score: number }[];
  preferredFocusTimes: { hour: number; score: number }[];
  averageMeetingDuration: number;
  busiestDays: number[];
  quietestDays: number[];
  typicalStartHour: number;
  typicalEndHour: number;
}

export interface SuggestionOptions {
  /** Number of days to analyze for patterns */
  patternDays?: number;
  /** Number of suggestions to generate */
  maxSuggestions?: number;
  /** Include conflict resolution suggestions */
  includeConflicts?: boolean;
  /** Include time block suggestions */
  includeTimeBlocks?: boolean;
  /** Include optimization suggestions */
  includeOptimizations?: boolean;
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: Required<SuggestionOptions> = {
  patternDays: 30,
  maxSuggestions: 5,
  includeConflicts: true,
  includeTimeBlocks: true,
  includeOptimizations: true,
  minConfidence: 0.5,
};

// Optimal hour ranges for different activities
const FOCUS_TIME_HOURS = [9, 10, 11, 14, 15]; // Morning and early afternoon
const MEETING_HOURS = [10, 11, 14, 15, 16]; // Mid-morning to late afternoon

// ============================================================================
// Main Suggestion Generator
// ============================================================================

export function generateSuggestions(
  context: SuggestionContext,
  options: SuggestionOptions = {},
): SchedulingSuggestion[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const now = context.now || new Date();
  const suggestions: SchedulingSuggestion[] = [];

  // Analyze user patterns
  const patterns = analyzePatterns(context.events, opts.patternDays, now);

  // Generate focus time suggestions
  if (opts.includeTimeBlocks) {
    const focusSuggestions = suggestFocusBlocks(context, patterns, now);
    suggestions.push(...focusSuggestions);
  }

  // Generate conflict resolution suggestions
  if (opts.includeConflicts) {
    const conflictSuggestions = suggestConflictResolutions(context.events, now);
    suggestions.push(...conflictSuggestions);
  }

  // Generate optimization suggestions
  if (opts.includeOptimizations) {
    const optimizationSuggestions = suggestOptimizations(
      context,
      patterns,
      now,
    );
    suggestions.push(...optimizationSuggestions);
  }

  // Filter by confidence and limit
  return suggestions
    .filter((s) => s.confidence >= opts.minConfidence)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, opts.maxSuggestions);
}

// ============================================================================
// Pattern Analysis
// ============================================================================

export function analyzePatterns(
  events: ScheduleBlock[],
  days: number,
  now: Date,
): PatternAnalysis {
  const startDate = addDays(now, -days);
  const pastEvents = events.filter(
    (e) => e.start >= startDate && e.start < now && e.type === "event",
  );

  // Analyze meeting times
  const hourCounts: Record<number, number> = {};
  const dayCounts: Record<number, number> = {};
  let totalDuration = 0;
  let meetingCount = 0;

  pastEvents.forEach((event) => {
    const hour = getHours(event.start);
    const day = getDay(event.start);

    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    dayCounts[day] = (dayCounts[day] || 0) + 1;

    if (event.end) {
      totalDuration += differenceInMinutes(event.end, event.start);
      meetingCount++;
    }
  });

  // Calculate preferred meeting times
  const preferredMeetingTimes = Object.entries(hourCounts)
    .map(([hour, count]) => ({
      hour: parseInt(hour, 10),
      score: count / pastEvents.length,
    }))
    .sort((a, b) => b.score - a.score);

  // Calculate preferred focus times (inverse of meeting times)
  const preferredFocusTimes = FOCUS_TIME_HOURS.map((hour) => ({
    hour,
    score: 1 - (hourCounts[hour] || 0) / Math.max(pastEvents.length, 1),
  })).sort((a, b) => b.score - a.score);

  // Find busiest and quietest days
  const dayScores = Object.entries(dayCounts)
    .map(([day, count]) => ({ day: parseInt(day, 10), count }))
    .sort((a, b) => b.count - a.count);

  const busiestDays = dayScores.slice(0, 3).map((d) => d.day);
  const quietestDays = dayScores.slice(-2).map((d) => d.day);

  // Find typical working hours
  const eventHours = pastEvents
    .map((e) => getHours(e.start))
    .sort((a, b) => a - b);
  const typicalStartHour = eventHours.length > 0 ? eventHours[0] : 9;
  const typicalEndHour =
    eventHours.length > 0 ? eventHours[eventHours.length - 1] : 18;

  return {
    preferredMeetingTimes,
    preferredFocusTimes,
    averageMeetingDuration:
      meetingCount > 0 ? totalDuration / meetingCount : 60,
    busiestDays,
    quietestDays,
    typicalStartHour,
    typicalEndHour,
  };
}

// ============================================================================
// Focus Block Suggestions
// ============================================================================

function suggestFocusBlocks(
  context: SuggestionContext,
  patterns: PatternAnalysis,
  now: Date,
): SchedulingSuggestion[] {
  const suggestions: SchedulingSuggestion[] = [];
  const nextWeek = eachDayOfInterval({
    start: addDays(now, 1),
    end: addDays(now, 7),
  });

  // Find best focus time slots
  for (const day of nextWeek) {
    const dayEvents = context.events.filter(
      (e) =>
        e.start >= startOfDay(day) &&
        e.start < endOfDay(day) &&
        e.type === "event",
    );

    // Check each preferred focus hour
    for (const { hour, score } of patterns.preferredFocusTimes.slice(0, 3)) {
      const slotStart = setMinutes(setHours(day, hour), 0);
      const slotEnd = addHours(slotStart, 2); // 2-hour focus block

      // Check if slot is free
      const hasConflict = dayEvents.some(
        (e) =>
          (e.end &&
            isWithinInterval(slotStart, { start: e.start, end: e.end })) ||
          isWithinInterval(slotEnd, { start: e.start, end: e.end! }),
      );

      if (!hasConflict) {
        const confidence = Math.min(0.9, score * 0.7 + 0.3);

        suggestions.push({
          id: `focus-${format(slotStart, "yyyy-MM-dd-HH")}`,
          type: "time-block",
          title: "Bloc de concentration recommand\u00e9",
          description: `${format(slotStart, "EEEE d MMMM", { locale: fr })} de ${format(slotStart, "HH:mm")} \u00e0 ${format(slotEnd, "HH:mm")}. Ce cr\u00e9neau est g\u00e9n\u00e9ralement calme pour vous.`,
          confidence,
          impact: "medium",
          suggestedAction: {
            type: "create",
            data: {
              type: "event",
              title: "Focus Time",
              start: slotStart,
              end: slotEnd,
              allDay: false,
              color: "#10b981", // Green for focus
              status: "confirmed",
            } as Partial<ScheduleBlock>,
          },
          reasoning: `Bas\u00e9 sur vos habitudes, vous avez peu de r\u00e9unions \u00e0 ${hour}h. Ce cr\u00e9neau est id\u00e9al pour le travail concentr\u00e9.`,
        });

        break; // Only one suggestion per day
      }
    }
  }

  return suggestions.slice(0, 3); // Max 3 focus suggestions
}

// ============================================================================
// Conflict Resolution Suggestions
// ============================================================================

function suggestConflictResolutions(
  events: ScheduleBlock[],
  now: Date,
): SchedulingSuggestion[] {
  const suggestions: SchedulingSuggestion[] = [];
  const futureEvents = events.filter(
    (e) => e.start >= now && e.type === "event",
  );

  // Find overlapping events
  for (let i = 0; i < futureEvents.length; i++) {
    const event1 = futureEvents[i];
    if (!event1.end) continue;

    for (let j = i + 1; j < futureEvents.length; j++) {
      const event2 = futureEvents[j];
      if (!event2.end) continue;

      // Check for overlap
      const overlap =
        (event1.start < event2.end && event1.end > event2.start) ||
        (event2.start < event1.end && event2.end > event1.start);

      if (overlap) {
        const overlapMinutes = Math.min(
          differenceInMinutes(event1.end, event2.start),
          differenceInMinutes(event2.end, event1.start),
        );

        // Suggest moving the shorter event
        const eventToMove =
          differenceInMinutes(event1.end, event1.start) <
          differenceInMinutes(event2.end, event2.start)
            ? event1
            : event2;
        const otherEvent = eventToMove === event1 ? event2 : event1;

        // Find next available slot after the other event
        const newStart = otherEvent.end!;
        const duration = differenceInMinutes(
          eventToMove.end!,
          eventToMove.start,
        );
        const newEnd = addMinutes(newStart, duration);

        suggestions.push({
          id: `conflict-${eventToMove.id}`,
          type: "conflict-resolution",
          title: "Conflit d\u00e9tect\u00e9",
          description: `"${eventToMove.title}" chevauche "${otherEvent.title}" de ${overlapMinutes} minutes.`,
          confidence: 0.85,
          impact: "high",
          suggestedAction: {
            type: "move",
            targetId: eventToMove.id,
            data: {
              start: newStart,
              end: newEnd,
            },
          },
          reasoning: `D\u00e9placer "${eventToMove.title}" apr\u00e8s "${otherEvent.title}" r\u00e9sout le conflit.`,
          alternatives: [
            {
              id: `conflict-${eventToMove.id}-alt`,
              type: "conflict-resolution",
              title: "Alternative: d\u00e9placer l'autre \u00e9v\u00e9nement",
              description: `D\u00e9placer "${otherEvent.title}" \u00e0 la place`,
              confidence: 0.7,
              impact: "high",
              suggestedAction: {
                type: "move",
                targetId: otherEvent.id,
                data: {
                  start: eventToMove.end,
                  end: addMinutes(
                    eventToMove.end!,
                    differenceInMinutes(otherEvent.end!, otherEvent.start),
                  ),
                },
              },
            },
          ],
        });
      }
    }
  }

  return suggestions.slice(0, 3); // Max 3 conflict suggestions
}

// ============================================================================
// Optimization Suggestions
// ============================================================================

function suggestOptimizations(
  context: SuggestionContext,
  patterns: PatternAnalysis,
  now: Date,
): SchedulingSuggestion[] {
  const suggestions: SchedulingSuggestion[] = [];
  const tomorrow = addDays(startOfDay(now), 1);
  const nextWeekEnd = addDays(tomorrow, 7);

  const upcomingEvents = context.events.filter(
    (e) => e.start >= tomorrow && e.start < nextWeekEnd && e.type === "event",
  );

  // Check for meeting clusters that could be consolidated
  const meetingsByDay: Record<string, ScheduleBlock[]> = {};
  upcomingEvents.forEach((event) => {
    const dayKey = format(event.start, "yyyy-MM-dd");
    if (!meetingsByDay[dayKey]) meetingsByDay[dayKey] = [];
    meetingsByDay[dayKey].push(event);
  });

  Object.entries(meetingsByDay).forEach(([dayKey, dayEvents]) => {
    if (dayEvents.length < 3) return;

    // Check for fragmented meetings (short gaps between)
    const sortedEvents = dayEvents.sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );
    let fragmentedCount = 0;

    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const current = sortedEvents[i];
      const next = sortedEvents[i + 1];
      if (current.end) {
        const gap = differenceInMinutes(next.start, current.end);
        if (gap > 0 && gap < 30) {
          fragmentedCount++;
        }
      }
    }

    if (fragmentedCount >= 2) {
      const dayDate = new Date(dayKey);
      suggestions.push({
        id: `optimize-${dayKey}`,
        type: "optimization",
        title: "Journ\u00e9e fragment\u00e9e d\u00e9tect\u00e9e",
        description: `Le ${format(dayDate, "EEEE d MMMM", { locale: fr })}, vous avez ${dayEvents.length} r\u00e9unions avec des pauses trop courtes entre elles.`,
        confidence: 0.75,
        impact: "medium",
        suggestedAction: {
          type: "update",
        },
        reasoning:
          "Regrouper les r\u00e9unions permettrait de lib\u00e9rer des blocs de temps plus longs pour le travail concentr\u00e9.",
      });
    }
  });

  // Check for early morning or late evening meetings (outside typical hours)
  upcomingEvents.forEach((event) => {
    const hour = getHours(event.start);
    if (hour < patterns.typicalStartHour || hour > patterns.typicalEndHour) {
      suggestions.push({
        id: `optimize-time-${event.id}`,
        type: "optimization",
        title: "R\u00e9union hors heures habituelles",
        description: `"${event.title}" est planifi\u00e9 \u00e0 ${format(event.start, "HH:mm")}, en dehors de vos heures de travail typiques (${patterns.typicalStartHour}h-${patterns.typicalEndHour}h).`,
        confidence: 0.65,
        impact: "low",
        suggestedAction: {
          type: "move",
          targetId: event.id,
        },
        reasoning:
          "Envisagez de d\u00e9placer cette r\u00e9union vers vos heures de travail habituelles pour un meilleur \u00e9quilibre.",
      });
    }
  });

  // Check for back-to-back meetings without breaks
  upcomingEvents.forEach((event) => {
    if (!event.end) return;

    const nextEvent = upcomingEvents.find(
      (e) => e.id !== event.id && e.start.getTime() === event.end!.getTime(),
    );

    if (nextEvent) {
      suggestions.push({
        id: `optimize-break-${event.id}`,
        type: "optimization",
        title: "R\u00e9unions cons\u00e9cutives",
        description: `"${event.title}" et "${nextEvent.title}" sont encha\u00een\u00e9s sans pause.`,
        confidence: 0.7,
        impact: "low",
        suggestedAction: {
          type: "update",
          targetId: event.id,
          data: {
            end: addMinutes(event.end, -5), // Shorten by 5 min
          },
        },
        reasoning:
          "Ajouter une pause de 5-10 minutes entre les r\u00e9unions am\u00e9liore la concentration et r\u00e9duit la fatigue.",
      });
    }
  });

  return suggestions;
}

// ============================================================================
// Detect Recurring Patterns
// ============================================================================

export function detectRecurringConflicts(
  events: ScheduleBlock[],
  weeks: number = 4,
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];
  const now = new Date();
  const startDate = addDays(now, -weeks * 7);

  const pastEvents = events.filter(
    (e) => e.start >= startDate && e.start < now && e.status === "cancelled",
  );

  // Group cancelled events by day of week and hour
  const cancelledPatterns: Record<string, ScheduleBlock[]> = {};

  pastEvents.forEach((event) => {
    const key = `${getDay(event.start)}-${getHours(event.start)}`;
    if (!cancelledPatterns[key]) cancelledPatterns[key] = [];
    cancelledPatterns[key].push(event);
  });

  // Find patterns with multiple cancellations
  Object.entries(cancelledPatterns).forEach(([key, cancelledEvents]) => {
    if (cancelledEvents.length >= 2) {
      const [day, hour] = key.split("-").map(Number);
      const dayNames = [
        "dimanche",
        "lundi",
        "mardi",
        "mercredi",
        "jeudi",
        "vendredi",
        "samedi",
      ];

      conflicts.push({
        id: `recurring-cancel-${key}`,
        type: "preference",
        severity: "medium",
        blocks: cancelledEvents,
        description: `Les r\u00e9unions \u00e0 ${hour}h le ${dayNames[day]} sont souvent annul\u00e9es (${cancelledEvents.length} fois).`,
        suggestions: [
          {
            id: `avoid-${key}`,
            type: "optimization",
            title: "\u00c9viter ce cr\u00e9neau",
            description: `Consid\u00e9rez d'\u00e9viter de planifier des r\u00e9unions \u00e0 ${hour}h le ${dayNames[day]}.`,
            confidence: 0.8,
            impact: "medium",
            suggestedAction: { type: "update" },
          },
        ],
      });
    }
  });

  return conflicts;
}

// ============================================================================
// Best Meeting Time Finder
// ============================================================================

export function findBestMeetingTime(
  events: ScheduleBlock[],
  duration: number, // minutes
  dateRange: DateRange,
  patterns: PatternAnalysis,
): DateRange[] {
  const slots: DateRange[] = [];
  const days = eachDayOfInterval(dateRange);

  for (const day of days) {
    const dayOfWeek = getDay(day);

    // Skip weekends by default
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    // Check each preferred meeting hour
    for (const { hour, score } of patterns.preferredMeetingTimes) {
      if (
        hour < patterns.typicalStartHour ||
        hour > patterns.typicalEndHour - 1
      )
        continue;

      const slotStart = setMinutes(setHours(day, hour), 0);
      const slotEnd = addMinutes(slotStart, duration);

      // Check for conflicts
      const hasConflict = events.some((e) => {
        if (!e.end) return false;
        return (
          (slotStart >= e.start && slotStart < e.end) ||
          (slotEnd > e.start && slotEnd <= e.end) ||
          (slotStart <= e.start && slotEnd >= e.end)
        );
      });

      if (!hasConflict) {
        slots.push({ start: slotStart, end: slotEnd });
      }
    }
  }

  // Sort by pattern score (implicitly from preferredMeetingTimes order)
  return slots.slice(0, 5);
}
