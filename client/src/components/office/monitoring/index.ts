/**
 * Office Monitoring Components
 *
 * Components for metrics and monitoring.
 */

// Components
export { MetricsDashboard } from './metrics-dashboard';
export { HealthStatusWidget } from './health-status-widget';

// Types
export type {
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
  HealthCheck,
  HealthStatus,
  MetricType,
  MetricCategory,
  TimeRange,
  Granularity,
  EventSeverity,
  EventType,
} from '@/lib/office/monitoring/types';

// Constants
export {
  EVENT_SEVERITY_LABELS,
  EVENT_SEVERITY_COLORS,
  EVENT_TYPE_LABELS,
  HEALTH_STATUS_LABELS,
  HEALTH_STATUS_COLORS,
  TIME_RANGE_LABELS,
  METRIC_CATEGORY_LABELS,
} from '@/lib/office/monitoring/types';

// API
export { monitoringApi } from '@/lib/office/monitoring/api';

// Store
export { useMonitoringStore } from '@/stores/monitoring-store';
