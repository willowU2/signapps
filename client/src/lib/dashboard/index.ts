/**
 * Dashboard System
 *
 * Export centralisé pour le système de dashboard personnalisable.
 */

// Types
export type {
  WidgetCategory,
  WidgetSize,
  WidgetDefinition,
  WidgetConfigSchema,
  WidgetConfigProperty,
  WidgetInstance,
  WidgetRenderProps,
  DashboardLayout,
  DashboardPreset,
  DashboardContextValue,
} from "./types";

// Registry
export {
  registerWidget,
  getWidget,
  getAllWidgets,
  getWidgetsByCategory,
  getPublicWidgets,
  getWidgetCategories,
  dashboardPresets,
  getPreset,
  getPresetsForRole,
} from "./registry";
