//! Canonical `org_boards` and `org_board_members` tables.
//!
//! A board materialises a governance group attached to an org node
//! (one board per node thanks to the UNIQUE constraint). Board
//! members are persons; at most one member is the
//! **decision maker** (`is_decision_maker = true`), the API layer
//! enforces that invariant inside a transaction.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// One board row, attached 1:1 to an org node.
///
/// # Examples
///
/// ```ignore
/// let b = Board {
///     id: uuid::Uuid::new_v4(),
///     node_id: uuid::Uuid::new_v4(),
///     created_at: chrono::Utc::now(),
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct Board {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Noeud d'organisation auquel le board est rattaché (UNIQUE).
    pub node_id: Uuid,
    /// Date de création (UTC).
    pub created_at: DateTime<Utc>,
}

/// One member of a board.
///
/// # Examples
///
/// ```ignore
/// let m = BoardMember {
///     id: uuid::Uuid::new_v4(),
///     board_id: uuid::Uuid::new_v4(),
///     person_id: uuid::Uuid::new_v4(),
///     role: "chair".into(),
///     is_decision_maker: true,
///     sort_order: 0,
/// };
/// ```
///
/// # Panics
///
/// Aucun panic.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct BoardMember {
    /// Identifiant unique (UUID v4).
    pub id: Uuid,
    /// Board parent.
    pub board_id: Uuid,
    /// Personne membre.
    pub person_id: Uuid,
    /// Libellé du rôle (chair, secretary, member, ...).
    pub role: String,
    /// `true` = décisionnaire (au plus un par board, contrainte
    /// applicative en W2).
    pub is_decision_maker: bool,
    /// Ordre d'affichage (0 = premier).
    pub sort_order: i32,
}
