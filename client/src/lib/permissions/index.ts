/**
 * Permissions Module
 *
 * Export centralisé du système de permissions.
 */

// Types
export type {
  Resource,
  ResourceAction,
  PermissionMap,
  UserPermissions,
  PermissionContextValue,
  PermissionCheckOptions,
  ColumnPermission,
  ActionPermission,
} from "./types";

export { RoleLevel } from "./types";

// Context & Provider
export {
  PermissionsProvider,
  usePermissions,
  Can,
  AdminOnly,
  Feature,
} from "./context";
