/**
 * Views System Types
 *
 * Defines the schema for customizable views that can be saved,
 * shared, and applied to data tables.
 */

import type { LucideIcon } from "lucide-react";

// ============================================================================
// Filter Types
// ============================================================================

export type FilterOperator =
  // Text operators
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  // Number operators
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  // Date operators
  | "before"
  | "after"
  | "on_date"
  | "last_n_days"
  | "next_n_days"
  | "this_week"
  | "this_month"
  | "this_year"
  // Array operators
  | "in"
  | "not_in"
  // Boolean operators
  | "is_true"
  | "is_false";

export type FilterValueType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "select"
  | "multi_select";

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: unknown;
  valueType: FilterValueType;
}

export interface FilterGroup {
  id: string;
  logic: "and" | "or";
  conditions: (FilterCondition | FilterGroup)[];
}

// ============================================================================
// Sort Types
// ============================================================================

export type SortDirection = "asc" | "desc";

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

// ============================================================================
// Column Types
// ============================================================================

export interface ColumnConfig {
  field: string;
  visible: boolean;
  width?: number;
  order: number;
}

// ============================================================================
// View Definition
// ============================================================================

export type ViewType = "table" | "cards" | "kanban" | "calendar" | "timeline";

export interface ViewDefinition {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  entityType: string;
  viewType: ViewType;

  // Display configuration
  columns: ColumnConfig[];
  sort: SortConfig[];
  groupBy?: string;

  // Filter configuration
  filters: FilterGroup;
  quickFilters?: QuickFilter[];

  // Pagination
  pageSize: number;

  // Metadata
  isDefault?: boolean;
  isSystem?: boolean;
  isShared?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;

  // Sharing
  sharedWith?: ViewShareConfig[];
}

// ============================================================================
// Quick Filters
// ============================================================================

export interface QuickFilter {
  id: string;
  label: string;
  icon?: LucideIcon;
  filter: FilterCondition | FilterGroup;
  isActive?: boolean;
}

export interface QuickFilterPreset {
  id: string;
  entityType: string;
  filters: QuickFilter[];
}

// ============================================================================
// View Sharing
// ============================================================================

export type SharePermission = "view" | "edit" | "admin";

export interface ViewShareConfig {
  targetType: "user" | "role" | "workspace" | "public";
  targetId?: string;
  permission: SharePermission;
}

// ============================================================================
// View Templates
// ============================================================================

export interface ViewTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  entityType: string;
  category: string;
  view: Omit<ViewDefinition, "id" | "createdBy" | "createdAt" | "updatedAt">;
}

// ============================================================================
// View Store State
// ============================================================================

export interface ViewsState {
  // Current view
  activeViewId: string | null;

  // Saved views by entity type
  views: Record<string, ViewDefinition[]>;

  // Temporary view modifications (unsaved)
  draftChanges: Partial<ViewDefinition> | null;

  // Quick filter states
  activeQuickFilters: string[];

  // Loading states
  isLoading: boolean;
  isSaving: boolean;
}

// ============================================================================
// View Actions
// ============================================================================

export interface ViewActions {
  // View CRUD
  createView: (
    view: Omit<ViewDefinition, "id" | "createdAt" | "updatedAt">,
  ) => Promise<ViewDefinition>;
  updateView: (id: string, updates: Partial<ViewDefinition>) => Promise<void>;
  deleteView: (id: string) => Promise<void>;
  duplicateView: (id: string, newName: string) => Promise<ViewDefinition>;

  // View selection
  setActiveView: (id: string | null) => void;

  // Draft changes (before saving)
  setDraftChanges: (changes: Partial<ViewDefinition> | null) => void;
  applyDraftChanges: () => Promise<void>;
  discardDraftChanges: () => void;

  // Quick filters
  toggleQuickFilter: (filterId: string) => void;
  clearQuickFilters: () => void;

  // Sharing
  shareView: (viewId: string, config: ViewShareConfig) => Promise<void>;
  unshareView: (
    viewId: string,
    targetType: string,
    targetId?: string,
  ) => Promise<void>;

  // Import/Export
  exportView: (viewId: string) => ViewDefinition;
  importView: (view: ViewDefinition) => Promise<ViewDefinition>;
}

// ============================================================================
// Filter Builder Props
// ============================================================================

export interface FieldDefinition {
  field: string;
  label: string;
  type: FilterValueType;
  options?: { value: string; label: string }[];
}

export interface FilterBuilderProps {
  fields: FieldDefinition[];
  value: FilterGroup;
  onChange: (value: FilterGroup) => void;
  maxDepth?: number;
}

// ============================================================================
// View Selector Props
// ============================================================================

export interface ViewSelectorProps {
  entityType: string;
  activeViewId: string | null;
  onViewChange: (viewId: string | null) => void;
  onCreateView?: () => void;
  onEditView?: (viewId: string) => void;
}

// ============================================================================
// Utility Types
// ============================================================================

export type FilterOperatorsByType = {
  [K in FilterValueType]: FilterOperator[];
};

export const FILTER_OPERATORS_BY_TYPE: FilterOperatorsByType = {
  string: [
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "is_empty",
    "is_not_empty",
  ],
  number: ["equals", "not_equals", "gt", "gte", "lt", "lte", "between"],
  boolean: ["is_true", "is_false"],
  date: [
    "on_date",
    "before",
    "after",
    "between",
    "last_n_days",
    "next_n_days",
    "this_week",
    "this_month",
    "this_year",
  ],
  datetime: [
    "on_date",
    "before",
    "after",
    "between",
    "last_n_days",
    "next_n_days",
    "this_week",
    "this_month",
    "this_year",
  ],
  select: ["equals", "not_equals", "in", "not_in", "is_empty", "is_not_empty"],
  multi_select: ["in", "not_in", "is_empty", "is_not_empty"],
};

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "est égal à",
  not_equals: "n'est pas égal à",
  contains: "contient",
  not_contains: "ne contient pas",
  starts_with: "commence par",
  ends_with: "se termine par",
  is_empty: "est vide",
  is_not_empty: "n'est pas vide",
  gt: "supérieur à",
  gte: "supérieur ou égal à",
  lt: "inférieur à",
  lte: "inférieur ou égal à",
  between: "entre",
  before: "avant",
  after: "après",
  on_date: "le",
  last_n_days: "derniers jours",
  next_n_days: "prochains jours",
  this_week: "cette semaine",
  this_month: "ce mois",
  this_year: "cette année",
  in: "parmi",
  not_in: "pas parmi",
  is_true: "est vrai",
  is_false: "est faux",
};
