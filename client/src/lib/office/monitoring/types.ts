/**
 * Office Monitoring Types
 *
 * Types for Office Suite metrics and monitoring.
 */

// ============================================================================
// Metric Types
// ============================================================================

export type MetricType =
  | 'counter'
  | 'gauge'
  | 'histogram'
  | 'summary';

export type MetricCategory =
  | 'document'
  | 'editor'
  | 'conversion'
  | 'cache'
  | 'sync'
  | 'performance'
  | 'error';

export type TimeRange =
  | '1h'
  | '6h'
  | '24h'
  | '7d'
  | '30d';

export type Granularity =
  | 'minute'
  | 'hour'
  | 'day'
  | 'week';

// ============================================================================
// Metrics
// ============================================================================

export interface Metric {
  name: string;
  type: MetricType;
  category: MetricCategory;
  value: number;
  unit?: string;
  labels?: Record<string, string>;
  timestamp: string;
}

export interface MetricSeries {
  name: string;
  category: MetricCategory;
  unit?: string;
  dataPoints: Array<{
    timestamp: string;
    value: number;
  }>;
  aggregations: {
    min: number;
    max: number;
    avg: number;
    sum: number;
    count: number;
  };
}

export interface MetricDefinition {
  name: string;
  description: string;
  type: MetricType;
  category: MetricCategory;
  unit?: string;
  labels?: string[];
}

// ============================================================================
// Dashboard Metrics
// ============================================================================

export interface OfficeMetricsSummary {
  // Document metrics
  documentsCreated: number;
  documentsEdited: number;
  documentsViewed: number;
  documentsExported: number;
  activeDocuments: number;

  // Editor metrics
  editorSessions: number;
  averageSessionDuration: number; // seconds
  collaborativeSessions: number;
  totalEdits: number;

  // Conversion metrics
  conversionsTotal: number;
  conversionsSuccessful: number;
  conversionsFailed: number;
  averageConversionTime: number;

  // Cache metrics
  cacheHitRate: number;
  cacheSize: number;
  cacheSavings: number;

  // Sync metrics
  syncedDocuments: number;
  syncConflicts: number;
  lastSyncTime?: string;

  // Performance metrics
  averageLoadTime: number;
  averageSaveTime: number;
  averageExportTime: number;
  p99LoadTime: number;

  // Period
  period: TimeRange;
  updatedAt: string;
}

export interface DocumentTypeBreakdown {
  type: 'document' | 'spreadsheet' | 'presentation' | 'form';
  count: number;
  percentage: number;
  trend: number; // percentage change
}

export interface UserActivityMetrics {
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  topUsers: Array<{
    userId: string;
    userName: string;
    documentsEdited: number;
    totalEdits: number;
  }>;
}

// ============================================================================
// Events
// ============================================================================

export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

export type EventType =
  | 'document_created'
  | 'document_edited'
  | 'document_deleted'
  | 'document_exported'
  | 'conversion_started'
  | 'conversion_completed'
  | 'conversion_failed'
  | 'sync_started'
  | 'sync_completed'
  | 'sync_conflict'
  | 'cache_miss'
  | 'cache_eviction'
  | 'error_occurred'
  | 'performance_degraded'
  | 'quota_warning'
  | 'quota_exceeded';

export interface MonitoringEvent {
  id: string;
  type: EventType;
  severity: EventSeverity;
  message: string;
  timestamp: string;

  // Context
  documentId?: string;
  documentName?: string;
  userId?: string;
  userName?: string;

  // Details
  metadata?: Record<string, unknown>;
  stackTrace?: string;

  // State
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface EventFilter {
  types?: EventType[];
  severity?: EventSeverity[];
  documentId?: string;
  userId?: string;
  startTime?: string;
  endTime?: string;
  acknowledged?: boolean;
}

// ============================================================================
// Alerts
// ============================================================================

export type AlertStatus = 'active' | 'resolved' | 'silenced';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;

  // Condition
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  threshold: number;
  duration: number; // seconds

  // Actions
  severity: EventSeverity;
  notifyChannels: string[];

  // Status
  status: AlertStatus;
  lastTriggered?: string;
  triggeredCount: number;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  status: AlertStatus;
  severity: EventSeverity;
  message: string;
  value: number;
  threshold: number;
  triggeredAt: string;
  resolvedAt?: string;
  silencedUntil?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

// ============================================================================
// Health Check
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheck {
  component: string;
  status: HealthStatus;
  message?: string;
  latency?: number;
  lastCheck: string;
}

export interface SystemHealth {
  overall: HealthStatus;
  components: {
    editor: HealthCheck;
    converter: HealthCheck;
    cache: HealthCheck;
    storage: HealthCheck;
    sync: HealthCheck;
    database: HealthCheck;
  };
  uptime: number; // seconds
  lastIncident?: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface GetMetricsParams {
  category?: MetricCategory;
  names?: string[];
  timeRange?: TimeRange;
  granularity?: Granularity;
  labels?: Record<string, string>;
}

export interface GetEventsParams {
  filter?: EventFilter;
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface GetEventsResponse {
  events: MonitoringEvent[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Constants
// ============================================================================

export const EVENT_SEVERITY_LABELS: Record<EventSeverity, string> = {
  info: 'Info',
  warning: 'Avertissement',
  error: 'Erreur',
  critical: 'Critique',
};

export const EVENT_SEVERITY_COLORS: Record<EventSeverity, string> = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  critical: 'bg-red-200 text-red-900',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  document_created: 'Document créé',
  document_edited: 'Document modifié',
  document_deleted: 'Document supprimé',
  document_exported: 'Document exporté',
  conversion_started: 'Conversion démarrée',
  conversion_completed: 'Conversion terminée',
  conversion_failed: 'Conversion échouée',
  sync_started: 'Sync démarrée',
  sync_completed: 'Sync terminée',
  sync_conflict: 'Conflit de sync',
  cache_miss: 'Cache miss',
  cache_eviction: 'Éviction cache',
  error_occurred: 'Erreur',
  performance_degraded: 'Performance dégradée',
  quota_warning: 'Quota bientôt atteint',
  quota_exceeded: 'Quota dépassé',
};

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  healthy: 'Opérationnel',
  degraded: 'Dégradé',
  unhealthy: 'Hors service',
};

export const HEALTH_STATUS_COLORS: Record<HealthStatus, string> = {
  healthy: 'bg-green-100 text-green-800',
  degraded: 'bg-yellow-100 text-yellow-800',
  unhealthy: 'bg-red-100 text-red-800',
};

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1h': 'Dernière heure',
  '6h': '6 dernières heures',
  '24h': 'Dernières 24h',
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
};

export const METRIC_CATEGORY_LABELS: Record<MetricCategory, string> = {
  document: 'Documents',
  editor: 'Éditeur',
  conversion: 'Conversion',
  cache: 'Cache',
  sync: 'Synchronisation',
  performance: 'Performance',
  error: 'Erreurs',
};
