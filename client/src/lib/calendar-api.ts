//! Calendar service API client

import axios from "axios";
import { Calendar, CreateCalendar, UpdateCalendar, Event, CreateEvent, UpdateEvent, EventAttendee, AddEventAttendee } from "@/types/calendar";

const API_BASE = process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Inject JWT token from storage if available
client.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const calendarApi = {
  // Calendars
  createCalendar: (data: CreateCalendar) =>
    client.post<Calendar>("/calendars", data),

  listCalendars: () =>
    client.get<Calendar[]>("/calendars"),

  getCalendar: (id: string) =>
    client.get<Calendar>(`/calendars/${id}`),

  updateCalendar: (id: string, data: UpdateCalendar) =>
    client.put<Calendar>(`/calendars/${id}`, data),

  deleteCalendar: (id: string) =>
    client.delete(`/calendars/${id}`),

  // Calendar members (sharing)
  listMembers: (calendarId: string) =>
    client.get(`/calendars/${calendarId}/members`),

  addMember: (calendarId: string, userId: string, role: string) =>
    client.post(`/calendars/${calendarId}/members`, { user_id: userId, role }),

  removeMember: (calendarId: string, userId: string) =>
    client.delete(`/calendars/${calendarId}/members/${userId}`),

  updateMemberRole: (calendarId: string, userId: string, role: string) =>
    client.put(`/calendars/${calendarId}/members/${userId}`, { role }),

  // Events
  createEvent: (calendarId: string, data: CreateEvent) =>
    client.post<Event>(`/calendars/${calendarId}/events`, data),

  listEvents: (calendarId: string, start?: Date, end?: Date) =>
    client.get<Event[]>(`/calendars/${calendarId}/events`, {
      params: {
        start: start?.toISOString(),
        end: end?.toISOString(),
      },
    }),

  getEvent: (id: string) =>
    client.get<Event>(`/events/${id}`),

  updateEvent: (id: string, data: UpdateEvent) =>
    client.put<Event>(`/events/${id}`, data),

  deleteEvent: (id: string) =>
    client.delete(`/events/${id}`),

  // Event attendees
  addAttendee: (eventId: string, data: AddEventAttendee) =>
    client.post<EventAttendee>(`/events/${eventId}/attendees`, data),

  listAttendees: (eventId: string) =>
    client.get<EventAttendee[]>(`/events/${eventId}/attendees`),

  updateRsvp: (attendeeId: string, rsvpStatus: string) =>
    client.put(`/attendees/${attendeeId}/rsvp`, { rsvp_status: rsvpStatus }),

  removeAttendee: (attendeeId: string) =>
    client.delete(`/attendees/${attendeeId}`),
};
