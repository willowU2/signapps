//! Canonical `org_nodes` table — the hierarchy of entities, units,
//! positions and roles that compose a tenant's organization.
//!
//! Materialized path via PostgreSQL LTREE so subtree queries
//! (`path <@ 'acme.rd'`) stay O(log n) even on large tenants
//! (10k+ nodes). The `path` column is exposed as a Rust `String`
//! because sqlx does not yet ship a first-class LTREE type — the
//! repository binds it explicitly via `$1::ltree`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// The kind of an organization node — drives UI rendering and the
/// permission resolver.
///
/// Stored as lowercase `TEXT` (`root`, `entity`, `unit`, `position`,
/// `role`) thanks to the `rename_all = "snake_case"` derive option.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum NodeKind {
    /// Top of a tenant hierarchy.
    Root,
    /// A legal entity (company, subsidiary).
    Entity,
    /// A functional unit (department, team, squad).
    Unit,
    /// A named position in the org chart (e.g., "Lead Designer").
    Position,
    /// A role — a cross-cutting bundle of responsibilities.
    Role,
}

/// One node in the canonical organization tree.
///
/// # Examples
///
/// ```ignore
/// let node = OrgNode {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     kind: NodeKind::Unit,
///     parent_id: None,
///     path: "acme.rd".into(),
///     name: "R&D".into(),
///     slug: Some("rd".into()),
///     attributes: serde_json::json!({}),
///     active: true,
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
pub struct OrgNode {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant qui possède ce noeud.
    pub tenant_id: Uuid,
    /// Discriminator (root, entity, unit, position, role).
    pub kind: NodeKind,
    /// Parent direct, `None` au sommet de l'arbre.
    pub parent_id: Option<Uuid>,
    /// LTREE materialized path, dot-separated slugs (e.g. `acme.rd.platform`).
    pub path: String,
    /// Nom affiché à l'utilisateur.
    pub name: String,
    /// Slug optionnel (segment LTREE feuille, kebab/snake-case).
    pub slug: Option<String>,
    /// Attributs extensibles (JSONB).
    pub attributes: serde_json::Value,
    /// `false` = archivé (soft delete), exclu des listings actifs.
    pub active: bool,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}
