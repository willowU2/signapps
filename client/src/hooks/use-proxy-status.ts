import { useQuery } from '@tanstack/react-query';
import { routesApi, ProxyStatus } from '@/lib/api';

export function useProxyStatus() {
  return useQuery<ProxyStatus | null>({
    queryKey: ['proxy', 'status'],
    queryFn: async () => {
      const response = await routesApi.proxyStatus();
      return response.data || null;
    },
    refetchInterval: 15000,
  });
}
