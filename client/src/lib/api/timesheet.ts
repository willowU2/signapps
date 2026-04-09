/**
 * Timesheet API Module — via signapps-workforce (port 3024)
 *
 * Provides CRUD + timer start/stop + stats for time tracking entries.
 * Routes through gateway at /api/v1/workforce/timesheet.
 */
import { getClient, ServiceName } from "./factory";

// ============================================================================
// Types
// ============================================================================

export interface TimesheetEntry {
  id: string;
  task_name?: string;
  start_time: string;
  end_time?: string;
  duration_seconds: number;
  is_billable: boolean;
  project_id?: string;
  owner_id: string;
  tenant_id?: string;
  created_at?: string;
}

export interface CreateTimesheetEntryRequest {
  task_name?: string;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  is_billable?: boolean;
  project_id?: string;
}

export interface UpdateTimesheetEntryRequest {
  task_name?: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  is_billable?: boolean;
  project_id?: string;
}

export interface StartTimerRequest {
  task_name?: string;
  is_billable?: boolean;
  project_id?: string;
}

export interface TimesheetStats {
  total_seconds: number;
  billable_seconds: number;
  entry_count: number;
}

// ============================================================================
// Client
// ============================================================================

const workforceClient = () => getClient(ServiceName.WORKFORCE);

// ============================================================================
// Timesheet API
// ============================================================================

export const timesheetApi = {
  /** List timesheet entries, optionally filtered by date range */
  listEntries: (params?: {
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) =>
    workforceClient().get<TimesheetEntry[]>("/workforce/timesheet", { params }),

  /** Create a manual timesheet entry */
  createEntry: (data: CreateTimesheetEntryRequest) =>
    workforceClient().post<TimesheetEntry>("/workforce/timesheet", data),

  /** Update an existing timesheet entry */
  updateEntry: (id: string, data: UpdateTimesheetEntryRequest) =>
    workforceClient().put<TimesheetEntry>(`/workforce/timesheet/${id}`, data),

  /** Delete a timesheet entry */
  deleteEntry: (id: string) =>
    workforceClient().delete(`/workforce/timesheet/${id}`),

  /** Start a timer (creates an open-ended entry) */
  startTimer: (data: StartTimerRequest) =>
    workforceClient().post<TimesheetEntry>("/workforce/timesheet/start", data),

  /** Stop the running timer */
  stopTimer: () =>
    workforceClient().post<TimesheetEntry>("/workforce/timesheet/stop"),

  /** Get aggregated stats for a period (week, month, year) */
  getStats: (period?: "week" | "month" | "year") =>
    workforceClient().get<TimesheetStats>("/workforce/timesheet/stats", {
      params: period ? { period } : undefined,
    }),
};
