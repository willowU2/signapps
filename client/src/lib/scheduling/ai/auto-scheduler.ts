/**
 * Auto-Scheduler Service
 *
 * Automatically schedule tasks based on constraints, deadlines,
 * priorities, and user preferences.
 */

import {
  addDays,
  addMinutes,
  startOfDay,
  endOfDay,
  setHours,
  setMinutes,
  getDay,
  getHours,
  isBefore,
  isAfter,
  differenceInMinutes,
  eachDayOfInterval,
  format,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type {
  Task,
  ScheduleBlock,
  AutoScheduleRequest,
  AutoScheduleResult,
  AutoScheduleConstraints,
  AutoSchedulePreferences,
  DateRange,
  ConflictInfo,
} from '../types/scheduling';
import { analyzePatterns, type PatternAnalysis } from './suggestions';

// ============================================================================
// Types
// ============================================================================

interface TimeSlot {
  start: Date;
  end: Date;
  duration: number; // minutes
  score: number; // Suitability score 0-1
}

interface ScheduledTask {
  task: Task;
  slot: DateRange;
  confidence: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONSTRAINTS: AutoScheduleConstraints = {
  dateRange: {
    start: new Date(),
    end: addDays(new Date(), 14),
  },
  workingHours: { start: 9, end: 18 },
  excludeDays: [0, 6], // Weekends
  respectDeadlines: true,
  minBlockSize: 30,
  maxBlockSize: 180,
};

const DEFAULT_PREFERENCES: AutoSchedulePreferences = {
  preferMorning: false,
  groupSimilarTasks: true,
  bufferBetweenTasks: 15,
  prioritizeUrgent: true,
};

const PRIORITY_WEIGHTS = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ============================================================================
// Main Auto-Scheduler
// ============================================================================

export function autoScheduleTasks(
  request: AutoScheduleRequest,
  existingEvents: ScheduleBlock[],
  patterns?: PatternAnalysis
): AutoScheduleResult {
  const constraints = { ...DEFAULT_CONSTRAINTS, ...request.constraints };
  const preferences = { ...DEFAULT_PREFERENCES, ...request.preferences };

  // Sort tasks by priority and deadline
  const sortedTasks = sortTasksForScheduling(request.tasks, preferences);

  // Find all available time slots
  let availableSlots = findAvailableSlots(constraints, existingEvents);

  // Score slots based on patterns and preferences
  if (patterns) {
    availableSlots = scoreSlots(availableSlots, patterns, preferences);
  }

  const scheduled: ScheduledTask[] = [];
  const unscheduled: Array<{ task: Task; reason: string }> = [];
  const conflicts: ConflictInfo[] = [];

  // Try to schedule each task
  for (const task of sortedTasks) {
    const result = scheduleTask(
      task,
      availableSlots,
      constraints,
      preferences,
      scheduled
    );

    if (result.success && result.slot) {
      scheduled.push({
        task,
        slot: result.slot,
        confidence: result.confidence,
      });

      // Remove used slot from available slots
      availableSlots = removeUsedSlot(availableSlots, result.slot, preferences.bufferBetweenTasks);
    } else {
      unscheduled.push({
        task,
        reason: result.reason || 'Aucun cr\u00e9neau disponible',
      });

      // Check for deadline conflicts
      if (
        constraints.respectDeadlines &&
        task.dueDate &&
        isBefore(task.dueDate, constraints.dateRange.end)
      ) {
        conflicts.push({
          id: `deadline-${task.id}`,
          type: 'deadline',
          severity: 'high',
          blocks: [],
          description: `La t\u00e2che "${task.title}" ne peut pas \u00eatre planifi\u00e9e avant sa deadline (${format(task.dueDate, 'dd/MM/yyyy')})`,
          suggestions: [],
        });
      }
    }
  }

  // Check for workload conflicts
  const workloadConflict = checkWorkloadConflict(scheduled, constraints);
  if (workloadConflict) {
    conflicts.push(workloadConflict);
  }

  return {
    scheduled: scheduled.map((s) => ({
      task: s.task,
      suggestedSlot: s.slot,
      confidence: s.confidence,
    })),
    unscheduled,
    conflicts,
  };
}

// ============================================================================
// Task Sorting
// ============================================================================

function sortTasksForScheduling(
  tasks: Task[],
  preferences: AutoSchedulePreferences
): Task[] {
  return [...tasks].sort((a, b) => {
    // Prioritize by urgency if enabled
    if (preferences.prioritizeUrgent) {
      const priorityDiff =
        PRIORITY_WEIGHTS[b.priority || 'medium'] -
        PRIORITY_WEIGHTS[a.priority || 'medium'];
      if (priorityDiff !== 0) return priorityDiff;
    }

    // Then by deadline
    if (a.dueDate && b.dueDate) {
      return a.dueDate.getTime() - b.dueDate.getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    // Then by estimated time (shorter first for better fit)
    const aTime = a.estimatedMinutes || 60;
    const bTime = b.estimatedMinutes || 60;
    return aTime - bTime;
  });
}

// ============================================================================
// Slot Finding
// ============================================================================

function findAvailableSlots(
  constraints: AutoScheduleConstraints,
  existingEvents: ScheduleBlock[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const days = eachDayOfInterval(constraints.dateRange);

  for (const day of days) {
    const dayOfWeek = getDay(day);

    // Skip excluded days
    if (constraints.excludeDays?.includes(dayOfWeek)) continue;

    // Get working hours for this day
    const dayStart = setMinutes(setHours(day, constraints.workingHours.start), 0);
    const dayEnd = setMinutes(setHours(day, constraints.workingHours.end), 0);

    // Get events for this day
    const dayEvents = existingEvents
      .filter(
        (e) =>
          e.start >= startOfDay(day) &&
          e.start < endOfDay(day) &&
          e.end
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    // Find gaps between events
    let currentStart = dayStart;

    for (const event of dayEvents) {
      if (event.start > currentStart) {
        // There's a gap before this event
        const gapEnd = event.start;
        const duration = differenceInMinutes(gapEnd, currentStart);

        if (duration >= (constraints.minBlockSize || 30)) {
          slots.push({
            start: currentStart,
            end: gapEnd,
            duration,
            score: 0.5, // Base score
          });
        }
      }

      // Move current start past this event
      if (event.end && event.end > currentStart) {
        currentStart = event.end;
      }
    }

    // Check for gap after last event
    if (currentStart < dayEnd) {
      const duration = differenceInMinutes(dayEnd, currentStart);
      if (duration >= (constraints.minBlockSize || 30)) {
        slots.push({
          start: currentStart,
          end: dayEnd,
          duration,
          score: 0.5,
        });
      }
    }
  }

  return slots;
}

// ============================================================================
// Slot Scoring
// ============================================================================

function scoreSlots(
  slots: TimeSlot[],
  patterns: PatternAnalysis,
  preferences: AutoSchedulePreferences
): TimeSlot[] {
  return slots.map((slot) => {
    let score = 0.5; // Base score

    const hour = getHours(slot.start);

    // Prefer focus times (from patterns)
    const focusTimeScore = patterns.preferredFocusTimes.find(
      (ft) => ft.hour === hour
    )?.score;
    if (focusTimeScore) {
      score += focusTimeScore * 0.3;
    }

    // Morning preference
    if (preferences.preferMorning && hour < 12) {
      score += 0.1;
    }

    // Prefer longer slots (more flexibility)
    if (slot.duration >= 120) {
      score += 0.1;
    }

    // Penalize very early or late slots
    if (hour < patterns.typicalStartHour || hour > patterns.typicalEndHour) {
      score -= 0.2;
    }

    // Normalize score to 0-1
    score = Math.max(0, Math.min(1, score));

    return { ...slot, score };
  });
}

// ============================================================================
// Task Scheduling
// ============================================================================

interface ScheduleTaskResult {
  success: boolean;
  slot?: DateRange;
  confidence: number;
  reason?: string;
}

function scheduleTask(
  task: Task,
  availableSlots: TimeSlot[],
  constraints: AutoScheduleConstraints,
  preferences: AutoSchedulePreferences,
  alreadyScheduled: ScheduledTask[]
): ScheduleTaskResult {
  const estimatedMinutes = task.estimatedMinutes || 60;

  // Respect max block size
  const maxDuration = Math.min(
    estimatedMinutes,
    constraints.maxBlockSize || 180
  );

  // Find slots that can fit this task
  const suitableSlots = availableSlots.filter((slot) => {
    // Must fit the task
    if (slot.duration < maxDuration) return false;

    // Must be before deadline if set
    if (
      constraints.respectDeadlines &&
      task.dueDate &&
      isAfter(slot.start, task.dueDate)
    ) {
      return false;
    }

    return true;
  });

  if (suitableSlots.length === 0) {
    return {
      success: false,
      confidence: 0,
      reason: task.dueDate
        ? `Aucun cr\u00e9neau disponible avant la deadline (${format(task.dueDate, 'dd/MM/yyyy')})`
        : 'Aucun cr\u00e9neau disponible de dur\u00e9e suffisante',
    };
  }

  // Sort by score and pick the best
  const sortedSlots = [...suitableSlots].sort((a, b) => b.score - a.score);
  const bestSlot = sortedSlots[0];

  // Group similar tasks if preference enabled
  if (preferences.groupSimilarTasks && task.projectId) {
    const sameProjectTask = alreadyScheduled.find(
      (s) => s.task.projectId === task.projectId
    );
    if (sameProjectTask) {
      // Try to schedule near the same project task
      const nearbySlot = sortedSlots.find((slot) => {
        const slotDay = startOfDay(slot.start);
        const projectDay = startOfDay(sameProjectTask.slot.start);
        return slotDay.getTime() === projectDay.getTime();
      });
      if (nearbySlot) {
        return {
          success: true,
          slot: {
            start: nearbySlot.start,
            end: addMinutes(nearbySlot.start, maxDuration),
          },
          confidence: Math.min(nearbySlot.score + 0.1, 1),
        };
      }
    }
  }

  return {
    success: true,
    slot: {
      start: bestSlot.start,
      end: addMinutes(bestSlot.start, maxDuration),
    },
    confidence: bestSlot.score,
  };
}

// ============================================================================
// Slot Management
// ============================================================================

function removeUsedSlot(
  slots: TimeSlot[],
  usedSlot: DateRange,
  bufferMinutes: number
): TimeSlot[] {
  const result: TimeSlot[] = [];

  for (const slot of slots) {
    // Check if this slot overlaps with the used slot
    const usedStart = addMinutes(usedSlot.start, -bufferMinutes);
    const usedEnd = addMinutes(usedSlot.end, bufferMinutes);

    if (slot.end <= usedStart || slot.start >= usedEnd) {
      // No overlap, keep the slot
      result.push(slot);
    } else if (slot.start < usedStart && slot.end > usedEnd) {
      // Used slot is in the middle - split into two
      const beforeDuration = differenceInMinutes(usedStart, slot.start);
      const afterDuration = differenceInMinutes(slot.end, usedEnd);

      if (beforeDuration >= 30) {
        result.push({
          ...slot,
          end: usedStart,
          duration: beforeDuration,
        });
      }
      if (afterDuration >= 30) {
        result.push({
          ...slot,
          start: usedEnd,
          duration: afterDuration,
        });
      }
    } else if (slot.start < usedStart) {
      // Used slot overlaps the end
      const duration = differenceInMinutes(usedStart, slot.start);
      if (duration >= 30) {
        result.push({
          ...slot,
          end: usedStart,
          duration,
        });
      }
    } else if (slot.end > usedEnd) {
      // Used slot overlaps the start
      const duration = differenceInMinutes(slot.end, usedEnd);
      if (duration >= 30) {
        result.push({
          ...slot,
          start: usedEnd,
          duration,
        });
      }
    }
    // Fully overlapped slots are dropped
  }

  return result;
}

// ============================================================================
// Conflict Detection
// ============================================================================

function checkWorkloadConflict(
  scheduled: ScheduledTask[],
  constraints: AutoScheduleConstraints
): ConflictInfo | null {
  // Group scheduled tasks by day
  const tasksByDay: Record<string, ScheduledTask[]> = {};

  scheduled.forEach((s) => {
    const dayKey = format(s.slot.start, 'yyyy-MM-dd');
    if (!tasksByDay[dayKey]) tasksByDay[dayKey] = [];
    tasksByDay[dayKey].push(s);
  });

  // Check for overloaded days
  const workingHoursPerDay =
    (constraints.workingHours.end - constraints.workingHours.start) * 60;

  for (const [dayKey, tasks] of Object.entries(tasksByDay)) {
    const totalMinutes = tasks.reduce(
      (sum, t) => sum + differenceInMinutes(t.slot.end, t.slot.start),
      0
    );

    const utilizationPercent = (totalMinutes / workingHoursPerDay) * 100;

    if (utilizationPercent > 80) {
      return {
        id: `overload-${dayKey}`,
        type: 'overload',
        severity: utilizationPercent > 100 ? 'high' : 'medium',
        blocks: tasks.map((t) => t.task as unknown as ScheduleBlock),
        description: `Le ${format(new Date(dayKey), 'EEEE d MMMM', { locale: fr })} est tr\u00e8s charg\u00e9 (${Math.round(utilizationPercent)}% d'occupation)`,
        suggestions: [],
      };
    }
  }

  return null;
}

// ============================================================================
// Preview Generation
// ============================================================================

export function previewAutoSchedule(
  request: AutoScheduleRequest,
  existingEvents: ScheduleBlock[]
): {
  preview: Array<{ task: Task; slot: DateRange }>;
  stats: {
    totalTasks: number;
    schedulable: number;
    conflicts: number;
  };
} {
  const result = autoScheduleTasks(request, existingEvents);

  return {
    preview: result.scheduled.map((s) => ({
      task: s.task,
      slot: s.suggestedSlot,
    })),
    stats: {
      totalTasks: request.tasks.length,
      schedulable: result.scheduled.length,
      conflicts: result.conflicts.length,
    },
  };
}

// ============================================================================
// Single Task Scheduling
// ============================================================================

export function findBestSlotForTask(
  task: Task,
  existingEvents: ScheduleBlock[],
  constraints?: Partial<AutoScheduleConstraints>,
  patterns?: PatternAnalysis
): DateRange | null {
  const fullConstraints = { ...DEFAULT_CONSTRAINTS, ...constraints };

  let slots = findAvailableSlots(fullConstraints, existingEvents);

  if (patterns) {
    slots = scoreSlots(slots, patterns, DEFAULT_PREFERENCES);
  }

  const result = scheduleTask(task, slots, fullConstraints, DEFAULT_PREFERENCES, []);

  return result.success && result.slot ? result.slot : null;
}
