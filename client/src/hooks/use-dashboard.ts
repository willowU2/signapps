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
import { mailApi as mailApiModule } from "@/lib/api/mail";
import { calendarApi, tasksApi } from "@/lib/api/calendar";
import { quotasApi } from "@/lib/api/storage";
import { contactsApi } from "@/lib/api/contacts";
import { chatApi } from "@/lib/api/chat";
import { notificationsApi as notifApiModule } from "@/lib/api/notifications";
import { meetApi } from "@/lib/api/meet";

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
// Dashboard Summary — real-time aggregated KPI data from individual services
// ============================================================================

/** Default summary with zero counts (used as fallback). */
const EMPTY_SUMMARY: DashboardSummary = {
  unread_emails: 0,
  tasks_due_today: 0,
  upcoming_events: 0,
  recent_files: 0,
  storage_used_bytes: 0,
  contacts_count: 0,
  chat_unread: 0,
  notifications_unread: 0,
  active_meetings: 0,
  next_event_title: null,
  next_event_time: null,
};

/**
 * Fetches aggregated dashboard KPIs from individual service APIs.
 * Each call is independent -- a single service failure does not
 * block the others (Promise.allSettled + circuit breakers).
 */
export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const [
        mailRes,
        eventsRes,
        tasksRes,
        filesRes,
        storageRes,
        contactsRes,
        chatRes,
        notifRes,
        meetRes,
      ] = await Promise.allSettled([
        // 1. Mail — unread count
        guarded(ServiceName.MAIL, () => mailApiModule.getStats()),
        // 2. Calendar — today's events
        guarded(ServiceName.CALENDAR, async () => {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);
          const calRes = await calendarApi.listCalendars();
          const calendars = calRes.data ?? [];
          const nested = await Promise.all(
            calendars.map((cal: { id: string }) =>
              calendarApi
                .listEvents(cal.id, todayStart, todayEnd)
                .then((r) => r.data ?? [])
                .catch(() => []),
            ),
          );
          return nested.flat();
        }),
        // 3. Tasks — open tasks count
        guarded(ServiceName.CALENDAR, async () => {
          const calRes = await calendarApi.listCalendars();
          const calendars = calRes.data ?? [];
          const allTasks: { status: string }[] = [];
          for (const cal of calendars) {
            try {
              const r = await tasksApi.listTasks(cal.id);
              allTasks.push(...((r.data ?? []) as { status: string }[]));
            } catch {
              /* skip */
            }
          }
          return allTasks;
        }),
        // 4. Storage — recent files count (default bucket)
        guarded(ServiceName.STORAGE, () => storageApi.listFiles("default", "")),
        // 5. Storage — quota usage
        guarded(ServiceName.STORAGE, () => quotasApi.getMyQuota()),
        // 6. Contacts — total count
        guarded(ServiceName.CONTACTS, () => contactsApi.list()),
        // 7. Chat — unread messages
        guarded(ServiceName.CHAT, () => chatApi.getAllUnreadCounts()),
        // 8. Notifications — unread count
        guarded(ServiceName.NOTIFICATIONS, () => notifApiModule.unreadCount()),
        // 9. Meet — active rooms
        guarded(ServiceName.MEET, () => meetApi.listRooms()),
      ]);

      const summary: DashboardSummary = { ...EMPTY_SUMMARY };

      // Mail: unread_emails
      if (mailRes.status === "fulfilled" && mailRes.value?.data) {
        summary.unread_emails = mailRes.value.data.unread_count ?? 0;
      }

      // Calendar: upcoming_events + next event info
      if (eventsRes.status === "fulfilled") {
        const events = eventsRes.value as {
          title: string;
          start_time: string;
        }[];
        summary.upcoming_events = events.length;
        // Find next event that hasn't started yet
        const now = new Date();
        const upcoming = events
          .filter((e) => new Date(e.start_time) > now)
          .sort(
            (a, b) =>
              new Date(a.start_time).getTime() -
              new Date(b.start_time).getTime(),
          );
        if (upcoming.length > 0) {
          summary.next_event_title = upcoming[0].title;
          summary.next_event_time = new Date(
            upcoming[0].start_time,
          ).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          });
        }
      }

      // Tasks: tasks_due_today (open tasks)
      if (tasksRes.status === "fulfilled") {
        const tasks = tasksRes.value as { status: string }[];
        summary.tasks_due_today = tasks.filter(
          (t) => t.status !== "done",
        ).length;
      }

      // Files: recent_files
      if (filesRes.status === "fulfilled" && filesRes.value?.data) {
        summary.recent_files = filesRes.value.data.objects?.length ?? 0;
      }

      // Storage: storage_used_bytes
      if (storageRes.status === "fulfilled" && storageRes.value?.data) {
        summary.storage_used_bytes = storageRes.value.data.storage?.used ?? 0;
      }

      // Contacts: contacts_count
      if (contactsRes.status === "fulfilled" && contactsRes.value?.data) {
        const contacts = contactsRes.value.data;
        summary.contacts_count = Array.isArray(contacts) ? contacts.length : 0;
      }

      // Chat: chat_unread (sum all channel unread counts)
      if (chatRes.status === "fulfilled" && chatRes.value?.data) {
        const statuses = chatRes.value.data;
        summary.chat_unread = Array.isArray(statuses)
          ? statuses.reduce(
              (sum: number, s: { unread_count?: number }) =>
                sum + (s.unread_count ?? 0),
              0,
            )
          : 0;
      }

      // Notifications: notifications_unread
      if (notifRes.status === "fulfilled" && notifRes.value?.data) {
        summary.notifications_unread = notifRes.value.data.count ?? 0;
      }

      // Meet: active_meetings
      if (meetRes.status === "fulfilled" && meetRes.value?.data) {
        const rooms = meetRes.value.data;
        summary.active_meetings = Array.isArray(rooms)
          ? rooms.filter((r: { status: string }) => r.status === "active")
              .length
          : 0;
      }

      return summary;
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
