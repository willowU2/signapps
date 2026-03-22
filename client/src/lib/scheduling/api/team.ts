/**
 * Team API Client
 *
 * React Query hooks for team member and availability management.
 * Integrates directly with the `signapps-workforce` microservice.
 */

import { useQuery } from '@tanstack/react-query';
import {
  startOfDay,
  endOfDay,
  setHours,
  setMinutes,
  isWeekend,
} from 'date-fns';
import type {
  TeamMember,
  AvailabilitySlot,
  WorkingHours,
} from '../types/scheduling';
import { getClient, ServiceName } from '@/lib/api/factory';

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

/**
 * Interface corresponding to the rust `Employee` model.
 */
interface BackendEmployee {
  id: string;
  tenant_id: string;
  user_id?: string;
  org_node_id: string;
  employee_number?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  functions: string[];
  contract_type: string;
  fte_ratio: number;
  hire_date?: string;
  termination_date?: string;
  status: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BackendOrgTreeNode {
  id: string;
  parent_id?: string;
  node_type: string;
  name: string;
  code?: string;
  description?: string;
  config: any;
  sort_order: number;
  children: BackendOrgTreeNode[];
  depth: number;
  employee_count: number;
}

function toTeamMember(employee: BackendEmployee, managerId?: string | null): TeamMember {
  return {
    id: employee.id,
    name: `${employee.first_name} ${employee.last_name}`.trim(),
    email: employee.email || '',
    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${employee.first_name}`,
    role: employee.functions?.[0] || 'Employé',
    department: 'Département',
    managerId: managerId || null,
    orgNodeId: employee.org_node_id,
    workingHours: defaultWorkingHours,
  };
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
  orgTree: () => [...teamKeys.all, 'orgTree'] as const,
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
    queryFn: async () => {
      const client = getClient(ServiceName.WORKFORCE);
      const res = await client.get<BackendEmployee[]>('/workforce/employees');
      return res.data.map((emp) => toTeamMember(emp));
    },
  });
}

/**
 * Fetch a single team member
 */
export function useTeamMember(id: string) {
  return useQuery({
    queryKey: teamKeys.member(id),
    queryFn: async () => {
      const client = getClient(ServiceName.WORKFORCE);
      const res = await client.get<any>(`/workforce/employees/${id}`);
      if (!res.data) return null;
      
      const member = toTeamMember(res.data.employee);
      if (res.data.function_names && res.data.function_names.length > 0) {
        member.role = res.data.function_names[0];
      }
      if (res.data.org_node_name) {
         member.department = res.data.org_node_name;
      }
      return member;
    },
    enabled: !!id,
  });
}

/**
 * Fetch Organizational Tree natively
 */
export function useOrgTree() {
  return useQuery({
    queryKey: teamKeys.orgTree(),
    queryFn: async (): Promise<BackendOrgTreeNode[]> => {
       const client = getClient(ServiceName.WORKFORCE);
       const res = await client.get<BackendOrgTreeNode[]>('/workforce/org/tree');
       return res.data;
    }
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
