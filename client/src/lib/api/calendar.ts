
import { calendarApiClient } from './core';
import { Calendar, CreateCalendar, UpdateCalendar, Event, CreateEvent, UpdateEvent, EventAttendee, AddEventAttendee } from '@/types/calendar';

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
        calendarApiClient.get<NotificationPreferences>("/notifications/preferences"),

    updatePreferences: (data: Partial<NotificationPreferences>) =>
        calendarApiClient.put<NotificationPreferences>("/notifications/preferences", data),

    getHistory: (params?: { limit?: number; offset?: number }) =>
        calendarApiClient.get<NotificationHistoryResponse>("/notifications/history", { params }),

    getUnreadCount: () =>
        calendarApiClient.get<UnreadCount>("/notifications/unread-count"),

    resend: (notificationId: string) =>
        calendarApiClient.post(`/notifications/${notificationId}/resend`),

    subscribePush: (subscription: object, browserName?: string) =>
        calendarApiClient.post("/notifications/subscriptions/push", { subscription, browser_name: browserName }),

    listPushSubscriptions: () =>
        calendarApiClient.get<Array<{ id: string; browser_name?: string; created_at: string }>>("/notifications/subscriptions/push"),

    unsubscribePush: (subscriptionId: string) =>
        calendarApiClient.delete(`/notifications/subscriptions/push/${subscriptionId}`),
};

export const calendarApi = {
    // Calendars
    createCalendar: (data: CreateCalendar) =>
        calendarApiClient.post<Calendar>("/calendars", data),

    listCalendars: () =>
        calendarApiClient.get<Calendar[]>("/calendars"),

    getCalendar: (id: string) =>
        calendarApiClient.get<Calendar>(`/calendars/${id}`),

    updateCalendar: (id: string, data: UpdateCalendar) =>
        calendarApiClient.put<Calendar>(`/calendars/${id}`, data),

    deleteCalendar: (id: string) =>
        calendarApiClient.delete(`/calendars/${id}`),

    // Calendar members (sharing)
    listMembers: (calendarId: string) =>
        calendarApiClient.get(`/calendars/${calendarId}/members`),

    addMember: (calendarId: string, userId: string, role: string) =>
        calendarApiClient.post(`/calendars/${calendarId}/members`, { user_id: userId, role }),

    removeMember: (calendarId: string, userId: string) =>
        calendarApiClient.delete(`/calendars/${calendarId}/members/${userId}`),

    updateMemberRole: (calendarId: string, userId: string, role: string) =>
        calendarApiClient.put(`/calendars/${calendarId}/members/${userId}`, { role }),

    // Events
    createEvent: (calendarId: string, data: CreateEvent) =>
        calendarApiClient.post<Event>(`/calendars/${calendarId}/events`, data),

    listEvents: (calendarId: string, start?: Date, end?: Date) =>
        calendarApiClient.get<Event[]>(`/calendars/${calendarId}/events`, {
            params: {
                start: start?.toISOString(),
                end: end?.toISOString(),
            },
        }),

    getEvent: (id: string) =>
        calendarApiClient.get<Event>(`/events/${id}`),

    updateEvent: (id: string, data: UpdateEvent) =>
        calendarApiClient.put<Event>(`/events/${id}`, data),

    deleteEvent: (id: string) =>
        calendarApiClient.delete(`/events/${id}`),

    // Event attendees
    addAttendee: (eventId: string, data: AddEventAttendee) =>
        calendarApiClient.post<EventAttendee>(`/events/${eventId}/attendees`, data),

    listAttendees: (eventId: string) =>
        calendarApiClient.get<EventAttendee[]>(`/events/${eventId}/attendees`),

    updateRsvp: (attendeeId: string, rsvpStatus: string) =>
        calendarApiClient.put(`/attendees/${attendeeId}/rsvp`, { rsvp_status: rsvpStatus }),

    removeAttendee: (attendeeId: string) =>
        calendarApiClient.delete(`/attendees/${attendeeId}`),

    // Raw HTTP access for calendar-specific endpoints
    // Used by components that need custom calendar endpoints (import/export, notifications, etc.)
    get: <T = any>(url: string, config?: any) =>
        calendarApiClient.get<T>(url, config),

    post: <T = any>(url: string, data?: any, config?: any) =>
        calendarApiClient.post<T>(url, data, config),

    put: <T = any>(url: string, data?: any, config?: any) =>
        calendarApiClient.put<T>(url, data, config),

    delete: <T = any>(url: string, config?: any) =>
        calendarApiClient.delete<T>(url, config),
};

// Tasks API
export const tasksApi = {
    listTasks: (calendarId: string) =>
        calendarApiClient.get(`/calendars/${calendarId}/tasks`),
    createTask: (calendarId: string, data: any) =>
        calendarApiClient.post(`/calendars/${calendarId}/tasks`, data),
    getTask: (taskId: string) =>
        calendarApiClient.get(`/tasks/${taskId}`),
    updateTask: (taskId: string, data: any) =>
        calendarApiClient.put(`/tasks/${taskId}`, data),
    deleteTask: (taskId: string) =>
        calendarApiClient.delete(`/tasks/${taskId}`),
};

// Timezones API
export const timezonesApi = {
    list: () => calendarApiClient.get('/timezones'),
    getUserTimezone: () => calendarApiClient.get('/timezones/me'),
    setUserTimezone: (timezone: string) => calendarApiClient.put('/timezones/me', { timezone }),
};

// Imports & ICS
export const importApi = {
    importIcs: (calendarId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return calendarApiClient.post(`/calendars/${calendarId}/import`, formData);
    },
    exportIcs: (calendarId: string) =>
        calendarApiClient.get(`/calendars/${calendarId}/export`, { responseType: 'blob' }),
};
