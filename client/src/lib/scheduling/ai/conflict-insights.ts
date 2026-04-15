/**
 * Conflict Insights Service
 *
 * Intelligent analysis of scheduling conflicts, recurring patterns,
 * no-shows, and frequently rescheduled events.
 */

import {
  differenceInMinutes,
  differenceInDays,
  format,
  getDay,
  getHours,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  addWeeks,
  subWeeks,
  isWithinInterval,
} from "date-fns";
import { fr } from "date-fns/locale";
import type {
  ScheduleBlock,
  ConflictInfo,
  SchedulingSuggestion,
  DateRange,
} from "../types/scheduling";

// ============================================================================
// Types
// ============================================================================

export interface ConflictPattern {
  id: string;
  type: "recurring-conflict" | "no-show" | "frequent-reschedule" | "overload";
  severity: "low" | "medium" | "high";
  frequency: number; // Number of occurrences
  description: string;
  affectedEvents: ScheduleBlock[];
  timeSlot?: {
    dayOfWeek: number;
    hour: number;
  };
  suggestions: SchedulingSuggestion[];
}

export interface ConflictInsightResult {
  patterns: ConflictPattern[];
  summary: {
    totalConflicts: number;
    recurringConflicts: number;
    noShows: number;
    rescheduled: number;
    overloadedDays: number;
  };
  hotspots: TimeHotspot[];
}

export interface TimeHotspot {
  dayOfWeek: number;
  hour: number;
  conflictCount: number;
  severity: "low" | "medium" | "high";
}

export interface ConflictInsightOptions {
  /** Number of weeks to analyze */
  weeksToAnalyze?: number;
  /** Minimum occurrences to be considered a pattern */
  minOccurrences?: number;
  /** Include cancelled events analysis */
  includeCancelled?: boolean;
  /** Include rescheduled events analysis */
  includeRescheduled?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: Required<ConflictInsightOptions> = {
  weeksToAnalyze: 8,
  minOccurrences: 2,
  includeCancelled: true,
  includeRescheduled: true,
};

const DAY_NAMES = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

// ============================================================================
// Main Analysis Function
// ============================================================================

export function analyzeConflictPatterns(
  events: ScheduleBlock[],
  options: ConflictInsightOptions = {},
): ConflictInsightResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const now = new Date();
  const analysisRange: DateRange = {
    start: subWeeks(now, opts.weeksToAnalyze),
    end: now,
  };

  const patterns: ConflictPattern[] = [];
  const hotspots: TimeHotspot[] = [];

  // Analyze recurring conflicts
  const recurringConflicts = findRecurringConflicts(
    events,
    analysisRange,
    opts,
  );
  patterns.push(...recurringConflicts);

  // Analyze no-shows (cancelled events)
  if (opts.includeCancelled) {
    const noShowPatterns = findNoShowPatterns(events, analysisRange, opts);
    patterns.push(...noShowPatterns);
  }

  // Analyze frequently rescheduled events
  if (opts.includeRescheduled) {
    const rescheduledPatterns = findReschedulePatterns(
      events,
      analysisRange,
      opts,
    );
    patterns.push(...rescheduledPatterns);
  }

  // Analyze overloaded time slots
  const overloadPatterns = findOverloadPatterns(events, analysisRange, opts);
  patterns.push(...overloadPatterns);

  // Compute hotspots
  const conflictHotspots = computeTimeHotspots(events, analysisRange);
  hotspots.push(...conflictHotspots);

  // Compute summary
  const summary = {
    totalConflicts: patterns.length,
    recurringConflicts: patterns.filter((p) => p.type === "recurring-conflict")
      .length,
    noShows: patterns.filter((p) => p.type === "no-show").length,
    rescheduled: patterns.filter((p) => p.type === "frequent-reschedule")
      .length,
    overloadedDays: patterns.filter((p) => p.type === "overload").length,
  };

  return { patterns, summary, hotspots };
}

// ============================================================================
// Recurring Conflict Detection
// ============================================================================

function findRecurringConflicts(
  events: ScheduleBlock[],
  range: DateRange,
  opts: Required<ConflictInsightOptions>,
): ConflictPattern[] {
  const patterns: ConflictPattern[] = [];
  const conflictsBySlot: Map<string, ScheduleBlock[]> = new Map();

  // Group overlapping events by time slot
  const rangeEvents = events.filter(
    (e) => e.start >= range.start && e.start <= range.end,
  );

  // Find overlapping events
  for (let i = 0; i < rangeEvents.length; i++) {
    const event1 = rangeEvents[i];
    if (!event1.end) continue;

    for (let j = i + 1; j < rangeEvents.length; j++) {
      const event2 = rangeEvents[j];
      if (!event2.end) continue;

      // Check for overlap
      const overlaps = event1.start < event2.end && event1.end > event2.start;

      if (overlaps) {
        const dayOfWeek = getDay(event1.start);
        const hour = getHours(event1.start);
        const slotKey = `${dayOfWeek}-${hour}`;

        if (!conflictsBySlot.has(slotKey)) {
          conflictsBySlot.set(slotKey, []);
        }
        conflictsBySlot.get(slotKey)!.push(event1, event2);
      }
    }
  }

  // Convert to patterns
  conflictsBySlot.forEach((conflictEvents, slotKey) => {
    const [day, hour] = slotKey.split("-").map(Number);
    const uniqueEvents = [...new Set(conflictEvents)];

    if (uniqueEvents.length >= opts.minOccurrences) {
      const severity =
        uniqueEvents.length >= 5
          ? "high"
          : uniqueEvents.length >= 3
            ? "medium"
            : "low";

      patterns.push({
        id: `recurring-${slotKey}`,
        type: "recurring-conflict",
        severity,
        frequency: uniqueEvents.length,
        description: `Conflits r\u00e9currents le ${DAY_NAMES[day]} \u00e0 ${hour}h (${uniqueEvents.length} occurrences)`,
        affectedEvents: uniqueEvents,
        timeSlot: { dayOfWeek: day, hour },
        suggestions: [
          {
            id: `avoid-${slotKey}`,
            type: "optimization",
            title: "\u00c9viter ce cr\u00e9neau",
            description: `Consid\u00e9rez d'\u00e9viter de planifier des \u00e9v\u00e9nements le ${DAY_NAMES[day]} \u00e0 ${hour}h.`,
            confidence: 0.8,
            impact: severity,
            suggestedAction: { type: "update" },
          },
        ],
      });
    }
  });

  return patterns;
}

// ============================================================================
// No-Show Pattern Detection
// ============================================================================

function findNoShowPatterns(
  events: ScheduleBlock[],
  range: DateRange,
  opts: Required<ConflictInsightOptions>,
): ConflictPattern[] {
  const patterns: ConflictPattern[] = [];
  const cancelledBySlot: Map<string, ScheduleBlock[]> = new Map();

  // Find cancelled events
  const cancelledEvents = events.filter(
    (e) =>
      e.start >= range.start &&
      e.start <= range.end &&
      e.status === "cancelled",
  );

  // Group by day/hour
  cancelledEvents.forEach((event) => {
    const dayOfWeek = getDay(event.start);
    const hour = getHours(event.start);
    const slotKey = `${dayOfWeek}-${hour}`;

    if (!cancelledBySlot.has(slotKey)) {
      cancelledBySlot.set(slotKey, []);
    }
    cancelledBySlot.get(slotKey)!.push(event);
  });

  // Convert to patterns
  cancelledBySlot.forEach((slotEvents, slotKey) => {
    const [day, hour] = slotKey.split("-").map(Number);

    if (slotEvents.length >= opts.minOccurrences) {
      const severity =
        slotEvents.length >= 4
          ? "high"
          : slotEvents.length >= 2
            ? "medium"
            : "low";

      patterns.push({
        id: `noshow-${slotKey}`,
        type: "no-show",
        severity,
        frequency: slotEvents.length,
        description: `\u00c9v\u00e9nements souvent annul\u00e9s le ${DAY_NAMES[day]} \u00e0 ${hour}h (${slotEvents.length} annulations)`,
        affectedEvents: slotEvents,
        timeSlot: { dayOfWeek: day, hour },
        suggestions: [
          {
            id: `reschedule-noshow-${slotKey}`,
            type: "optimization",
            title: "Replanifier ce cr\u00e9neau",
            description: `Ce cr\u00e9neau voit beaucoup d'annulations. Envisagez de d\u00e9placer ces r\u00e9unions r\u00e9currentes.`,
            confidence: 0.75,
            impact: "medium",
            suggestedAction: { type: "update" },
          },
        ],
      });
    }
  });

  return patterns;
}

// ============================================================================
// Reschedule Pattern Detection
// ============================================================================

function findReschedulePatterns(
  events: ScheduleBlock[],
  range: DateRange,
  opts: Required<ConflictInsightOptions>,
): ConflictPattern[] {
  const patterns: ConflictPattern[] = [];
  const rescheduleCounts: Map<
    string,
    { count: number; events: ScheduleBlock[] }
  > = new Map();

  // Find events with sequence > 0 (indicates rescheduling)
  // In our model, we use metadata to track this
  const rangeEvents = events.filter(
    (e) =>
      e.start >= range.start &&
      e.start <= range.end &&
      e.metadata?.rescheduleCount,
  );

  // Group by recurring pattern (same title on same weekday)
  rangeEvents.forEach((event) => {
    const dayOfWeek = getDay(event.start);
    const key = `${event.title.toLowerCase().slice(0, 30)}-${dayOfWeek}`;

    if (!rescheduleCounts.has(key)) {
      rescheduleCounts.set(key, { count: 0, events: [] });
    }
    const entry = rescheduleCounts.get(key)!;
    entry.count += (event.metadata?.rescheduleCount as number) || 1;
    entry.events.push(event);
  });

  // Convert to patterns
  rescheduleCounts.forEach((entry, key) => {
    if (entry.count >= opts.minOccurrences && entry.events.length > 0) {
      const severity =
        entry.count >= 6 ? "high" : entry.count >= 3 ? "medium" : "low";

      patterns.push({
        id: `reschedule-${key}`,
        type: "frequent-reschedule",
        severity,
        frequency: entry.count,
        description: `"${entry.events[0].title}" est souvent replanifi\u00e9 (${entry.count} fois)`,
        affectedEvents: entry.events,
        suggestions: [
          {
            id: `fix-reschedule-${key}`,
            type: "optimization",
            title: "Trouver un meilleur cr\u00e9neau",
            description: `Cet \u00e9v\u00e9nement est fr\u00e9quemment d\u00e9plac\u00e9. Cherchez un cr\u00e9neau plus stable.`,
            confidence: 0.7,
            impact: "medium",
            suggestedAction: { type: "update" },
          },
        ],
      });
    }
  });

  return patterns;
}

// ============================================================================
// Overload Pattern Detection
// ============================================================================

function findOverloadPatterns(
  events: ScheduleBlock[],
  range: DateRange,
  opts: Required<ConflictInsightOptions>,
): ConflictPattern[] {
  const patterns: ConflictPattern[] = [];
  const dayLoadCounts: Map<number, number> = new Map();

  // Count events per day of week
  const rangeEvents = events.filter(
    (e) => e.start >= range.start && e.start <= range.end && e.type === "event",
  );

  rangeEvents.forEach((event) => {
    const dayOfWeek = getDay(event.start);
    dayLoadCounts.set(dayOfWeek, (dayLoadCounts.get(dayOfWeek) || 0) + 1);
  });

  // Calculate average and find overloaded days
  const totalEvents = rangeEvents.length;
  const avgEventsPerDay = totalEvents / 5; // 5 working days

  dayLoadCounts.forEach((count, dayOfWeek) => {
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) return;

    const ratio = count / avgEventsPerDay;
    if (ratio > 1.5) {
      const severity = ratio > 2 ? "high" : "medium";
      const dayEvents = rangeEvents.filter(
        (e) => getDay(e.start) === dayOfWeek,
      );

      patterns.push({
        id: `overload-${dayOfWeek}`,
        type: "overload",
        severity,
        frequency: count,
        description: `Le ${DAY_NAMES[dayOfWeek]} est surcharg\u00e9 (${Math.round(ratio * 100 - 100)}% au-dessus de la moyenne)`,
        affectedEvents: dayEvents,
        timeSlot: { dayOfWeek, hour: 0 },
        suggestions: [
          {
            id: `balance-${dayOfWeek}`,
            type: "optimization",
            title: "R\u00e9\u00e9quilibrer la semaine",
            description: `D\u00e9placez certaines r\u00e9unions du ${DAY_NAMES[dayOfWeek]} vers des jours moins charg\u00e9s.`,
            confidence: 0.75,
            impact: "medium",
            suggestedAction: { type: "update" },
          },
        ],
      });
    }
  });

  return patterns;
}

// ============================================================================
// Time Hotspot Computation
// ============================================================================

function computeTimeHotspots(
  events: ScheduleBlock[],
  range: DateRange,
): TimeHotspot[] {
  const hotspots: TimeHotspot[] = [];
  const slotConflicts: Map<string, number> = new Map();

  const rangeEvents = events.filter(
    (e) => e.start >= range.start && e.start <= range.end,
  );

  // Count conflicts per slot
  for (let i = 0; i < rangeEvents.length; i++) {
    const event1 = rangeEvents[i];
    if (!event1.end) continue;

    for (let j = i + 1; j < rangeEvents.length; j++) {
      const event2 = rangeEvents[j];
      if (!event2.end) continue;

      if (event1.start < event2.end && event1.end > event2.start) {
        const dayOfWeek = getDay(event1.start);
        const hour = getHours(event1.start);
        const key = `${dayOfWeek}-${hour}`;
        slotConflicts.set(key, (slotConflicts.get(key) || 0) + 1);
      }
    }
  }

  // Convert to hotspots
  slotConflicts.forEach((count, key) => {
    const [day, hour] = key.split("-").map(Number);
    const severity = count >= 5 ? "high" : count >= 3 ? "medium" : "low";

    hotspots.push({
      dayOfWeek: day,
      hour,
      conflictCount: count,
      severity,
    });
  });

  return hotspots.sort((a, b) => b.conflictCount - a.conflictCount);
}

// ============================================================================
// Specific Conflict Analysis
// ============================================================================

export function analyzeSpecificConflict(
  event1: ScheduleBlock,
  event2: ScheduleBlock,
): ConflictInfo {
  const overlapMinutes = calculateOverlapMinutes(event1, event2);
  const severity =
    overlapMinutes > 30 ? "high" : overlapMinutes > 15 ? "medium" : "low";

  const suggestions: SchedulingSuggestion[] = [];

  // Suggest moving the shorter event
  if (event1.end && event2.end) {
    const duration1 = differenceInMinutes(event1.end, event1.start);
    const duration2 = differenceInMinutes(event2.end, event2.start);
    const shorterEvent = duration1 < duration2 ? event1 : event2;
    const longerEvent = shorterEvent === event1 ? event2 : event1;

    suggestions.push({
      id: `move-${shorterEvent.id}`,
      type: "conflict-resolution",
      title: `D\u00e9placer "${shorterEvent.title}"`,
      description: `D\u00e9placer "${shorterEvent.title}" apr\u00e8s "${longerEvent.title}"`,
      confidence: 0.85,
      impact: "high",
      suggestedAction: {
        type: "move",
        targetId: shorterEvent.id,
        data: {
          start: longerEvent.end,
        },
      },
    });
  }

  // Suggest shortening one event
  if (overlapMinutes <= 30) {
    suggestions.push({
      id: `shorten-${event1.id}`,
      type: "conflict-resolution",
      title: "R\u00e9duire la dur\u00e9e",
      description: `Raccourcir "${event1.title}" de ${overlapMinutes} minutes`,
      confidence: 0.7,
      impact: "low",
      suggestedAction: {
        type: "update",
        targetId: event1.id,
      },
    });
  }

  return {
    id: `conflict-${event1.id}-${event2.id}`,
    type: "overlap",
    severity,
    blocks: [event1, event2],
    description: `"${event1.title}" et "${event2.title}" se chevauchent de ${overlapMinutes} minutes`,
    suggestions,
  };
}

function calculateOverlapMinutes(
  event1: ScheduleBlock,
  event2: ScheduleBlock,
): number {
  if (!event1.end || !event2.end) return 0;

  const overlapStart =
    event1.start > event2.start ? event1.start : event2.start;
  const overlapEnd = event1.end < event2.end ? event1.end : event2.end;

  if (overlapStart >= overlapEnd) return 0;

  return differenceInMinutes(overlapEnd, overlapStart);
}

// ============================================================================
// Weekly Conflict Report
// ============================================================================

export function generateWeeklyConflictReport(
  events: ScheduleBlock[],
  weekStart?: Date,
): {
  week: DateRange;
  conflicts: ConflictInfo[];
  totalConflictMinutes: number;
  mostConflictedDay: string;
  recommendations: string[];
} {
  const start = weekStart || startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = endOfWeek(start, { weekStartsOn: 1 });
  const range = { start, end };

  const weekEvents = events.filter((e) => e.start >= start && e.start <= end);

  const conflicts: ConflictInfo[] = [];
  let totalMinutes = 0;
  const conflictsByDay: Map<number, number> = new Map();

  // Find all conflicts
  for (let i = 0; i < weekEvents.length; i++) {
    const event1 = weekEvents[i];
    if (!event1.end) continue;

    for (let j = i + 1; j < weekEvents.length; j++) {
      const event2 = weekEvents[j];
      if (!event2.end) continue;

      if (event1.start < event2.end && event1.end > event2.start) {
        const conflict = analyzeSpecificConflict(event1, event2);
        conflicts.push(conflict);

        const overlapMinutes = calculateOverlapMinutes(event1, event2);
        totalMinutes += overlapMinutes;

        const day = getDay(event1.start);
        conflictsByDay.set(day, (conflictsByDay.get(day) || 0) + 1);
      }
    }
  }

  // Find most conflicted day
  let maxConflicts = 0;
  let mostConflictedDayNum = 1;
  conflictsByDay.forEach((count, day) => {
    if (count > maxConflicts) {
      maxConflicts = count;
      mostConflictedDayNum = day;
    }
  });

  // Generate recommendations
  const recommendations: string[] = [];

  if (conflicts.length > 5) {
    recommendations.push(
      "Beaucoup de conflits cette semaine. Envisagez de bloquer du temps tampon entre les r\u00e9unions.",
    );
  }

  if (totalMinutes > 60) {
    recommendations.push(
      `${Math.round(totalMinutes / 60)}h de chevauchements cette semaine. Priorisez les r\u00e9unions les plus importantes.`,
    );
  }

  if (maxConflicts > 3) {
    recommendations.push(
      `Le ${DAY_NAMES[mostConflictedDayNum]} est particuli\u00e8rement charg\u00e9. R\u00e9partissez mieux vos r\u00e9unions.`,
    );
  }

  return {
    week: range,
    conflicts,
    totalConflictMinutes: totalMinutes,
    mostConflictedDay: DAY_NAMES[mostConflictedDayNum],
    recommendations,
  };
}
