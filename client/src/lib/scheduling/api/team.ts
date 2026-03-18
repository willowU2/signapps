/**
 * Team API Client
 *
 * React Query hooks for team member and availability management.
 * Uses local storage for MVP, will integrate with backend later.
 */

import { useQuery } from '@tanstack/react-query';
import {
  startOfDay,
  endOfDay,
  addHours,
  setHours,
  setMinutes,
  isWeekend,
} from 'date-fns';
import type {
  TeamMember,
  AvailabilitySlot,
  WorkingHours,
} from '../types/scheduling';

// ============================================================================
// Storage Key
// ============================================================================

const TEAM_STORAGE_KEY = 'scheduling-team';

// ============================================================================
// Local Storage Helpers
// ============================================================================

function getStoredTeamMembers(): TeamMember[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(TEAM_STORAGE_KEY);
    if (!stored) return getDefaultTeamMembers();
    return JSON.parse(stored);
  } catch {
    return getDefaultTeamMembers();
  }
}

// ============================================================================
// Default Data (Demo)
// ============================================================================

const defaultWorkingHours: WorkingHours = {
  timezone: 'Europe/Paris',
  schedule: {
    monday: { start: '09:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
    tuesday: { start: '09:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
    wednesday: { start: '09:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
    thursday: { start: '09:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
    friday: { start: '09:00', end: '17:00', breaks: [{ start: '12:00', end: '13:00' }] },
  },
};

function getDefaultTeamMembers(): TeamMember[] {
  return [
    {
      id: 'member-1',
      name: 'Marie Dupont',
      email: 'marie.dupont@example.com',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marie',
      role: 'Chef de projet',
      department: 'Gestion de projet',
      workingHours: defaultWorkingHours,
    },
    {
      id: 'member-2',
      name: 'Pierre Martin',
      email: 'pierre.martin@example.com',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=pierre',
      role: 'Développeur Senior',
      department: 'Développement',
      workingHours: defaultWorkingHours,
    },
    {
      id: 'member-3',
      name: 'Sophie Bernard',
      email: 'sophie.bernard@example.com',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sophie',
      role: 'Designer UX',
      department: 'Design',
      workingHours: defaultWorkingHours,
    },
    {
      id: 'member-4',
      name: 'Thomas Petit',
      email: 'thomas.petit@example.com',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=thomas',
      role: 'Développeur Full-Stack',
      department: 'Développement',
      workingHours: defaultWorkingHours,
    },
    {
      id: 'member-5',
      name: 'Julie Moreau',
      email: 'julie.moreau@example.com',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=julie',
      role: 'Product Owner',
      department: 'Produit',
      workingHours: defaultWorkingHours,
    },
    {
      id: 'member-6',
      name: 'Nicolas Leroy',
      email: 'nicolas.leroy@example.com',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nicolas',
      role: 'DevOps Engineer',
      department: 'Infrastructure',
      workingHours: defaultWorkingHours,
    },
    {
      id: 'member-7',
      name: 'Camille Roux',
      email: 'camille.roux@example.com',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=camille',
      role: 'QA Engineer',
      department: 'Qualité',
      workingHours: defaultWorkingHours,
    },
    {
      id: 'member-8',
      name: 'Alexandre Girard',
      email: 'alexandre.girard@example.com',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alexandre',
      role: 'Tech Lead',
      department: 'Développement',
      workingHours: defaultWorkingHours,
    },
  ];
}

// ============================================================================
// Generate Availability Slots
// ============================================================================

function generateAvailabilitySlots(
  members: TeamMember[],
  date: Date
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const dayStart = startOfDay(date);

  // Skip weekends
  if (isWeekend(date)) {
    members.forEach((member) => {
      slots.push({
        memberId: member.id,
        start: dayStart,
        end: endOfDay(date),
        status: 'out-of-office',
      });
    });
    return slots;
  }

  // Generate realistic availability patterns
  members.forEach((member, index) => {
    // Working hours: 9-18 with lunch break
    const workStart = setMinutes(setHours(dayStart, 9), 0);
    const lunchStart = setMinutes(setHours(dayStart, 12), 0);
    const lunchEnd = setMinutes(setHours(dayStart, 13), 0);
    const workEnd = setMinutes(setHours(dayStart, 18), 0);

    // Before work
    slots.push({
      memberId: member.id,
      start: dayStart,
      end: workStart,
      status: 'out-of-office',
    });

    // Morning - simulate some meetings
    const hasMorningMeeting = index % 3 === 0;
    if (hasMorningMeeting) {
      const meetingStart = setMinutes(setHours(dayStart, 10), 0);
      const meetingEnd = setMinutes(setHours(dayStart, 11), 0);

      slots.push({
        memberId: member.id,
        start: workStart,
        end: meetingStart,
        status: 'available',
      });
      slots.push({
        memberId: member.id,
        start: meetingStart,
        end: meetingEnd,
        status: 'busy',
      });
      slots.push({
        memberId: member.id,
        start: meetingEnd,
        end: lunchStart,
        status: 'available',
      });
    } else {
      slots.push({
        memberId: member.id,
        start: workStart,
        end: lunchStart,
        status: index % 4 === 1 ? 'tentative' : 'available',
      });
    }

    // Lunch
    slots.push({
      memberId: member.id,
      start: lunchStart,
      end: lunchEnd,
      status: 'busy',
    });

    // Afternoon - simulate some meetings
    const hasAfternoonMeeting = index % 2 === 0;
    if (hasAfternoonMeeting) {
      const meetingStart = setMinutes(setHours(dayStart, 14), 0);
      const meetingEnd = setMinutes(setHours(dayStart, 15), 30);

      slots.push({
        memberId: member.id,
        start: lunchEnd,
        end: meetingStart,
        status: 'available',
      });
      slots.push({
        memberId: member.id,
        start: meetingStart,
        end: meetingEnd,
        status: 'busy',
      });
      slots.push({
        memberId: member.id,
        start: meetingEnd,
        end: workEnd,
        status: 'available',
      });
    } else {
      slots.push({
        memberId: member.id,
        start: lunchEnd,
        end: workEnd,
        status: 'available',
      });
    }

    // After work
    slots.push({
      memberId: member.id,
      start: workEnd,
      end: endOfDay(date),
      status: 'out-of-office',
    });
  });

  return slots;
}

// ============================================================================
// Query Keys
// ============================================================================

export const teamKeys = {
  all: ['team'] as const,
  members: () => [...teamKeys.all, 'members'] as const,
  member: (id: string) => [...teamKeys.members(), id] as const,
  availability: (date: Date) => [...teamKeys.all, 'availability', date.toISOString()] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch all team members
 */
export function useTeamMembers() {
  return useQuery({
    queryKey: teamKeys.members(),
    queryFn: () => getStoredTeamMembers(),
  });
}

/**
 * Fetch a single team member
 */
export function useTeamMember(id: string) {
  return useQuery({
    queryKey: teamKeys.member(id),
    queryFn: () => {
      const members = getStoredTeamMembers();
      return members.find((m) => m.id === id) ?? null;
    },
    enabled: !!id,
  });
}

/**
 * Fetch availability slots for a specific date
 */
export function useAvailabilitySlots(date: Date) {
  const { data: members = [] } = useTeamMembers();

  return useQuery({
    queryKey: teamKeys.availability(date),
    queryFn: () => generateAvailabilitySlots(members, date),
    enabled: members.length > 0,
  });
}

/**
 * Find common free slots for multiple members
 */
export function useFindCommonSlots(memberIds: string[], date: Date) {
  const { data: slots = [] } = useAvailabilitySlots(date);

  return useQuery({
    queryKey: [...teamKeys.availability(date), 'common', memberIds],
    queryFn: () => {
      // Find slots where all members are available
      const memberSlots = memberIds.map((id) =>
        slots.filter((s) => s.memberId === id && s.status === 'available')
      );

      if (memberSlots.length === 0) return [];

      // Find intersections of all availability slots
      const commonSlots: { start: Date; end: Date }[] = [];

      // Start with the first member's slots
      let candidates = memberSlots[0].map((s) => ({
        start: new Date(s.start),
        end: new Date(s.end),
      }));

      // Intersect with each other member's slots
      for (let i = 1; i < memberSlots.length; i++) {
        const newCandidates: { start: Date; end: Date }[] = [];

        for (const candidate of candidates) {
          for (const slot of memberSlots[i]) {
            const slotStart = new Date(slot.start);
            const slotEnd = new Date(slot.end);

            // Find intersection
            const intersectStart = new Date(
              Math.max(candidate.start.getTime(), slotStart.getTime())
            );
            const intersectEnd = new Date(
              Math.min(candidate.end.getTime(), slotEnd.getTime())
            );

            if (intersectStart < intersectEnd) {
              newCandidates.push({
                start: intersectStart,
                end: intersectEnd,
              });
            }
          }
        }

        candidates = newCandidates;
      }

      return candidates;
    },
    enabled: memberIds.length > 0 && slots.length > 0,
  });
}
