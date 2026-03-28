import { useState, useCallback } from "react";
import { calendarApiClient } from "@/lib/api/core";

export interface CalendarShare {
  calendar_id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
  user_name?: string;
  user_email?: string;
}

export interface PermissionResponse {
  can_view: boolean;
  can_edit: boolean;
  can_manage: boolean;
}

export function useShares(calendarId: string | null) {
  const [shares, setShares] = useState<CalendarShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadShares = useCallback(async () => {
    if (!calendarId) return;

    try {
      setLoading(true);
      const response = await calendarApiClient.get(
        `/calendars/${calendarId}/shares`
      );
      setShares(response.data);
      setError(null);
    } catch {
      setError("Failed to load calendar shares");
    } finally {
      setLoading(false);
    }
  }, [calendarId]);

  const shareCalendar = useCallback(
    async (userId: string, role: "owner" | "editor" | "viewer") => {
      if (!calendarId) return;

      try {
        const response = await calendarApiClient.post(
          `/calendars/${calendarId}/shares`,
          { user_id: userId, role }
        );
        setShares((prev) => [...prev, response.data]);
        setError(null);
        return response.data;
      } catch (err) {
        setError("Failed to share calendar");
        throw err;
      }
    },
    [calendarId]
  );

  const unshareCalendar = useCallback(
    async (userId: string) => {
      if (!calendarId) return;

      try {
        await calendarApiClient.delete(
          `/calendars/${calendarId}/shares/${userId}`
        );
        setShares((prev) => prev.filter((s) => s.user_id !== userId));
        setError(null);
      } catch (err) {
        setError("Failed to remove share");
        throw err;
      }
    },
    [calendarId]
  );

  const updatePermission = useCallback(
    async (userId: string, role: "owner" | "editor" | "viewer") => {
      if (!calendarId) return;

      try {
        await calendarApiClient.put(
          `/calendars/${calendarId}/shares/${userId}`,
          { role }
        );
        setShares((prev) =>
          prev.map((s) => (s.user_id === userId ? { ...s, role } : s))
        );
        setError(null);
      } catch (err) {
        setError("Impossible de mettre à jour permission");
        throw err;
      }
    },
    [calendarId]
  );

  const checkPermission = useCallback(
    async (userId: string): Promise<PermissionResponse | null> => {
      if (!calendarId) return null;

      try {
        const response = await calendarApiClient.get(
          `/calendars/${calendarId}/shares/${userId}/check`
        );
        return response.data;
      } catch {
        return null;
      }
    },
    [calendarId]
  );

  return {
    shares,
    loading,
    error,
    loadShares,
    shareCalendar,
    unshareCalendar,
    updatePermission,
    checkPermission,
  };
}
