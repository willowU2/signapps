//! Canonical `org_position_incumbents` table.
//!
//! Un **incumbent** lie une personne à un poste pendant une période
//! donnée. Le nombre d'incumbents **actifs** sur un poste doit rester
//! `<= head_count` (contrainte applicative, pas base).
//!
//! Quand une personne quitte un poste, on positionne `active = false` et
//! `end_date` plutôt que de supprimer — l'historique est conservé via
//! l'audit log (migration 500).

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One `org_position_incumbents` row.
///
/// # Examples
///
/// ```ignore
/// let i = PositionIncumbent {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     position_id: uuid::Uuid::new_v4(),
///     person_id: uuid::Uuid::new_v4(),
///     start_date: chrono::Utc::now().date_naive(),
///     end_date: None,
///     active: true,
///     created_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PositionIncumbent {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire.
    pub tenant_id: Uuid,
    /// Poste occupé.
    pub position_id: Uuid,
    /// Personne qui occupe le siège.
    pub person_id: Uuid,
    /// Début de l'occupation (par défaut jour courant).
    pub start_date: NaiveDate,
    /// Fin optionnelle (`None` = toujours en poste).
    pub end_date: Option<NaiveDate>,
    /// `false` = n'occupe plus le poste (archivage soft).
    pub active: bool,
    /// Date de création du row (UTC).
    pub created_at: DateTime<Utc>,
}
