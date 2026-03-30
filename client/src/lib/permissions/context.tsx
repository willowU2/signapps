/**
 * Permissions Context & Provider
 *
 * Fournit les permissions de l'utilisateur courant à toute l'application.
 */

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/lib/store";
import { rolesApi, type Role } from "@/lib/api/identity";
import { FEATURES } from "@/lib/features";
import type {
  Resource,
  ResourceAction,
  RoleLevel,
  UserPermissions,
  PermissionContextValue,
  PermissionCheckOptions,
  PermissionMap,
} from "./types";

// ============================================================================
// Context
// ============================================================================

const PermissionContext = createContext<PermissionContextValue | null>(null);

// ============================================================================
// Default Permissions by Role Level
// ============================================================================

const DEFAULT_USER_PERMISSIONS: PermissionMap = {
  storage: ["read", "create", "update", "delete"],
  calendar: ["read", "create", "update", "delete"],
  docs: ["read", "create", "update", "delete"],
  mail: ["read", "send"],
  chat: ["read", "send"],
  scheduler: ["read"],
};

const DEFAULT_ADMIN_PERMISSIONS: PermissionMap = {
  containers: ["read", "create", "update", "delete", "start", "stop"],
  storage: ["read", "create", "update", "delete", "share"],
  users: ["read", "create", "update", "delete"],
  groups: ["read", "create", "update", "delete", "manage_members"],
  roles: ["read", "create", "update", "delete"],
  webhooks: ["read", "create", "update", "delete", "test"],
  scheduler: ["read", "create", "update", "delete", "run"],
  calendar: ["read", "create", "update", "delete"],
  mail: ["read", "send", "delete"],
  docs: ["read", "create", "update", "delete", "share"],
  chat: ["read", "send", "delete", "manage_channels"],
  settings: ["read", "update"],
  audit: ["read", "export"],
};

// ============================================================================
// Provider
// ============================================================================

interface PermissionsProviderProps {
  children: React.ReactNode;
}

export function PermissionsProvider({ children }: PermissionsProviderProps) {
  const { user, isAuthenticated } = useAuthStore();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load permissions from backend
  const loadPermissions = useCallback(async () => {
    if (!user || !isAuthenticated) {
      setPermissions(null);
      setIsLoading(false);
      return;
    }

    try {
      // Determine role level — UserRole and RoleLevel are incompatible enums, cast via number
      const roleLevel = (user.role as number) as RoleLevel;
      const isAdmin = roleLevel >= 2;
      const isSuperAdmin = roleLevel >= 3;

      // Start with default permissions based on role
      let permissionMap: PermissionMap = { ...DEFAULT_USER_PERMISSIONS };

      if (isAdmin) {
        permissionMap = { ...DEFAULT_ADMIN_PERMISSIONS };
      }

      // Try to get user's role from backend for granular permissions
      // Note: This could be extended to fetch the user's specific role permissions
      // For now, we use role level to determine base permissions

      // Get enabled features from the FEATURES config
      const enabledFeatures = Object.entries(FEATURES)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);

      setPermissions({
        userId: user.id,
        roleLevel,
        roleName: getRoleName(roleLevel),
        isAdmin,
        isSuperAdmin,
        permissions: permissionMap,
        features: enabledFeatures,
      });
    } catch (error) {
      console.error("Failed to load permissions:", error);
      // Fallback to basic user permissions
      setPermissions({
        userId: user.id,
        roleLevel: (user.role as number) as RoleLevel,
        roleName: getRoleName(user.role),
        isAdmin: user.role >= 2,
        isSuperAdmin: user.role >= 3,
        permissions: DEFAULT_USER_PERMISSIONS,
        features: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, isAuthenticated]);

  // Load permissions on mount and when user changes
  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // Permission check function
  const can = useCallback(
    (
      resource: Resource,
      action: ResourceAction | ResourceAction[],
      options?: PermissionCheckOptions
    ): boolean => {
      if (!permissions) return false;

      // Super admin can do everything
      if (permissions.isSuperAdmin) return true;

      const resourcePermissions = permissions.permissions[resource];
      if (!resourcePermissions) return false;

      const actions = Array.isArray(action) ? action : [action];

      if (options?.any) {
        // Check if ANY of the actions is allowed
        return actions.some((a) => resourcePermissions.includes(a));
      } else {
        // Check if ALL actions are allowed
        return actions.every((a) => resourcePermissions.includes(a));
      }
    },
    [permissions]
  );

  // Is admin check
  const isAdminCheck = useCallback((): boolean => {
    return permissions?.isAdmin ?? false;
  }, [permissions]);

  // Is super admin check
  const isSuperAdminCheck = useCallback((): boolean => {
    return permissions?.isSuperAdmin ?? false;
  }, [permissions]);

  // Has role check
  const hasRole = useCallback(
    (minLevel: RoleLevel): boolean => {
      if (!permissions) return false;
      return permissions.roleLevel >= minLevel;
    },
    [permissions]
  );

  // Has feature check
  const hasFeature = useCallback(
    (feature: string): boolean => {
      if (!permissions) return false;
      // Super admin has all features
      if (permissions.isSuperAdmin) return true;
      return permissions.features.includes(feature);
    },
    [permissions]
  );

  // Refresh permissions
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadPermissions();
  }, [loadPermissions]);

  const value: PermissionContextValue = {
    permissions,
    isLoading,
    can,
    isAdmin: isAdminCheck,
    isSuperAdmin: isSuperAdminCheck,
    hasRole,
    hasFeature,
    refresh,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function usePermissions(): PermissionContextValue {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}

// ============================================================================
// Helpers
// ============================================================================

function getRoleName(roleLevel: number): string {
  switch (roleLevel) {
    case 0:
      return "Invité";
    case 1:
      return "Utilisateur";
    case 2:
      return "Administrateur";
    case 3:
      return "Super Admin";
    default:
      return "Inconnu";
  }
}

// ============================================================================
// Conditional Render Components
// ============================================================================

interface CanProps {
  resource: Resource;
  action: ResourceAction | ResourceAction[];
  any?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only if user has the specified permission.
 */
export function Can({ resource, action, any, children, fallback = null }: CanProps) {
  const { can } = usePermissions();
  return can(resource, action, { any }) ? <>{children}</> : <>{fallback}</>;
}

interface AdminOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only if user is admin.
 */
export function AdminOnly({ children, fallback = null }: AdminOnlyProps) {
  const { isAdmin } = usePermissions();
  return isAdmin() ? <>{children}</> : <>{fallback}</>;
}

interface FeatureProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only if feature is enabled.
 */
export function Feature({ feature, children, fallback = null }: FeatureProps) {
  const { hasFeature } = usePermissions();
  return hasFeature(feature) ? <>{children}</> : <>{fallback}</>;
}
