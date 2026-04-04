//! Governance board models for org nodes.
//!
//! Each org node can have at most one board of governance. Board members have
//! roles and exactly one member should be the decision maker.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ============================================================================
// Board
// ============================================================================

/// A governance board attached to an org node.
///
/// Each node can have at most one board (enforced by UNIQUE on `node_id`).
/// If a node has no board, governance is inherited from its nearest ancestor
/// that does.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgBoard {
    /// Unique identifier for this board.
    pub id: Uuid,
    /// The org node this board is attached to.
    pub node_id: Uuid,
    /// Timestamp of record creation.
    pub created_at: DateTime<Utc>,
    /// Timestamp of last update.
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Board Member
// ============================================================================

/// A member of a governance board with a specific role.
///
/// Exactly one member per board should have `is_decision_maker = true`
/// (enforced at the application level).
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct OrgBoardMember {
    /// Unique identifier for this membership.
    pub id: Uuid,
    /// Board this member belongs to.
    pub board_id: Uuid,
    /// Person serving on the board.
    pub person_id: Uuid,
    /// Role on the board (e.g. `president`, `vice_president`, `member`, `treasurer`, `secretary`).
    pub role: String,
    /// Whether this member is the final decision maker.
    pub is_decision_maker: bool,
    /// Display order within the board.
    pub sort_order: i32,
    /// Date the membership starts.
    pub start_date: Option<NaiveDate>,
    /// Date the membership ends (open-ended if `None`).
    pub end_date: Option<NaiveDate>,
    /// Timestamp of record creation.
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Request payloads
// ============================================================================

/// Request payload to add a member to a board.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateBoardMember {
    /// Person to add to the board.
    pub person_id: Uuid,
    /// Role on the board.
    pub role: String,
    /// Whether this member is the final decision maker.
    pub is_decision_maker: Option<bool>,
    /// Display order within the board.
    pub sort_order: Option<i32>,
    /// Start date of the membership.
    pub start_date: Option<NaiveDate>,
    /// End date of the membership.
    pub end_date: Option<NaiveDate>,
}

/// Request payload to update an existing board member.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateBoardMember {
    /// Updated role on the board.
    pub role: Option<String>,
    /// Updated decision maker status.
    pub is_decision_maker: Option<bool>,
    /// Updated display order.
    pub sort_order: Option<i32>,
    /// Updated end date.
    pub end_date: Option<NaiveDate>,
}

// ============================================================================
// Effective board (with inheritance info)
// ============================================================================

/// Resolved board for a node, which may be inherited from an ancestor.
///
/// When a node has no board of its own, the system walks up the parent chain
/// and returns the first board found, annotated with inheritance metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct EffectiveBoard {
    /// The resolved board.
    pub board: OrgBoard,
    /// Members of the resolved board.
    pub members: Vec<OrgBoardMember>,
    /// If inherited, the node ID the board was inherited from.
    pub inherited_from_node_id: Option<Uuid>,
    /// If inherited, the name of the node the board was inherited from.
    pub inherited_from_node_name: Option<String>,
}
