import { useState, useCallback } from "react";
import { calendarApi } from "@/lib/calendar-api";
import { useAuthStore } from "@/lib/store";

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
  const { token } = useAuthStore();

  const loadShares = useCallback(async () => {
    if (!calendarId || !token) return;

    try {
      setLoading(true);
      const response = await calendarApi.get(
        `/calendars/${calendarId}/shares`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShares(response.data);
      setError(null);
    } catch (err) {
      console.error("Failed to load shares:", err);
      setError("Failed to load calendar shares");
    } finally {
      setLoading(false);
    }
  }, [calendarId, token]);

  const shareCalendar = useCallback(
    async (userId: string, role: "owner" | "editor" | "viewer") => {
      if (!calendarId || !token) return;

      try {
        const response = await calendarApi.post(
          `/calendars/${calendarId}/shares`,
          { user_id: userId, role },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setShares([...shares, response.data]);
        setError(null);
        return response.data;
      } catch (err) {
        console.error("Failed to share calendar:", err);
        setError("Failed to share calendar");
        throw err;
      }
    },
    [calendarId, token, shares]
  );

  const unshareCalendar = useCallback(
    async (userId: string) => {
      if (!calendarId || !token) return;

      try {
        await calendarApi.delete(
          `/calendars/${calendarId}/shares/${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setShares(shares.filter((s) => s.user_id !== userId));
        setError(null);
      } catch (err) {
        console.error("Failed to unshare calendar:", err);
        setError("Failed to remove share");
        throw err;
      }
    },
    [calendarId, token, shares]
  );

  const updatePermission = useCallback(
    async (userId: string, role: "owner" | "editor" | "viewer") => {
      if (!calendarId || !token) return;

      try {
        await calendarApi.put(
          `/calendars/${calendarId}/shares/${userId}`,
          { role },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setShares(
          shares.map((s) => (s.user_id === userId ? { ...s, role } : s))
        );
        setError(null);
      } catch (err) {
        console.error("Failed to update permission:", err);
        setError("Failed to update permission");
        throw err;
      }
    },
    [calendarId, token, shares]
  );

  const checkPermission = useCallback(
    async (userId: string): Promise<PermissionResponse | null> => {
      if (!calendarId || !token) return null;

      try {
        const response = await calendarApi.get(
          `/calendars/${calendarId}/shares/${userId}/check`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
      } catch (err) {
        console.error("Failed to check permission:", err);
        return null;
      }
    },
    [calendarId, token]
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
