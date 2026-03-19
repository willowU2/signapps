/**
 * Calendar API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from './factory';
import { Calendar, CreateCalendar, UpdateCalendar, Event, CreateEvent, UpdateEvent, EventAttendee, AddEventAttendee } from '@/types/calendar';

// Get the calendar service client (cached)
const calendarClient = getClient(ServiceName.CALENDAR);

// Notification types (served by calendar service)
export interface NotificationRecord {
    id: string;
    notification_type: string;
    channel: string;
    status: string;
    recipient_address?: string;
    created_at: string;
    sent_at?: string;
}

export interface NotificationHistoryResponse {
    notifications: NotificationRecord[];
    total: number;
    page: number;
    limit: number;
}

export interface NotificationPreferences {
    id: string;
    email_enabled: boolean;
    email_frequency?: string;
    sms_enabled: boolean;
    phone_number?: string;
    push_enabled: boolean;
    quiet_hours_enabled: boolean;
    quiet_start?: string;
    quiet_end?: string;
    reminder_times?: number[];
}

export interface UnreadCount {
    pending: number;
    failed: number;
    total: number;
}

export const notificationsApi = {
    getPreferences: () =>
        calendarClient.get<NotificationPreferences>("/notifications/preferences"),

    updatePreferences: (data: Partial<NotificationPreferences>) =>
        calendarClient.put<NotificationPreferences>("/notifications/preferences", data),

    getHistory: (params?: { limit?: number; offset?: number }) =>
        calendarClient.get<NotificationHistoryResponse>("/notifications/history", { params }),

    getUnreadCount: () =>
        calendarClient.get<UnreadCount>("/notifications/unread-count"),

    resend: (notificationId: string) =>
        calendarClient.post(`/notifications/${notificationId}/resend`),

    subscribePush: (subscription: object, browserName?: string) =>
        calendarClient.post("/notifications/subscriptions/push", { subscription, browser_name: browserName }),

    listPushSubscriptions: () =>
        calendarClient.get<Array<{ id: string; browser_name?: string; created_at: string }>>("/notifications/subscriptions/push"),

    unsubscribePush: (subscriptionId: string) =>
        calendarClient.delete(`/notifications/subscriptions/push/${subscriptionId}`),
};

export const calendarApi = {
    // Calendars
    createCalendar: (data: CreateCalendar) =>
        calendarClient.post<Calendar>("/calendars", data),

    listCalendars: () =>
        calendarClient.get<Calendar[]>("/calendars"),

    getCalendar: (id: string) =>
        calendarClient.get<Calendar>(`/calendars/${id}`),

    updateCalendar: (id: string, data: UpdateCalendar) =>
        calendarClient.put<Calendar>(`/calendars/${id}`, data),

    deleteCalendar: (id: string) =>
        calendarClient.delete(`/calendars/${id}`),

    // Calendar members (sharing)
    listMembers: (calendarId: string) =>
        calendarClient.get(`/calendars/${calendarId}/members`),

    addMember: (calendarId: string, userId: string, role: string) =>
        calendarClient.post(`/calendars/${calendarId}/members`, { user_id: userId, role }),

    removeMember: (calendarId: string, userId: string) =>
        calendarClient.delete(`/calendars/${calendarId}/members/${userId}`),

    updateMemberRole: (calendarId: string, userId: string, role: string) =>
        calendarClient.put(`/calendars/${calendarId}/members/${userId}`, { role }),

    // Events
    createEvent: (calendarId: string, data: CreateEvent) =>
        calendarClient.post<Event>(`/calendars/${calendarId}/events`, data),

    listEvents: (calendarId: string, start?: Date, end?: Date) =>
        calendarClient.get<Event[]>(`/calendars/${calendarId}/events`, {
            params: {
                start: start?.toISOString(),
                end: end?.toISOString(),
            },
        }),

    getEvent: (id: string) =>
        calendarClient.get<Event>(`/events/${id}`),

    updateEvent: (id: string, data: UpdateEvent) =>
        calendarClient.put<Event>(`/events/${id}`, data),

    deleteEvent: (id: string) =>
        calendarClient.delete(`/events/${id}`),

    // Event attendees
    addAttendee: (eventId: string, data: AddEventAttendee) =>
        calendarClient.post<EventAttendee>(`/events/${eventId}/attendees`, data),

    listAttendees: (eventId: string) =>
        calendarClient.get<EventAttendee[]>(`/events/${eventId}/attendees`),

    updateRsvp: (attendeeId: string, rsvpStatus: string) =>
        calendarClient.put(`/attendees/${attendeeId}/rsvp`, { rsvp_status: rsvpStatus }),

    removeAttendee: (attendeeId: string) =>
        calendarClient.delete(`/attendees/${attendeeId}`),

    // Raw HTTP access for calendar-specific endpoints
    // Used by components that need custom calendar endpoints (import/export, notifications, etc.)
    get: <T = any>(url: string, config?: any) =>
        calendarClient.get<T>(url, config),

    post: <T = any>(url: string, data?: any, config?: any) =>
        calendarClient.post<T>(url, data, config),

    put: <T = any>(url: string, data?: any, config?: any) =>
        calendarClient.put<T>(url, data, config),

    patch: <T = any>(url: string, data?: any, config?: any) =>
        calendarClient.patch<T>(url, data, config),

    delete: <T = any>(url: string, config?: any) =>
        calendarClient.delete<T>(url, config),
};

// Tasks API
export const tasksApi = {
    listTasks: (calendarId: string) =>
        calendarClient.get(`/calendars/${calendarId}/tasks`),
    createTask: (calendarId: string, data: any) =>
        calendarClient.post(`/calendars/${calendarId}/tasks`, data),
    getTask: (taskId: string) =>
        calendarClient.get(`/tasks/${taskId}`),
    updateTask: (taskId: string, data: any) =>
        calendarClient.put(`/tasks/${taskId}`, data),
    deleteTask: (taskId: string) =>
        calendarClient.delete(`/tasks/${taskId}`),
};

// Timezones API
export const timezonesApi = {
    list: () => calendarClient.get('/timezones'),
    getUserTimezone: () => calendarClient.get('/timezones/me'),
    setUserTimezone: (timezone: string) => calendarClient.put('/timezones/me', { timezone }),
};

// Imports & ICS
export const importApi = {
    importIcs: (calendarId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return calendarClient.post(`/calendars/${calendarId}/import`, formData);
    },
    exportIcs: (calendarId: string) =>
        calendarClient.get(`/calendars/${calendarId}/export`, { responseType: 'blob' }),
};
