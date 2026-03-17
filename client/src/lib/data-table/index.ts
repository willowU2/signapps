/**
 * Generic DataTable Module
 *
 * Export centralisé de tous les composants et utilitaires DataTable.
 */

// Main component
export { GenericDataTable } from "./generic-data-table";

// Cell renderers
export {
  TextCell,
  DateCell,
  DateTimeCell,
  BadgeCell,
  AvatarCell,
  renderCell,
} from "./cells";

// Types
export type {
  ViewMode,
  FilterOperator,
  ColumnConfig,
  FilterConfig,
  ActiveFilter,
  ActionConfig,
  BulkActionConfig,
  EntityConfig,
  GenericDataTableProps,
} from "./types";

// Registry
export {
  // Configs
  userConfig,
  fileConfig,
  taskConfig,
  roleConfig,
  jobConfig,
  // Entity types
  type UserEntity,
  type FileEntity,
  type TaskEntity,
  type RoleEntity,
  type JobEntity,
  // Registry functions
  getEntityConfig,
  registerEntityConfig,
  extendEntityConfig,
  getRegisteredEntityTypes,
} from "./registry";
