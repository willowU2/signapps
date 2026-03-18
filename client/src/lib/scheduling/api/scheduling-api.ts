/**
 * Unified Scheduling System - API Client
 * Story 1.1.2: Scheduling API Client
 */

import { api } from '@/lib/api';
import type {
  TimeItem,
  TimeItemsQuery,
  TimeItemsResponse,
  CreateTimeItemInput,
  UpdateTimeItemInput,
  MoveTimeItemInput,
  ShareTimeItemInput,
  RecurrenceRule,
  BookingRules,
} from '../types';

// ============================================================================
// API CONFIGURATION
// ============================================================================

const SCHEDULER_URL = process.env.NEXT_PUBLIC_SCHEDULER_URL || 'http://localhost:3007';
const BASE_PATH = '/api/v1/scheduling';

// Create axios instance for scheduler service
const schedulerApi = api.create({
  baseURL: SCHEDULER_URL,
});

// ============================================================================
// TIMEITEM CRUD
// ============================================================================

/**
 * Create a new TimeItem
 */
export async function createTimeItem(input: CreateTimeItemInput): Promise<TimeItem> {
  const response = await schedulerApi.post<TimeItem>(`${BASE_PATH}/items`, input);
  return response.data;
}

/**
 * Get a single TimeItem by ID
 */
export async function getTimeItem(id: string): Promise<TimeItem> {
  const response = await schedulerApi.get<TimeItem>(`${BASE_PATH}/items/${id}`);
  return response.data;
}

/**
 * Update a TimeItem
 */
export async function updateTimeItem(
  id: string,
  input: UpdateTimeItemInput
): Promise<TimeItem> {
  const response = await schedulerApi.patch<TimeItem>(`${BASE_PATH}/items/${id}`, input);
  return response.data;
}

/**
 * Delete a TimeItem
 */
export async function deleteTimeItem(id: string): Promise<void> {
  await schedulerApi.delete(`${BASE_PATH}/items/${id}`);
}

/**
 * Query TimeItems with filters
 */
export async function queryTimeItems(query: TimeItemsQuery): Promise<TimeItemsResponse> {
  const params = new URLSearchParams();

  if (query.start) params.append('start', query.start);
  if (query.end) params.append('end', query.end);
  if (query.scope && query.scope !== 'all') params.append('scope', query.scope);
  if (query.types?.length) params.append('types', query.types.join(','));
  if (query.statuses?.length) params.append('statuses', query.statuses.join(','));
  if (query.priorities?.length) params.append('priorities', query.priorities.join(','));
  if (query.projectId) params.append('project_id', query.projectId);
  if (query.userIds?.length) params.append('user_ids', query.userIds.join(','));
  if (query.groupIds?.length) params.append('group_ids', query.groupIds.join(','));
  if (query.search) params.append('search', query.search);
  if (query.includeRecurrences) params.append('include_recurrences', 'true');
  if (query.includeCompleted) params.append('include_completed', 'true');
  if (query.includeCancelled) params.append('include_cancelled', 'true');
  if (query.unscheduledOnly) params.append('unscheduled_only', 'true');
  if (query.limit) params.append('limit', query.limit.toString());
  if (query.offset) params.append('offset', query.offset.toString());
  if (query.sortBy) params.append('sort_by', query.sortBy);
  if (query.sortOrder) params.append('sort_order', query.sortOrder);

  const response = await schedulerApi.get<TimeItemsResponse>(
    `${BASE_PATH}/items?${params.toString()}`
  );
  return response.data;
}

/**
 * Get TimeItems in a date range
 */
export async function getTimeItemsInRange(
  start: string,
  end: string,
  scope?: string
): Promise<TimeItem[]> {
  const response = await queryTimeItems({
    start,
    end,
    scope: scope as TimeItemsQuery['scope'],
    includeRecurrences: true,
  });
  return response.items;
}

/**
 * Get unscheduled tasks (no start_time)
 */
export async function getUnscheduledTasks(): Promise<TimeItem[]> {
  const response = await queryTimeItems({
    unscheduledOnly: true,
    types: ['task'],
    statuses: ['todo', 'in_progress'],
  });
  return response.items;
}

// ============================================================================
// SCHEDULING ACTIONS
// ============================================================================

/**
 * Move/reschedule a TimeItem
 */
export async function moveTimeItem(
  id: string,
  input: MoveTimeItemInput
): Promise<TimeItem> {
  const response = await schedulerApi.post<TimeItem>(
    `${BASE_PATH}/items/${id}/move`,
    input
  );
  return response.data;
}

/**
 * Clone a TimeItem
 */
export async function cloneTimeItem(
  id: string,
  overrides?: Partial<CreateTimeItemInput>
): Promise<TimeItem> {
  const response = await schedulerApi.post<TimeItem>(
    `${BASE_PATH}/items/${id}/clone`,
    overrides || {}
  );
  return response.data;
}

// ============================================================================
// SHARING
// ============================================================================

/**
 * Share a TimeItem with users/groups
 */
export async function shareTimeItem(
  id: string,
  input: ShareTimeItemInput
): Promise<TimeItem> {
  const response = await schedulerApi.post<TimeItem>(
    `${BASE_PATH}/items/${id}/share`,
    input
  );
  return response.data;
}

// ============================================================================
// RECURRENCE
// ============================================================================

/**
 * Set recurrence rule for a TimeItem
 */
export async function setRecurrence(
  id: string,
  rule: Omit<RecurrenceRule, 'id'>
): Promise<TimeItem> {
  const response = await schedulerApi.post<TimeItem>(
    `${BASE_PATH}/items/${id}/recurrence`,
    rule
  );
  return response.data;
}

/**
 * Remove recurrence from a TimeItem
 */
export async function removeRecurrence(id: string): Promise<TimeItem> {
  const response = await schedulerApi.delete<TimeItem>(
    `${BASE_PATH}/items/${id}/recurrence`
  );
  return response.data;
}

/**
 * Modify a single recurrence instance
 */
export async function modifyRecurrenceInstance(
  id: string,
  date: string,
  changes: UpdateTimeItemInput
): Promise<TimeItem> {
  const response = await schedulerApi.patch<TimeItem>(
    `${BASE_PATH}/items/${id}/instances/${date}`,
    changes
  );
  return response.data;
}

// ============================================================================
// DEPENDENCIES
// ============================================================================

/**
 * Add a dependency to a TimeItem
 */
export async function addDependency(
  id: string,
  dependsOnId: string,
  type: string = 'finish_to_start'
): Promise<TimeItem> {
  const response = await schedulerApi.post<TimeItem>(
    `${BASE_PATH}/items/${id}/dependencies`,
    { depends_on_id: dependsOnId, type }
  );
  return response.data;
}

/**
 * Remove a dependency from a TimeItem
 */
export async function removeDependency(
  id: string,
  dependencyId: string
): Promise<TimeItem> {
  const response = await schedulerApi.delete<TimeItem>(
    `${BASE_PATH}/items/${id}/dependencies/${dependencyId}`
  );
  return response.data;
}

// ============================================================================
// TEMPLATES
// ============================================================================

export interface Template {
  id: string;
  name: string;
  description?: string;
  items: CreateTimeItemInput[];
  createdBy: string;
  createdAt: string;
}

/**
 * Get all templates
 */
export async function getTemplates(): Promise<Template[]> {
  const response = await schedulerApi.get<Template[]>(`${BASE_PATH}/templates`);
  return response.data;
}

/**
 * Create a template
 */
export async function createTemplate(
  name: string,
  items: CreateTimeItemInput[],
  description?: string
): Promise<Template> {
  const response = await schedulerApi.post<Template>(`${BASE_PATH}/templates`, {
    name,
    items,
    description,
  });
  return response.data;
}

/**
 * Apply a template to a date
 */
export async function applyTemplate(
  templateId: string,
  startDate: string
): Promise<TimeItem[]> {
  const response = await schedulerApi.post<TimeItem[]>(
    `${BASE_PATH}/templates/${templateId}/apply`,
    { start_date: startDate }
  );
  return response.data;
}

// ============================================================================
// RESOURCES
// ============================================================================

export interface Resource {
  id: string;
  name: string;
  type: string;
  capacity?: number;
  location?: string;
  metadata?: Record<string, unknown>;
  isActive: boolean;
}

/**
 * Get all resources
 */
export async function getResources(): Promise<Resource[]> {
  const response = await schedulerApi.get<Resource[]>(`${BASE_PATH}/resources`);
  return response.data;
}

/**
 * Get resource availability
 */
export async function getResourceAvailability(
  resourceId: string,
  start: string,
  end: string
): Promise<{ start: string; end: string }[]> {
  const response = await schedulerApi.get<{ start: string; end: string }[]>(
    `${BASE_PATH}/resources/${resourceId}/availability`,
    { params: { start, end } }
  );
  return response.data;
}

// ============================================================================
// BOOKING (PUBLIC)
// ============================================================================

export interface BookingSlot {
  start: string;
  end: string;
  available: boolean;
}

export interface BookingRequest {
  slotStart: string;
  slotEnd: string;
  name: string;
  email: string;
  notes?: string;
}

/**
 * Get available booking slots (public endpoint)
 */
export async function getBookingSlots(
  slug: string,
  start: string,
  end: string
): Promise<BookingSlot[]> {
  const response = await schedulerApi.get<BookingSlot[]>(
    `${BASE_PATH}/booking/${slug}/slots`,
    { params: { start, end } }
  );
  return response.data;
}

/**
 * Book a slot (public endpoint)
 */
export async function bookSlot(
  slug: string,
  request: BookingRequest
): Promise<TimeItem> {
  const response = await schedulerApi.post<TimeItem>(
    `${BASE_PATH}/booking/${slug}/book`,
    request
  );
  return response.data;
}

// ============================================================================
// AVAILABILITY
// ============================================================================

export interface AvailabilitySlot {
  userId: string;
  start: string;
  end: string;
  busy: boolean;
}

/**
 * Get team availability
 */
export async function getTeamAvailability(
  userIds: string[],
  start: string,
  end: string,
  granularity: number = 30 // minutes
): Promise<AvailabilitySlot[]> {
  const response = await schedulerApi.get<AvailabilitySlot[]>(
    `${BASE_PATH}/availability`,
    {
      params: {
        user_ids: userIds.join(','),
        start,
        end,
        granularity,
      },
    }
  );
  return response.data;
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

export interface UserPreferences {
  peakHoursStart: number;
  peakHoursEnd: number;
  pomodoroLength: number;
  breakLength: number;
  showWeekends: boolean;
  show24Hour: boolean;
  defaultView: string;
  defaultScope: string;
  weekStartsOn: number;
  reminderDefaults: number[];
}

/**
 * Get user preferences
 */
export async function getPreferences(): Promise<UserPreferences> {
  const response = await schedulerApi.get<UserPreferences>(
    `${BASE_PATH}/preferences`
  );
  return response.data;
}

/**
 * Update user preferences
 */
export async function updatePreferences(
  updates: Partial<UserPreferences>
): Promise<UserPreferences> {
  const response = await schedulerApi.patch<UserPreferences>(
    `${BASE_PATH}/preferences`,
    updates
  );
  return response.data;
}

// ============================================================================
// AI ENDPOINTS
// ============================================================================

export interface ScheduleSuggestion {
  item: TimeItem;
  suggestedStart: string;
  suggestedEnd: string;
  reason: string;
  confidence: number;
}

export interface ParsedNaturalLanguage {
  title: string;
  type?: string;
  date?: string;
  time?: string;
  duration?: number;
  priority?: string;
  participants?: string[];
  location?: string;
  ambiguities?: { field: string; options: string[] }[];
}

/**
 * Get AI scheduling suggestions
 */
export async function getScheduleSuggestions(
  date: string,
  taskIds?: string[]
): Promise<ScheduleSuggestion[]> {
  const response = await schedulerApi.post<ScheduleSuggestion[]>(
    `${BASE_PATH}/ai/suggest-schedule`,
    { date, task_ids: taskIds }
  );
  return response.data;
}

/**
 * Parse natural language input
 */
export async function parseNaturalLanguage(
  text: string
): Promise<ParsedNaturalLanguage> {
  const response = await schedulerApi.post<ParsedNaturalLanguage>(
    `${BASE_PATH}/ai/parse-natural`,
    { text }
  );
  return response.data;
}

/**
 * Get user patterns
 */
export async function getUserPatterns(): Promise<{
  peakProductivityHours: number[];
  preferredMeetingTimes: number[];
  averageTaskDuration: number;
  completionRate: number;
}> {
  const response = await schedulerApi.get(`${BASE_PATH}/ai/patterns`);
  return response.data;
}

// ============================================================================
// EXPORT
// ============================================================================

export const schedulingApi = {
  // CRUD
  createTimeItem,
  getTimeItem,
  updateTimeItem,
  deleteTimeItem,
  queryTimeItems,
  getTimeItemsInRange,
  getUnscheduledTasks,

  // Actions
  moveTimeItem,
  cloneTimeItem,
  shareTimeItem,

  // Recurrence
  setRecurrence,
  removeRecurrence,
  modifyRecurrenceInstance,

  // Dependencies
  addDependency,
  removeDependency,

  // Templates
  getTemplates,
  createTemplate,
  applyTemplate,

  // Resources
  getResources,
  getResourceAvailability,

  // Booking
  getBookingSlots,
  bookSlot,

  // Availability
  getTeamAvailability,

  // Preferences
  getPreferences,
  updatePreferences,

  // AI
  getScheduleSuggestions,
  parseNaturalLanguage,
  getUserPatterns,
};

export default schedulingApi;
