import { useQuery } from '@tanstack/react-query';
import { routesApi, ProxyStatus } from '@/lib/api';

export function useProxyStatus() {
  return useQuery<ProxyStatus | null>({
    queryKey: ['proxy', 'status'],
    retry: false,
    queryFn: async () => {
      try {
        const response = await routesApi.proxyStatus();
        return response.data || null;
      } catch {
        return null;
      }
    },
    refetchInterval: 15000,
  });
}
