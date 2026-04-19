//! Canonical `org_policies` (GPO-like) and `org_policy_bindings`.
//!
//! A policy names a bundle of `(resource, actions[])` grants.  A
//! binding attaches a policy to a node; `inherit = true` means the
//! binding propagates to every descendant of the node in the LTREE.
//!
//! Policies are evaluated at decision time by the
//! `OrgPermissionResolver` introduced in W4.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A single permission spec stored inside the `permissions` JSONB
/// array of a [`Policy`].
///
/// Example payload:
///
/// ```json
/// {
///   "resource": "calendar.event",
///   "actions": ["read", "create", "update"]
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PermissionSpec {
    /// Resource identifier (`<service>.<resource>` form).
    pub resource: String,
    /// Allowed actions on the resource.
    pub actions: Vec<String>,
}

/// One policy row.
///
/// # Examples
///
/// ```ignore
/// let pol = Policy {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     name: "Designers".into(),
///     description: Some("Read+write design tools".into()),
///     permissions: serde_json::json!([{"resource":"design","actions":["*"]}]),
///     created_at: chrono::Utc::now(),
///     updated_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Policy {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Nom court (unique au sein d'un tenant côté API).
    pub name: String,
    /// Description longue facultative.
    pub description: Option<String>,
    /// Tableau JSONB de [`PermissionSpec`].
    pub permissions: serde_json::Value,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}

/// One binding row attaching a policy to a node.
///
/// `inherit = true` propagates the policy to every descendant of
/// `node_id` in the LTREE hierarchy.
///
/// # Examples
///
/// ```ignore
/// let bind = PolicyBinding {
///     id: uuid::Uuid::new_v4(),
///     policy_id: uuid::Uuid::new_v4(),
///     node_id: uuid::Uuid::new_v4(),
///     inherit: true,
///     created_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PolicyBinding {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Policy bindée.
    pub policy_id: Uuid,
    /// Noeud cible.
    pub node_id: Uuid,
    /// `true` = la policy s'applique à tous les descendants LTREE.
    pub inherit: bool,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
}
