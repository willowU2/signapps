/**
 * Universal Search Hook
 *
 * Agrège les données de plusieurs sources pour la recherche universelle.
 */

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import {
  type UniversalBlock,
  toBlock,
  toBlocks,
  type UserEntity,
  type FileEntity,
  type TaskEntity,
  type EventEntity,
  type DocumentEntity,
} from "@/lib/blocks";
import { usersApi } from "@/lib/api/identity";
import { storageApi } from "@/lib/api/storage";
import { schedulerApi } from "@/lib/api/scheduler";
import { calendarApi } from "@/lib/api/calendar";

// ============================================================================
// Types
// ============================================================================

export interface UseUniversalSearchOptions {
  /** Enable users search */
  includeUsers?: boolean;
  /** Enable files search */
  includeFiles?: boolean;
  /** Enable tasks search */
  includeTasks?: boolean;
  /** Enable events search */
  includeEvents?: boolean;
  /** Enable documents search */
  includeDocuments?: boolean;
  /** Limit per type */
  limitPerType?: number;
}

export interface UseUniversalSearchResult {
  blocks: UniversalBlock[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useUniversalSearch(
  options: UseUniversalSearchOptions = {},
): UseUniversalSearchResult {
  const {
    includeUsers = true,
    includeFiles = true,
    includeTasks = true,
    includeEvents = true,
    includeDocuments = true,
    limitPerType = 50,
  } = options;

  // Fetch users
  const usersQuery = useQuery({
    queryKey: ["universal-search", "users"],
    queryFn: async () => {
      const response = await usersApi.list(undefined, limitPerType);
      return response.data.users || [];
    },
    enabled: includeUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch files
  const filesQuery = useQuery({
    queryKey: ["universal-search", "files"],
    queryFn: async () => {
      const response = await storageApi.listFiles("default", "");
      // Limit results client-side since API doesn't support limit
      return (response.data.objects || []).slice(0, limitPerType);
    },
    enabled: includeFiles,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch tasks (using scheduled jobs as tasks for now)
  const tasksQuery = useQuery({
    queryKey: ["universal-search", "tasks"],
    queryFn: async () => {
      const response = await schedulerApi.listJobs();
      // Limit results client-side
      return (response.data || []).slice(0, limitPerType);
    },
    enabled: includeTasks,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch events
  const eventsQuery = useQuery({
    queryKey: ["universal-search", "events"],
    queryFn: async () => {
      // First get user's calendars, then fetch events from the first one
      const calendarsResponse = await calendarApi.listCalendars();
      const calendars = calendarsResponse.data || [];
      if (calendars.length === 0) return [];

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      const response = await calendarApi.listEvents(
        calendars[0].id,
        startOfMonth,
        endOfMonth,
      );
      return (response.data || []).slice(0, limitPerType);
    },
    enabled: includeEvents,
    staleTime: 5 * 60 * 1000,
  });

  // Convert to blocks
  const blocks = React.useMemo(() => {
    const allBlocks: UniversalBlock[] = [];

    // Users
    if (usersQuery.data) {
      try {
        const userBlocks = usersQuery.data.map((user: any) =>
          toBlock("user", {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.display_name || user.username,
            role: user.role || 0,
            avatarUrl: user.avatar_url,
            department: user.department,
            createdAt: user.created_at,
            lastLoginAt: user.last_login_at,
          } as UserEntity),
        );
        allBlocks.push(...userBlocks);
      } catch (e) {
        console.error("Error converting users to blocks:", e);
      }
    }

    // Files
    if (filesQuery.data) {
      try {
        const fileBlocks = filesQuery.data.map((file: any) =>
          toBlock(file.is_directory ? "folder" : "file", {
            id: file.id || file.key,
            name: file.name || file.key?.split("/").pop() || "",
            key: file.key || "",
            bucket: file.bucket || "default",
            content_type:
              file.mime_type || file.content_type || "application/octet-stream",
            size: file.size || 0,
            is_folder: file.is_directory || false,
            created_at: file.created_at,
            updated_at: file.updated_at,
            thumbnail_url: file.thumbnail_url,
          } as FileEntity),
        );
        allBlocks.push(...fileBlocks);
      } catch (e) {
        console.error("Error converting files to blocks:", e);
      }
    }

    // Tasks
    if (tasksQuery.data) {
      try {
        const taskBlocks = tasksQuery.data.map((task: any) =>
          toBlock("task", {
            id: task.id,
            title: task.title || "",
            description: task.description,
            status: task.status || "todo",
            priority: task.priority || "medium",
            due_date: task.due_date,
            assignee_id: task.assignee_id,
            project_id: task.project_id,
            tags: task.tags || [],
            created_at: task.created_at,
            updated_at: task.updated_at,
          } as TaskEntity),
        );
        allBlocks.push(...taskBlocks);
      } catch (e) {
        console.error("Error converting tasks to blocks:", e);
      }
    }

    // Events
    if (eventsQuery.data) {
      try {
        const eventBlocks = eventsQuery.data.map((event: any) =>
          toBlock("event", {
            id: event.id,
            title: event.title || "",
            description: event.description,
            start_time: event.start_time || new Date().toISOString(),
            end_time: event.end_time,
            location: event.location,
            all_day: event.all_day || false,
            calendar_id: event.calendar_id,
            attendees: event.attendees || [],
            created_at: event.created_at,
          } as EventEntity),
        );
        allBlocks.push(...eventBlocks);
      } catch (e) {
        console.error("Error converting events to blocks:", e);
      }
    }

    return allBlocks;
  }, [usersQuery.data, filesQuery.data, tasksQuery.data, eventsQuery.data]);

  const isLoading =
    usersQuery.isLoading ||
    filesQuery.isLoading ||
    tasksQuery.isLoading ||
    eventsQuery.isLoading;

  const error =
    usersQuery.error ||
    filesQuery.error ||
    tasksQuery.error ||
    eventsQuery.error;

  const refetch = React.useCallback(() => {
    usersQuery.refetch();
    filesQuery.refetch();
    tasksQuery.refetch();
    eventsQuery.refetch();
  }, [usersQuery, filesQuery, tasksQuery, eventsQuery]);

  return {
    blocks,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
