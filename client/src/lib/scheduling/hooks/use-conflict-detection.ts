/**
 * useConflictDetection Hook
 *
 * React hook for detecting scheduling conflicts and suggesting alternatives.
 */

import * as React from 'react';
import { useEvents } from '../api/calendar';
import {
  checkConflicts,
  suggestAlternativeTimes,
  type ConflictResult,
  type AvailableSlot,
  type ConflictCheckOptions,
} from '../utils/conflict-detection';
import { addDays, startOfDay, endOfDay } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

interface UseConflictDetectionOptions extends ConflictCheckOptions {
  /** Enable auto-suggestions when conflicts are found */
  autoSuggest?: boolean;
  /** Maximum number of suggestions to return */
  maxSuggestions?: number;
  /** Working hours start (default: 9) */
  workingHoursStart?: number;
  /** Working hours end (default: 18) */
  workingHoursEnd?: number;
}

interface ConflictDetectionResult extends ConflictResult {
  suggestions: AvailableSlot[];
  isLoading: boolean;
  checkForConflicts: (start: Date, end: Date) => void;
  clearConflicts: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useConflictDetection(
  options: UseConflictDetectionOptions = {}
): ConflictDetectionResult {
  const {
    bufferMinutes = 0,
    excludeIds = [],
    autoSuggest = true,
    maxSuggestions = 3,
    workingHoursStart = 9,
    workingHoursEnd = 18,
  } = options;

  const [result, setResult] = React.useState<ConflictResult>({
    hasConflicts: false,
    conflicts: [],
    totalOverlapMinutes: 0,
  });
  const [suggestions, setSuggestions] = React.useState<AvailableSlot[]>([]);
  const [proposedTime, setProposedTime] = React.useState<{ start: Date; end: Date } | null>(null);

  // Fetch events for a broad range to check conflicts
  const dateRange = React.useMemo(() => {
    if (!proposedTime) {
      return { start: startOfDay(new Date()), end: endOfDay(addDays(new Date(), 30)) };
    }
    return {
      start: startOfDay(proposedTime.start),
      end: endOfDay(addDays(proposedTime.start, 14)),
    };
  }, [proposedTime]);

  const { data: events = [], isLoading } = useEvents(dateRange);

  // Check conflicts when proposedTime or events change
  React.useEffect(() => {
    if (!proposedTime || isLoading) return;

    const conflictResult = checkConflicts(proposedTime.start, proposedTime.end, events, {
      bufferMinutes,
      excludeIds,
    });

    setResult(conflictResult);

    // Generate suggestions if conflicts found and autoSuggest enabled
    if (conflictResult.hasConflicts && autoSuggest) {
      const alternativeSlots = suggestAlternativeTimes(
        proposedTime.start,
        proposedTime.end,
        events,
        {
          maxSuggestions,
          workingHoursStart,
          workingHoursEnd,
        }
      );
      setSuggestions(alternativeSlots);
    } else {
      setSuggestions([]);
    }
  }, [
    proposedTime,
    events,
    isLoading,
    bufferMinutes,
    excludeIds,
    autoSuggest,
    maxSuggestions,
    workingHoursStart,
    workingHoursEnd,
  ]);

  const checkForConflicts = React.useCallback((start: Date, end: Date) => {
    setProposedTime({ start, end });
  }, []);

  const clearConflicts = React.useCallback(() => {
    setProposedTime(null);
    setResult({
      hasConflicts: false,
      conflicts: [],
      totalOverlapMinutes: 0,
    });
    setSuggestions([]);
  }, []);

  return {
    ...result,
    suggestions,
    isLoading,
    checkForConflicts,
    clearConflicts,
  };
}

// ============================================================================
// Debounced Version
// ============================================================================

export function useConflictDetectionDebounced(
  options: UseConflictDetectionOptions & { debounceMs?: number } = {}
): ConflictDetectionResult {
  const { debounceMs = 300, ...restOptions } = options;
  const detection = useConflictDetection(restOptions);

  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const debouncedCheck = React.useCallback(
    (start: Date, end: Date) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        detection.checkForConflicts(start, end);
      }, debounceMs);
    },
    [detection, debounceMs]
  );

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    ...detection,
    checkForConflicts: debouncedCheck,
  };
}

export default useConflictDetection;
