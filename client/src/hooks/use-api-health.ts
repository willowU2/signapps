import { useQuery } from "@tanstack/react-query";
import { getClient, ServiceName } from "@/lib/api/factory";

export type ApiHealthStatus = "online" | "offline" | "checking";

export interface ApiHealthResult {
  status: ApiHealthStatus;
  isOnline: boolean;
  isOffline: boolean;
  isChecking: boolean;
  responseTime?: number;
}

/**
 * Checks whether a single SignApps service is reachable.
 *
 * Usage:
 *   const { isOnline, isOffline } = useApiHealth(ServiceName.MAIL);
 *
 * - staleTime: 30s (same cadence as useServiceHealth)
 * - Falls back to offline on any error
 */
interface HealthData {
  online: boolean;
  responseTime?: number;
}

export function useApiHealth(service: ServiceName): ApiHealthResult {
  const { data, isLoading } = useQuery<HealthData>({
    queryKey: ["api-health", service],
    queryFn: async (): Promise<HealthData> => {
      const start = Date.now();
      try {
        const client = getClient(service);
        await client.get("/health", { timeout: 3000 });
        return { online: true, responseTime: Date.now() - start };
      } catch {
        return { online: false };
      }
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });

  if (isLoading) {
    return {
      status: "checking",
      isOnline: false,
      isOffline: false,
      isChecking: true,
    };
  }

  const online = data?.online ?? false;
  return {
    status: online ? "online" : "offline",
    isOnline: online,
    isOffline: !online,
    isChecking: false,
    responseTime: data?.responseTime,
  };
}
