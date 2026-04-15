import { useQuery } from "@tanstack/react-query";
import { containersApi, routesApi, storageApi } from "@/lib/api";
import { getClient, ServiceName } from "@/lib/api/factory";

export interface SidebarBadges {
  containers?: number;
  routes?: number;
  storage?: number;
  mail?: number;
  chat?: number;
  tasks?: number;
}

export function useSidebarBadges() {
  return useQuery<SidebarBadges>({
    queryKey: ["sidebar-badges"],
    queryFn: async () => {
      const [containersRes, routesRes, storageRes, mailRes, chatRes, tasksRes] =
        await Promise.allSettled([
          containersApi.list(),
          routesApi.list(),
          storageApi.listBuckets(),
          // Mail unread count -- try to fetch from API, fallback gracefully
          getClient(ServiceName.IDENTITY)
            .get<{ unread_count?: number }>("/mail/unread-count")
            .then((r) => r.data),
          // Chat unread messages
          getClient(ServiceName.IDENTITY)
            .get<{ unread_count?: number }>("/chat/unread-count")
            .then((r) => r.data),
          // Tasks overdue count
          getClient(ServiceName.IDENTITY)
            .get<{ overdue_count?: number }>("/tasks/overdue-count")
            .then((r) => r.data),
        ]);

      const badges: SidebarBadges = {};

      if (containersRes.status === "fulfilled" && containersRes.value.data) {
        badges.containers = containersRes.value.data.filter(
          (c: any) =>
            c.docker_info?.state === "running" || c.state === "running",
        ).length;
      }

      if (routesRes.status === "fulfilled" && routesRes.value.data) {
        badges.routes = routesRes.value.data.length;
      }

      // if (storageRes.status === 'fulfilled' && storageRes.value.data) {
      //   badges.storage = storageRes.value.data.length;
      // }

      // Mail unread count (placeholder: uses API if available, otherwise 0)
      if (
        mailRes.status === "fulfilled" &&
        mailRes.value?.unread_count != null
      ) {
        badges.mail = mailRes.value.unread_count;
      }

      // Chat unread count (placeholder: uses API if available, otherwise 0)
      if (
        chatRes.status === "fulfilled" &&
        chatRes.value?.unread_count != null
      ) {
        badges.chat = chatRes.value.unread_count;
      }

      // Tasks overdue count (placeholder: uses API if available, otherwise 0)
      if (
        tasksRes.status === "fulfilled" &&
        tasksRes.value?.overdue_count != null
      ) {
        badges.tasks = tasksRes.value.overdue_count;
      }

      return badges;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });
}
