/**
 * Metrics API Module
 *
 * Client for signapps-metrics service (port 3008).
 * Covers: system metrics, analytics, experiments, ESG.
 */
import { getClient, ServiceName } from './factory';
import { schedulerApiClient as schedulerClient } from './core';

import { METRICS_URL } from '@/lib/api/core';
const metricsClient = getClient(ServiceName.METRICS);

// ============================================================================
// Types — Scheduler workload metrics (port 3007)
// ============================================================================

export interface WorkloadMetrics {
  total_tasks: number;
  pending: number;
  in_progress: number;
  completed: number;
  blocked: number;
}

export interface ResourceMetrics {
  total_bookings: number;
  hours_booked: number;
}

export interface MetricsQuery {
  start_date?: string;
  end_date?: string;
}

// Legacy scheduler metrics (kept for backwards compat)
export const schedulerMetricsApi = {
  getWorkload: (params?: MetricsQuery) =>
    schedulerClient.get<WorkloadMetrics>('/metrics/workload', { params }).then((res: any) => res.data),

  getResources: () =>
    schedulerClient.get<ResourceMetrics>('/metrics/resources').then((res: any) => res.data),
};

// ============================================================================
// Types — Admin analytics (GET /api/v1/admin/analytics/*)
// ============================================================================

export interface AnalyticsOverview {
  total_users: number;
  active_today: number;
  total_storage_bytes: number;
  services_count: number;
  uptime_hours: number;
}

export interface StorageByUser {
  user_id: string;
  email: string;
  used_bytes: number;
  quota_bytes: number;
  percentage: number;
}

export interface ActivityPoint {
  hour: number;
  day: string;
  count: number;
}

// ============================================================================
// Types — A/B Experiments (GET/POST /api/v1/experiments)
// ============================================================================

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  status: string;
  variants: unknown;
  traffic_split: unknown;
  created_at: string;
  updated_at: string;
}

export interface CreateExperimentRequest {
  name: string;
  description?: string;
  status?: string;
  variants?: unknown;
  traffic_split?: unknown;
}

export interface UpdateExperimentRequest {
  name?: string;
  description?: string;
  status?: string;
  variants?: unknown;
  traffic_split?: unknown;
}

// ============================================================================
// Types — ESG (GET/PUT /api/v1/esg/*)
// ============================================================================

export interface EsgScore {
  id: string;
  tenant_id: string;
  category: string;
  score: number;
  trend?: string;
  updated_at: string;
}

export interface EsgQuarterly {
  id: string;
  tenant_id: string;
  quarter: number;
  year: number;
  score: number;
}

export interface UpsertEsgScoreRequest {
  category: string;
  score: number;
  trend?: string;
}

export interface UpsertEsgQuarterlyRequest {
  quarter: number;
  year: number;
  score: number;
}

// ============================================================================
// Types — User event tracking (POST /api/v1/metrics/track)
// ============================================================================

export interface UserEventPayload {
  event: string;
  properties?: Record<string, unknown>;
  user_id?: string;
  timestamp?: string;
}

export interface UserEventsBatchPayload {
  events: UserEventPayload[];
}

// ============================================================================
// metricsApi
// ============================================================================

export const metricsApi = {
  // User event tracking
  track: (payload: UserEventPayload) =>
    metricsClient.post('/metrics/track', payload),

  trackBatch: (payload: UserEventsBatchPayload) =>
    metricsClient.post('/metrics/track/batch', payload),
  // Admin analytics — requires admin role
  analyticsOverview: () =>
    metricsClient.get<AnalyticsOverview>('/admin/analytics/overview'),

  analyticsStorage: () =>
    metricsClient.get<StorageByUser[]>('/admin/analytics/storage'),

  analyticsActivity: () =>
    metricsClient.get<ActivityPoint[]>('/admin/analytics/activity'),

  // System metrics SSE stream — GET /api/v1/system/stream
  // Returns the raw URL so callers can open an EventSource
  getMetricsStreamUrl: (): string => {
    const base = METRICS_URL;
    return `${base}/system/stream`;
  },

  // A/B Experiments
  experiments: {
    list: () =>
      metricsClient.get<Experiment[]>('/experiments'),
    create: (data: CreateExperimentRequest) =>
      metricsClient.post<Experiment>('/experiments', data),
    update: (id: string, data: UpdateExperimentRequest) =>
      metricsClient.put<Experiment>(`/experiments/${id}`, data),
    delete: (id: string) =>
      metricsClient.delete(`/experiments/${id}`),
  },

  // ESG
  esg: {
    scores: () =>
      metricsClient.get<EsgScore[]>('/esg/scores'),
    upsertScore: (data: UpsertEsgScoreRequest) =>
      metricsClient.put<EsgScore>('/esg/scores', data),
    quarterly: () =>
      metricsClient.get<EsgQuarterly[]>('/esg/quarterly'),
    upsertQuarterly: (data: UpsertEsgQuarterlyRequest) =>
      metricsClient.put<EsgQuarterly>('/esg/quarterly', data),
  },
};

// ============================================================================
// useMetricsSSE — hook helper (returns EventSource)
// ============================================================================

/**
 * Open an SSE connection to the metrics stream.
 * Usage: const es = useMetricsSSE(); es.onmessage = (e) => ...
 * Remember to call es.close() on cleanup.
 */
export function useMetricsSSE(): EventSource {
  const url = metricsApi.getMetricsStreamUrl();
  return new EventSource(url, { withCredentials: true });
}
