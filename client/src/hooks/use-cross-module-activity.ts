"use client";

// Feature 2: Cross-module activity timeline
// Feature 8: Team activity feed

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getClient, ServiceName } from "@/lib/api/factory";

export type ActivityModule =
  | "mail"
  | "tasks"
  | "docs"
  | "calendar"
  | "contacts"
  | "drive"
  | "crm";

export interface ActivityItem {
  id: string;
  module: ActivityModule;
  action: string;
  entityTitle: string;
  entityUrl?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  timestamp: string;
}

export function useCrossModuleActivity(limit = 50) {
  const client = getClient(ServiceName.IDENTITY);

  const { data, isLoading, error, refetch } = useQuery<ActivityItem[]>({
    queryKey: ["cross-module-activity", limit],
    queryFn: async () => {
      try {
        const { data } = await client.get<ActivityItem[]>(
          "/activity/cross-module",
          {
            params: { limit },
          },
        );
        return data;
      } catch {
        // Graceful degradation — return empty array when endpoint unavailable
        return [];
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const getByModule = useCallback(
    (module: ActivityModule) => {
      return (data ?? []).filter((a) => a.module === module);
    },
    [data],
  );

  const getByUser = useCallback(
    (userId: string) => {
      return (data ?? []).filter((a) => a.userId === userId);
    },
    [data],
  );

  return {
    activities: data ?? [],
    isLoading,
    error,
    refetch,
    getByModule,
    getByUser,
  };
}
