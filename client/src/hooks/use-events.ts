//! Hook for calendar events data management

import { useState, useCallback } from "react";
import { calendarApi } from "@/lib/api";
import { Event, CreateEvent, UpdateEvent } from "@/types/calendar";
import { useCalendarStore } from "@/stores/calendar-store";

export function useEvents(calendarId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { events, setEvents } = useCalendarStore();

  // Fetch events for date range
  const fetchEvents = useCallback(
    async (start: Date, end: Date) => {
      if (!calendarId) return;

      try {
        setIsLoading(true);
        setError(null);
        const response = await calendarApi.listEvents(calendarId, start, end);
        setEvents(response.data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load events";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [calendarId, setEvents]
  );

  // Create event — read the store at call time instead of from a captured
  // closure so quick successive creates don't lose each other.
  const createEvent = useCallback(
    async (data: CreateEvent) => {
      if (!calendarId) throw new Error("Calendar ID required");

      try {
        setError(null);
        const response = await calendarApi.createEvent(calendarId, data);
        const created = response.data;
        const current = useCalendarStore.getState().events;
        setEvents([...current, created]);
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Impossible de créer event";
        setError(message);
        throw err;
      }
    },
    [calendarId, setEvents]
  );

  // Update event — optimistic-style: snapshot previous events, apply server
  // response; on failure, restore the snapshot so the UI stays consistent.
  const updateEvent = useCallback(
    async (id: string, data: UpdateEvent) => {
      const snapshot = useCalendarStore.getState().events;
      try {
        setError(null);
        const response = await calendarApi.updateEvent(id, data);
        const updated = response.data;
        const current = useCalendarStore.getState().events;
        setEvents(current.map((e) => (e.id === id ? updated : e)));
        return updated;
      } catch (err) {
        // Rollback to the pre-update snapshot
        setEvents(snapshot);
        const message =
          err instanceof Error ? err.message : "Impossible de mettre à jour event";
        setError(message);
        throw err;
      }
    },
    [setEvents]
  );

  // Delete event — same snapshot/rollback pattern.
  const deleteEvent = useCallback(
    async (id: string) => {
      const snapshot = useCalendarStore.getState().events;
      try {
        setError(null);
        await calendarApi.deleteEvent(id);
        const current = useCalendarStore.getState().events;
        setEvents(current.filter((e) => e.id !== id));
      } catch (err) {
        setEvents(snapshot);
        const message = err instanceof Error ? err.message : "Impossible de supprimer event";
        setError(message);
        throw err;
      }
    },
    [setEvents]
  );

  return {
    events,
    isLoading,
    error,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}
