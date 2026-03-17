/**
 * Views System
 *
 * Centralized exports for the customizable views system.
 */

// Types
export type {
  FilterOperator,
  FilterValueType,
  FilterCondition,
  FilterGroup,
  SortDirection,
  SortConfig,
  ColumnConfig,
  ViewType,
  ViewDefinition,
  QuickFilter,
  QuickFilterPreset,
  SharePermission,
  ViewShareConfig,
  ViewTemplate,
  ViewsState,
  ViewActions,
  FieldDefinition,
  FilterBuilderProps,
  ViewSelectorProps,
} from "./types";

export {
  FILTER_OPERATORS_BY_TYPE,
  OPERATOR_LABELS,
} from "./types";

// Registry
export {
  viewTemplates,
  quickFilterPresets,
  templateCategories,
  createEmptyFilterGroup,
  getTemplatesForEntity,
  getTemplatesByCategory,
  getTemplate,
  getQuickFilters,
  createViewFromTemplate,
  getDefaultView,
} from "./registry";

// Components
export { FilterBuilder, FilterSummary } from "./filter-builder";
export { ViewSelector, ViewTypeSwitcher } from "./view-selector";
export {
  QuickFilters,
  ActiveFiltersSummary,
  CompactQuickFilters,
} from "./quick-filters";
export { ViewEditorSheet } from "./view-editor-sheet";

// Analytics
export type {
  ViewUsageEvent,
  ViewAnalytics,
  ViewRecommendation,
} from "./analytics";
export {
  trackViewEvent,
  useViewAnalytics,
  useTrackViewUsage,
  useViewRecommendations,
  exportAnalyticsData,
  clearAnalyticsData,
} from "./analytics";
