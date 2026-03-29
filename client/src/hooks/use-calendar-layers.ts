import { useMemo } from "react";
import { useCalendarStore } from "@/stores/calendar-store";

export interface CalendarEvent {
  id: string;
  event_type: string;
  scope?: string;
  created_by?: string;
  assigned_to?: string;
  resource_id?: string;
  category_id?: string;
  project_id?: string;
  provider_connection_id?: string;
  // resource relation
  resource?: { resource_type?: string };
}

function matchesLayer(
  event: CalendarEvent,
  layerId: string,
  currentUserId: string,
  selectedResources: string[],
): boolean {
  switch (layerId) {
    case "my-events":
      return event.event_type === "event" && event.created_by === currentUserId;

    case "my-tasks":
      return (
        event.event_type === "task" &&
        (event.assigned_to === currentUserId || event.created_by === currentUserId)
      );

    case "team-leaves":
      return event.event_type === "leave" && event.scope === "team";

    case "rooms":
      return (
        event.event_type === "booking" &&
        event.resource?.resource_type === "room" &&
        selectedResources.includes(event.resource_id ?? "")
      );

    case "equipment":
      return (
        event.event_type === "booking" &&
        event.resource?.resource_type === "equipment" &&
        selectedResources.includes(event.resource_id ?? "")
      );

    case "vehicles":
      return (
        event.event_type === "booking" &&
        event.resource?.resource_type === "vehicle" &&
        selectedResources.includes(event.resource_id ?? "")
      );

    case "projects":
      return (
        event.event_type === "milestone" ||
        (event.event_type === "task" && !!event.project_id)
      );

    case "team-shifts":
      return event.event_type === "shift" && event.scope === "team";

    case "external":
      return !!event.provider_connection_id;

    default:
      // Category layers — layerId is the category UUID
      return event.category_id === layerId;
  }
}

/**
 * Filters a list of calendar events according to the active layer configuration
 * stored in the calendar Zustand store.
 *
 * - If no layers are enabled, all events are returned (no-op guard).
 * - Events created by a selected colleague are always included regardless of layer.
 * - Otherwise an event is included if at least one active layer matches it.
 */
export function useCalendarLayers(
  events: CalendarEvent[],
  currentUserId: string,
): CalendarEvent[] {
  const { layers, selectedColleagues, selectedResources } = useCalendarStore();

  return useMemo(() => {
    const activeLayers = layers.filter((l) => l.enabled);

    // If no layers are configured/enabled, show all events
    if (activeLayers.length === 0) return events;

    return events.filter((event) => {
      // Always show events from selected colleagues (colleague overlay)
      if (selectedColleagues.includes(event.created_by ?? "")) return true;

      // Check if the event matches at least one active layer
      return activeLayers.some((layer) =>
        matchesLayer(event, layer.layer_id, currentUserId, selectedResources),
      );
    });
  }, [events, layers, selectedColleagues, selectedResources, currentUserId]);
}
