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
import type { ScheduleBlock, TeamMember, BlockType, BlockStatus } from '../types/scheduling';
import { usersApi } from '../../api/identity';
import { timeItemsApi } from '../../api/scheduler';

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
// Data Fetching Helper
// ============================================================================

async function fetchAvailabilityData(
  participantIds: string[],
  start: Date,
  end: Date
): Promise<{ events: ScheduleBlock[]; members: TeamMember[] }> {
  // Fetch users
  const usersRes = await usersApi.list(0, 100);
  const members: TeamMember[] = usersRes.data.users
    .filter((u) => participantIds.includes(u.id))
    .map((u) => ({
      id: u.id,
      name: u.display_name || u.username,
      email: u.email || '',
      role: u.role === 2 ? 'Admin' : 'Utilisateur',
      department: 'Général',
    }));

  // Fetch TimeItems
  const eventsRes = await timeItemsApi.queryUsersEvents(
    participantIds,
    start.toISOString(),
    end.toISOString()
  );

  const events: ScheduleBlock[] = eventsRes.data.items.map((item) => ({
    id: item.id,
    title: item.title,
    start: new Date(item.start_time || item.deadline || new Date().toISOString()),
    end: item.end_time ? new Date(item.end_time) : undefined,
    allDay: item.all_day,
    type: item.item_type as BlockType,
    status: item.status as BlockStatus,
    metadata: {
      organizerId: item.owner_id,
    },
    // To support checkTimeSlot which looks at attendees, we map owner_id to attendees for MVP.
    // In a full implementation, we would extract actual attendees from TimeItemRelations.
    attendees: [{ id: item.owner_id, name: '', email: '', responseStatus: 'accepted', status: 'accepted', required: true }],
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
  }));

  return { events, members };
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

  // Stable keys for array/date deps to avoid re-running on every render
  const participantIdsKey = participantIds.join(',');
  const startDateMs = startDate.getTime();
  const preferredTimesKey = preferredTimes.join(',');
  const workingHoursStart = workingHours?.start;
  const workingHoursEnd = workingHours?.end;

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    participantIdsKey,
    duration,
    startDateMs,
    daysToSearch,
    workingHoursStart,
    workingHoursEnd,
    includeWeekends,
    bufferMinutes,
    preferredTimesKey,
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
      // Get real data from APIs
      const { events, members } = await fetchAvailabilityData(
        query.participantIds,
        query.dateRange.start,
        query.dateRange.end
      );

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
      const searchStart = startOfDay(new Date());
      const searchEnd = endOfDay(addDays(new Date(), 14)); // Search 2 weeks

      const { events, members } = await fetchAvailabilityData(
        participantIds,
        searchStart,
        searchEnd
      );

      const query: AvailabilityQuery = {
        participantIds,
        duration,
        dateRange: {
          start: searchStart,
          end: searchEnd,
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
