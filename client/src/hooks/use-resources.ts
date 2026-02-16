import { useState, useCallback } from "react";
import { calendarApi } from "@/lib/calendar-api";
import { useAuthStore } from "@/lib/store";

export interface Resource {
  id: string;
  name: string;
  type: "room" | "equipment" | "vehicle";
  capacity?: number;
  location?: string;
  is_available: boolean;
}

export interface ResourceConflict {
  resource_id: string;
  conflicting_event_id: string;
  conflicting_event_title: string;
  conflicting_start: string;
  conflicting_end: string;
}

export interface AvailabilityResponse {
  available: boolean;
  conflicts: ResourceConflict[];
}

export function useResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuthStore();

  const loadResources = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await calendarApi.get("/resources", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResources(response.data);
      setError(null);
    } catch (err) {
      console.error("Failed to load resources:", err);
      setError("Failed to load resources");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadResourcesByType = useCallback(
    async (type: string) => {
      if (!token) return [];

      try {
        const response = await calendarApi.get(`/resources/type/${type}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
      } catch (err) {
        console.error("Failed to load resources by type:", err);
        return [];
      }
    },
    [token]
  );

  const createResource = useCallback(
    async (
      name: string,
      type: "room" | "equipment" | "vehicle",
      capacity?: number,
      location?: string
    ) => {
      if (!token) return;

      try {
        const response = await calendarApi.post(
          "/resources",
          {
            name,
            type,
            capacity,
            location,
            is_available: true,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setResources([...resources, response.data]);
        setError(null);
        return response.data;
      } catch (err) {
        console.error("Failed to create resource:", err);
        setError("Failed to create resource");
        throw err;
      }
    },
    [token, resources]
  );

  const updateResource = useCallback(
    async (
      resourceId: string,
      updates: { name?: string; is_available?: boolean }
    ) => {
      if (!token) return;

      try {
        const response = await calendarApi.put(
          `/resources/${resourceId}`,
          updates,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setResources(
          resources.map((r) => (r.id === resourceId ? response.data : r))
        );
        setError(null);
        return response.data;
      } catch (err) {
        console.error("Failed to update resource:", err);
        setError("Failed to update resource");
        throw err;
      }
    },
    [token, resources]
  );

  const deleteResource = useCallback(
    async (resourceId: string) => {
      if (!token) return;

      try {
        await calendarApi.delete(`/resources/${resourceId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setResources(resources.filter((r) => r.id !== resourceId));
        setError(null);
      } catch (err) {
        console.error("Failed to delete resource:", err);
        setError("Failed to delete resource");
        throw err;
      }
    },
    [token, resources]
  );

  const checkAvailability = useCallback(
    async (
      resourceIds: string[],
      startTime: string,
      endTime: string
    ): Promise<AvailabilityResponse | null> => {
      if (!token) return null;

      try {
        const response = await calendarApi.post(
          "/resources/availability",
          {
            resource_ids: resourceIds,
            start_time: startTime,
            end_time: endTime,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
      } catch (err) {
        console.error("Failed to check availability:", err);
        return null;
      }
    },
    [token]
  );

  const bookResources = useCallback(
    async (resourceId: string, eventId: string, resourceIds: string[]) => {
      if (!token) return;

      try {
        await calendarApi.post(
          `/resources/${resourceId}/book`,
          {
            event_id: eventId,
            resource_ids: resourceIds,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setError(null);
      } catch (err) {
        console.error("Failed to book resources:", err);
        setError("Failed to book resources");
        throw err;
      }
    },
    [token]
  );

  return {
    resources,
    loading,
    error,
    loadResources,
    loadResourcesByType,
    createResource,
    updateResource,
    deleteResource,
    checkAvailability,
    bookResources,
  };
}
