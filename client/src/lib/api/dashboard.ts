/**
 * Dashboard API Module
 *
 * Widget layout persistence and aggregated summary data.
 * Endpoints served by the Identity service (port 3001).
 */
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.IDENTITY);

// ============================================================================
// Types
// ============================================================================

/** A single widget placement on the dashboard grid. */
export interface WidgetPlacement {
  /** Widget type identifier (e.g. "email", "calendar", "tasks", "files"). */
  widget_type: string;
  /** Grid column position. */
  x: number;
  /** Grid row position. */
  y: number;
  /** Width in grid units. */
  w: number;
  /** Height in grid units. */
  h: number;
  /** Optional widget-specific configuration. */
  config?: Record<string, unknown>;
}

/** Dashboard layout as returned by the API. */
export interface DashboardLayout {
  id: string;
  user_id: string;
  widgets: WidgetPlacement[];
  created_at: string;
  updated_at: string;
}

/** Aggregated summary data for default dashboard widgets. */
export interface DashboardSummary {
  unread_emails: number;
  tasks_due_today: number;
  upcoming_events: number;
  recent_files: number;
}

// ============================================================================
// API
// ============================================================================

export const dashboardApi = {
  /** Fetch the current user's dashboard layout. */
  getLayout: () => client.get<DashboardLayout>("/dashboard/layout"),

  /** Save the current user's dashboard layout. */
  saveLayout: (widgets: WidgetPlacement[]) =>
    client.put<DashboardLayout>("/dashboard/layout", { widgets }),

  /** Fetch aggregated widget summary data. */
  getSummary: () => client.get<DashboardSummary>("/dashboard/widgets/summary"),
};
