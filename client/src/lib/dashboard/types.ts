/**
 * Dashboard System - Types
 *
 * Types pour le système de dashboard personnalisable.
 */

import type { LucideIcon } from "lucide-react";

// ============================================================================
// Widget Types
// ============================================================================

export type WidgetCategory =
  | "analytics"
  | "productivity"
  | "system"
  | "content"
  | "social"
  | "custom";

export interface WidgetSize {
  minW: number;
  minH: number;
  defaultW: number;
  defaultH: number;
  maxW?: number;
  maxH?: number;
}

export interface WidgetDefinition {
  /** Unique widget type identifier */
  type: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Category for grouping */
  category: WidgetCategory;
  /** Icon component */
  icon: LucideIcon;
  /** Size constraints */
  size: WidgetSize;
  /** Default configuration */
  defaultConfig?: Record<string, unknown>;
  /** Configuration schema (JSON Schema) */
  configSchema?: WidgetConfigSchema;
  /** Required permissions to use this widget */
  requiredPermission?: string;
  /** Whether this widget is available for all users */
  isPublic?: boolean;
  /** Preview image URL */
  previewUrl?: string;
}

export interface WidgetConfigSchema {
  type: "object";
  properties: Record<string, WidgetConfigProperty>;
  required?: string[];
}

export interface WidgetConfigProperty {
  type: "string" | "number" | "boolean" | "array" | "object";
  title: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  enumLabels?: Record<string, string>;
  minimum?: number;
  maximum?: number;
}

// ============================================================================
// Widget Instance Types
// ============================================================================

export interface WidgetInstance {
  /** Unique instance ID */
  id: string;
  /** Widget type (references WidgetDefinition) */
  type: string;
  /** Grid position */
  x: number;
  y: number;
  /** Grid size */
  w: number;
  h: number;
  /** Instance-specific configuration */
  config: Record<string, unknown>;
}

export interface WidgetRenderProps {
  /** Widget instance data */
  widget: WidgetInstance;
  /** Whether the widget is in edit mode */
  isEditing: boolean;
  /** Update widget configuration */
  onConfigChange?: (config: Record<string, unknown>) => void;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardLayout {
  /** Layout ID */
  id: string;
  /** Layout name */
  name: string;
  /** Layout description */
  description?: string;
  /** Widget instances */
  widgets: WidgetInstance[];
  /** Grid columns */
  columns?: number;
  /** Row height in pixels */
  rowHeight?: number;
  /** Whether this is a system preset */
  isPreset?: boolean;
  /** Creator user ID */
  createdBy?: string;
  /** Creation timestamp */
  createdAt?: string;
  /** Last update timestamp */
  updatedAt?: string;
}

export interface DashboardPreset {
  /** Preset ID */
  id: string;
  /** Preset name */
  name: string;
  /** Preset description */
  description: string;
  /** Target audience (role-based) */
  targetRole?:
    | "developer"
    | "manager"
    | "analyst"
    | "admin"
    | "hr"
    | "sales"
    | "all";
  /** Icon */
  icon: LucideIcon;
  /** Preview image URL */
  previewUrl?: string;
  /** Widgets configuration */
  widgets: Omit<WidgetInstance, "id">[];
}

// ============================================================================
// Widget Context
// ============================================================================

export interface DashboardContextValue {
  /** Current layout */
  layout: DashboardLayout;
  /** Edit mode */
  isEditing: boolean;
  /** Available widget definitions */
  availableWidgets: WidgetDefinition[];
  /** Add widget */
  addWidget: (type: string, config?: Record<string, unknown>) => void;
  /** Remove widget */
  removeWidget: (id: string) => void;
  /** Update widget position/size */
  updateWidgetLayout: (
    id: string,
    position: { x: number; y: number; w: number; h: number },
  ) => void;
  /** Update widget config */
  updateWidgetConfig: (id: string, config: Record<string, unknown>) => void;
  /** Set edit mode */
  setEditing: (editing: boolean) => void;
  /** Apply preset */
  applyPreset: (presetId: string) => void;
  /** Reset to default */
  resetLayout: () => void;
}
