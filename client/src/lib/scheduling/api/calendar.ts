/**
 * Scheduling Calendar API
 *
 * API client for the Scheduling module calendar operations.
 * Wraps the base calendar API with scheduling-specific types and React Query hooks.
 */

import * as React from 'react';
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { calendarApi, tasksApi } from '@/lib/api/calendar';
import { toast } from 'sonner';
import type {
  ScheduleBlock,
  CreateEventInput,
  UpdateEventInput,
  EventsQueryParams,
  DateRange,
  Task,
  TaskStatus,
  EventTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  RSVPInput,
  RSVPStatus,
  Attendee,
} from '../types/scheduling';

// ============================================================================
// Query Keys
// ============================================================================

export const schedulingKeys = {
  all: ['scheduling'] as const,
  events: () => [...schedulingKeys.all, 'events'] as const,
  eventsList: (params: EventsQueryParams) => [...schedulingKeys.events(), params] as const,
  event: (id: string) => [...schedulingKeys.events(), id] as const,
  tasks: () => [...schedulingKeys.all, 'tasks'] as const,
  tasksList: (calendarId: string) => [...schedulingKeys.tasks(), calendarId] as const,
  task: (id: string) => [...schedulingKeys.tasks(), id] as const,
  calendars: () => [...schedulingKeys.all, 'calendars'] as const,
  templates: () => [...schedulingKeys.all, 'templates'] as const,
  template: (id: string) => [...schedulingKeys.templates(), id] as const,
};

// ============================================================================
// Transformers
// ============================================================================

/**
 * Transform API event to ScheduleBlock
 */
function toScheduleBlock(event: any): ScheduleBlock {
  return {
    id: event.id,
    type: 'event',
    title: event.title,
    description: event.description,
    start: new Date(event.start_time || event.start),
    end: event.end_time || event.end ? new Date(event.end_time || event.end) : undefined,
    allDay: event.all_day ?? false,
    calendarId: event.calendar_id,
    attendees: event.attendees?.map((a: any) => ({
      id: a.id,
      name: a.user?.display_name || a.email,
      email: a.email,
      status: a.rsvp_status || 'pending',
      required: a.required ?? true,
    })),
    color: event.color,
    status: event.status || 'confirmed',
    recurrence: event.recurrence_rule ? parseRecurrence(event.recurrence_rule) : undefined,
    metadata: event.metadata,
    createdAt: new Date(event.created_at),
    updatedAt: new Date(event.updated_at),
  };
}

/**
 * Transform ScheduleBlock to API event format
 */
function toApiEvent(block: Partial<CreateEventInput | UpdateEventInput>): any {
  return {
    title: block.title,
    description: block.description,
    start_time: block.start?.toISOString(),
    end_time: block.end?.toISOString(),
    all_day: block.allDay,
    color: block.color,
    recurrence_rule: block.recurrence ? formatRecurrence(block.recurrence) : undefined,
  };
}

function parseRecurrence(rule: string): any {
  // Simple RRULE parser
  const parts = rule.split(';');
  const result: any = {};

  for (const part of parts) {
    const [key, value] = part.split('=');
    switch (key) {
      case 'FREQ':
        result.frequency = value.toLowerCase();
        break;
      case 'INTERVAL':
        result.interval = parseInt(value, 10);
        break;
      case 'COUNT':
        result.count = parseInt(value, 10);
        break;
      case 'UNTIL':
        result.endDate = new Date(value);
        break;
      case 'BYDAY':
        result.byDay = value.split(',');
        break;
    }
  }

  return result;
}

function formatRecurrence(recurrence: any): string {
  const parts: string[] = [];

  if (recurrence.frequency) {
    parts.push(`FREQ=${recurrence.frequency.toUpperCase()}`);
  }
  if (recurrence.interval) {
    parts.push(`INTERVAL=${recurrence.interval}`);
  }
  if (recurrence.count) {
    parts.push(`COUNT=${recurrence.count}`);
  }
  if (recurrence.endDate) {
    parts.push(`UNTIL=${recurrence.endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
  }
  if (recurrence.byDay?.length) {
    parts.push(`BYDAY=${recurrence.byDay.join(',')}`);
  }

  return parts.join(';');
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch events for a date range
 */
export async function fetchEvents(params: EventsQueryParams): Promise<ScheduleBlock[]> {
  const calendars = await calendarApi.listCalendars();
  const calendarIds = params.calendarIds || calendars.data.map((c: any) => c.id);

  const eventPromises = calendarIds.map((calendarId: string) =>
    calendarApi.listEvents(calendarId, params.start, params.end)
  );

  const responses = await Promise.all(eventPromises);
  const allEvents = responses.flatMap((r) => r.data || []);

  return allEvents.map(toScheduleBlock);
}

/**
 * Fetch a single event
 */
export async function fetchEvent(eventId: string): Promise<ScheduleBlock> {
  const response = await calendarApi.getEvent(eventId);
  return toScheduleBlock(response.data);
}

/**
 * Create a new event
 */
export async function createEvent(
  calendarId: string,
  input: CreateEventInput
): Promise<ScheduleBlock> {
  const response = await calendarApi.createEvent(calendarId, toApiEvent(input));
  return toScheduleBlock(response.data);
}

/**
 * Update an event
 */
export async function updateEvent(
  eventId: string,
  input: UpdateEventInput
): Promise<ScheduleBlock> {
  const response = await calendarApi.updateEvent(eventId, toApiEvent(input));
  return toScheduleBlock(response.data);
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId: string): Promise<void> {
  await calendarApi.deleteEvent(eventId);
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch events for a date range
 */
export function useEvents(
  params: EventsQueryParams,
  options?: Omit<UseQueryOptions<ScheduleBlock[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: schedulingKeys.eventsList(params),
    queryFn: () => fetchEvents(params),
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: true,
    ...options,
  });
}

/**
 * Hook to fetch a single event
 */
export function useEvent(
  eventId: string,
  options?: Omit<UseQueryOptions<ScheduleBlock>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: schedulingKeys.event(eventId),
    queryFn: () => fetchEvent(eventId),
    enabled: !!eventId,
    ...options,
  });
}

/**
 * Hook to create an event
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ calendarId, input }: { calendarId: string; input: CreateEventInput }) =>
      createEvent(calendarId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulingKeys.events() });
      toast.success('Événement créé');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

/**
 * Hook to update an event with optimistic updates
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, input }: { eventId: string; input: UpdateEventInput }) =>
      updateEvent(eventId, input),
    onMutate: async ({ eventId, input }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: schedulingKeys.events() });

      // Snapshot previous value
      const previousEvents = queryClient.getQueryData(schedulingKeys.events());

      // Optimistically update
      queryClient.setQueriesData(
        { queryKey: schedulingKeys.events() },
        (old: ScheduleBlock[] | undefined) =>
          old?.map((event) =>
            event.id === eventId
              ? { ...event, ...input, updatedAt: new Date() }
              : event
          )
      );

      return { previousEvents };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousEvents) {
        queryClient.setQueriesData(
          { queryKey: schedulingKeys.events() },
          context.previousEvents
        );
      }
      toast.error('Erreur lors de la mise à jour');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schedulingKeys.events() });
    },
  });
}

/**
 * Hook to delete an event
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteEvent,
    onMutate: async (eventId) => {
      await queryClient.cancelQueries({ queryKey: schedulingKeys.events() });

      const previousEvents = queryClient.getQueryData(schedulingKeys.events());

      queryClient.setQueriesData(
        { queryKey: schedulingKeys.events() },
        (old: ScheduleBlock[] | undefined) => old?.filter((event) => event.id !== eventId)
      );

      return { previousEvents };
    },
    onError: (err, eventId, context) => {
      if (context?.previousEvents) {
        queryClient.setQueriesData(
          { queryKey: schedulingKeys.events() },
          context.previousEvents
        );
      }
      toast.error('Erreur lors de la suppression');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schedulingKeys.events() });
    },
    onSuccess: () => {
      toast.success('Événement supprimé');
    },
  });
}

/**
 * Hook to move/resize an event (convenience wrapper)
 */
export function useMoveEvent() {
  const updateMutation = useUpdateEvent();

  return useMutation({
    mutationFn: ({ eventId, start, end }: { eventId: string; start: Date; end?: Date }) =>
      updateMutation.mutateAsync({ eventId, input: { start, end } }),
  });
}

// ============================================================================
// Calendars
// ============================================================================

export function useCalendars() {
  return useQuery({
    queryKey: schedulingKeys.calendars(),
    queryFn: async () => {
      const response = await calendarApi.listCalendars();
      return response.data;
    },
    staleTime: 60_000, // 1 minute
  });
}

// ============================================================================
// Event Templates — API with localStorage cache/fallback
// ============================================================================

const TEMPLATES_STORAGE_KEY = 'scheduling_templates';
const TEMPLATES_API_PATH = '/scheduling/templates';

function getStoredTemplates(): EventTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!data) return [];
    const templates = JSON.parse(data);
    return templates.map((t: EventTemplate & { createdAt: string; updatedAt: string }) => ({
      ...t,
      createdAt: new Date(t.createdAt),
      updatedAt: new Date(t.updatedAt),
    }));
  } catch {
    return [];
  }
}

function saveTemplates(templates: EventTemplate[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

/**
 * Fetch all templates — tries API first, falls back to localStorage cache.
 */
export async function fetchTemplates(): Promise<EventTemplate[]> {
  try {
    const response = await calendarApi.get<EventTemplate[]>(TEMPLATES_API_PATH);
    const templates = (response.data || []).map(
      (t: EventTemplate & { createdAt: string; updatedAt: string }) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      })
    );
    // Update local cache with fresh data from API
    saveTemplates(templates);
    return templates;
  } catch {
    // API unavailable — return local cache
    return getStoredTemplates();
  }
}

/**
 * Create a new template — tries API first, falls back to localStorage.
 */
export async function createTemplate(input: CreateTemplateInput): Promise<EventTemplate> {
  try {
    const response = await calendarApi.post<EventTemplate>(TEMPLATES_API_PATH, input);
    const newTemplate: EventTemplate = {
      ...response.data,
      createdAt: new Date(response.data.createdAt),
      updatedAt: new Date(response.data.updatedAt),
    };
    // Sync local cache
    const templates = getStoredTemplates();
    templates.push(newTemplate);
    saveTemplates(templates);
    return newTemplate;
  } catch {
    // API unavailable — persist locally
    const templates = getStoredTemplates();
    const newTemplate: EventTemplate = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    templates.push(newTemplate);
    saveTemplates(templates);
    return newTemplate;
  }
}

/**
 * Update a template — tries API first, falls back to localStorage.
 */
export async function updateTemplate(
  templateId: string,
  input: UpdateTemplateInput
): Promise<EventTemplate> {
  try {
    const response = await calendarApi.put<EventTemplate>(
      `${TEMPLATES_API_PATH}/${templateId}`,
      input
    );
    const updated: EventTemplate = {
      ...response.data,
      createdAt: new Date(response.data.createdAt),
      updatedAt: new Date(response.data.updatedAt),
    };
    // Sync local cache
    const templates = getStoredTemplates();
    const index = templates.findIndex((t) => t.id === templateId);
    if (index !== -1) {
      templates[index] = updated;
      saveTemplates(templates);
    }
    return updated;
  } catch {
    // API unavailable — update locally
    const templates = getStoredTemplates();
    const index = templates.findIndex((t) => t.id === templateId);
    if (index === -1) throw new Error('Template not found');

    templates[index] = {
      ...templates[index],
      ...input,
      eventDefaults: {
        ...templates[index].eventDefaults,
        ...(input.eventDefaults || {}),
      },
      updatedAt: new Date(),
    };
    saveTemplates(templates);
    return templates[index];
  }
}

/**
 * Delete a template — tries API first, falls back to localStorage.
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  try {
    await calendarApi.delete(`${TEMPLATES_API_PATH}/${templateId}`);
    // Sync local cache
    const templates = getStoredTemplates();
    saveTemplates(templates.filter((t) => t.id !== templateId));
  } catch {
    // API unavailable — delete locally
    const templates = getStoredTemplates();
    saveTemplates(templates.filter((t) => t.id !== templateId));
  }
}

// ============================================================================
// Template React Query Hooks
// ============================================================================

/**
 * Hook to fetch all templates
 */
export function useTemplates() {
  return useQuery({
    queryKey: schedulingKeys.templates(),
    queryFn: fetchTemplates,
    staleTime: 60_000,
  });
}

/**
 * Hook to create a template
 */
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulingKeys.templates() });
      toast.success('Modèle créé');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

/**
 * Hook to update a template
 */
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, input }: { templateId: string; input: UpdateTemplateInput }) =>
      updateTemplate(templateId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulingKeys.templates() });
      toast.success('Modèle mis à jour');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

/**
 * Hook to delete a template
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schedulingKeys.templates() });
      toast.success('Modèle supprimé');
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// ============================================================================
// RSVP (MVP: localStorage for attendee status)
// ============================================================================

const RSVP_STORAGE_KEY = 'scheduling_rsvp';

interface StoredRSVP {
  eventId: string;
  attendeeId: string;
  status: RSVPStatus;
  declineReason?: string;
  respondedAt: string;
}

function getStoredRSVPs(): StoredRSVP[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(RSVP_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveRSVPs(rsvps: StoredRSVP[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RSVP_STORAGE_KEY, JSON.stringify(rsvps));
}

/**
 * Update RSVP status for an attendee
 */
export async function updateRSVP(input: RSVPInput): Promise<StoredRSVP> {
  const rsvps = getStoredRSVPs();

  // Remove existing RSVP for this event/attendee
  const filtered = rsvps.filter(
    (r) => !(r.eventId === input.eventId && r.attendeeId === input.attendeeId)
  );

  const newRSVP: StoredRSVP = {
    eventId: input.eventId,
    attendeeId: input.attendeeId,
    status: input.status,
    declineReason: input.declineReason,
    respondedAt: new Date().toISOString(),
  };

  filtered.push(newRSVP);
  saveRSVPs(filtered);

  return newRSVP;
}

/**
 * Get RSVP status for an attendee
 */
export function getRSVP(eventId: string, attendeeId: string): StoredRSVP | undefined {
  const rsvps = getStoredRSVPs();
  return rsvps.find((r) => r.eventId === eventId && r.attendeeId === attendeeId);
}

/**
 * Get all RSVPs for an event
 */
export function getEventRSVPs(eventId: string): StoredRSVP[] {
  const rsvps = getStoredRSVPs();
  return rsvps.filter((r) => r.eventId === eventId);
}

/**
 * Get RSVP summary for an event
 */
export function getRSVPSummary(eventId: string, attendees: Attendee[]): {
  accepted: number;
  declined: number;
  tentative: number;
  pending: number;
  total: number;
} {
  const rsvps = getEventRSVPs(eventId);
  const rsvpMap = new Map(rsvps.map((r) => [r.attendeeId, r.status]));

  let accepted = 0;
  let declined = 0;
  let tentative = 0;
  let pending = 0;

  for (const attendee of attendees) {
    const status = rsvpMap.get(attendee.id) || attendee.status || 'pending';
    switch (status) {
      case 'accepted':
        accepted++;
        break;
      case 'declined':
        declined++;
        break;
      case 'tentative':
        tentative++;
        break;
      default:
        pending++;
    }
  }

  return {
    accepted,
    declined,
    tentative,
    pending,
    total: attendees.length,
  };
}

// ============================================================================
// RSVP React Query Hooks
// ============================================================================

/**
 * Hook to update RSVP status
 */
export function useUpdateRSVP() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRSVP,
    onMutate: async (input) => {
      // Optimistically update the event in cache
      await queryClient.cancelQueries({ queryKey: schedulingKeys.events() });

      queryClient.setQueriesData(
        { queryKey: schedulingKeys.events() },
        (old: ScheduleBlock[] | undefined) =>
          old?.map((event) => {
            if (event.id !== input.eventId) return event;

            return {
              ...event,
              attendees: event.attendees?.map((a) =>
                a.id === input.attendeeId
                  ? { ...a, status: input.status, respondedAt: new Date() }
                  : a
              ),
            };
          })
      );
    },
    onSuccess: (data) => {
      const statusLabels: Record<RSVPStatus, string> = {
        accepted: 'Accepté',
        declined: 'Refusé',
        tentative: 'Peut-être',
        pending: 'En attente',
      };
      toast.success(`Réponse: ${statusLabels[data.status]}`);
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: schedulingKeys.events() });
    },
  });
}

/**
 * Hook to get RSVP summary for an event
 */
export function useRSVPSummary(eventId: string, attendees: Attendee[]) {
  return React.useMemo(() => {
    return getRSVPSummary(eventId, attendees);
  }, [eventId, attendees]);
}

