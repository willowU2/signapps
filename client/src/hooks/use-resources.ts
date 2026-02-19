import { useState, useCallback } from "react";
import { calendarApi } from "@/lib/api";

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

  const loadResources = useCallback(async () => {
    try {
      setLoading(true);
      const response = await calendarApi.get("/resources");
      setResources(response.data);
      setError(null);
    } catch {
      setError("Failed to load resources");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadResourcesByType = useCallback(
    async (type: string) => {
      try {
        const response = await calendarApi.get(`/resources/type/${type}`);
        return response.data;
      } catch {
        return [];
      }
    },
    []
  );

  const createResource = useCallback(
    async (
      name: string,
      type: "room" | "equipment" | "vehicle",
      capacity?: number,
      location?: string
    ) => {
      try {
        const response = await calendarApi.post("/resources", {
          name,
          type,
          capacity,
          location,
          is_available: true,
        });
        setResources((prev) => [...prev, response.data]);
        setError(null);
        return response.data;
      } catch (err) {
        setError("Failed to create resource");
        throw err;
      }
    },
    []
  );

  const updateResource = useCallback(
    async (
      resourceId: string,
      updates: { name?: string; is_available?: boolean }
    ) => {
      try {
        const response = await calendarApi.put(
          `/resources/${resourceId}`,
          updates
        );
        setResources((prev) =>
          prev.map((r) => (r.id === resourceId ? response.data : r))
        );
        setError(null);
        return response.data;
      } catch (err) {
        setError("Failed to update resource");
        throw err;
      }
    },
    []
  );

  const deleteResource = useCallback(
    async (resourceId: string) => {
      try {
        await calendarApi.delete(`/resources/${resourceId}`);
        setResources((prev) => prev.filter((r) => r.id !== resourceId));
        setError(null);
      } catch (err) {
        setError("Failed to delete resource");
        throw err;
      }
    },
    []
  );

  const checkAvailability = useCallback(
    async (
      resourceIds: string[],
      startTime: string,
      endTime: string
    ): Promise<AvailabilityResponse | null> => {
      try {
        const response = await calendarApi.post("/resources/availability", {
          resource_ids: resourceIds,
          start_time: startTime,
          end_time: endTime,
        });
        return response.data;
      } catch {
        return null;
      }
    },
    []
  );

  const bookResources = useCallback(
    async (resourceId: string, eventId: string, resourceIds: string[]) => {
      try {
        await calendarApi.post(`/resources/${resourceId}/book`, {
          event_id: eventId,
          resource_ids: resourceIds,
        });
        setError(null);
      } catch (err) {
        setError("Failed to book resources");
        throw err;
      }
    },
    []
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
