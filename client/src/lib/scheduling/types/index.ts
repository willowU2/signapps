/**
 * Unified Scheduling System - Types Index
 */

export * from './time-item';

// Export types from scheduling, excluding types that conflict with time-item
export type {
  TabType,
  BlockType,
  ScheduleBlock,
  BlockStatus,
  RSVPStatus,
  Attendee,
  RSVPInput,
  ScheduleRecurrenceRule,
  EventLayout,
  TaskStatus,
  Task,
  Subtask,
  Resource,
  Booking,
  TeamMember,
  WorkingHours,
  WeeklySchedule,
  DaySchedule,
  AvailabilitySlot,
  SchedulingFilters,
  ViewConfig,
  Command,
  ParsedInput,
  CreateEventInput,
  UpdateEventInput,
  EventsQueryParams,
  EventTemplate,
  EventTemplateDefaults,
  CreateTemplateInput,
  UpdateTemplateInput,
  EventLocation,
  FloorPlanData,
  FloorPlanResource,
  FloorPlanViewState,
  WorkloadData,
  WorkloadBreakdown,
  TimeAnalytics,
  AnalyticsInsight,
  SchedulingSuggestion,
  AutoScheduleRequest,
  AutoScheduleConstraints,
  AutoSchedulePreferences,
  AutoScheduleResult,
  ConflictInfo,
  UndoableAction,
} from './scheduling';

// Export value (const) separately
export { DEFAULT_VIEW_CONFIG } from './scheduling';

export * from './layout';
