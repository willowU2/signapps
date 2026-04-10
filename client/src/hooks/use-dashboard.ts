import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosResponse } from "axios";
import { containersApi, metricsApi, storageApi, routesApi } from "@/lib/api";
import {
  dashboardApi,
  type DashboardSummary,
  type WidgetPlacement,
} from "@/lib/api/dashboard";
import type { SystemMetrics } from "@/lib/api/monitoring";
import { getServiceBreaker } from "@/lib/circuit-breaker";
import { ServiceName } from "@/lib/api/factory";

export interface DashboardData {
  containers: number;
  runningContainers: number;
  storage: string;
  routes: number;
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
  networkRx: number;
  networkTx: number;
}

/**
 * Wrap an API call with a circuit breaker so that when a service is down
 * we stop hammering it and immediately return a settled rejection instead.
 * Uses `getServiceBreaker` which automatically configures the health URL
 * for auto-reconnect probing.
 */
async function guarded<T>(
  service: ServiceName,
  fn: () => Promise<T>,
): Promise<T> {
  return getServiceBreaker(service).call(fn);
}

export function useDashboardData() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      // All four calls go through circuit breakers — if a service is down
      // for 3+ consecutive checks the breaker opens and stops retrying
      // for 30 seconds, eliminating console error spam.
      const [containersRes, metricsRes, bucketsRes, routesRes] =
        await Promise.allSettled([
          guarded(ServiceName.CONTAINERS, () => containersApi.list()),
          guarded(ServiceName.METRICS, () => metricsApi.system()),
          guarded(ServiceName.STORAGE, () => storageApi.listBuckets()),
          guarded(ServiceName.PROXY, () => routesApi.list()),
        ]);

      let containerCount = 0;
      let runningCount = 0;
      if (containersRes.status === "fulfilled" && containersRes.value.data) {
        const containers = containersRes.value.data;
        containerCount = containers.length;
         
        runningCount = containers.filter(
          (c: any) =>
            c.docker_info?.state === "running" || c.state === "running",
        ).length;
      }

      let cpu = 0,
        memory = 0,
        disk = 0,
        uptime = 0,
        networkRx = 0,
        networkTx = 0;
      if (metricsRes.status === "fulfilled" && metricsRes.value.data) {
        const data = metricsRes.value as AxiosResponse<SystemMetrics>;
        const m = data.data;
        cpu = m.cpu_usage_percent || m.cpu || 0;
        memory = m.memory_usage_percent || m.memory || 0;
        disk = m.disk_usage_percent || m.disk || 0;
        uptime = m.uptime_seconds || m.uptime || 0;
        networkRx = m.network_rx_bytes || 0;
        networkTx = m.network_tx_bytes || 0;
      }

      let storageUsed = "0 buckets";
      if (bucketsRes.status === "fulfilled" && bucketsRes.value.data) {
        storageUsed = `${bucketsRes.value.data.length} buckets`;
      }

      let routeCount = 0;
      if (routesRes.status === "fulfilled" && routesRes.value.data) {
        routeCount = routesRes.value.data.length;
      }

      return {
        containers: containerCount,
        runningContainers: runningCount,
        storage: storageUsed,
        routes: routeCount,
        cpu: Math.round(cpu),
        memory: Math.round(memory),
        disk: Math.round(disk),
        uptime,
        networkRx,
        networkTx,
      };
    },
    // Increase staleTime so we don't re-fetch on every tab switch
    staleTime: 60_000,
    // Auto-refresh every 60 seconds for live dashboard data
    refetchInterval: 60_000,
    // Don't refetch automatically when the window regains focus if data is fresh
    refetchOnWindowFocus: false,
  });
}

// ============================================================================
// Dashboard Summary — widget KPI counts from dashboardApi
// ============================================================================

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      try {
        const res = await dashboardApi.getSummary();
        return res.data;
      } catch {
        // Return zero counts on failure to avoid breaking the dashboard
        return {
          unread_emails: 0,
          tasks_due_today: 0,
          upcoming_events: 0,
          recent_files: 0,
        };
      }
    },
    staleTime: 2 * 60_000, // 2 minutes
    refetchInterval: 5 * 60_000, // Refresh every 5 minutes
    refetchOnWindowFocus: true,
  });
}

// ============================================================================
// Dashboard Layout — load/save from backend via dashboardApi
// ============================================================================

export function useDashboardBackendLayout() {
  const queryClient = useQueryClient();

  const layoutQuery = useQuery({
    queryKey: ["dashboard", "layout"],
    queryFn: async () => {
      try {
        const res = await dashboardApi.getLayout();
        return res.data;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const saveLayoutMutation = useMutation({
    mutationFn: (widgets: WidgetPlacement[]) =>
      dashboardApi.saveLayout(widgets),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", "layout"] });
    },
  });

  return {
    backendLayout: layoutQuery.data,
    isLayoutLoading: layoutQuery.isLoading,
    saveLayout: saveLayoutMutation.mutate,
    isSaving: saveLayoutMutation.isPending,
  };
}
