/**
 * My Team API — Team management for managers
 *
 * Endpoints under /workforce/my-team, served by the Workforce service (port 3024).
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.WORKFORCE);

// ============================================================================
// Types
// ============================================================================

export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contractor"
  | "intern";
export type MemberStatus = "active" | "on_leave" | "remote" | "inactive";
export type PendingActionType =
  | "leave_request"
  | "timesheet_approval"
  | "expense_claim"
  | "onboarding_task";
export type PendingActionStatus = "pending" | "approved" | "rejected";

export interface TeamMember {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  job_title: string;
  department: string;
  employment_type: EmploymentType;
  status: MemberStatus;
  hire_date: string;
  manager_id: string;
  phone?: string;
  location?: string;
}

export interface TeamManager {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  job_title: string;
  department: string;
}

export interface MyTeamResponse {
  manager: TeamManager;
  members: TeamMember[];
  total: number;
}

export interface TeamSummary {
  total_members: number;
  active_members: number;
  on_leave: number;
  remote: number;
  pending_actions: number;
  upcoming_reviews: number;
}

export interface PendingAction {
  id: string;
  type: PendingActionType;
  status: PendingActionStatus;
  employee_id: string;
  employee_name: string;
  description: string;
  created_at: string;
  due_date?: string;
  metadata?: Record<string, unknown>;
}

export interface ApproveLeaveRequest {
  comment?: string;
}

export interface RejectLeaveRequest {
  reason: string;
}

export interface ApproveTimesheetRequest {
  comment?: string;
}

// ============================================================================
// API
// ============================================================================

export const myTeamApi = {
  /** Fetch the current manager's team */
  getMyTeam: () => client.get<MyTeamResponse>("/workforce/my-team"),

  /** Fetch team summary with pending actions count */
  getSummary: () => client.get<TeamSummary>("/workforce/my-team/summary"),

  /** List all pending actions for the manager */
  listPendingActions: () =>
    client.get<PendingAction[]>("/workforce/my-team/pending-actions"),

  /** Get a single team member by id */
  getMember: (memberId: string) =>
    client.get<TeamMember>(`/workforce/my-team/members/${memberId}`),

  /** Approve a leave request */
  approveLeave: (leaveId: string, data?: ApproveLeaveRequest) =>
    client.post<PendingAction>(
      `/workforce/leaves/${leaveId}/approve`,
      data ?? {},
    ),

  /** Reject a leave request */
  rejectLeave: (leaveId: string, data: RejectLeaveRequest) =>
    client.post<PendingAction>(`/workforce/leaves/${leaveId}/reject`, data),

  /** Approve a timesheet */
  approveTimesheet: (timesheetId: string, data?: ApproveTimesheetRequest) =>
    client.post<PendingAction>(
      `/workforce/timesheets/${timesheetId}/approve`,
      data ?? {},
    ),

  /** List timesheets pending approval for the manager's team */
  listPendingTimesheets: () =>
    client.get<PendingAction[]>("/workforce/my-team/pending-timesheets"),

  /** List leave requests pending approval for the manager's team */
  listPendingLeaves: () =>
    client.get<PendingAction[]>("/workforce/my-team/pending-leaves"),
};
