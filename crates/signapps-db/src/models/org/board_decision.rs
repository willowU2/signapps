//! Canonical `org_board_decisions` table — SO2 governance.
//!
//! A **decision** is the artefact of a board's deliberation. It carries
//! a status lifecycle `proposed -> {approved,rejected,deferred}` and an
//! optional `decided_at` / `decided_by_person_id` stamp once closed.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Status lifecycle of a board decision.
///
/// Stored as lowercase `VARCHAR(16)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum DecisionStatus {
    /// Décision proposée, en attente.
    Proposed,
    /// Décision approuvée.
    Approved,
    /// Décision rejetée.
    Rejected,
    /// Décision reportée à plus tard.
    Deferred,
}

/// One `org_board_decisions` row.
///
/// # Examples
///
/// ```ignore
/// let d = BoardDecision {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     board_id: uuid::Uuid::new_v4(),
///     title: "Embaucher 3 SRE Q2 2026".into(),
///     description: Some("Réunion du 2026-04-15".into()),
///     status: DecisionStatus::Proposed,
///     decided_at: None,
///     decided_by_person_id: None,
///     attributes: serde_json::json!({}),
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
pub struct BoardDecision {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Board qui porte la décision.
    pub board_id: Uuid,
    /// Titre court.
    pub title: String,
    /// Description longue (markdown possible).
    pub description: Option<String>,
    /// Statut courant.
    pub status: DecisionStatus,
    /// Date de clôture (UTC, NULL tant que `proposed`).
    pub decided_at: Option<DateTime<Utc>>,
    /// Personne qui a clôturé la décision.
    pub decided_by_person_id: Option<Uuid>,
    /// Métadonnées libres (motion number, attachments, ...).
    pub attributes: serde_json::Value,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}
