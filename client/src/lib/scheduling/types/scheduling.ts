/**
 * Scheduling Module Types
 *
 * Types for the Unified Scheduling UI including Calendar, Tasks, Resources, and Team features.
 */

// ============================================================================
// Core Types
// ============================================================================

export type ViewType = 'agenda' | 'day' | '3-day' | 'week' | 'month';
export type TabType = 'my-day' | 'tasks' | 'resources' | 'team';
export type BlockType = 'event' | 'task' | 'booking';

export interface DateRange {
  start: Date;
  end: Date;
}

// ============================================================================
// Schedule Block (Unified Event/Task/Booking)
// ============================================================================

export interface ScheduleBlock {
  id: string;
  type: BlockType;
  title: string;
  description?: string;
  start: Date;
  end?: Date;
  allDay: boolean;
  recurrence?: RecurrenceRule;
  attendees?: Attendee[];
  resourceId?: string;
  calendarId?: string;
  color?: string;
  status?: BlockStatus;
  priority?: Priority;
  tags?: string[];
  location?: EventLocation;
  reminderMinutes?: number;
  templateId?: string; // If created from a template
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type BlockStatus = 'confirmed' | 'tentative' | 'cancelled' | 'completed';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Attendee {
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined' | 'tentative';
  required: boolean;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: Date;
  count?: number;
  byDay?: string[];
  byMonth?: number[];
  byMonthDay?: number[];
}

// ============================================================================
// Event Layout (for rendering overlapping events)
// ============================================================================

export interface EventLayout {
  block: ScheduleBlock;
  top: number;
  height: number;
  left: number;
  width: number;
  column: number;
  totalColumns: number;
}

// ============================================================================
// Tasks
// ============================================================================

export type TaskStatus = 'backlog' | 'today' | 'in-progress' | 'done';

export interface Task extends Omit<ScheduleBlock, 'type'> {
  type: 'task';
  status: TaskStatus;
  dueDate?: Date;
  completedAt?: Date;
  projectId?: string;
  assigneeId?: string;
  subtasks?: Subtask[];
  estimatedMinutes?: number;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

// ============================================================================
// Resources
// ============================================================================

export interface Resource {
  id: string;
  name: string;
  type: 'room' | 'equipment' | 'vehicle' | 'other';
  description?: string;
  capacity?: number;
  location?: string;
  floor?: string;
  amenities?: string[];
  imageUrl?: string;
  available: boolean;
}

export interface Booking extends Omit<ScheduleBlock, 'type'> {
  type: 'booking';
  resourceId: string;
  organizerId: string;
  purpose?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

// ============================================================================
// Team
// ============================================================================

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: string;
  department?: string;
  workingHours?: WorkingHours;
}

export interface WorkingHours {
  timezone: string;
  schedule: WeeklySchedule;
}

export interface WeeklySchedule {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface DaySchedule {
  start: string; // HH:mm format
  end: string;
  breaks?: { start: string; end: string }[];
}

export interface AvailabilitySlot {
  memberId: string;
  start: Date;
  end: Date;
  status: 'available' | 'busy' | 'tentative' | 'out-of-office';
}

// ============================================================================
// Filters
// ============================================================================

export interface SchedulingFilters {
  calendarIds?: string[];
  types?: BlockType[];
  statuses?: BlockStatus[];
  priorities?: Priority[];
  tags?: string[];
  search?: string;
  showWeekends?: boolean;
  showAllDay?: boolean;
}

// ============================================================================
// View Configuration
// ============================================================================

export interface ViewConfig {
  slotDuration: 15 | 30 | 60;
  workingHoursStart: number;
  workingHoursEnd: number;
  firstDayOfWeek: 0 | 1 | 6; // 0=Sunday, 1=Monday, 6=Saturday
  showWeekNumbers: boolean;
  compactMode: boolean;
}

export const DEFAULT_VIEW_CONFIG: ViewConfig = {
  slotDuration: 30,
  workingHoursStart: 9,
  workingHoursEnd: 18,
  firstDayOfWeek: 1,
  showWeekNumbers: true,
  compactMode: false,
};

// ============================================================================
// Command Palette
// ============================================================================

export interface Command {
  id: string;
  icon: string;
  label: string;
  description?: string;
  shortcut?: string;
  category: 'navigation' | 'create' | 'search' | 'action';
  action: () => void;
  keywords?: string[];
}

// ============================================================================
// NLP Parsing
// ============================================================================

export interface ParsedInput {
  type: 'event' | 'task' | 'booking' | 'navigation' | 'search';
  confidence: number;
  extracted: {
    title?: string;
    date?: Date;
    time?: string;
    duration?: number;
    participants?: string[];
    location?: string;
    recurrence?: RecurrenceRule;
    priority?: Priority;
  };
  suggestions?: ParsedInput[];
  rawInput: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface CreateEventInput {
  title: string;
  description?: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  calendarId: string;
  attendees?: string[];
  recurrence?: RecurrenceRule;
  color?: string;
  location?: EventLocation;
  reminderMinutes?: number;
  templateId?: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  start?: Date;
  end?: Date;
  allDay?: boolean;
  attendees?: string[];
  recurrence?: RecurrenceRule;
  color?: string;
  status?: BlockStatus;
}

export interface EventsQueryParams {
  start: Date;
  end: Date;
  calendarIds?: string[];
  includeRecurring?: boolean;
}

// ============================================================================
// Event Templates
// ============================================================================

export interface EventTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  eventDefaults: EventTemplateDefaults;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventTemplateDefaults {
  title?: string;
  description?: string;
  duration: number; // minutes
  allDay?: boolean;
  color?: string;
  attendees?: string[];
  location?: string;
  recurrence?: RecurrenceRule;
  reminderMinutes?: number;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category?: string;
  eventDefaults: EventTemplateDefaults;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  category?: string;
  eventDefaults?: Partial<EventTemplateDefaults>;
}

// ============================================================================
// Location
// ============================================================================

export interface EventLocation {
  name: string;
  address?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  resourceId?: string; // If location is a resource (meeting room)
  meetingUrl?: string; // For virtual meetings
}
