//! Canonical `org_board_votes` table — SO2 governance.
//!
//! Un vote est l'expression **unique** d'une personne sur une décision.
//! Le couple `(decision_id, person_id)` est UNIQUE — une personne qui
//! change d'avis met à jour la ligne existante (upsert).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Vote kind.
///
/// Stored as lowercase `VARCHAR(8)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum VoteKind {
    /// Pour.
    For,
    /// Contre.
    Against,
    /// Abstention.
    Abstain,
}

/// One `org_board_votes` row.
///
/// # Examples
///
/// ```ignore
/// let v = BoardVote {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     decision_id: uuid::Uuid::new_v4(),
///     person_id: uuid::Uuid::new_v4(),
///     vote: VoteKind::For,
///     rationale: Some("aligné avec la stratégie 2026".into()),
///     voted_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct BoardVote {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Décision votée.
    pub decision_id: Uuid,
    /// Personne qui vote.
    pub person_id: Uuid,
    /// Sens du vote.
    pub vote: VoteKind,
    /// Justification libre.
    pub rationale: Option<String>,
    /// Date du vote (UTC).
    pub voted_at: DateTime<Utc>,
}
