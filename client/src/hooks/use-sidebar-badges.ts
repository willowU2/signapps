import { useQuery } from '@tanstack/react-query';
import { containersApi, routesApi, storageApi } from '@/lib/api';

export interface SidebarBadges {
  containers?: number;
  routes?: number;
  storage?: number;
}

export function useSidebarBadges() {
  return useQuery<SidebarBadges>({
    queryKey: ['sidebar-badges'],
    queryFn: async () => {
      const [containersRes, routesRes, storageRes] = await Promise.allSettled([
        containersApi.list(),
        routesApi.list(),
        storageApi.listBuckets(),
      ]);

      const badges: SidebarBadges = {};

      if (containersRes.status === 'fulfilled' && containersRes.value.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        badges.containers = containersRes.value.data.filter((c: any) =>
          c.docker_info?.state === 'running' || c.state === 'running'
        ).length;
      }

      if (routesRes.status === 'fulfilled' && routesRes.value.data) {
        badges.routes = routesRes.value.data.length;
      }

      if (storageRes.status === 'fulfilled' && storageRes.value.data) {
        badges.storage = storageRes.value.data.length;
      }

      return badges;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });
}
