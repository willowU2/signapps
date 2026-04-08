"use client";

/**
 * useSharing — React hook for managing sharing grants on any resource.
 *
 * Wraps the unified {@link sharingApi} and provides reactive state with
 * loading/error handling and toast feedback.
 *
 * @example
 * ```tsx
 * const { grants, loading, createGrant, revokeGrant } = useSharing('file', fileId);
 * ```
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { sharingApi } from "@/lib/api/sharing";
import type {
  SharingGrant,
  CreateSharingGrant,
  EffectivePermission,
  SharingResourceType,
  SharingRole,
} from "@/types/sharing";

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseSharingReturn {
  /** All grants on the resource (direct + inherited). */
  grants: SharingGrant[];
  /** Effective permission for the authenticated user — `null` while loading or on error. */
  permission: EffectivePermission | null;
  /** `true` while the grants list is being fetched. */
  loading: boolean;
  /** Error message from the last failed operation — `null` if no error. */
  error: string | null;
  /** Manually re-fetch the grants list. */
  loadGrants: () => Promise<void>;
  /** Manually re-fetch the effective permission. */
  loadPermission: () => Promise<void>;
  /**
   * Create a new sharing grant.
   *
   * @param request - Grant creation payload.
   * @returns The created grant, or `undefined` if `resourceType`/`resourceId` is null.
   * @throws Re-throws on API error (after showing a toast).
   */
  createGrant: (
    request: CreateSharingGrant,
  ) => Promise<SharingGrant | undefined>;
  /**
   * Revoke an existing sharing grant.
   *
   * @param grantId - UUID of the grant to revoke.
   * @throws Re-throws on API error (after showing a toast).
   */
  revokeGrant: (grantId: string) => Promise<void>;
  /**
   * Update the role of an existing sharing grant.
   *
   * @param grantId - UUID of the grant to update.
   * @param role    - New role to assign.
   * @throws Re-throws on API error (after showing a toast).
   */
  updateGrantRole: (grantId: string, role: SharingRole) => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook for managing sharing grants on a resource.
 *
 * Pass `null` for either argument to disable all API calls (useful when the
 * resource ID is not yet known, e.g. during loading).
 *
 * @param resourceType - Type of the resource to manage sharing for.
 * @param resourceId   - UUID of the resource.
 * @returns Reactive state and mutation callbacks.
 *
 * @example
 * ```tsx
 * function SharePanel({ fileId }: { fileId: string }) {
 *   const { grants, loading, createGrant, revokeGrant } = useSharing('file', fileId);
 *
 *   return (
 *     <ul>
 *       {grants.map((g) => (
 *         <li key={g.id}>
 *           {g.grantee_id} — {g.role}
 *           <button onClick={() => revokeGrant(g.id)}>Révoquer</button>
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useSharing(
  resourceType: SharingResourceType | null,
  resourceId: string | null,
): UseSharingReturn {
  const [grants, setGrants] = useState<SharingGrant[]>([]);
  const [permission, setPermission] = useState<EffectivePermission | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGrants = useCallback(async () => {
    if (!resourceType || !resourceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await sharingApi.listGrants(resourceType, resourceId);
      setGrants(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur de chargement";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  const loadPermission = useCallback(async () => {
    if (!resourceType || !resourceId) return;
    try {
      const data = await sharingApi.getEffectivePermission(
        resourceType,
        resourceId,
      );
      setPermission(data);
    } catch {
      // Silent fail — permission is informational and may not be available
    }
  }, [resourceType, resourceId]);

  const createGrant = useCallback(
    async (request: CreateSharingGrant): Promise<SharingGrant | undefined> => {
      if (!resourceType || !resourceId) return undefined;
      try {
        const grant = await sharingApi.createGrant(
          resourceType,
          resourceId,
          request,
        );
        setGrants((prev) => [...prev, grant]);
        toast.success("Partage créé");
        return grant;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Échec du partage";
        toast.error(msg);
        throw err;
      }
    },
    [resourceType, resourceId],
  );

  const revokeGrant = useCallback(
    async (grantId: string): Promise<void> => {
      if (!resourceType || !resourceId) return;
      try {
        await sharingApi.revokeGrant(resourceType, resourceId, grantId);
        setGrants((prev) => prev.filter((g) => g.id !== grantId));
        toast.success("Partage révoqué");
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Échec de la révocation";
        toast.error(msg);
        throw err;
      }
    },
    [resourceType, resourceId],
  );

  const updateGrantRole = useCallback(
    async (grantId: string, role: SharingRole): Promise<void> => {
      if (!resourceType || !resourceId) return;
      try {
        const updated = await sharingApi.updateGrantRole(
          resourceType,
          resourceId,
          grantId,
          role,
        );
        setGrants((prev) =>
          prev.map((g) => (g.id === updated.id ? updated : g)),
        );
        toast.success("Rôle mis à jour");
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Échec de la mise à jour";
        toast.error(msg);
        throw err;
      }
    },
    [resourceType, resourceId],
  );

  useEffect(() => {
    loadGrants();
    loadPermission();
  }, [loadGrants, loadPermission]);

  return {
    grants,
    permission,
    loading,
    error,
    loadGrants,
    loadPermission,
    createGrant,
    revokeGrant,
    updateGrantRole,
  };
}
