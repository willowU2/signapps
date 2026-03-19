/**
 * Office Monitoring API
 *
 * API client for metrics and monitoring.
 */

import { getClient, ServiceName } from '@/lib/api/factory';

const api = getClient(ServiceName.OFFICE);
import type {
  Metric,
  MetricSeries,
  MetricDefinition,
  OfficeMetricsSummary,
  DocumentTypeBreakdown,
  UserActivityMetrics,
  MonitoringEvent,
  Alert,
  AlertRule,
  SystemHealth,
  GetMetricsParams,
  GetEventsParams,
  GetEventsResponse,
  TimeRange,
  Granularity,
  EventFilter,
} from './types';

const MONITORING_BASE = '/api/v1/office/monitoring';

// ============================================================================
// Metrics
// ============================================================================

/**
 * Get metrics summary
 */
export async function getMetricsSummary(
  timeRange: TimeRange = '24h'
): Promise<OfficeMetricsSummary> {
  const response = await api.get<OfficeMetricsSummary>(
    `${MONITORING_BASE}/metrics/summary?timeRange=${timeRange}`
  );
  return response.data;
}

/**
 * Get metric series data
 */
export async function getMetricSeries(
  params: GetMetricsParams
): Promise<MetricSeries[]> {
  const queryParams = new URLSearchParams();

  if (params.category) queryParams.append('category', params.category);
  if (params.names?.length) queryParams.append('names', params.names.join(','));
  if (params.timeRange) queryParams.append('timeRange', params.timeRange);
  if (params.granularity) queryParams.append('granularity', params.granularity);
  if (params.labels) {
    Object.entries(params.labels).forEach(([key, value]) => {
      queryParams.append(`label.${key}`, value);
    });
  }

  const response = await api.get<MetricSeries[]>(
    `${MONITORING_BASE}/metrics/series?${queryParams.toString()}`
  );
  return response.data;
}

/**
 * Get available metric definitions
 */
export async function getMetricDefinitions(): Promise<MetricDefinition[]> {
  const response = await api.get<MetricDefinition[]>(
    `${MONITORING_BASE}/metrics/definitions`
  );
  return response.data;
}

/**
 * Get current metric values
 */
export async function getCurrentMetrics(
  names?: string[]
): Promise<Metric[]> {
  const params = names ? `?names=${names.join(',')}` : '';
  const response = await api.get<Metric[]>(
    `${MONITORING_BASE}/metrics/current${params}`
  );
  return response.data;
}

/**
 * Get document type breakdown
 */
export async function getDocumentTypeBreakdown(
  timeRange: TimeRange = '24h'
): Promise<DocumentTypeBreakdown[]> {
  const response = await api.get<DocumentTypeBreakdown[]>(
    `${MONITORING_BASE}/metrics/documents/breakdown?timeRange=${timeRange}`
  );
  return response.data;
}

/**
 * Get user activity metrics
 */
export async function getUserActivityMetrics(
  timeRange: TimeRange = '24h'
): Promise<UserActivityMetrics> {
  const response = await api.get<UserActivityMetrics>(
    `${MONITORING_BASE}/metrics/users/activity?timeRange=${timeRange}`
  );
  return response.data;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Get monitoring events
 */
export async function getEvents(
  params?: GetEventsParams
): Promise<GetEventsResponse> {
  const queryParams = new URLSearchParams();

  if (params?.filter) {
    const filter = params.filter;
    if (filter.types?.length) queryParams.append('types', filter.types.join(','));
    if (filter.severity?.length) queryParams.append('severity', filter.severity.join(','));
    if (filter.documentId) queryParams.append('documentId', filter.documentId);
    if (filter.userId) queryParams.append('userId', filter.userId);
    if (filter.startTime) queryParams.append('startTime', filter.startTime);
    if (filter.endTime) queryParams.append('endTime', filter.endTime);
    if (filter.acknowledged !== undefined) {
      queryParams.append('acknowledged', String(filter.acknowledged));
    }
  }
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.offset) queryParams.append('offset', String(params.offset));
  if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

  const response = await api.get<GetEventsResponse>(
    `${MONITORING_BASE}/events?${queryParams.toString()}`
  );
  return response.data;
}

/**
 * Get a specific event
 */
export async function getEvent(eventId: string): Promise<MonitoringEvent> {
  const response = await api.get<MonitoringEvent>(
    `${MONITORING_BASE}/events/${eventId}`
  );
  return response.data;
}

/**
 * Acknowledge an event
 */
export async function acknowledgeEvent(eventId: string): Promise<MonitoringEvent> {
  const response = await api.post<MonitoringEvent>(
    `${MONITORING_BASE}/events/${eventId}/acknowledge`
  );
  return response.data;
}

/**
 * Acknowledge multiple events
 */
export async function acknowledgeEvents(eventIds: string[]): Promise<{ count: number }> {
  const response = await api.post<{ count: number }>(
    `${MONITORING_BASE}/events/acknowledge`,
    { eventIds }
  );
  return response.data;
}

/**
 * Get recent events (shortcut)
 */
export async function getRecentEvents(limit = 20): Promise<MonitoringEvent[]> {
  const response = await getEvents({ limit, sortOrder: 'desc' });
  return response.events;
}

/**
 * Get error events
 */
export async function getErrorEvents(
  timeRange: TimeRange = '24h'
): Promise<MonitoringEvent[]> {
  const response = await getEvents({
    filter: {
      severity: ['error', 'critical'],
      startTime: getStartTimeForRange(timeRange),
    },
    sortOrder: 'desc',
  });
  return response.events;
}

// ============================================================================
// Alerts
// ============================================================================

/**
 * Get alert rules
 */
export async function getAlertRules(): Promise<AlertRule[]> {
  const response = await api.get<AlertRule[]>(`${MONITORING_BASE}/alerts/rules`);
  return response.data;
}

/**
 * Create alert rule
 */
export async function createAlertRule(
  rule: Omit<AlertRule, 'id' | 'status' | 'lastTriggered' | 'triggeredCount'>
): Promise<AlertRule> {
  const response = await api.post<AlertRule>(`${MONITORING_BASE}/alerts/rules`, rule);
  return response.data;
}

/**
 * Update alert rule
 */
export async function updateAlertRule(
  ruleId: string,
  updates: Partial<AlertRule>
): Promise<AlertRule> {
  const response = await api.patch<AlertRule>(
    `${MONITORING_BASE}/alerts/rules/${ruleId}`,
    updates
  );
  return response.data;
}

/**
 * Delete alert rule
 */
export async function deleteAlertRule(ruleId: string): Promise<void> {
  await api.delete(`${MONITORING_BASE}/alerts/rules/${ruleId}`);
}

/**
 * Get active alerts
 */
export async function getActiveAlerts(): Promise<Alert[]> {
  const response = await api.get<Alert[]>(`${MONITORING_BASE}/alerts/active`);
  return response.data;
}

/**
 * Get alert history
 */
export async function getAlertHistory(
  params?: { limit?: number; offset?: number }
): Promise<{ alerts: Alert[]; total: number }> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', String(params.limit));
  if (params?.offset) queryParams.append('offset', String(params.offset));

  const response = await api.get<{ alerts: Alert[]; total: number }>(
    `${MONITORING_BASE}/alerts/history?${queryParams.toString()}`
  );
  return response.data;
}

/**
 * Silence an alert
 */
export async function silenceAlert(
  alertId: string,
  duration: number // seconds
): Promise<Alert> {
  const response = await api.post<Alert>(
    `${MONITORING_BASE}/alerts/${alertId}/silence`,
    { duration }
  );
  return response.data;
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string): Promise<Alert> {
  const response = await api.post<Alert>(
    `${MONITORING_BASE}/alerts/${alertId}/acknowledge`
  );
  return response.data;
}

// ============================================================================
// Health
// ============================================================================

/**
 * Get system health
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const response = await api.get<SystemHealth>(`${MONITORING_BASE}/health`);
  return response.data;
}

/**
 * Get health history
 */
export async function getHealthHistory(
  timeRange: TimeRange = '24h'
): Promise<Array<{ timestamp: string; health: SystemHealth }>> {
  const response = await api.get<Array<{ timestamp: string; health: SystemHealth }>>(
    `${MONITORING_BASE}/health/history?timeRange=${timeRange}`
  );
  return response.data;
}

// ============================================================================
// Real-time Updates
// ============================================================================

/**
 * Subscribe to metrics updates via SSE
 */
export function subscribeToMetricsUpdates(
  onUpdate: (metrics: Metric[]) => void,
  onError?: (error: Event) => void
): () => void {
  const eventSource = new EventSource(`${MONITORING_BASE}/metrics/stream`);

  eventSource.onmessage = (event) => {
    try {
      const metrics: Metric[] = JSON.parse(event.data);
      onUpdate(metrics);
    } catch (e) {
      console.error('Failed to parse metrics:', e);
    }
  };

  eventSource.onerror = (error) => {
    onError?.(error);
  };

  return () => eventSource.close();
}

/**
 * Subscribe to events stream via SSE
 */
export function subscribeToEvents(
  onEvent: (event: MonitoringEvent) => void,
  onError?: (error: Event) => void
): () => void {
  const eventSource = new EventSource(`${MONITORING_BASE}/events/stream`);

  eventSource.onmessage = (event) => {
    try {
      const monitoringEvent: MonitoringEvent = JSON.parse(event.data);
      onEvent(monitoringEvent);
    } catch (e) {
      console.error('Failed to parse event:', e);
    }
  };

  eventSource.onerror = (error) => {
    onError?.(error);
  };

  return () => eventSource.close();
}

// ============================================================================
// Helpers
// ============================================================================

function getStartTimeForRange(timeRange: TimeRange): string {
  const now = new Date();
  switch (timeRange) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case '6h':
      return new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
}

// ============================================================================
// Export All
// ============================================================================

export const monitoringApi = {
  // Metrics
  getMetricsSummary,
  getMetricSeries,
  getMetricDefinitions,
  getCurrentMetrics,
  getDocumentTypeBreakdown,
  getUserActivityMetrics,
  // Events
  getEvents,
  getEvent,
  acknowledgeEvent,
  acknowledgeEvents,
  getRecentEvents,
  getErrorEvents,
  // Alerts
  getAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  getActiveAlerts,
  getAlertHistory,
  silenceAlert,
  acknowledgeAlert,
  // Health
  getSystemHealth,
  getHealthHistory,
  // Real-time
  subscribeToMetricsUpdates,
  subscribeToEvents,
};

export default monitoringApi;
