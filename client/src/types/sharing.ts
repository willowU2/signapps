/**
 * Sharing System Types — SignApps Platform
 *
 * Unified type definitions for the cross-service sharing API.
 * All resource types, roles, and grantee types are centralised here
 * so that every consumer (API client, hooks, components) imports from
 * a single source of truth.
 *
 * Backend API pattern:
 *   GET    /api/v1/{prefix}/:resource_id/grants
 *   POST   /api/v1/{prefix}/:resource_id/grants
 *   DELETE /api/v1/{prefix}/:resource_id/grants/:grant_id
 *   GET    /api/v1/{prefix}/:resource_id/permissions
 *   GET    /api/v1/shared-with-me?resource_type={type}
 */

// ─── Primitive types ────────────────────────────────────────────────────────

/** All resource types that can be shared via the unified grants API. */
export type SharingResourceType =
  | "file"
  | "folder"
  | "calendar"
  | "event"
  | "document"
  | "form"
  | "contact_book"
  | "channel"
  | "asset"
  | "vault_entry";

/**
 * Role controlling what the grantee can do on the resource.
 *
 * - `viewer`   — read-only access
 * - `editor`   — read + write access
 * - `manager`  — full control including sharing
 * - `deny`     — explicit block, overrides inherited grants
 */
export type SharingRole = "viewer" | "editor" | "manager" | "deny";

/**
 * Kind of entity receiving the grant.
 *
 * - `user`     — a single authenticated user (UUID)
 * - `group`    — a named group / security group (UUID)
 * - `org_node` — an organisational node / department (UUID)
 * - `everyone` — all authenticated users in the tenant (no grantee_id required)
 */
export type SharingGranteeType = "user" | "group" | "org_node" | "everyone";

// ─── Core models ─────────────────────────────────────────────────────────────

/**
 * A single sharing grant as returned by the backend.
 *
 * Grants are the authoritative records stored in the database.
 * The effective permission for a user is computed from the union of all
 * grants that match that user (direct, group, org_node, everyone).
 */
export interface SharingGrant {
  /** UUID of the grant record. */
  id: string;
  /** Tenant the grant belongs to. */
  tenant_id: string;
  /** Resource type (mirrors {@link SharingResourceType}). */
  resource_type: string;
  /** UUID of the shared resource. */
  resource_id: string;
  /** Kind of grantee. */
  grantee_type: SharingGranteeType;
  /** UUID of the grantee — `null` when `grantee_type` is `everyone`. */
  grantee_id: string | null;
  /** Granted role. */
  role: SharingRole;
  /** Whether the grantee can re-share the resource with others. */
  can_reshare: boolean;
  /** Whether this grant was propagated from a parent resource. */
  inherit: boolean;
  /** UUID of the user who created this grant. */
  granted_by: string;
  /** ISO 8601 expiry timestamp — `null` means the grant never expires. */
  expires_at: string | null;
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** ISO 8601 last-update timestamp. */
  updated_at: string;
}

/**
 * Payload for creating a new sharing grant.
 *
 * @example
 * ```ts
 * const request: CreateSharingGrant = {
 *   grantee_type: "user",
 *   grantee_id: "018e5b4c-...",
 *   role: "editor",
 *   can_reshare: false,
 *   expires_at: null,
 * };
 * ```
 */
export interface CreateSharingGrant {
  /** Kind of entity to share with. */
  grantee_type: SharingGranteeType;
  /** UUID of the grantee — `null` when `grantee_type` is `everyone`. */
  grantee_id: string | null;
  /** Role to grant. */
  role: SharingRole;
  /** Whether the grantee can re-share the resource. */
  can_reshare: boolean;
  /** Optional ISO 8601 expiry — `null` means no expiry. */
  expires_at: string | null;
}

/**
 * Effective (resolved) permission for the authenticated user on a resource.
 *
 * Computed server-side from the union of all matching grants across all axes
 * (direct, group membership, org hierarchy, tenant-wide).
 */
export interface EffectivePermission {
  /** Highest role the user holds on this resource. */
  role: SharingRole;
  /** Whether the user may re-share the resource. */
  can_reshare: boolean;
  /**
   * Fine-grained capability strings derived from the role.
   * Example values: `"read"`, `"write"`, `"delete"`, `"manage_grants"`.
   */
  capabilities: string[];
  /** Audit trail showing which grants contributed to this permission. */
  sources: PermissionSource[];
}

/**
 * Single contribution to the effective permission — one grant that matched
 * the current user.
 */
export interface PermissionSource {
  /** The axis through which the grant applies (e.g. `"direct"`, `"group"`, `"org"`, `"everyone"`). */
  axis: string;
  /** Display name of the grantee (user name, group name, etc.) — `null` if unavailable. */
  grantee_name: string | null;
  /** Role from this specific source. */
  role: SharingRole;
  /** Human-readable path explaining how the grant was resolved. */
  via: string;
}

// ─── Display constants ───────────────────────────────────────────────────────

/** French labels for each sharing role, suitable for display in UI selectors. */
export const SHARING_ROLE_LABELS: Record<SharingRole, string> = {
  viewer: "Lecteur",
  editor: "Éditeur",
  manager: "Gestionnaire",
  deny: "Bloqué",
};

/** French labels for each grantee type, suitable for display in UI selectors. */
export const SHARING_GRANTEE_TYPE_LABELS: Record<SharingGranteeType, string> = {
  user: "Utilisateur",
  group: "Groupe",
  org_node: "Département",
  everyone: "Tout le monde",
};

/** French labels for each resource type, suitable for display in breadcrumbs and dialogs. */
export const SHARING_RESOURCE_TYPE_LABELS: Record<SharingResourceType, string> =
  {
    file: "Fichier",
    folder: "Dossier",
    calendar: "Calendrier",
    event: "Événement",
    document: "Document",
    form: "Formulaire",
    contact_book: "Carnet d'adresses",
    channel: "Canal",
    asset: "Actif",
    vault_entry: "Secret",
  };
