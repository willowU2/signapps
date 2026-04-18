import "server-only";

import { fetchServer } from "./http";

/**
 * Aggregated dashboard summary data returned by the identity service
 * (`GET /api/v1/dashboard/widgets/summary`).  Mirror of the client-side
 * `DashboardSummary` type in `@/lib/api/dashboard` — kept independent so
 * the server bundle does not pull the whole client API layer.
 */
export interface DashboardSummary {
  unread_emails: number;
  tasks_due_today: number;
  upcoming_events: number;
  recent_files: number;
  storage_used_bytes: number;
  contacts_count: number;
  chat_unread: number;
  notifications_unread: number;
  active_meetings: number;
  next_event_title: string | null;
  next_event_time: string | null;
}

/** A single widget placement on the dashboard grid (mirror of backend). */
export interface WidgetPlacement {
  widget_type: string;
  x: number;
  y: number;
  w: number;
  h: number;
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

/** Bundle of server-prefetched data handed to the client dashboard shell. */
export interface DashboardInitialData {
  summary: DashboardSummary | null;
  layout: DashboardLayout | null;
}

const EMPTY_SUMMARY: DashboardSummary = {
  unread_emails: 0,
  tasks_due_today: 0,
  upcoming_events: 0,
  recent_files: 0,
  storage_used_bytes: 0,
  contacts_count: 0,
  chat_unread: 0,
  notifications_unread: 0,
  active_meetings: 0,
  next_event_title: null,
  next_event_time: null,
};

const IDENTITY_BASE_URL =
  process.env.NEXT_PUBLIC_IDENTITY_URL ?? "http://localhost:3001";

/**
 * Server-side prefetch of dashboard data for the RSC page.
 *
 * Each sub-call is independent — a failing backend (e.g. service down at
 * first boot) yields a null field rather than throwing, so the page still
 * streams the shell and the client hooks can take over after hydration.
 */
export async function fetchDashboardData(): Promise<DashboardInitialData> {
  const [summaryResult, layoutResult] = await Promise.allSettled([
    fetchServer<DashboardSummary>("/api/v1/dashboard/widgets/summary", {
      baseUrl: IDENTITY_BASE_URL,
    }),
    fetchServer<DashboardLayout>("/api/v1/dashboard/layout", {
      baseUrl: IDENTITY_BASE_URL,
    }),
  ]);

  const summary =
    summaryResult.status === "fulfilled" ? summaryResult.value : null;
  const layout =
    layoutResult.status === "fulfilled" ? layoutResult.value : null;

  if (summaryResult.status === "rejected") {
    console.error(
      "[dashboard] server summary prefetch failed",
      summaryResult.reason,
    );
  }
  if (layoutResult.status === "rejected") {
    console.error(
      "[dashboard] server layout prefetch failed",
      layoutResult.reason,
    );
  }

  return {
    summary: summary ?? { ...EMPTY_SUMMARY },
    layout,
  };
}
