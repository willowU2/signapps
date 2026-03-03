import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { metricsApi, alertsApi, SystemMetrics, DiskMetrics, AlertConfig, AlertEvent } from '@/lib/api';
import { toast } from 'sonner';

export function useMetricsSummary(refetchInterval?: number) {
  return useQuery<SystemMetrics>({
    queryKey: ['metrics', 'summary'],
    queryFn: async () => {
      const response = await metricsApi.summary();
      return response.data;
    },
    refetchInterval: refetchInterval || false,
  });
}

export function useDiskMetrics(refetchInterval?: number) {
  return useQuery<DiskMetrics[]>({
    queryKey: ['metrics', 'disk'],
    queryFn: async () => {
      const response = await metricsApi.disk();
      return (response.data || []).map((d: DiskMetrics) => ({
        ...d,
        total: d.total_bytes ?? d.total ?? 0,
        used: d.used_bytes ?? d.used ?? 0,
        available: d.available_bytes ?? d.available ?? 0,
        percent: d.usage_percent ?? d.percent ?? 0,
      }));
    },
    refetchInterval: refetchInterval || false,
  });
}

export function useAlertConfigs() {
  return useQuery<AlertConfig[]>({
    queryKey: ['alerts', 'configs'],
    queryFn: async () => {
      const response = await alertsApi.listConfigs();
      return response.data || [];
    },
  });
}

export function useActiveAlerts() {
  return useQuery<AlertEvent[]>({
    queryKey: ['alerts', 'active'],
    queryFn: async () => {
      const response = await alertsApi.listActive();
      return response.data || [];
    },
    refetchInterval: 30000,
  });
}

export function useAlertHistory(limit: number = 10) {
  return useQuery<AlertEvent[]>({
    queryKey: ['alerts', 'history', limit],
    queryFn: async () => {
      const response = await alertsApi.listHistory(limit);
      // Backend returns array directly, not {alerts: [...]}
      return Array.isArray(response.data) ? response.data : ((response.data as any)?.alerts || []);
    },
    refetchInterval: 30000,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      await alertsApi.acknowledge(alertId);
    },
    onSuccess: () => {
      toast.success('Alert acknowledged');
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: () => {
      toast.error('Failed to acknowledge alert');
    },
  });
}

export function useToggleAlertConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await alertsApi.toggleConfig(id, enabled);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'configs'] });
    },
    onError: () => {
      toast.error('Failed to toggle alert config');
    },
  });
}

export function useDeleteAlertConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configId: string) => {
      await alertsApi.deleteConfig(configId);
    },
    onSuccess: () => {
      toast.success('Alert configuration deleted');
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: () => {
      toast.error('Failed to delete alert config');
    },
  });
}

export function useMetricsStream(enabled: boolean) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [sseConnected, setSseConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    const METRICS_URL = process.env.NEXT_PUBLIC_METRICS_URL || 'http://localhost:3008/api/v1';
    const eventSource = new EventSource(`${METRICS_URL}/metrics/stream`);

    eventSource.onopen = () => {
      if (active) setSseConnected(true);
    };

    eventSource.onmessage = (event) => {
      if (!active) return;
      try {
        const data = JSON.parse(event.data);
        setMetrics(data);
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      if (active) setSseConnected(false);
    };

    return () => {
      active = false;
      eventSource.close();
    };
  }, [enabled]);

  const connected = enabled && sseConnected;

  return { metrics, connected };
}
