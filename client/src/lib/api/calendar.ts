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

// Out-of-Office API — GET/PUT/DELETE /api/v1/ooo
export interface OooSettings {
    enabled: boolean;
    start_date?: string;
    end_date?: string;
    message?: string;
}

export const oooApi = {
    get: () => calendarClient.get<OooSettings>('/ooo'),
    set: (data: OooSettings) => calendarClient.put<OooSettings>('/ooo', data),
    delete: () => calendarClient.delete('/ooo'),
};

// Scheduling Polls API — GET/POST /api/v1/polls
// Types aligned with backend polls.rs PollSummary / PollDetail
export interface Poll {
    id: string;
    organizer_id: string;
    title: string;
    description?: string;
    status: string; // 'open' | 'confirmed' | 'cancelled'
    confirmed_slot_id?: string;
    confirmed_event_id?: string;
    created_at: string;
    updated_at: string;
}

export interface PollSlotInput {
    slot_date: string;   // YYYY-MM-DD
    start_time: string;  // HH:MM:SS
    end_time: string;    // HH:MM:SS
}

export interface CreatePollRequest {
    title: string;
    description?: string;
    slots: PollSlotInput[];
}

export interface PollVoteRequest {
    voter_name: string;
    voter_email: string;
    votes: Record<string, string>; // slot_id -> "yes"|"maybe"|"no"
}

export const pollsApi = {
    list: () => calendarClient.get<Poll[]>('/polls'),
    create: (data: CreatePollRequest) => calendarClient.post<Poll>('/polls', data),
    get: (id: string) => calendarClient.get(`/polls/${id}`),
    vote: (id: string, data: PollVoteRequest) =>
        calendarClient.post(`/polls/${id}/vote`, data),
    confirm: (id: string, slotId: string) =>
        calendarClient.post(`/polls/${id}/confirm`, { slot_id: slotId }),
};

// Meeting Suggestions API — POST /api/v1/calendar/meeting-suggestions
export interface MeetingSuggestionsRequest {
    participant_ids: string[];
    duration_minutes: number;
    earliest: string;
    latest: string;
    count?: number;
}

export interface MeetingSuggestion {
    start_time: string;
    end_time: string;
    score: number;
}

export const meetingSuggestionsApi = {
    suggest: (data: MeetingSuggestionsRequest) =>
        calendarClient.post<MeetingSuggestion[]>('/calendar/meeting-suggestions', data),
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

// ============================================================================
// CalDAV feed — /caldav/calendars/:id
// ============================================================================

export const caldavFeedApi = {
    feed: (calendarId: string) =>
        calendarClient.get(`/caldav/calendars/${calendarId}`, {
            headers: { Accept: 'text/calendar' },
            responseType: 'text',
        }),
    getEventIcs: (calendarId: string, eventId: string) =>
        calendarClient.get(`/caldav/calendars/${calendarId}/events/${eventId}.ics`, {
            responseType: 'text',
        }),
};

// ============================================================================
// External Calendar Sync — /api/v1/external-sync/*
// ============================================================================

export interface ExternalSyncConfig {
    id: string;
    connection_id: string;
    calendar_id: string;
    external_calendar_id: string;
    sync_direction: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}

export const externalSyncApi = {
    listConnections: () =>
        calendarClient.get('/external-sync/connections'),
    initOAuth: (data: { provider: string; redirect_uri: string }) =>
        calendarClient.post('/external-sync/oauth/init', data),
    oauthCallback: (data: { code: string; state: string }) =>
        calendarClient.post('/external-sync/oauth/callback', data),
    disconnect: (connectionId: string) =>
        calendarClient.delete(`/external-sync/connections/${connectionId}`),
    triggerSync: (configId: string) =>
        calendarClient.post(`/external-sync/configs/${configId}/sync`),
    syncStatus: (configId: string) =>
        calendarClient.get(`/external-sync/configs/${configId}/logs`),
    listConfigs: () =>
        calendarClient.get<ExternalSyncConfig[]>('/external-sync/configs'),
    createConfig: (data: Partial<ExternalSyncConfig>) =>
        calendarClient.post<ExternalSyncConfig>('/external-sync/configs', data),
    deleteConfig: (configId: string) =>
        calendarClient.delete(`/external-sync/configs/${configId}`),
};

// ============================================================================
// User Timezone/Settings — /timezones/me
// ============================================================================

export const calendarUserSettingsApi = {
    getTimezone: () =>
        calendarClient.get<{ timezone: string }>('/timezones/me'),
    setTimezone: (timezone: string) =>
        calendarClient.put('/timezones/me', { timezone }),
};
