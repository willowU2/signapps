//! Canonical `org_assignments` table.
//!
//! Each assignment attaches a [`Person`](super::person::Person) to an
//! [`OrgNode`](super::node::OrgNode) along one of three orthogonal
//! axes:
//!
//! - **Structure** — primary reporting line (manager, subordinate).
//! - **Focus** — what the person is currently working on (project, topic).
//! - **Group** — cross-cutting team (guild, committee, board).
//!
//! A person can carry multiple assignments per axis. When several
//! exist on the **Structure** axis, exactly one carries
//! `is_primary = true` (enforced by the upper API layer in W2).

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// The axis along which an assignment connects a person to an
/// org node.
///
/// Stored as lowercase `TEXT` (`structure`, `focus`, `group`) thanks
/// to the `rename_all = "snake_case"` derive option.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum Axis {
    /// Primary reporting line (manager / subordinate).
    Structure,
    /// Active focus (project, topic, mission).
    Focus,
    /// Cross-cutting team (guild, committee, board).
    Group,
}

/// One assignment row.
///
/// # Examples
///
/// ```ignore
/// let a = Assignment {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     person_id: uuid::Uuid::new_v4(),
///     node_id: uuid::Uuid::new_v4(),
///     axis: Axis::Structure,
///     role: Some("Lead Designer".into()),
///     is_primary: true,
///     start_date: None,
///     end_date: None,
///     created_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Assignment {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant qui porte l'affectation.
    pub tenant_id: Uuid,
    /// La personne affectée.
    pub person_id: Uuid,
    /// Le noeud de rattachement.
    pub node_id: Uuid,
    /// Axe (structure | focus | group).
    pub axis: Axis,
    /// Libellé du rôle joué (texte libre).
    pub role: Option<String>,
    /// `true` = affectation principale (un seul `true` par axe et par
    /// personne, contrainte applicative).
    pub is_primary: bool,
    /// Début de validité (optionnel).
    pub start_date: Option<NaiveDate>,
    /// Fin de validité (optionnel).
    pub end_date: Option<NaiveDate>,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
}
