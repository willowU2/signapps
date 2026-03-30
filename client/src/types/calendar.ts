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

export interface EventAttendeeBasic {
  email?: string;
  name?: string;
}

export interface Event {
  id: string;
  calendar_id: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;  // ISO 8601
  end_time: string;    // ISO 8601
  /** Alternative start field from some calendar providers (Google, etc.) */
  start?: string | { dateTime?: string };
  /** Alternative end field from some calendar providers (Google, etc.) */
  end?: string | { dateTime?: string };
  rrule?: string;      // RFC 5545
  rrule_exceptions?: string[];
  timezone: string;
  created_by: string;
  is_all_day: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  /** Attendees list — returned by some calendar API endpoints */
  attendees?: EventAttendeeBasic[];
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

export type EventType = 'event' | 'task' | 'leave' | 'shift' | 'booking' | 'milestone' | 'blocker' | 'cron';
export type EventScope = 'personal' | 'team' | 'org';
export type EventStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'completed';
export type EventPriority = 'low' | 'medium' | 'high' | 'urgent';
export type LeaveType = 'cp' | 'rtt' | 'sick' | 'unpaid' | 'other';
export type PresenceMode = 'office' | 'remote' | 'absent';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type RuleType = 'min_onsite' | 'mandatory_days' | 'max_remote_same_day' | 'min_coverage';
export type EnforcementLevel = 'soft' | 'hard';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  owner_id?: string;
  org_id?: string;
  rules: Record<string, unknown>;
}

export interface PresenceRule {
  id: string;
  org_id: string;
  team_id?: string;
  rule_type: RuleType;
  rule_config: Record<string, unknown>;
  enforcement: EnforcementLevel;
  active: boolean;
}

export interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  year: number;
  total_days: number;
  used_days: number;
  pending_days: number;
}

export interface TimesheetEntry {
  id: string;
  user_id: string;
  event_id?: string;
  date: string;
  hours: number;
  category_id?: string;
  auto_generated: boolean;
  validated: boolean;
  validated_at?: string;
  exported_at?: string;
}

export interface LayerConfig {
  layer_id: string;
  enabled: boolean;
  opacity: number;
  color_override?: string;
}

export interface HeadcountPoint {
  time: string;
  role: string;
  count: number;
}

export interface PresenceViolation {
  rule_id: string;
  rule_type: RuleType;
  enforcement: EnforcementLevel;
  message: string;
}
