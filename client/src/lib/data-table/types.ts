/**
 * Generic DataTable Configuration Types
 *
 * Ces types permettent de configurer les DataTables de manière uniforme
 * pour toutes les entités de l'application.
 */

import { ColumnDef } from "@tanstack/react-table";
import { LucideIcon } from "lucide-react";

// ============================================================================
// View Modes
// ============================================================================

export type ViewMode = "table" | "cards" | "kanban";

// ============================================================================
// Column Configuration
// ============================================================================

export interface ColumnConfig<TData> {
  /** Unique identifier for the column */
  id: string;
  /** Display label for the column header */
  label: string;
  /** Accessor key for the data (dot notation supported: "user.name") */
  accessorKey?: string;
  /** Custom accessor function */
  accessorFn?: (row: TData) => unknown;
  /** Whether the column is sortable */
  sortable?: boolean;
  /** Whether the column is filterable */
  filterable?: boolean;
  /** Whether the column can be hidden by user */
  hideable?: boolean;
  /** Default visibility (true = visible) */
  defaultVisible?: boolean;
  /** Column width (px, %, or auto) */
  width?: string | number;
  /** Min width for resizable columns */
  minWidth?: number;
  /** Required permission to see this column */
  requiredPermission?: string;
  /** Cell renderer type */
  cellType?: "text" | "date" | "datetime" | "badge" | "avatar" | "actions" | "custom";
  /** Badge variant mapping for cellType="badge" */
  badgeVariants?: Record<string, "default" | "secondary" | "destructive" | "outline">;
  /** Format function for display value */
  format?: (value: unknown, row: TData) => string;
  /** Custom cell renderer */
  cell?: (props: { row: TData; value: unknown }) => React.ReactNode;
}

// ============================================================================
// Filter Configuration
// ============================================================================

export type FilterOperator =
  // Text
  | "equals"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  // Number
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "between"
  // Date
  | "before"
  | "after"
  | "last_n_days"
  | "this_week"
  | "this_month"
  // Select
  | "in"
  | "not_in"
  // Boolean
  | "is_true"
  | "is_false";

export interface FilterConfig {
  /** Column ID to filter on */
  columnId: string;
  /** Display label */
  label: string;
  /** Filter type determines available operators */
  type: "text" | "number" | "date" | "select" | "boolean";
  /** Available options for select filters */
  options?: Array<{ value: string; label: string }>;
  /** Default operator */
  defaultOperator?: FilterOperator;
}

export interface ActiveFilter {
  columnId: string;
  operator: FilterOperator;
  value: unknown;
}

// ============================================================================
// Action Configuration
// ============================================================================

export interface ActionConfig<TData> {
  /** Unique action identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon?: LucideIcon;
  /** Action variant for styling */
  variant?: "default" | "destructive";
  /** Required permission */
  requiredPermission?: string;
  /** Show only on hover */
  showOnHover?: boolean;
  /** Handler function */
  onClick: (row: TData) => void;
  /** Conditional visibility */
  visible?: (row: TData) => boolean;
  /** Conditional disabled state */
  disabled?: (row: TData) => boolean;
}

// ============================================================================
// Bulk Action Configuration
// ============================================================================

export interface BulkActionConfig<TData> {
  /** Unique action identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon?: LucideIcon;
  /** Action variant for styling */
  variant?: "default" | "destructive";
  /** Required permission */
  requiredPermission?: string;
  /** Handler function */
  onClick: (rows: TData[]) => void;
  /** Confirmation dialog config */
  confirm?: {
    title: string;
    description: string;
  };
}

// ============================================================================
// Entity Configuration
// ============================================================================

export interface EntityConfig<TData> {
  /** Entity type identifier */
  entityType: string;
  /** Display name (singular) */
  singularName: string;
  /** Display name (plural) */
  pluralName: string;
  /** Icon for the entity */
  icon?: LucideIcon;
  /** Column configurations */
  columns: ColumnConfig<TData>[];
  /** Available filters */
  filters?: FilterConfig[];
  /** Row actions */
  actions?: ActionConfig<TData>[];
  /** Bulk actions */
  bulkActions?: BulkActionConfig<TData>[];
  /** Available view modes */
  viewModes?: ViewMode[];
  /** Default view mode */
  defaultViewMode?: ViewMode;
  /** Default sort */
  defaultSort?: { id: string; desc: boolean };
  /** Searchable columns */
  searchableColumns?: string[];
  /** Primary search column */
  primarySearchColumn?: string;
  /** Row click behavior */
  onRowClick?: (row: TData) => void;
  /** Unique row identifier */
  getRowId?: (row: TData) => string;
  /** Enable row selection */
  enableRowSelection?: boolean;
  /** Page size options */
  pageSizeOptions?: number[];
  /** Default page size */
  defaultPageSize?: number;
}

// ============================================================================
// DataTable Props
// ============================================================================

export interface GenericDataTableProps<TData> {
  /** Entity configuration */
  config: EntityConfig<TData>;
  /** Data to display */
  data: TData[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string;
  /** Override columns (merged with config) */
  columns?: Partial<ColumnConfig<TData>>[];
  /** Override actions */
  actions?: ActionConfig<TData>[];
  /** Current view mode */
  viewMode?: ViewMode;
  /** View mode change handler */
  onViewModeChange?: (mode: ViewMode) => void;
  /** Search value */
  searchValue?: string;
  /** Search change handler */
  onSearchChange?: (value: string) => void;
  /** Active filters */
  filters?: ActiveFilter[];
  /** Filter change handler */
  onFiltersChange?: (filters: ActiveFilter[]) => void;
  /** Custom empty state */
  emptyState?: {
    icon?: LucideIcon;
    title: string;
    description: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  /** Custom toolbar content */
  toolbarContent?: React.ReactNode;
  /** Custom toolbar actions */
  toolbarActions?: React.ReactNode;
  /** Class name for container */
  className?: string;
}
