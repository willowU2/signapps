//! Database-mapped models for the `sharing.*` schema.
//!
//! Each struct with `#[derive(sqlx::FromRow)]` maps directly to a PostgreSQL
//! table in the `sharing` schema. Non-DB structs (e.g. [`UserContext`],
//! [`EffectivePermission`]) are runtime-only value objects used by the
//! permission resolver.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::types::{GranteeType, Role};

// ─── Grant ────────────────────────────────────────────────────────────────────

/// A single permission grant row from `sharing.grants`.
///
/// Represents one axis of the multi-axis permission model. Grants can target a
/// user, group, org node, or everyone, and may be scoped to a specific resource
/// or inherited from a parent resource.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Grant {
    /// Unique identifier of this grant.
    pub id: Uuid,
    /// The tenant this grant belongs to.
    pub tenant_id: Uuid,
    /// The type of resource this grant applies to (e.g. `"file"`, `"folder"`).
    pub resource_type: String,
    /// The UUID of the specific resource instance.
    pub resource_id: Uuid,
    /// The kind of grantee: `"user"`, `"group"`, `"org_node"`, or `"everyone"`.
    pub grantee_type: String,
    /// The UUID of the grantee, or `NULL` for `"everyone"` grants.
    pub grantee_id: Option<Uuid>,
    /// The role string: `"deny"`, `"viewer"`, `"editor"`, or `"manager"`.
    pub role: String,
    /// Whether the grantee can re-share this resource with others.
    pub can_reshare: Option<bool>,
    /// Optional expiry timestamp after which the grant is no longer valid.
    pub expires_at: Option<DateTime<Utc>>,
    /// The user who created this grant.
    pub granted_by: Uuid,
    /// When this grant was created.
    pub created_at: Option<DateTime<Utc>>,
    /// When this grant was last modified.
    pub updated_at: Option<DateTime<Utc>>,
}

impl Grant {
    /// Parse the `role` field into a typed [`Role`].
    ///
    /// Returns `None` if the stored string does not match a known role.
    ///
    /// # Examples
    ///
    /// ```
    /// # use signapps_sharing::models::Grant;
    /// # use signapps_sharing::types::Role;
    /// # // Grant is not easily constructed in a doctest; show the behaviour.
    /// // A grant with role = "editor" → Some(Role::Editor)
    /// // A grant with role = "unknown" → None
    /// ```
    pub fn parsed_role(&self) -> Option<Role> {
        self.role.parse().ok()
    }

    /// Parse the `grantee_type` field into a typed [`GranteeType`].
    ///
    /// Returns `None` if the stored string does not match a known grantee type.
    pub fn parsed_grantee_type(&self) -> Option<GranteeType> {
        self.grantee_type.parse().ok()
    }
}

// ─── CreateGrant ─────────────────────────────────────────────────────────────

/// Request DTO for creating a new permission grant.
///
/// Sent by HTTP handlers and validated before persisting to `sharing.grants`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGrant {
    /// The kind of grantee: `"user"`, `"group"`, `"org_node"`, or `"everyone"`.
    pub grantee_type: GranteeType,
    /// The UUID of the grantee, required for all types except `Everyone`.
    pub grantee_id: Option<Uuid>,
    /// The role to assign.
    pub role: Role,
    /// Whether the grantee can re-share this resource.
    pub can_reshare: Option<bool>,
    /// Optional expiry for time-limited grants.
    pub expires_at: Option<DateTime<Utc>>,
}

impl CreateGrant {
    /// Returns the grantee UUID, extracted from the DTO.
    ///
    /// Returns `None` when `grantee_type` is [`GranteeType::Everyone`] (which
    /// requires no specific id) or when `grantee_id` is not provided.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_sharing::models::CreateGrant;
    /// use signapps_sharing::types::{GranteeType, Role};
    /// use uuid::Uuid;
    ///
    /// let id = Uuid::new_v4();
    /// let dto = CreateGrant {
    ///     grantee_type: GranteeType::User,
    ///     grantee_id: Some(id),
    ///     role: Role::Viewer,
    ///     can_reshare: None,
    ///     expires_at: None,
    /// };
    /// assert_eq!(dto.resolved_grantee_id(), Some(id));
    ///
    /// let everyone = CreateGrant {
    ///     grantee_type: GranteeType::Everyone,
    ///     grantee_id: None,
    ///     role: Role::Viewer,
    ///     can_reshare: None,
    ///     expires_at: None,
    /// };
    /// assert_eq!(everyone.resolved_grantee_id(), None);
    /// ```
    pub fn resolved_grantee_id(&self) -> Option<Uuid> {
        match self.grantee_type {
            GranteeType::Everyone => None,
            _ => self.grantee_id,
        }
    }
}

// ─── Policy ───────────────────────────────────────────────────────────────────

/// A sharing policy row from `sharing.policies`.
///
/// Policies provide tenant-level or resource-level overrides that can restrict
/// or expand what the base grant resolution allows (e.g. disabling external
/// sharing for a resource type).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Policy {
    /// Unique identifier of this policy.
    pub id: Uuid,
    /// The tenant this policy belongs to.
    pub tenant_id: Uuid,
    /// The resource type this policy applies to, or `NULL` for all types.
    pub resource_type: Option<String>,
    /// A machine-readable policy key (e.g. `"no_external_share"`).
    pub policy_key: String,
    /// JSON-encoded policy value / configuration.
    pub policy_value: serde_json::Value,
    /// Whether this policy is currently active.
    pub enabled: Option<bool>,
    /// When this policy was created.
    pub created_at: Option<DateTime<Utc>>,
    /// When this policy was last modified.
    pub updated_at: Option<DateTime<Utc>>,
}

// ─── Template ─────────────────────────────────────────────────────────────────

/// A sharing template row from `sharing.templates`.
///
/// Templates are reusable sets of grants that can be applied to a resource in
/// one operation (e.g. "Project team default access").
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Template {
    /// Unique identifier of this template.
    pub id: Uuid,
    /// The tenant this template belongs to.
    pub tenant_id: Uuid,
    /// Human-readable name for the template.
    pub name: String,
    /// Optional description of what this template does.
    pub description: Option<String>,
    /// JSON array of grant descriptors stored as raw JSON.
    pub grants: serde_json::Value,
    /// The user who created this template.
    pub created_by: Uuid,
    /// Whether this is a system-managed template that cannot be deleted.
    pub is_system: bool,
    /// When this template was created.
    pub created_at: Option<DateTime<Utc>>,
    /// When this template was last modified.
    pub updated_at: Option<DateTime<Utc>>,
}

// ─── CreateTemplate ───────────────────────────────────────────────────────────

/// Request DTO for creating a new sharing template (admin only).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTemplate {
    /// Human-readable template name (required).
    pub name: String,
    /// Optional description.
    pub description: Option<String>,
    /// List of grant definitions stored as a JSON array.
    pub grants: serde_json::Value,
}

// ─── Capability ───────────────────────────────────────────────────────────────

/// A capability definition from `sharing.capabilities`.
///
/// Maps a (resource_type, role) pair to the list of fine-grained actions that
/// the role is allowed to perform on that resource type.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Capability {
    /// The resource type this capability applies to (e.g. `"file"`).
    pub resource_type: String,
    /// The role this capability applies to (e.g. `"editor"`).
    pub role: String,
    /// The list of actions granted (e.g. `["read", "write", "list"]`).
    pub actions: Vec<String>,
}

// ─── DefaultVisibility ────────────────────────────────────────────────────────

/// A default visibility row from `sharing.default_visibility`.
///
/// Controls whether newly created resources of a given type are visible to
/// everyone in the tenant by default, or start as private.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DefaultVisibility {
    /// The tenant this default applies to.
    pub tenant_id: Uuid,
    /// The resource type this default applies to.
    pub resource_type: String,
    /// The default visibility value (e.g. `"private"`, `"tenant"`, `"public"`).
    pub default_visibility: String,
}

// ─── AuditEntry ───────────────────────────────────────────────────────────────

/// An audit log entry from `sharing.audit_log`.
///
/// Every mutation to the sharing system (grant creation, revocation, policy
/// change, template application) generates an immutable audit entry.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditEntry {
    /// Unique identifier of this audit entry.
    pub id: Uuid,
    /// The tenant this event belongs to.
    pub tenant_id: Uuid,
    /// The resource type involved in the event.
    pub resource_type: String,
    /// The resource instance involved in the event.
    pub resource_id: Uuid,
    /// The kind of action performed (e.g. `"grant_created"`, `"grant_revoked"`).
    pub action: String,
    /// The user who performed the action.
    pub actor_id: Uuid,
    /// Optional IP address of the actor for forensic purposes.
    pub actor_ip: Option<String>,
    /// Optional JSON payload with additional event details.
    pub details: Option<serde_json::Value>,
    /// When this audit entry was recorded.
    pub created_at: Option<DateTime<Utc>>,
}

// ─── UserContext ──────────────────────────────────────────────────────────────

/// Runtime-only context object describing the acting user for a permission check.
///
/// This struct is **not** persisted to the database; it is constructed at
/// request time from the JWT claims and supplemental group/org lookups.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserContext {
    /// The user's unique identifier.
    pub user_id: Uuid,
    /// The tenant the user belongs to.
    pub tenant_id: Uuid,
    /// UUIDs of all groups the user is a member of.
    pub group_ids: Vec<Uuid>,
    /// Map from group UUID to the role string the user holds in that group.
    pub group_roles: HashMap<Uuid, String>,
    /// UUIDs of all org-node ancestors from the user's position up to the root.
    pub org_ancestors: Vec<Uuid>,
    /// The user's system-level role (0 = regular, 1 = staff, 2 = admin, 3 = superadmin).
    pub system_role: i16,
}

impl UserContext {
    /// Returns `true` if the user holds superadmin system role (level ≥ 3).
    ///
    /// Superadmins bypass all permission checks.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_sharing::models::UserContext;
    /// use std::collections::HashMap;
    /// use uuid::Uuid;
    ///
    /// let ctx = UserContext {
    ///     user_id: Uuid::new_v4(),
    ///     tenant_id: Uuid::new_v4(),
    ///     group_ids: vec![],
    ///     group_roles: HashMap::new(),
    ///     org_ancestors: vec![],
    ///     system_role: 3,
    /// };
    /// assert!(ctx.is_superadmin());
    /// ```
    pub fn is_superadmin(&self) -> bool {
        self.system_role >= 3
    }

    /// Returns `true` if the user holds admin system role (level ≥ 2).
    ///
    /// Admins can manage sharing settings for resources within their tenant.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_sharing::models::UserContext;
    /// use std::collections::HashMap;
    /// use uuid::Uuid;
    ///
    /// let ctx = UserContext {
    ///     user_id: Uuid::new_v4(),
    ///     tenant_id: Uuid::new_v4(),
    ///     group_ids: vec![],
    ///     group_roles: HashMap::new(),
    ///     org_ancestors: vec![],
    ///     system_role: 2,
    /// };
    /// assert!(ctx.is_admin());
    /// assert!(!ctx.is_superadmin());
    /// ```
    pub fn is_admin(&self) -> bool {
        self.system_role >= 2
    }
}

// ─── EffectivePermission ──────────────────────────────────────────────────────

/// The resolved effective permission for a (user, resource) pair.
///
/// Returned by the permission resolver after evaluating all grant axes,
/// policies, and capabilities. Contains both the net role and the full list
/// of allowed actions, plus attribution sources for auditing/display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectivePermission {
    /// The net role after multi-axis resolution.
    pub role: Role,
    /// Whether the user may re-share this resource.
    pub can_reshare: bool,
    /// The list of fine-grained actions the user may perform.
    pub capabilities: Vec<String>,
    /// Attribution sources explaining how this permission was derived.
    pub sources: Vec<PermissionSource>,
}

// ─── PermissionSource ─────────────────────────────────────────────────────────

/// One grant axis contribution to an [`EffectivePermission`].
///
/// Used for transparency: the UI can show the user "you have editor access
/// because you are a member of group X".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionSource {
    /// The grant axis this source comes from (e.g. `"user"`, `"group"`, `"org_node"`, `"everyone"`).
    pub axis: String,
    /// Optional human-readable name of the grantee (group name, org node label…).
    pub grantee_name: Option<String>,
    /// The role contributed by this source.
    pub role: Role,
    /// A short description of how this grant was found (e.g. `"direct"`, `"inherited from /projects"`).
    pub via: String,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{GranteeType, Role};

    fn make_user_context(system_role: i16) -> UserContext {
        UserContext {
            user_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            group_ids: vec![],
            group_roles: HashMap::new(),
            org_ancestors: vec![],
            system_role,
        }
    }

    #[test]
    fn user_context_superadmin() {
        assert!(make_user_context(3).is_superadmin());
        assert!(make_user_context(4).is_superadmin());
        assert!(!make_user_context(2).is_superadmin());
        assert!(!make_user_context(0).is_superadmin());
    }

    #[test]
    fn user_context_admin() {
        assert!(make_user_context(2).is_admin());
        assert!(make_user_context(3).is_admin());
        assert!(!make_user_context(1).is_admin());
        assert!(!make_user_context(0).is_admin());
    }

    #[test]
    fn create_grant_resolved_grantee_id_user() {
        let id = Uuid::new_v4();
        let dto = CreateGrant {
            grantee_type: GranteeType::User,
            grantee_id: Some(id),
            role: Role::Editor,
            can_reshare: None,
            expires_at: None,
        };
        assert_eq!(dto.resolved_grantee_id(), Some(id));
    }

    #[test]
    fn create_grant_resolved_grantee_id_everyone() {
        let dto = CreateGrant {
            grantee_type: GranteeType::Everyone,
            grantee_id: None,
            role: Role::Viewer,
            can_reshare: None,
            expires_at: None,
        };
        assert_eq!(dto.resolved_grantee_id(), None);
    }

    #[test]
    fn create_grant_everyone_with_spurious_id_returns_none() {
        // Even if a caller accidentally passes an id for Everyone, we ignore it.
        let dto = CreateGrant {
            grantee_type: GranteeType::Everyone,
            grantee_id: Some(Uuid::new_v4()),
            role: Role::Viewer,
            can_reshare: None,
            expires_at: None,
        };
        assert_eq!(dto.resolved_grantee_id(), None);
    }

    #[test]
    fn effective_permission_serializes() {
        let ep = EffectivePermission {
            role: Role::Editor,
            can_reshare: false,
            capabilities: vec!["read".into(), "write".into()],
            sources: vec![PermissionSource {
                axis: "user".into(),
                grantee_name: None,
                role: Role::Editor,
                via: "direct".into(),
            }],
        };
        let json = serde_json::to_string(&ep).expect("serialization failed");
        assert!(json.contains("editor"));
    }
}
