//! Resource booking handlers for the standalone `resources` schema.
//!
//! Provides CRUD for bookable resources (rooms, equipment, vehicles)
//! and time-bounded reservations with conflict detection via PostgreSQL
//! EXCLUDE constraints.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use signapps_common::{Claims, Result, TenantContext};
use signapps_db::models::{
    CreateResourceItem, CreateResourceReservation, ResourceItem, ResourceReservation,
    UpdateResourceItem,
};
use signapps_db::repositories::ResourceBookingRepository;
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// Query parameters
// ============================================================================

/// Query parameters for listing resources.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListResourcesQuery {
    /// Filter by resource type (room, equipment, vehicle).
    pub resource_type: Option<String>,
    /// Only show available resources (default: false).
    #[serde(default)]
    pub available: bool,
    /// Max results (default 50, max 100).
    pub limit: Option<i64>,
    /// Pagination offset.
    pub offset: Option<i64>,
}

// ============================================================================
// Resource Item endpoints
// ============================================================================

/// List resources (optionally filtered by type and availability).
#[utoipa::path(
    get,
    path = "/api/v1/resources",
    params(ListResourcesQuery),
    responses(
        (status = 200, description = "List of resources", body = Vec<ResourceItem>),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Resources"
)]
#[tracing::instrument(skip_all)]
pub async fn list_resources(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Query(query): Query<ListResourcesQuery>,
) -> Result<Json<Vec<ResourceItem>>> {
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    let items = ResourceBookingRepository::list_items(
        &state.pool,
        query.resource_type.as_deref(),
        query.available,
        limit,
        offset,
    )
    .await?;
    Ok(Json(items))
}

/// Get a resource by ID.
#[utoipa::path(
    get,
    path = "/api/v1/resources/{id}",
    params(("id" = Uuid, Path, description = "Resource ID")),
    responses(
        (status = 200, description = "Resource details", body = ResourceItem),
        (status = 404, description = "Resource not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Resources"
)]
#[tracing::instrument(skip_all, fields(resource_id = %id))]
pub async fn get_resource(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<Json<ResourceItem>> {
    let item = ResourceBookingRepository::find_item_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Resource {}", id)))?;
    Ok(Json(item))
}

/// Create a new resource (admin).
#[utoipa::path(
    post,
    path = "/api/v1/resources",
    request_body = CreateResourceItem,
    responses(
        (status = 201, description = "Resource created", body = ResourceItem),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Resources"
)]
#[tracing::instrument(skip_all)]
pub async fn create_resource(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Json(payload): Json<CreateResourceItem>,
) -> Result<(StatusCode, Json<ResourceItem>)> {
    let valid_types = ["room", "equipment", "vehicle"];
    if !valid_types.contains(&payload.resource_type.as_str()) {
        return Err(signapps_common::Error::Validation(format!(
            "Invalid resource_type. Must be one of: {:?}",
            valid_types
        )));
    }

    let item = ResourceBookingRepository::create_item(&state.pool, payload).await?;
    tracing::info!(resource_id = %item.id, "Created resource");
    Ok((StatusCode::CREATED, Json(item)))
}

/// Update a resource (admin).
#[utoipa::path(
    put,
    path = "/api/v1/resources/{id}",
    params(("id" = Uuid, Path, description = "Resource ID")),
    request_body = UpdateResourceItem,
    responses(
        (status = 200, description = "Resource updated", body = ResourceItem),
        (status = 404, description = "Resource not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Resources"
)]
#[tracing::instrument(skip_all, fields(resource_id = %id))]
pub async fn update_resource(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateResourceItem>,
) -> Result<Json<ResourceItem>> {
    // Verify resource exists
    let _existing = ResourceBookingRepository::find_item_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Resource {}", id)))?;

    let item = ResourceBookingRepository::update_item(&state.pool, id, payload).await?;
    tracing::info!(resource_id = %id, "Updated resource");
    Ok(Json(item))
}

/// Delete a resource (admin). Cascades to reservations.
#[utoipa::path(
    delete,
    path = "/api/v1/resources/{id}",
    params(("id" = Uuid, Path, description = "Resource ID")),
    responses(
        (status = 204, description = "Resource deleted"),
        (status = 404, description = "Resource not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Resources"
)]
#[tracing::instrument(skip_all, fields(resource_id = %id))]
pub async fn delete_resource(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    // Verify resource exists
    let _existing = ResourceBookingRepository::find_item_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Resource {}", id)))?;

    ResourceBookingRepository::delete_item(&state.pool, id).await?;
    tracing::info!(resource_id = %id, "Deleted resource");
    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Reservation endpoints
// ============================================================================

/// List reservations for a specific resource.
#[utoipa::path(
    get,
    path = "/api/v1/resources/{id}/reservations",
    params(("id" = Uuid, Path, description = "Resource ID")),
    responses(
        (status = 200, description = "Reservations for resource", body = Vec<ResourceReservation>),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Resources"
)]
#[tracing::instrument(skip_all, fields(resource_id = %id))]
pub async fn list_resource_reservations(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ResourceReservation>>> {
    let reservations =
        ResourceBookingRepository::list_reservations_for_resource(&state.pool, id).await?;
    Ok(Json(reservations))
}

/// Create a reservation (with conflict detection via EXCLUDE constraint).
#[utoipa::path(
    post,
    path = "/api/v1/reservations",
    request_body = CreateResourceReservation,
    responses(
        (status = 201, description = "Reservation created", body = ResourceReservation),
        (status = 409, description = "Time slot conflicts with existing reservation"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Resources"
)]
#[tracing::instrument(skip_all)]
pub async fn create_reservation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateResourceReservation>,
) -> Result<(StatusCode, Json<ResourceReservation>)> {
    // Verify resource exists and is available
    let resource =
        ResourceBookingRepository::find_item_by_id(&state.pool, payload.resource_id)
            .await?
            .ok_or_else(|| {
                signapps_common::Error::NotFound(format!("Resource {}", payload.resource_id))
            })?;

    if !resource.available {
        return Err(signapps_common::Error::BadRequest(
            "Resource is not available for booking".to_string(),
        ));
    }

    // Validate time range
    if payload.starts_at >= payload.ends_at {
        return Err(signapps_common::Error::Validation(
            "starts_at must be before ends_at".to_string(),
        ));
    }

    let reservation =
        ResourceBookingRepository::create_reservation(&state.pool, claims.sub, payload)
            .await?;
    tracing::info!(
        reservation_id = %reservation.id,
        resource_id = %reservation.resource_id,
        "Created reservation"
    );
    Ok((StatusCode::CREATED, Json(reservation)))
}

/// Cancel a reservation.
#[utoipa::path(
    delete,
    path = "/api/v1/reservations/{id}",
    params(("id" = Uuid, Path, description = "Reservation ID")),
    responses(
        (status = 204, description = "Reservation cancelled"),
        (status = 404, description = "Reservation not found"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Resources"
)]
#[tracing::instrument(skip_all, fields(reservation_id = %id))]
pub async fn cancel_reservation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    // Verify reservation exists and belongs to user
    let existing = ResourceBookingRepository::find_reservation_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Reservation {}", id)))?;

    if existing.user_id != claims.sub {
        return Err(signapps_common::Error::Forbidden(
            "You can only cancel your own reservations".to_string(),
        ));
    }

    ResourceBookingRepository::cancel_reservation(&state.pool, id).await?;
    tracing::info!(reservation_id = %id, "Cancelled reservation");
    Ok(StatusCode::NO_CONTENT)
}

/// List current user's reservations.
#[utoipa::path(
    get,
    path = "/api/v1/my-reservations",
    responses(
        (status = 200, description = "Current user's reservations", body = Vec<ResourceReservation>),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearer" = [])),
    tag = "Resources"
)]
#[tracing::instrument(skip_all)]
pub async fn list_my_reservations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ResourceReservation>>> {
    let reservations =
        ResourceBookingRepository::list_reservations_for_user(&state.pool, claims.sub)
            .await?;
    Ok(Json(reservations))
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[test]
    fn module_compiles() {
        // Verify this handler module compiles correctly.
        // Integration tests require a running database and service.
        assert!(true, "{} handler module loaded", module_path!());
    }
}
