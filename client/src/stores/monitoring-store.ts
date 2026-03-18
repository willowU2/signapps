/**
 * Monitoring Store
 *
 * Zustand store for Office Suite monitoring state.
 */

import { create } from 'zustand';
import type {
  OfficeMetricsSummary,
  MetricSeries,
  DocumentTypeBreakdown,
  UserActivityMetrics,
  MonitoringEvent,
  Alert,
  AlertRule,
  SystemHealth,
  TimeRange,
  EventSeverity,
  EventType,
} from '@/lib/office/monitoring/types';
import { monitoringApi } from '@/lib/office/monitoring/api';

// ============================================================================
// Types
// ============================================================================

interface MonitoringState {
  // Metrics
  summary: OfficeMetricsSummary | null;
  metricSeries: MetricSeries[];
  documentBreakdown: DocumentTypeBreakdown[];
  userActivity: UserActivityMetrics | null;

  // Events
  events: MonitoringEvent[];
  recentEvents: MonitoringEvent[];
  totalEvents: number;
  hasMoreEvents: boolean;

  // Alerts
  alertRules: AlertRule[];
  activeAlerts: Alert[];
  alertHistory: Alert[];

  // Health
  health: SystemHealth | null;

  // Filters
  timeRange: TimeRange;
  severityFilter: EventSeverity[];
  typeFilter: EventType[];

  // Loading states
  isLoadingSummary: boolean;
  isLoadingEvents: boolean;
  isLoadingAlerts: boolean;
  isLoadingHealth: boolean;

  // Real-time
  metricsSubscription: (() => void) | null;
  eventsSubscription: (() => void) | null;

  // Error
  error: string | null;

  // Actions - Metrics
  loadSummary: (timeRange?: TimeRange) => Promise<void>;
  loadMetricSeries: (names: string[]) => Promise<void>;
  loadDocumentBreakdown: () => Promise<void>;
  loadUserActivity: () => Promise<void>;

  // Actions - Events
  loadEvents: () => Promise<void>;
  loadMoreEvents: () => Promise<void>;
  loadRecentEvents: () => Promise<void>;
  acknowledgeEvent: (eventId: string) => Promise<boolean>;
  acknowledgeAllEvents: () => Promise<number>;

  // Actions - Alerts
  loadAlertRules: () => Promise<void>;
  loadActiveAlerts: () => Promise<void>;
  loadAlertHistory: () => Promise<void>;
  createAlertRule: (rule: Omit<AlertRule, 'id' | 'status' | 'lastTriggered' | 'triggeredCount'>) => Promise<boolean>;
  updateAlertRule: (ruleId: string, updates: Partial<AlertRule>) => Promise<boolean>;
  deleteAlertRule: (ruleId: string) => Promise<boolean>;
  silenceAlert: (alertId: string, duration: number) => Promise<boolean>;
  acknowledgeAlert: (alertId: string) => Promise<boolean>;

  // Actions - Health
  loadHealth: () => Promise<void>;

  // Actions - Real-time
  subscribeToMetrics: () => void;
  subscribeToEvents: () => void;
  unsubscribeAll: () => void;

  // Actions - Filters
  setTimeRange: (range: TimeRange) => void;
  setSeverityFilter: (severity: EventSeverity[]) => void;
  setTypeFilter: (types: EventType[]) => void;

  // Utility
  refreshAll: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useMonitoringStore = create<MonitoringState>()((set, get) => ({
  // Initial state
  summary: null,
  metricSeries: [],
  documentBreakdown: [],
  userActivity: null,

  events: [],
  recentEvents: [],
  totalEvents: 0,
  hasMoreEvents: false,

  alertRules: [],
  activeAlerts: [],
  alertHistory: [],

  health: null,

  timeRange: '24h',
  severityFilter: [],
  typeFilter: [],

  isLoadingSummary: false,
  isLoadingEvents: false,
  isLoadingAlerts: false,
  isLoadingHealth: false,

  metricsSubscription: null,
  eventsSubscription: null,

  error: null,

  // Metrics Actions
  loadSummary: async (timeRange?: TimeRange) => {
    const range = timeRange ?? get().timeRange;
    set({ isLoadingSummary: true, error: null });

    try {
      const summary = await monitoringApi.getMetricsSummary(range);
      set({ summary, timeRange: range, isLoadingSummary: false });
    } catch (error) {
      set({
        isLoadingSummary: false,
        error: error instanceof Error ? error.message : 'Erreur de chargement',
      });
    }
  },

  loadMetricSeries: async (names: string[]) => {
    const { timeRange } = get();

    try {
      const series = await monitoringApi.getMetricSeries({
        names,
        timeRange,
        granularity: timeRange === '1h' ? 'minute' : timeRange === '24h' ? 'hour' : 'day',
      });
      set({ metricSeries: series });
    } catch (error) {
      // Silent fail for series
    }
  },

  loadDocumentBreakdown: async () => {
    const { timeRange } = get();

    try {
      const breakdown = await monitoringApi.getDocumentTypeBreakdown(timeRange);
      set({ documentBreakdown: breakdown });
    } catch (error) {
      // Silent fail
    }
  },

  loadUserActivity: async () => {
    const { timeRange } = get();

    try {
      const activity = await monitoringApi.getUserActivityMetrics(timeRange);
      set({ userActivity: activity });
    } catch (error) {
      // Silent fail
    }
  },

  // Events Actions
  loadEvents: async () => {
    const { severityFilter, typeFilter, timeRange } = get();
    set({ isLoadingEvents: true, error: null });

    try {
      const response = await monitoringApi.getEvents({
        filter: {
          severity: severityFilter.length > 0 ? severityFilter : undefined,
          types: typeFilter.length > 0 ? typeFilter : undefined,
          startTime: getStartTimeForRange(timeRange),
        },
        limit: 50,
        sortOrder: 'desc',
      });

      set({
        events: response.events,
        totalEvents: response.total,
        hasMoreEvents: response.hasMore,
        isLoadingEvents: false,
      });
    } catch (error) {
      set({
        isLoadingEvents: false,
        error: error instanceof Error ? error.message : 'Erreur de chargement',
      });
    }
  },

  loadMoreEvents: async () => {
    const { events, hasMoreEvents, isLoadingEvents, severityFilter, typeFilter, timeRange } = get();
    if (!hasMoreEvents || isLoadingEvents) return;

    set({ isLoadingEvents: true });

    try {
      const response = await monitoringApi.getEvents({
        filter: {
          severity: severityFilter.length > 0 ? severityFilter : undefined,
          types: typeFilter.length > 0 ? typeFilter : undefined,
          startTime: getStartTimeForRange(timeRange),
        },
        limit: 50,
        offset: events.length,
        sortOrder: 'desc',
      });

      set({
        events: [...events, ...response.events],
        hasMoreEvents: response.hasMore,
        isLoadingEvents: false,
      });
    } catch (error) {
      set({
        isLoadingEvents: false,
        error: error instanceof Error ? error.message : 'Erreur de chargement',
      });
    }
  },

  loadRecentEvents: async () => {
    try {
      const events = await monitoringApi.getRecentEvents(10);
      set({ recentEvents: events });
    } catch (error) {
      // Silent fail
    }
  },

  acknowledgeEvent: async (eventId: string) => {
    try {
      const updated = await monitoringApi.acknowledgeEvent(eventId);

      set((state) => ({
        events: state.events.map((e) => (e.id === eventId ? updated : e)),
        recentEvents: state.recentEvents.map((e) => (e.id === eventId ? updated : e)),
      }));

      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur',
      });
      return false;
    }
  },

  acknowledgeAllEvents: async () => {
    const { events } = get();
    const unacknowledged = events.filter((e) => !e.acknowledged).map((e) => e.id);

    if (unacknowledged.length === 0) return 0;

    try {
      const result = await monitoringApi.acknowledgeEvents(unacknowledged);

      set((state) => ({
        events: state.events.map((e) =>
          unacknowledged.includes(e.id) ? { ...e, acknowledged: true } : e
        ),
      }));

      return result.count;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur',
      });
      return 0;
    }
  },

  // Alerts Actions
  loadAlertRules: async () => {
    set({ isLoadingAlerts: true });

    try {
      const rules = await monitoringApi.getAlertRules();
      set({ alertRules: rules, isLoadingAlerts: false });
    } catch (error) {
      set({ isLoadingAlerts: false });
    }
  },

  loadActiveAlerts: async () => {
    try {
      const alerts = await monitoringApi.getActiveAlerts();
      set({ activeAlerts: alerts });
    } catch (error) {
      // Silent fail
    }
  },

  loadAlertHistory: async () => {
    try {
      const { alerts } = await monitoringApi.getAlertHistory({ limit: 50 });
      set({ alertHistory: alerts });
    } catch (error) {
      // Silent fail
    }
  },

  createAlertRule: async (rule) => {
    try {
      const created = await monitoringApi.createAlertRule(rule);
      set((state) => ({ alertRules: [...state.alertRules, created] }));
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur de création',
      });
      return false;
    }
  },

  updateAlertRule: async (ruleId, updates) => {
    try {
      const updated = await monitoringApi.updateAlertRule(ruleId, updates);
      set((state) => ({
        alertRules: state.alertRules.map((r) => (r.id === ruleId ? updated : r)),
      }));
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur de mise à jour',
      });
      return false;
    }
  },

  deleteAlertRule: async (ruleId) => {
    try {
      await monitoringApi.deleteAlertRule(ruleId);
      set((state) => ({
        alertRules: state.alertRules.filter((r) => r.id !== ruleId),
      }));
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur de suppression',
      });
      return false;
    }
  },

  silenceAlert: async (alertId, duration) => {
    try {
      const updated = await monitoringApi.silenceAlert(alertId, duration);
      set((state) => ({
        activeAlerts: state.activeAlerts.map((a) => (a.id === alertId ? updated : a)),
      }));
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur',
      });
      return false;
    }
  },

  acknowledgeAlert: async (alertId) => {
    try {
      const updated = await monitoringApi.acknowledgeAlert(alertId);
      set((state) => ({
        activeAlerts: state.activeAlerts.map((a) => (a.id === alertId ? updated : a)),
      }));
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur',
      });
      return false;
    }
  },

  // Health Actions
  loadHealth: async () => {
    set({ isLoadingHealth: true });

    try {
      const health = await monitoringApi.getSystemHealth();
      set({ health, isLoadingHealth: false });
    } catch (error) {
      set({ isLoadingHealth: false });
    }
  },

  // Real-time Actions
  subscribeToMetrics: () => {
    const { metricsSubscription } = get();
    if (metricsSubscription) return;

    const unsubscribe = monitoringApi.subscribeToMetricsUpdates(
      (metrics) => {
        // Update summary with new metrics
        // This would require more sophisticated merging logic
      },
      () => {
        // Reconnect on error
        setTimeout(() => {
          get().unsubscribeAll();
          get().subscribeToMetrics();
        }, 5000);
      }
    );

    set({ metricsSubscription: unsubscribe });
  },

  subscribeToEvents: () => {
    const { eventsSubscription } = get();
    if (eventsSubscription) return;

    const unsubscribe = monitoringApi.subscribeToEvents(
      (event) => {
        set((state) => ({
          events: [event, ...state.events],
          recentEvents: [event, ...state.recentEvents.slice(0, 9)],
          totalEvents: state.totalEvents + 1,
        }));
      },
      () => {
        // Reconnect on error
        setTimeout(() => {
          const { eventsSubscription } = get();
          if (eventsSubscription) {
            eventsSubscription();
            set({ eventsSubscription: null });
          }
          get().subscribeToEvents();
        }, 5000);
      }
    );

    set({ eventsSubscription: unsubscribe });
  },

  unsubscribeAll: () => {
    const { metricsSubscription, eventsSubscription } = get();

    if (metricsSubscription) {
      metricsSubscription();
    }
    if (eventsSubscription) {
      eventsSubscription();
    }

    set({ metricsSubscription: null, eventsSubscription: null });
  },

  // Filter Actions
  setTimeRange: (range: TimeRange) => {
    set({ timeRange: range });
    get().loadSummary(range);
    get().loadEvents();
  },

  setSeverityFilter: (severity: EventSeverity[]) => {
    set({ severityFilter: severity });
    get().loadEvents();
  },

  setTypeFilter: (types: EventType[]) => {
    set({ typeFilter: types });
    get().loadEvents();
  },

  // Utility
  refreshAll: async () => {
    await Promise.all([
      get().loadSummary(),
      get().loadDocumentBreakdown(),
      get().loadUserActivity(),
      get().loadEvents(),
      get().loadActiveAlerts(),
      get().loadHealth(),
    ]);
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    get().unsubscribeAll();

    set({
      summary: null,
      metricSeries: [],
      documentBreakdown: [],
      userActivity: null,
      events: [],
      recentEvents: [],
      totalEvents: 0,
      hasMoreEvents: false,
      alertRules: [],
      activeAlerts: [],
      alertHistory: [],
      health: null,
      error: null,
    });
  },
}));

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
// Selectors
// ============================================================================

export const selectMetricsSummary = (state: MonitoringState) => state.summary;
export const selectActiveAlerts = (state: MonitoringState) => state.activeAlerts;
export const selectRecentEvents = (state: MonitoringState) => state.recentEvents;
export const selectSystemHealth = (state: MonitoringState) => state.health;

export default useMonitoringStore;
