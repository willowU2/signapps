/**
 * Permission Types
 *
 * Types pour le système de permissions RBAC.
 */

// ============================================================================
// Role Levels
// ============================================================================

export enum RoleLevel {
  GUEST = 0,
  USER = 1,
  ADMIN = 2,
  SUPER_ADMIN = 3,
}

// ============================================================================
// Resource Actions
// ============================================================================

export type ResourceAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "start"
  | "stop"
  | "share"
  | "manage_members"
  | "test"
  | "run"
  | "send"
  | "manage_channels"
  | "export";

// ============================================================================
// Resources
// ============================================================================

export type Resource =
  | "containers"
  | "storage"
  | "users"
  | "groups"
  | "roles"
  | "webhooks"
  | "scheduler"
  | "calendar"
  | "mail"
  | "docs"
  | "chat"
  | "settings"
  | "audit";

// ============================================================================
// Permission Map
// ============================================================================

export type PermissionMap = {
  [resource in Resource]?: ResourceAction[];
};

// ============================================================================
// User Permissions
// ============================================================================

export interface UserPermissions {
  /** User ID */
  userId: string;
  /** User role level */
  roleLevel: RoleLevel;
  /** Role name */
  roleName: string;
  /** Is admin (role >= 2) */
  isAdmin: boolean;
  /** Is super admin (role >= 3) */
  isSuperAdmin: boolean;
  /** Resource-specific permissions */
  permissions: PermissionMap;
  /** Features enabled for this tenant */
  features: string[];
}

// ============================================================================
// Permission Check Options
// ============================================================================

export interface PermissionCheckOptions {
  /** Check if any of the actions is allowed (OR) */
  any?: boolean;
}

// ============================================================================
// Permission Context Value
// ============================================================================

export interface PermissionContextValue {
  /** Current user permissions */
  permissions: UserPermissions | null;
  /** Loading state */
  isLoading: boolean;
  /** Check if user has a specific permission */
  can: (resource: Resource, action: ResourceAction | ResourceAction[], options?: PermissionCheckOptions) => boolean;
  /** Check if user is admin */
  isAdmin: () => boolean;
  /** Check if user is super admin */
  isSuperAdmin: () => boolean;
  /** Check if user has minimum role level */
  hasRole: (minLevel: RoleLevel) => boolean;
  /** Check if a feature is enabled */
  hasFeature: (feature: string) => boolean;
  /** Refresh permissions from server */
  refresh: () => Promise<void>;
}

// ============================================================================
// Column Permission Config
// ============================================================================

export interface ColumnPermission {
  /** Resource to check */
  resource: Resource;
  /** Action to check */
  action: ResourceAction;
}

// ============================================================================
// Action Permission Config
// ============================================================================

export interface ActionPermission {
  /** Resource to check */
  resource: Resource;
  /** Action(s) to check */
  action: ResourceAction | ResourceAction[];
  /** Check mode: all actions required (AND) or any action sufficient (OR) */
  mode?: "all" | "any";
}
