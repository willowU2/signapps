/**
 * Sharing API Module — SignApps Platform
 *
 * Unified client for the cross-service sharing API.  Sharing endpoints are
 * hosted on the same backend service that owns each resource type, so this
 * module routes requests to the correct service automatically.
 *
 * Supported resource types and their backend services:
 *   file, folder    → storage   (port 3004)
 *   calendar, event → calendar  (port 3011)
 *   document        → docs      (port 3010)
 *   form            → forms     (port 3015)
 *   contact_book    → contacts  (port 3021)
 *   channel         → chat      (port 3020)
 *   asset           → it-assets (port 3022)
 *   vault_entry     → identity  (port 3001)
 *
 * Usage:
 * ```ts
 * import { sharingApi } from '@/lib/api/sharing';
 *
 * // List grants on a file
 * const grants = await sharingApi.listGrants('file', fileId);
 *
 * // Create a new grant
 * const grant = await sharingApi.createGrant('file', fileId, {
 *   grantee_type: 'user',
 *   grantee_id: userId,
 *   role: 'editor',
 *   can_reshare: false,
 *   expires_at: null,
 * });
 * ```
 */

import type {
  BulkGrantRequest,
  BulkGrantResult,
  SharingGrant,
  CreateSharingGrant,
  EffectivePermission,
  SharingResourceType,
  SharingTemplate,
  CreateTemplateRequest,
  SharingAuditEntry,
} from "@/types/sharing";
import { getClient, ServiceName } from "./factory";

// ─── Internal routing helpers ────────────────────────────────────────────────

/**
 * Maps a resource type to the backend service that owns it.
 *
 * @param resourceType - The resource type to resolve.
 * @returns The {@link ServiceName} of the owning service.
 */
function resolveService(resourceType: SharingResourceType): ServiceName {
  switch (resourceType) {
    case "file":
    case "folder":
      return ServiceName.STORAGE;
    case "calendar":
    case "event":
      return ServiceName.CALENDAR;
    case "document":
      return ServiceName.DOCS;
    case "form":
      return ServiceName.FORMS;
    case "contact_book":
      return ServiceName.CONTACTS;
    case "channel":
      return ServiceName.CHAT;
    case "asset":
      return ServiceName.IT_ASSETS;
    case "vault_entry":
      return ServiceName.IDENTITY;
  }
}

/**
 * Maps a resource type to its URL path prefix used in the backend route.
 *
 * @param resourceType - The resource type to resolve.
 * @returns The URL segment that precedes `/:resource_id/grants`.
 */
function resolvePrefix(resourceType: SharingResourceType): string {
  switch (resourceType) {
    case "file":
      return "files";
    case "folder":
      return "folders";
    case "calendar":
      return "calendars";
    case "event":
      return "events";
    case "document":
      return "documents";
    case "form":
      return "forms";
    case "contact_book":
      return "contacts";
    case "channel":
      return "chat";
    case "asset":
      return "assets";
    case "vault_entry":
      return "vault";
  }
}

// ─── API surface ─────────────────────────────────────────────────────────────

/**
 * Unified sharing API client.
 *
 * All methods accept a `resourceType` and `resourceId` and automatically
 * route to the correct backend service.
 */
export const sharingApi = {
  /**
   * List all sharing grants on a resource.
   *
   * @param resourceType - Type of the shared resource.
   * @param resourceId   - UUID of the resource.
   * @returns Array of {@link SharingGrant} records (direct + inherited).
   *
   * @example
   * ```ts
   * const grants = await sharingApi.listGrants('calendar', calendarId);
   * ```
   */
  async listGrants(
    resourceType: SharingResourceType,
    resourceId: string,
  ): Promise<SharingGrant[]> {
    const client = getClient(resolveService(resourceType));
    const prefix = resolvePrefix(resourceType);
    const { data } = await client.get<SharingGrant[]>(
      `/api/v1/${prefix}/${resourceId}/grants`,
    );
    return data;
  },

  /**
   * Create a new sharing grant on a resource.
   *
   * @param resourceType - Type of the shared resource.
   * @param resourceId   - UUID of the resource.
   * @param request      - Grant creation payload.
   * @returns The created {@link SharingGrant}.
   *
   * @example
   * ```ts
   * const grant = await sharingApi.createGrant('document', docId, {
   *   grantee_type: 'group',
   *   grantee_id: groupId,
   *   role: 'viewer',
   *   can_reshare: false,
   *   expires_at: '2026-12-31T23:59:59Z',
   * });
   * ```
   */
  async createGrant(
    resourceType: SharingResourceType,
    resourceId: string,
    request: CreateSharingGrant,
  ): Promise<SharingGrant> {
    const client = getClient(resolveService(resourceType));
    const prefix = resolvePrefix(resourceType);
    const { data } = await client.post<SharingGrant>(
      `/api/v1/${prefix}/${resourceId}/grants`,
      request,
    );
    return data;
  },

  /**
   * Revoke a sharing grant.
   *
   * @param resourceType - Type of the shared resource.
   * @param resourceId   - UUID of the resource.
   * @param grantId      - UUID of the grant to revoke.
   *
   * @example
   * ```ts
   * await sharingApi.revokeGrant('file', fileId, grantId);
   * ```
   */
  async revokeGrant(
    resourceType: SharingResourceType,
    resourceId: string,
    grantId: string,
  ): Promise<void> {
    const client = getClient(resolveService(resourceType));
    const prefix = resolvePrefix(resourceType);
    await client.delete(`/api/v1/${prefix}/${resourceId}/grants/${grantId}`);
  },

  /**
   * Get the effective (resolved) permission for the authenticated user.
   *
   * Returns `null` when the user has no access or the endpoint is unavailable.
   *
   * @param resourceType - Type of the shared resource.
   * @param resourceId   - UUID of the resource.
   * @returns The {@link EffectivePermission} or `null`.
   *
   * @example
   * ```ts
   * const perm = await sharingApi.getEffectivePermission('folder', folderId);
   * if (perm?.capabilities.includes('write')) { ... }
   * ```
   */
  async getEffectivePermission(
    resourceType: SharingResourceType,
    resourceId: string,
  ): Promise<EffectivePermission | null> {
    const client = getClient(resolveService(resourceType));
    const prefix = resolvePrefix(resourceType);
    const { data } = await client.get<EffectivePermission | null>(
      `/api/v1/${prefix}/${resourceId}/permissions`,
    );
    return data;
  },

  /**
   * List all resources shared with the authenticated user.
   *
   * Uses the storage service as the authoritative endpoint for the
   * tenant-wide `shared-with-me` query.
   *
   * @param resourceType - Optional filter — omit to get all resource types.
   * @returns Array of {@link SharingGrant} records.
   *
   * @example
   * ```ts
   * // All shared resources
   * const all = await sharingApi.sharedWithMe();
   *
   * // Only shared files
   * const files = await sharingApi.sharedWithMe('file');
   * ```
   */
  async sharedWithMe(
    resourceType?: SharingResourceType,
  ): Promise<SharingGrant[]> {
    // shared-with-me is a tenant-wide query — storage is the safe default
    const client = getClient(ServiceName.STORAGE);
    const params = resourceType ? { resource_type: resourceType } : {};
    const { data } = await client.get<SharingGrant[]>(
      "/api/v1/shared-with-me",
      {
        params,
      },
    );
    return data;
  },

  // ─── Template methods ───────────────────────────────────────────────────

  /**
   * List all sharing templates available in the tenant.
   *
   * Includes both system templates and user-created templates.
   *
   * @returns Array of {@link SharingTemplate} records.
   *
   * @example
   * ```ts
   * const templates = await sharingApi.listTemplates();
   * ```
   */
  async listTemplates(): Promise<SharingTemplate[]> {
    // Templates are a tenant-wide resource — storage is the stable default.
    const client = getClient(ServiceName.STORAGE);
    const { data } = await client.get<SharingTemplate[]>(
      "/api/v1/sharing/templates",
    );
    return data;
  },

  /**
   * Create a new sharing template (admin only).
   *
   * @param request - Template creation payload.
   * @returns The created {@link SharingTemplate}.
   *
   * @example
   * ```ts
   * const tpl = await sharingApi.createTemplate({
   *   name: "Lecture équipe",
   *   description: null,
   *   grants: [{ grantee_type: "everyone", grantee_id: null, role: "viewer", can_reshare: false }],
   * });
   * ```
   */
  async createTemplate(
    request: CreateTemplateRequest,
  ): Promise<SharingTemplate> {
    const client = getClient(ServiceName.STORAGE);
    const { data } = await client.post<SharingTemplate>(
      "/api/v1/sharing/templates",
      request,
    );
    return data;
  },

  /**
   * Apply a sharing template to a resource.
   *
   * Resolves the correct backend service from the resource type, then calls
   * the `apply-template` endpoint which expands all template grants onto the
   * target resource.
   *
   * @param resourceType - Type of the target resource.
   * @param resourceId   - UUID of the target resource.
   * @param templateId   - UUID of the template to apply.
   * @returns An object with the `count` of grants that were created.
   *
   * @example
   * ```ts
   * const { count } = await sharingApi.applyTemplate('file', fileId, templateId);
   * console.log(`${count} accès créés`);
   * ```
   */
  async applyTemplate(
    resourceType: SharingResourceType,
    resourceId: string,
    templateId: string,
  ): Promise<{ count: number }> {
    const client = getClient(resolveService(resourceType));
    const prefix = resolvePrefix(resourceType);
    const { data } = await client.post<{ count: number }>(
      `/api/v1/${prefix}/${resourceId}/apply-template/${templateId}`,
    );
    return data;
  },

  /**
   * Update the role of an existing sharing grant.
   *
   * @param resourceType - Type of the shared resource.
   * @param resourceId   - UUID of the resource.
   * @param grantId      - UUID of the grant to update.
   * @param role         - New role to assign.
   * @returns The updated {@link SharingGrant}.
   *
   * @example
   * ```ts
   * const updated = await sharingApi.updateGrantRole('file', fileId, grantId, 'editor');
   * ```
   */
  async updateGrantRole(
    resourceType: SharingResourceType,
    resourceId: string,
    grantId: string,
    role: import("@/types/sharing").SharingRole,
  ): Promise<SharingGrant> {
    const client = getClient(resolveService(resourceType));
    const prefix = resolvePrefix(resourceType);
    const { data } = await client.patch<SharingGrant>(
      `/api/v1/${prefix}/${resourceId}/grants/${grantId}`,
      { role },
    );
    return data;
  },

  /**
   * Delete a sharing template by ID (admin only).
   *
   * System templates cannot be deleted and the server will return 404.
   *
   * @param templateId - UUID of the template to delete.
   *
   * @example
   * ```ts
   * await sharingApi.deleteTemplate(templateId);
   * ```
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const client = getClient(ServiceName.STORAGE);
    await client.delete(`/api/v1/sharing/templates/${templateId}`);
  },

  /**
   * Apply the same grant to multiple resources at once.
   *
   * Processes each resource independently — individual failures are returned
   * in `result.errors` rather than aborting the whole batch.
   *
   * The endpoint is hosted on the storage service (tenant-wide), regardless
   * of the actual `resource_type` in the request.
   *
   * @param request - Bulk grant payload.
   * @returns {@link BulkGrantResult} with the count of successes and any errors.
   *
   * @example
   * ```ts
   * const result = await sharingApi.bulkGrant({
   *   resource_type: "file",
   *   resource_ids: [id1, id2, id3],
   *   grantee_type: "user",
   *   grantee_id: userId,
   *   role: "viewer",
   *   can_reshare: false,
   *   expires_at: null,
   * });
   * console.log(`${result.created} partages créés, ${result.errors.length} erreurs`);
   * ```
   */
  async bulkGrant(request: BulkGrantRequest): Promise<BulkGrantResult> {
    // bulk-grant is a global endpoint — storage service hosts it
    const client = getClient(ServiceName.STORAGE);
    const { data } = await client.post<BulkGrantResult>(
      "/api/v1/sharing/bulk-grant",
      request,
    );
    return data;
  },

  /**
   * List sharing audit log entries for the tenant (admin only).
   *
   * Optionally filter by `resource_type` and `resource_id`.
   *
   * @param params - Optional filters: `resource_type`, `resource_id`, `limit`.
   * @returns Array of {@link SharingAuditEntry} records, newest first.
   *
   * @example
   * ```ts
   * // All audit entries
   * const entries = await sharingApi.listAudit();
   *
   * // Filtered by resource type
   * const templateEntries = await sharingApi.listAudit({ resource_type: 'template' });
   * ```
   */
  async listAudit(params?: {
    resource_type?: string;
    resource_id?: string;
    limit?: number;
  }): Promise<SharingAuditEntry[]> {
    const client = getClient(ServiceName.STORAGE);
    const { data } = await client.get<SharingAuditEntry[]>(
      "/api/v1/sharing/audit",
      { params },
    );
    return data;
  },
};
