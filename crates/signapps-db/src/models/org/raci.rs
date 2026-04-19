//! Canonical `org_raci` table — RACI matrix (SO2 governance).
//!
//! Une **entrée RACI** associe une personne à un projet (un node
//! `attributes.axis_type='project'`) avec un rôle dans
//! `{responsible, accountable, consulted, informed}`. Un projet a au
//! plus un accountable (contrainte SQL `idx_raci_one_accountable`).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Rôle RACI.
///
/// - `Responsible` — Execute the work.
/// - `Accountable` — Owns the outcome. At most one per project.
/// - `Consulted`   — Provides input before decision.
/// - `Informed`    — Kept in the loop after the fact.
///
/// Stored as lowercase `VARCHAR(16)` (`responsible`, `accountable`,
/// `consulted`, `informed`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum RaciRole {
    /// Exécute le travail.
    Responsible,
    /// Propriétaire unique (max 1 par projet).
    Accountable,
    /// Consulté avant décision.
    Consulted,
    /// Informé a posteriori.
    Informed,
}

/// One `org_raci` row.
///
/// # Examples
///
/// ```ignore
/// let r = Raci {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     project_id: uuid::Uuid::new_v4(),
///     person_id: uuid::Uuid::new_v4(),
///     role: RaciRole::Accountable,
///     created_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Raci {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Projet (un `org_nodes` avec `attributes.axis_type='project'`).
    pub project_id: Uuid,
    /// Personne concernée.
    pub person_id: Uuid,
    /// Rôle RACI.
    pub role: RaciRole,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
}
