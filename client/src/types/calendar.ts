//! Calendar domain types

export interface Calendar {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  timezone: string;
  color: string;
  is_shared: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCalendar {
  name: string;
  description?: string;
  timezone?: string;
  color?: string;
  is_shared?: boolean;
}

export interface UpdateCalendar {
  name?: string;
  description?: string;
  timezone?: string;
  color?: string;
  is_shared?: boolean;
}

export interface Event {
  id: string;
  calendar_id: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;  // ISO 8601
  end_time: string;    // ISO 8601
  rrule?: string;      // RFC 5545
  rrule_exceptions?: string[];
  timezone: string;
  created_by: string;
  is_all_day: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEvent {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  rrule?: string;
  timezone?: string;
  is_all_day?: boolean;
}

export interface UpdateEvent {
  title?: string;
  description?: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  rrule?: string;
  timezone?: string;
  is_all_day?: boolean;
}

export interface EventAttendee {
  id: string;
  event_id: string;
  user_id?: string;
  email?: string;
  rsvp_status: "pending" | "accepted" | "declined" | "tentative";
  response_date?: string;
  created_at: string;
  updated_at: string;
}

export interface AddEventAttendee {
  user_id?: string;
  email?: string;
}

export interface CalendarMember {
  id: string;
  calendar_id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
  created_at: string;
  updated_at: string;
}
