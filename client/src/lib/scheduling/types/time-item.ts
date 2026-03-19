/**
 * Unified Scheduling System - TimeItem Types
 * Story 1.1.1: TimeItem Data Model & Types
 */

// ============================================================================
// ENUMS & BASIC TYPES
// ============================================================================

export type TimeItemType =
  | 'task'
  | 'event'
  | 'booking'
  | 'shift'
  | 'milestone'
  | 'reminder'
  | 'blocker';

export type Scope = 'moi' | 'eux' | 'nous';

// Alias for backwards compatibility
export type ScopeType = Scope;

export type Visibility =
  | 'private'
  | 'group'
  | 'service'
  | 'bu'
  | 'company'
  | 'public';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type Status = 'todo' | 'in_progress' | 'done' | 'cancelled';

export type FocusLevel = 'deep' | 'medium' | 'shallow' | 'break';

export type EnergyRequired = 'high' | 'medium' | 'low';

export type TimeOfDay = 'morning' | 'midday' | 'afternoon' | 'evening';

export type ViewType =
  | 'day'
  | '3-day'
  | 'week'
  | 'month'
  | 'agenda'
  | 'timeline'
  | 'kanban'
  | 'heatmap'
  | 'focus'
  | 'roster';

export type RecurrenceFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'custom';

export type DependencyType =
  | 'finish_to_start'
  | 'start_to_start'
  | 'finish_to_finish'
  | 'start_to_finish';

// ============================================================================
// COMPLEX TYPES
// ============================================================================

export interface Location {
  type: 'text' | 'address' | 'virtual';
  value: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  url?: string; // For virtual meetings
}

export interface RecurrenceRule {
  id: string;
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[]; // 0=Sunday, 1=Monday, etc.
  dayOfMonth?: number;
  monthOfYear?: number;
  endDate?: string; // ISO8601
  count?: number;
  exceptions: string[]; // ISO8601 dates to skip
}

export interface TimeRange {
  start: string; // HH:mm format
  end: string; // HH:mm format
}

export interface BookingRules {
  minNotice: number; // minutes
  maxAdvance: number; // minutes
  bufferBefore?: number; // minutes
  bufferAfter?: number; // minutes
  maxPerDay?: number;
  allowedTimes?: TimeRange[];
  blockedTimes?: TimeRange[];
  allowedDays?: number[]; // 0=Sunday, 1=Monday, etc.
}

export interface Dependency {
  id: string;
  itemId: string;
  dependsOnId: string;
  type: DependencyType;
}

export interface Participant {
  id: string;
  userId: string;
  role: 'owner' | 'editor' | 'participant' | 'viewer';
  status?: 'pending' | 'accepted' | 'declined' | 'tentative';
}

export interface GroupParticipant {
  id: string;
  groupId: string;
}

// ============================================================================
// MAIN TIMEITEM INTERFACE
// ============================================================================

export interface TimeItem {
  // Identity
  id: string;
  type: TimeItemType;

  // Content
  title: string;
  description?: string;
  tags: string[];
  color?: string;

  // Time
  startTime?: string; // ISO8601
  endTime?: string; // ISO8601
  deadline?: string; // ISO8601
  duration?: number; // minutes
  allDay: boolean;

  // Location
  location?: Location | string;

  // Organization Hierarchy
  societeId: string;
  businessUnitId?: string;
  serviceId?: string;
  projectId?: string;

  // Ownership & Sharing
  ownerId: string;
  users: Participant[];
  groups: GroupParticipant[];
  scope: Scope;
  visibility: Visibility;

  // Status & Priority
  status: Status;
  priority: Priority;

  // Energy & Focus (Productivity)
  focusLevel?: FocusLevel;
  energyRequired?: EnergyRequired;
  valueScore?: number; // 1-10
  estimatedPomodoros?: number;
  actualPomodoros?: number;
  preferredTimeOfDay?: TimeOfDay;
  minBlockDuration?: number; // minutes
  maxBlockDuration?: number; // minutes

  // Relations
  dependencies: string[]; // IDs of items this depends on
  parentId?: string;
  recurrence?: RecurrenceRule;
  templateId?: string;

  // Booking specific
  resourceId?: string;
  bookingLink?: string;
  bookingRules?: BookingRules;

  // Metadata
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
  createdBy: string;
}

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface CreateTimeItemInput {
  type: TimeItemType;
  title: string;
  description?: string;
  tags?: string[];
  color?: string;

  startTime?: string;
  endTime?: string;
  deadline?: string;
  duration?: number;
  allDay?: boolean;

  location?: Location | string;

  projectId?: string;
  businessUnitId?: string;
  serviceId?: string;

  users?: string[]; // User IDs to add as participants
  groups?: string[]; // Group IDs to add
  scope?: Scope;
  visibility?: Visibility;

  status?: Status;
  priority?: Priority;

  focusLevel?: FocusLevel;
  energyRequired?: EnergyRequired;
  valueScore?: number;
  estimatedPomodoros?: number;
  preferredTimeOfDay?: TimeOfDay;
  minBlockDuration?: number;
  maxBlockDuration?: number;

  dependencies?: string[];
  parentId?: string;

  resourceId?: string;
  bookingRules?: BookingRules;
}

export interface UpdateTimeItemInput {
  type?: TimeItemType;
  title?: string;
  description?: string;
  tags?: string[];
  color?: string;

  startTime?: string | null;
  endTime?: string | null;
  deadline?: string | null;
  duration?: number | null;
  allDay?: boolean;

  location?: Location | string | null;

  projectId?: string | null;

  scope?: Scope;
  visibility?: Visibility;

  status?: Status;
  priority?: Priority;

  focusLevel?: FocusLevel | null;
  energyRequired?: EnergyRequired | null;
  valueScore?: number | null;
  estimatedPomodoros?: number | null;
  actualPomodoros?: number | null;
  preferredTimeOfDay?: TimeOfDay | null;
  minBlockDuration?: number | null;
  maxBlockDuration?: number | null;

  dependencies?: string[];
  parentId?: string | null;

  resourceId?: string | null;
  bookingRules?: BookingRules | null;
}

export interface MoveTimeItemInput {
  startTime: string;
  endTime?: string;
  duration?: number;
}

export interface ShareTimeItemInput {
  users?: string[];
  groups?: string[];
  removeUsers?: string[];
  removeGroups?: string[];
}

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface TimeItemsQuery {
  // Date range (required for most queries)
  start?: string; // ISO8601
  end?: string; // ISO8601

  // Scope filter
  scope?: Scope | 'all';

  // Type filters
  types?: TimeItemType[];

  // Status filters
  statuses?: Status[];

  // Priority filters
  priorities?: Priority[];

  // Project filter
  projectId?: string;

  // User/group filters
  userIds?: string[];
  groupIds?: string[];

  // Search
  search?: string;

  // Include options
  includeRecurrences?: boolean;
  includeCompleted?: boolean;
  includeCancelled?: boolean;
  unscheduledOnly?: boolean;

  // Pagination
  limit?: number;
  offset?: number;

  // Sort
  sortBy?: 'start_time' | 'deadline' | 'priority' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

export interface TimeItemsResponse {
  items: TimeItem[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// UI HELPER TYPES
// ============================================================================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  hour: number;
  minute: number;
}

export interface OverlapGroup {
  items: TimeItem[];
  maxOverlap: number;
  columns: Map<string, number>;
}

export interface DragData {
  type: 'time-item' | 'unscheduled-task';
  item: TimeItem;
  sourceView: ViewType;
}

export interface DropData {
  type: 'time-slot' | 'kanban-column' | 'user' | 'group' | 'date';
  date?: Date;
  hour?: number;
  minute?: number;
  columnId?: string;
  userId?: string;
  groupId?: string;
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

export const TIME_ITEM_TYPE_LABELS: Record<TimeItemType, string> = {
  task: 'Tâche',
  event: 'Événement',
  booking: 'Réservation',
  shift: 'Shift',
  milestone: 'Jalon',
  reminder: 'Rappel',
  blocker: 'Bloqueur',
};

export const TIME_ITEM_TYPE_ICONS: Record<TimeItemType, string> = {
  task: 'CheckSquare',
  event: 'Calendar',
  booking: 'Clock',
  shift: 'Users',
  milestone: 'Flag',
  reminder: 'Bell',
  blocker: 'Ban',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#94a3b8', // slate-400
  medium: '#3b82f6', // blue-500
  high: '#f97316', // orange-500
  urgent: '#ef4444', // red-500
};

export const STATUS_LABELS: Record<Status, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
  cancelled: 'Annulé',
};

export const SCOPE_LABELS: Record<Scope, string> = {
  moi: 'Moi',
  eux: 'Eux',
  nous: 'Nous',
};

export const VIEW_TYPE_LABELS: Record<ViewType, string> = {
  day: 'Jour',
  '3-day': '3 Jours',
  week: 'Semaine',
  month: 'Mois',
  agenda: 'Agenda',
  timeline: 'Timeline',
  kanban: 'Kanban',
  heatmap: 'Disponibilités',
  focus: 'Focus',
  roster: 'Planning',
};

export const FOCUS_LEVEL_LABELS: Record<FocusLevel, string> = {
  deep: 'Profond',
  medium: 'Moyen',
  shallow: 'Léger',
  break: 'Pause',
};

export const ENERGY_LABELS: Record<EnergyRequired, string> = {
  high: 'Haute énergie',
  medium: 'Énergie moyenne',
  low: 'Basse énergie',
};

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: 'Matin',
  midday: 'Midi',
  afternoon: 'Après-midi',
  evening: 'Soir',
};
