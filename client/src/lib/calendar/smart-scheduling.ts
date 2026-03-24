/**
 * Smart scheduling — find available slots across participants
 */

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface Participant {
  id: string;
  name: string;
  busySlots: TimeSlot[];
}

export interface SuggestedSlot {
  start: Date;
  end: Date;
  score: number; // 0-1, higher = better
  conflicts: string[]; // participant names with conflicts
}

/**
 * Find available meeting slots for all participants
 */
export function findAvailableSlots(
  participants: Participant[],
  durationMinutes: number,
  searchRange: { start: Date; end: Date },
  workingHours = { start: 9, end: 18 }
): SuggestedSlot[] {
  const slots: SuggestedSlot[] = [];
  const step = 30; // 30 min intervals
  const durationMs = durationMinutes * 60000;
  const stepMs = step * 60000;

  let cursor = new Date(searchRange.start);
  while (cursor < searchRange.end) {
    const hour = cursor.getHours();
    const day = cursor.getDay();

    // Skip weekends and outside working hours
    if (day === 0 || day === 6 || hour < workingHours.start || hour >= workingHours.end) {
      cursor = new Date(cursor.getTime() + stepMs);
      continue;
    }

    const slotEnd = new Date(cursor.getTime() + durationMs);
    const conflicts: string[] = [];

    for (const p of participants) {
      for (const busy of p.busySlots) {
        if (cursor < busy.end && slotEnd > busy.start) {
          conflicts.push(p.name);
          break;
        }
      }
    }

    const score = 1 - conflicts.length / Math.max(participants.length, 1);

    if (score > 0) {
      slots.push({ start: new Date(cursor), end: slotEnd, score, conflicts });
    }

    cursor = new Date(cursor.getTime() + stepMs);
  }

  return slots.sort((a, b) => b.score - a.score).slice(0, 10);
}
