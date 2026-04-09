//! Resource booking models for the `resources` schema.
//!
//! Standalone resource items (rooms, equipment, vehicles) and reservations
//! with PostgreSQL EXCLUDE constraint for conflict-free booking.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

// ============================================================================
// Resource Item
// ============================================================================

/// A bookable resource (room, equipment, vehicle) in the `resources.items` table.
///
/// # Examples
///
/// ```rust,ignore
/// let room = ResourceItem { name: "Salle A".into(), resource_type: "room".into(), ..Default::default() };
/// ```
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ResourceItem {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Display name.
    pub name: String,
    /// Resource category: `room`, `equipment`, `vehicle`.
    pub resource_type: String,
    /// Optional description.
    pub description: Option<String>,
    /// Physical location.
    pub location: Option<String>,
    /// Capacity (e.g., number of seats for a room).
    pub capacity: Option<i32>,
    /// List of amenities (e.g., projector, whiteboard).
    pub amenities: Vec<String>,
    /// URL to a resource image.
    pub image_url: Option<String>,
    /// Whether the resource is available for booking.
    pub available: bool,
    /// Arbitrary metadata (JSON).
    pub metadata: serde_json::Value,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last-updated timestamp.
    pub updated_at: DateTime<Utc>,
}

/// Request payload to create a new resource item.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateResourceItem {
    /// Display name.
    pub name: String,
    /// Resource category: `room`, `equipment`, `vehicle`.
    pub resource_type: String,
    /// Optional description.
    pub description: Option<String>,
    /// Physical location.
    pub location: Option<String>,
    /// Capacity (e.g., seats).
    pub capacity: Option<i32>,
    /// Amenities list.
    pub amenities: Option<Vec<String>>,
    /// Image URL.
    pub image_url: Option<String>,
    /// Arbitrary metadata.
    pub metadata: Option<serde_json::Value>,
}

/// Request payload to update an existing resource item.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateResourceItem {
    /// Display name.
    pub name: Option<String>,
    /// Resource category.
    pub resource_type: Option<String>,
    /// Description.
    pub description: Option<String>,
    /// Location.
    pub location: Option<String>,
    /// Capacity.
    pub capacity: Option<i32>,
    /// Amenities.
    pub amenities: Option<Vec<String>>,
    /// Image URL.
    pub image_url: Option<String>,
    /// Availability flag.
    pub available: Option<bool>,
    /// Metadata.
    pub metadata: Option<serde_json::Value>,
}

// ============================================================================
// Resource Reservation
// ============================================================================

/// A time-bounded reservation on a resource in `resources.reservations`.
///
/// The database EXCLUDE constraint prevents overlapping non-cancelled
/// reservations on the same resource.
///
/// # Errors
///
/// Repository methods return `Error::Database` on constraint violations
/// (including booking conflicts).
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ResourceReservation {
    /// Unique identifier (UUID v4).
    pub id: Uuid,
    /// Resource being reserved.
    pub resource_id: Uuid,
    /// User who made the reservation.
    pub user_id: Uuid,
    /// Reservation title / purpose.
    pub title: String,
    /// Start time.
    pub starts_at: DateTime<Utc>,
    /// End time.
    pub ends_at: DateTime<Utc>,
    /// Status: `pending`, `confirmed`, `cancelled`, `completed`.
    pub status: String,
    /// Optional notes.
    pub notes: Option<String>,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
}

/// Request payload to create a new reservation.
#[derive(Debug, Clone, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateResourceReservation {
    /// Resource to reserve.
    pub resource_id: Uuid,
    /// Title / purpose.
    pub title: String,
    /// Start time.
    pub starts_at: DateTime<Utc>,
    /// End time.
    pub ends_at: DateTime<Utc>,
    /// Optional notes.
    pub notes: Option<String>,
}
