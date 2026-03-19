/**
 * Scheduling Module Types
 *
 * Types for the Unified Scheduling UI including Calendar, Tasks, Resources, and Team features.
 * Note: Core types like ViewType, DateRange, Priority are imported from time-item.ts
 */

// Import shared types from time-item
import type { Priority, DateRange, ViewType, RecurrenceRule } from './time-item';

// Re-export for backwards compatibility
export type { Priority, DateRange, ViewType, RecurrenceRule } from './time-item';

// ============================================================================
// Core Types
// ============================================================================

export type TabType = 'my-day' | 'tasks' | 'resources' | 'team';
export type BlockType = 'event' | 'task' | 'booking';

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
  recurrence?: ScheduleRecurrenceRule;
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

// Priority is defined in time-item.ts - use that version

export type RSVPStatus = 'pending' | 'accepted' | 'declined' | 'tentative';

export interface Attendee {
  id: string;
  name: string;
  email: string;
  status: RSVPStatus;
  required: boolean;
  declineReason?: string;
  respondedAt?: Date;
}

export interface RSVPInput {
  eventId: string;
  attendeeId: string;
  status: RSVPStatus;
  declineReason?: string;
}

// RecurrenceRule for ScheduleBlock (simpler than TimeItem version)
export interface ScheduleRecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
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

export interface Task extends Omit<ScheduleBlock, 'type' | 'status'> {
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
    recurrence?: ScheduleRecurrenceRule;
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
  calendarId?: string; // Optional - parent component should provide if not set
  attendees?: string[];
  recurrence?: ScheduleRecurrenceRule;
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
  recurrence?: ScheduleRecurrenceRule;
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
  recurrence?: ScheduleRecurrenceRule;
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

// ============================================================================
// Floor Plan Types
// ============================================================================

export interface FloorPlanData {
  id: string;
  name: string;
  floor: string;
  buildingId?: string;
  svgContent?: string; // Raw SVG or URL
  width: number;
  height: number;
  resources: FloorPlanResource[];
}

export interface FloorPlanResource {
  id: string;
  resourceId: string; // Links to Resource
  name: string;
  type: 'room' | 'desk' | 'equipment' | 'zone';
  path: string; // SVG path or element ID
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  capacity?: number;
  amenities?: string[];
}

export interface FloorPlanViewState {
  zoom: number;
  panX: number;
  panY: number;
  selectedResourceId?: string;
  highlightedResourceIds?: string[];
}

// ============================================================================
// Workload & Analytics Types
// ============================================================================

export interface WorkloadData {
  memberId: string;
  memberName: string;
  avatarUrl?: string;
  period: DateRange;
  scheduledHours: number;
  capacityHours: number;
  utilizationPercent: number;
  breakdown: WorkloadBreakdown;
  trend: 'up' | 'down' | 'stable';
  trendPercent?: number;
}

export interface WorkloadBreakdown {
  meetings: number;
  focusTime: number;
  tasks: number;
  other: number;
}

export interface TimeAnalytics {
  period: DateRange;
  totalHours: number;
  breakdown: {
    category: string;
    hours: number;
    percent: number;
    color: string;
  }[];
  comparison?: {
    previousPeriod: DateRange;
    changePercent: number;
  };
  insights: AnalyticsInsight[];
}

export interface AnalyticsInsight {
  id: string;
  type: 'info' | 'warning' | 'suggestion';
  title: string;
  description: string;
  metric?: {
    value: number;
    unit: string;
    trend?: 'up' | 'down' | 'stable';
  };
  actionLabel?: string;
  action?: () => void;
}

// ============================================================================
// AI Suggestions Types
// ============================================================================

export interface SchedulingSuggestion {
  id: string;
  type: 'time-block' | 'reschedule' | 'conflict-resolution' | 'optimization';
  title: string;
  description: string;
  confidence: number; // 0-1
  impact: 'low' | 'medium' | 'high';
  suggestedAction: {
    type: 'create' | 'update' | 'delete' | 'move';
    targetId?: string;
    data?: Partial<ScheduleBlock>;
  };
  reasoning?: string;
  alternatives?: SchedulingSuggestion[];
}

export interface AutoScheduleRequest {
  tasks: Task[];
  constraints: AutoScheduleConstraints;
  preferences?: AutoSchedulePreferences;
}

export interface AutoScheduleConstraints {
  dateRange: DateRange;
  workingHours: { start: number; end: number };
  excludeDays?: number[]; // 0-6 (Sunday-Saturday)
  respectDeadlines: boolean;
  minBlockSize?: number; // minutes
  maxBlockSize?: number;
}

export interface AutoSchedulePreferences {
  preferMorning?: boolean;
  groupSimilarTasks?: boolean;
  bufferBetweenTasks?: number; // minutes
  prioritizeUrgent?: boolean;
}

export interface AutoScheduleResult {
  scheduled: Array<{
    task: Task;
    suggestedSlot: DateRange;
    confidence: number;
  }>;
  unscheduled: Array<{
    task: Task;
    reason: string;
  }>;
  conflicts: ConflictInfo[];
}

export interface ConflictInfo {
  id: string;
  type: 'overlap' | 'overload' | 'deadline' | 'preference';
  severity: 'low' | 'medium' | 'high';
  blocks: ScheduleBlock[];
  description: string;
  suggestions: SchedulingSuggestion[];
}

// ============================================================================
// Undo/Redo Types
// ============================================================================

export interface UndoableAction {
  id: string;
  type: 'create' | 'update' | 'delete' | 'move' | 'batch';
  timestamp: Date;
  description: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  data: {
    before?: unknown;
    after?: unknown;
    actions?: UndoableAction[];
  };
}
