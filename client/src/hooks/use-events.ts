//! Hook for calendar events data management

import { useEffect, useState } from "react";
import { useCallback } from "react";
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

  // Create event
  const createEvent = useCallback(
    async (data: CreateEvent) => {
      if (!calendarId) throw new Error("Calendar ID required");

      try {
        setError(null);
        const response = await calendarApi.createEvent(calendarId, data);
        setEvents([...events, response.data]);
        return response.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Impossible de créer event";
        setError(message);
        throw err;
      }
    },
    [calendarId, events, setEvents]
  );

  // Update event
  const updateEvent = useCallback(
    async (id: string, data: UpdateEvent) => {
      try {
        setError(null);
        const response = await calendarApi.updateEvent(id, data);
        setEvents(events.map((e) => (e.id === id ? response.data : e)));
        return response.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Impossible de mettre à jour event";
        setError(message);
        throw err;
      }
    },
    [events, setEvents]
  );

  // Delete event
  const deleteEvent = useCallback(
    async (id: string) => {
      try {
        setError(null);
        await calendarApi.deleteEvent(id);
        setEvents(events.filter((e) => e.id !== id));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Impossible de supprimer event";
        setError(message);
        throw err;
      }
    },
    [events, setEvents]
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
