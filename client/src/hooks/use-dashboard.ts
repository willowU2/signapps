import { useQuery } from '@tanstack/react-query';
import { containersApi, metricsApi, storageApi, routesApi } from '@/lib/api';
import { getBreaker } from '@/lib/circuit-breaker';

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
 */
async function guarded<T>(service: string, fn: () => Promise<T>): Promise<T> {
  return getBreaker(service).call(fn);
}

export function useDashboardData() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      // All four calls go through circuit breakers — if a service is down
      // for 3+ consecutive checks the breaker opens and stops retrying
      // for 30 seconds, eliminating console error spam.
      const [containersRes, metricsRes, bucketsRes, routesRes] = await Promise.allSettled([
        guarded('containers', () => containersApi.list()),
        guarded('metrics', () => metricsApi.system()),
        guarded('storage', () => storageApi.listBuckets()),
        guarded('proxy', () => routesApi.list()),
      ]);

      let containerCount = 0;
      let runningCount = 0;
      if (containersRes.status === 'fulfilled' && containersRes.value.data) {
        const containers = containersRes.value.data;
        containerCount = containers.length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        runningCount = containers.filter((c: any) =>
          c.docker_info?.state === 'running' || c.state === 'running'
        ).length;
      }

      let cpu = 0, memory = 0, disk = 0, uptime = 0, networkRx = 0, networkTx = 0;
      if (metricsRes.status === 'fulfilled' && metricsRes.value.data) {
        const m = metricsRes.value.data;
        cpu = m.cpu_usage_percent || m.cpu || 0;
        memory = m.memory_usage_percent || m.memory || 0;
        disk = m.disk_usage_percent || m.disk || 0;
        uptime = m.uptime_seconds || m.uptime || 0;
        networkRx = m.network_rx_bytes || 0;
        networkTx = m.network_tx_bytes || 0;
      }

      let storageUsed = '0 buckets';
      if (bucketsRes.status === 'fulfilled' && bucketsRes.value.data) {
        storageUsed = `${bucketsRes.value.data.length} buckets`;
      }

      let routeCount = 0;
      if (routesRes.status === 'fulfilled' && routesRes.value.data) {
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
    staleTime: 30_000,
    // Slow down the polling interval — 30s is fine for a dashboard overview
    refetchInterval: 30_000,
    // Don't refetch automatically when the window regains focus if data is fresh
    refetchOnWindowFocus: false,
  });
}
