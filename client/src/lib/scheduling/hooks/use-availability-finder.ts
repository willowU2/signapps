/**
 * useAvailabilityFinder Hook
 *
 * React hook for finding available meeting times across multiple participants.
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import {
  findAvailability,
  suggestBestMeetingTime,
  type AvailabilityQuery,
  type AvailabilityResult,
  type CommonSlot,
} from '../utils/availability-finder';
import type { ScheduleBlock, TeamMember } from '../types/scheduling';

// ============================================================================
// Types
// ============================================================================

export interface UseAvailabilityFinderOptions {
  /** IDs of participants to find availability for */
  participantIds: string[];
  /** Required meeting duration in minutes */
  duration: number;
  /** Start date for the search (defaults to today) */
  startDate?: Date;
  /** Number of days to search (defaults to 7) */
  daysToSearch?: number;
  /** Working hours constraint */
  workingHours?: {
    start: number;
    end: number;
  };
  /** Whether to include weekends in the search */
  includeWeekends?: boolean;
  /** Buffer time between meetings in minutes */
  bufferMinutes?: number;
  /** Preferred time of day */
  preferredTimes?: ('morning' | 'afternoon' | 'evening')[];
  /** Whether to enable the query */
  enabled?: boolean;
}

export interface UseAvailabilityFinderResult {
  /** Full availability result */
  availability: AvailabilityResult | undefined;
  /** Top suggested meeting times */
  suggestions: CommonSlot[];
  /** Whether the query is loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refetch availability */
  refetch: () => void;
  /** Update search parameters */
  updateParams: (params: Partial<UseAvailabilityFinderOptions>) => void;
}

// ============================================================================
// Mock Data (for MVP - replace with API calls)
// ============================================================================

function getMockEvents(): ScheduleBlock[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem('scheduling_events');
    if (!data) return [];
    const events = JSON.parse(data);
    return events.map((e: ScheduleBlock) => ({
      ...e,
      start: new Date(e.start),
      end: e.end ? new Date(e.end) : undefined,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
    }));
  } catch {
    return [];
  }
}

function getMockTeamMembers(): TeamMember[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem('scheduling_team_members');
    if (!data) {
      // Return default team members for demo
      return [
        {
          id: 'user-1',
          name: 'Alice Martin',
          email: 'alice@example.com',
          role: 'Développeur',
          department: 'Engineering',
        },
        {
          id: 'user-2',
          name: 'Bob Dupont',
          email: 'bob@example.com',
          role: 'Designer',
          department: 'Design',
        },
        {
          id: 'user-3',
          name: 'Claire Petit',
          email: 'claire@example.com',
          role: 'Product Manager',
          department: 'Product',
        },
      ];
    }
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useAvailabilityFinder(
  options: UseAvailabilityFinderOptions
): UseAvailabilityFinderResult {
  const {
    participantIds,
    duration,
    startDate = new Date(),
    daysToSearch = 7,
    workingHours,
    includeWeekends = false,
    bufferMinutes = 0,
    preferredTimes = [],
    enabled = true,
  } = options;

  // Store params in state for updates
  const [params, setParams] = React.useState({
    participantIds,
    duration,
    startDate,
    daysToSearch,
    workingHours,
    includeWeekends,
    bufferMinutes,
    preferredTimes,
  });

  // Update params when options change
  React.useEffect(() => {
    setParams({
      participantIds,
      duration,
      startDate,
      daysToSearch,
      workingHours,
      includeWeekends,
      bufferMinutes,
      preferredTimes,
    });
  }, [
    participantIds.join(','),
    duration,
    startDate.getTime(),
    daysToSearch,
    workingHours?.start,
    workingHours?.end,
    includeWeekends,
    bufferMinutes,
    preferredTimes.join(','),
  ]);

  // Build query
  const query: AvailabilityQuery = React.useMemo(
    () => ({
      participantIds: params.participantIds,
      duration: params.duration,
      dateRange: {
        start: startOfDay(params.startDate),
        end: endOfDay(addDays(params.startDate, params.daysToSearch)),
      },
      workingHours: params.workingHours,
      includeWeekends: params.includeWeekends,
      bufferMinutes: params.bufferMinutes,
      preferredTimes: params.preferredTimes,
    }),
    [params]
  );

  // Query for availability
  const {
    data: availability,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['availability', query],
    queryFn: async () => {
      // Get events and team members (MVP: from localStorage)
      const events = getMockEvents();
      const members = getMockTeamMembers();

      // Find availability
      return findAvailability(query, events, members);
    },
    enabled: enabled && params.participantIds.length > 0 && params.duration > 0,
    staleTime: 30000, // 30 seconds
  });

  // Get top suggestions
  const suggestions = React.useMemo(() => {
    if (!availability) return [];
    return availability.slots.slice(0, 10);
  }, [availability]);

  // Update params function
  const updateParams = React.useCallback(
    (newParams: Partial<UseAvailabilityFinderOptions>) => {
      setParams((prev) => ({
        ...prev,
        ...newParams,
        startDate: newParams.startDate || prev.startDate,
        participantIds: newParams.participantIds || prev.participantIds,
        preferredTimes: newParams.preferredTimes || prev.preferredTimes,
      }));
    },
    []
  );

  return {
    availability,
    suggestions,
    isLoading,
    error: error as Error | null,
    refetch,
    updateParams,
  };
}

// ============================================================================
// Simpler Hook for Quick Suggestions
// ============================================================================

export interface UseQuickAvailabilityOptions {
  participantIds: string[];
  duration: number;
  limit?: number;
}

export function useQuickAvailability(
  options: UseQuickAvailabilityOptions
): {
  suggestions: CommonSlot[];
  isLoading: boolean;
} {
  const { participantIds, duration, limit = 5 } = options;

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['quick-availability', participantIds.join(','), duration, limit],
    queryFn: async () => {
      const events = getMockEvents();
      const members = getMockTeamMembers();

      const query: AvailabilityQuery = {
        participantIds,
        duration,
        dateRange: {
          start: startOfDay(new Date()),
          end: endOfDay(addDays(new Date(), 14)), // Search 2 weeks
        },
        includeWeekends: false,
      };

      return suggestBestMeetingTime(query, events, members, limit);
    },
    enabled: participantIds.length > 0 && duration > 0,
    staleTime: 60000, // 1 minute
  });

  return { suggestions, isLoading };
}
