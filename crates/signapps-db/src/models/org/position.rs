//! Canonical `org_positions` table.
//!
//! Une **position** représente un siège typé sous un noeud. Elle est
//! distincte d'une [`Person`](super::person::Person) : plusieurs personnes
//! peuvent occuper successivement le même poste, et un poste peut avoir
//! plusieurs sièges (`head_count > 1`) — typique pour des postes
//! standardisés ("Senior Platform Engineer, 3 sièges dont 2 pourvus").
//!
//! Voir [`PositionIncumbent`](super::position_incumbent::PositionIncumbent)
//! pour savoir **qui** occupe quel siège, avec bornes temporelles.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One `org_positions` row.
///
/// # Examples
///
/// ```ignore
/// let p = Position {
///     id: uuid::Uuid::new_v4(),
///     tenant_id: uuid::Uuid::new_v4(),
///     node_id: uuid::Uuid::new_v4(),
///     title: "Senior Platform Engineer".into(),
///     head_count: 3,
///     attributes: serde_json::json!({"level": "senior"}),
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
pub struct Position {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Tenant propriétaire du poste.
    pub tenant_id: Uuid,
    /// Noeud auquel le poste est rattaché.
    pub node_id: Uuid,
    /// Libellé officiel du poste ("Head of Growth", "Senior Dev", ...).
    pub title: String,
    /// Nombre de sièges ouverts sur ce poste (`>= 0`).
    pub head_count: i32,
    /// Métadonnées extensibles (JSONB) — level, grade, remote_ok, ...
    pub attributes: serde_json::Value,
    /// `false` = poste archivé.
    pub active: bool,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
    /// Date de dernière modification (UTC).
    pub updated_at: DateTime<Utc>,
}
