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
import { identityApi } from "@/lib/api/identity";
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
  options: UseUniversalSearchOptions = {}
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
      const response = await identityApi.listUsers({ limit: limitPerType });
      return response.data.users || [];
    },
    enabled: includeUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch files
  const filesQuery = useQuery({
    queryKey: ["universal-search", "files"],
    queryFn: async () => {
      const response = await storageApi.listFiles("default", "", {
        limit: limitPerType,
      });
      return response.data.files || [];
    },
    enabled: includeFiles,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch tasks
  const tasksQuery = useQuery({
    queryKey: ["universal-search", "tasks"],
    queryFn: async () => {
      const response = await schedulerApi.listTasks({ limit: limitPerType });
      return response.data || [];
    },
    enabled: includeTasks,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch events
  const eventsQuery = useQuery({
    queryKey: ["universal-search", "events"],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      const response = await calendarApi.listEvents(
        undefined,
        startOfMonth.toISOString(),
        endOfMonth.toISOString()
      );
      return response.data || [];
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
          } as UserEntity)
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
            name: file.name || file.key?.split("/").pop(),
            key: file.key,
            bucket: file.bucket || "default",
            mimeType: file.mime_type || file.content_type,
            size: file.size,
            isDirectory: file.is_directory || false,
            createdAt: file.created_at,
            updatedAt: file.updated_at,
            thumbnailUrl: file.thumbnail_url,
          } as FileEntity)
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
            title: task.title,
            description: task.description,
            status: task.status || "todo",
            priority: task.priority || "medium",
            dueDate: task.due_date,
            assigneeId: task.assignee_id,
            projectId: task.project_id,
            tags: task.tags || [],
            createdAt: task.created_at,
            updatedAt: task.updated_at,
          } as TaskEntity)
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
            title: event.title,
            description: event.description,
            startTime: event.start_time,
            endTime: event.end_time,
            location: event.location,
            allDay: event.all_day || false,
            calendarId: event.calendar_id,
            attendees: event.attendees || [],
            createdAt: event.created_at,
          } as EventEntity)
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
