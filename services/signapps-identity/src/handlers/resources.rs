//! Resource management handlers (rooms, equipment, reservations).

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result, TenantContext};
use signapps_db::models::{
    CreateReservation, CreateResourceType, CreateTenantResource, UpdateReservationStatus,
    UpdateTenantResource,
};
use signapps_db::repositories::{
    ReservationRepository, ResourceTypeRepository, TenantResourceRepository,
};
use uuid::Uuid;
use validator::Validate;

use crate::AppState;

// ============================================================================
// Resource Type Endpoints
// ============================================================================

/// Resource type response DTO.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for ResourceType.
pub struct ResourceTypeResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub requires_approval: bool,
    pub created_at: String,
}

impl From<signapps_db::models::ResourceType> for ResourceTypeResponse {
    fn from(rt: signapps_db::models::ResourceType) -> Self {
        Self {
            id: rt.id,
            tenant_id: rt.tenant_id,
            name: rt.name,
            icon: rt.icon,
            color: rt.color,
            requires_approval: rt.requires_approval,
            created_at: rt.created_at.to_rfc3339(),
        }
    }
}

/// Create resource type request.
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for CreateResourceType.
pub struct CreateResourceTypeRequest {
    #[validate(length(min = 2, max = 64))]
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub requires_approval: Option<bool>,
}

/// List resource types for current tenant.
#[utoipa::path(
    get,
    path = "/api/v1/resource-types",
    tag = "resources",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Resource type list", body = Vec<ResourceTypeResponse>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list_resource_types(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<Json<Vec<ResourceTypeResponse>>> {
    let types = ResourceTypeRepository::list_by_tenant(&state.pool, ctx.tenant_id).await?;
    let response: Vec<ResourceTypeResponse> =
        types.into_iter().map(ResourceTypeResponse::from).collect();
    Ok(Json(response))
}

/// Create a new resource type.
#[utoipa::path(
    post,
    path = "/api/v1/resource-types",
    tag = "resources",
    security(("bearerAuth" = [])),
    request_body = CreateResourceTypeRequest,
    responses(
        (status = 201, description = "Resource type created", body = ResourceTypeResponse),
        (status = 401, description = "Not authenticated"),
        (status = 422, description = "Validation error"),
    )
)]
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn create_resource_type(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Json(payload): Json<CreateResourceTypeRequest>,
) -> Result<(StatusCode, Json<ResourceTypeResponse>)> {
    payload
        .validate()
        .map_err(|e| Error::Validation(e.to_string()))?;

    let create = CreateResourceType {
        name: payload.name,
        icon: payload.icon,
        color: payload.color,
        requires_approval: payload.requires_approval,
    };

    let resource_type = ResourceTypeRepository::create(&state.pool, ctx.tenant_id, create).await?;
    tracing::info!(resource_type_id = %resource_type.id, "Created resource type");

    Ok((
        StatusCode::CREATED,
        Json(ResourceTypeResponse::from(resource_type)),
    ))
}

/// Delete a resource type.
#[utoipa::path(
    delete,
    path = "/api/v1/resource-types/{id}",
    tag = "resources",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Resource type UUID")),
    responses(
        (status = 204, description = "Resource type deleted"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn delete_resource_type(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    ResourceTypeRepository::delete(&state.pool, id).await?;
    tracing::info!(resource_type_id = %id, "Deleted resource type");
    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Resource Endpoints (Rooms, Equipment, etc.)
// ============================================================================

/// Query parameters for listing resources.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ListResourcesQuery {
    pub resource_type: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Resource response DTO.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Resource.
pub struct ResourceResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub resource_type_id: Option<Uuid>,
    pub name: String,
    pub resource_type: String,
    pub description: Option<String>,
    pub capacity: Option<i32>,
    pub location: Option<String>,
    pub floor: Option<String>,
    pub building: Option<String>,
    pub amenities: Option<Vec<String>>,
    pub photo_urls: Option<Vec<String>>,
    pub requires_approval: bool,
    pub is_available: bool,
    pub created_at: String,
}

impl From<signapps_db::models::TenantResource> for ResourceResponse {
    fn from(r: signapps_db::models::TenantResource) -> Self {
        Self {
            id: r.id,
            tenant_id: r.tenant_id,
            resource_type_id: r.resource_type_id,
            name: r.name,
            resource_type: r.resource_type,
            description: r.description,
            capacity: r.capacity,
            location: r.location,
            floor: r.floor,
            building: r.building,
            amenities: r.amenities,
            photo_urls: r.photo_urls,
            requires_approval: r.requires_approval,
            is_available: r.is_available,
            created_at: r.created_at.to_rfc3339(),
        }
    }
}

/// Create resource request.
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for CreateResource.
pub struct CreateResourceRequest {
    pub resource_type_id: Option<Uuid>,
    #[validate(length(min = 2, max = 255))]
    pub name: String,
    #[validate(length(min = 2, max = 64))]
    pub resource_type: String, // room, equipment, vehicle, desk
    #[validate(length(max = 1000))]
    pub description: Option<String>,
    pub capacity: Option<i32>,
    pub location: Option<String>,
    pub floor: Option<String>,
    pub building: Option<String>,
    pub amenities: Option<Vec<String>>,
    pub requires_approval: Option<bool>,
    pub approver_ids: Option<Vec<Uuid>>,
}

/// Update resource request.
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for UpdateResource.
pub struct UpdateResourceRequest {
    #[validate(length(min = 2, max = 255))]
    pub name: Option<String>,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
    pub capacity: Option<i32>,
    pub location: Option<String>,
    pub floor: Option<String>,
    pub building: Option<String>,
    pub amenities: Option<Vec<String>>,
    pub photo_urls: Option<Vec<String>>,
    pub requires_approval: Option<bool>,
    pub approver_ids: Option<Vec<Uuid>>,
    pub is_available: Option<bool>,
}

/// List resources for current tenant.
#[utoipa::path(
    get,
    path = "/api/v1/resources",
    tag = "resources",
    security(("bearerAuth" = [])),
    params(
        ("resource_type" = Option<String>, Query, description = "Filter by resource type"),
        ("limit" = Option<i64>, Query, description = "Max results (default 50)"),
        ("offset" = Option<i64>, Query, description = "Pagination offset"),
    ),
    responses(
        (status = 200, description = "Resource list", body = Vec<ResourceResponse>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list_resources(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Query(query): Query<ListResourcesQuery>,
) -> Result<Json<Vec<ResourceResponse>>> {
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    let resources = TenantResourceRepository::list_by_tenant(
        &state.pool,
        ctx.tenant_id,
        query.resource_type.as_deref(),
        limit,
        offset,
    )
    .await?;

    let response: Vec<ResourceResponse> =
        resources.into_iter().map(ResourceResponse::from).collect();
    Ok(Json(response))
}

/// Get resource by ID.
#[utoipa::path(
    get,
    path = "/api/v1/resources/{id}",
    tag = "resources",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Resource UUID")),
    responses(
        (status = 200, description = "Resource detail", body = ResourceResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Resource not found"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn get_resource(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ResourceResponse>> {
    let resource = TenantResourceRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Resource {}", id)))?;
    Ok(Json(ResourceResponse::from(resource)))
}

/// Create a new resource.
#[utoipa::path(
    post,
    path = "/api/v1/resources",
    tag = "resources",
    security(("bearerAuth" = [])),
    request_body = CreateResourceRequest,
    responses(
        (status = 201, description = "Resource created", body = ResourceResponse),
        (status = 401, description = "Not authenticated"),
        (status = 422, description = "Validation error"),
    )
)]
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn create_resource(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateResourceRequest>,
) -> Result<(StatusCode, Json<ResourceResponse>)> {
    payload
        .validate()
        .map_err(|e| Error::Validation(e.to_string()))?;

    // Validate resource_type
    let valid_types = ["room", "equipment", "vehicle", "desk"];
    if !valid_types.contains(&payload.resource_type.as_str()) {
        return Err(Error::Validation(format!(
            "Invalid resource_type. Must be one of: {:?}",
            valid_types
        )));
    }

    let create = CreateTenantResource {
        resource_type_id: payload.resource_type_id,
        name: payload.name,
        resource_type: payload.resource_type,
        description: payload.description,
        capacity: payload.capacity,
        location: payload.location,
        floor: payload.floor,
        building: payload.building,
        amenities: payload.amenities,
        requires_approval: payload.requires_approval,
        approver_ids: payload.approver_ids,
    };

    let resource =
        TenantResourceRepository::create(&state.pool, ctx.tenant_id, claims.sub, create).await?;
    tracing::info!(resource_id = %resource.id, "Created resource");

    Ok((StatusCode::CREATED, Json(ResourceResponse::from(resource))))
}

/// Update a resource.
#[utoipa::path(
    put,
    path = "/api/v1/resources/{id}",
    tag = "resources",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Resource UUID")),
    request_body = UpdateResourceRequest,
    responses(
        (status = 200, description = "Resource updated", body = ResourceResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Resource not found"),
        (status = 422, description = "Validation error"),
    )
)]
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn update_resource(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateResourceRequest>,
) -> Result<Json<ResourceResponse>> {
    payload
        .validate()
        .map_err(|e| Error::Validation(e.to_string()))?;

    // Verify resource exists
    let _existing = TenantResourceRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Resource {}", id)))?;

    let update = UpdateTenantResource {
        name: payload.name,
        description: payload.description,
        capacity: payload.capacity,
        location: payload.location,
        floor: payload.floor,
        building: payload.building,
        amenities: payload.amenities,
        photo_urls: payload.photo_urls,
        availability_rules: None,
        booking_rules: None,
        requires_approval: payload.requires_approval,
        approver_ids: payload.approver_ids,
        is_available: payload.is_available,
    };

    let resource = TenantResourceRepository::update(&state.pool, id, update).await?;
    tracing::info!(resource_id = %id, "Updated resource");

    Ok(Json(ResourceResponse::from(resource)))
}

/// Delete a resource.
#[utoipa::path(
    delete,
    path = "/api/v1/resources/{id}",
    tag = "resources",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Resource UUID")),
    responses(
        (status = 204, description = "Resource deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Resource not found"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn delete_resource(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    // Verify resource exists
    let _existing = TenantResourceRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Resource {}", id)))?;

    TenantResourceRepository::delete(&state.pool, id).await?;
    tracing::info!(resource_id = %id, "Deleted resource");

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Reservation Endpoints
// ============================================================================

/// Query parameters for listing reservations.
#[derive(Debug, Deserialize)]
/// Query parameters for filtering results.
pub struct ListReservationsQuery {
    pub resource_id: Option<Uuid>,
    pub status: Option<String>,
}

/// Reservation response DTO.
#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response for Reservation.
pub struct ReservationResponse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub resource_id: Uuid,
    pub event_id: Option<Uuid>,
    pub requested_by: Uuid,
    pub status: String,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<String>,
    pub rejection_reason: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

impl From<signapps_db::models::Reservation> for ReservationResponse {
    fn from(r: signapps_db::models::Reservation) -> Self {
        Self {
            id: r.id,
            tenant_id: r.tenant_id,
            resource_id: r.resource_id,
            event_id: r.event_id,
            requested_by: r.requested_by,
            status: r.status,
            approved_by: r.approved_by,
            approved_at: r.approved_at.map(|dt| dt.to_rfc3339()),
            rejection_reason: r.rejection_reason,
            notes: r.notes,
            created_at: r.created_at.to_rfc3339(),
        }
    }
}

/// Create reservation request.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for CreateReservation.
pub struct CreateReservationRequest {
    pub resource_id: Uuid,
    pub event_id: Option<Uuid>,
    pub notes: Option<String>,
}

/// Update reservation status request.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for UpdateReservationStatus.
pub struct UpdateReservationStatusRequest {
    pub status: String, // approved, rejected, cancelled
    pub rejection_reason: Option<String>,
}

/// List reservations.
#[utoipa::path(
    get,
    path = "/api/v1/reservations",
    tag = "resources",
    security(("bearerAuth" = [])),
    params(
        ("resource_id" = Option<Uuid>, Query, description = "Filter by resource UUID (required)"),
        ("status" = Option<String>, Query, description = "Filter by status"),
    ),
    responses(
        (status = 200, description = "Reservation list", body = Vec<ReservationResponse>),
        (status = 400, description = "resource_id required"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list_reservations(
    State(state): State<AppState>,
    Query(query): Query<ListReservationsQuery>,
) -> Result<Json<Vec<ReservationResponse>>> {
    let resource_id = query
        .resource_id
        .ok_or_else(|| Error::BadRequest("resource_id is required".to_string()))?;

    let reservations =
        ReservationRepository::list_by_resource(&state.pool, resource_id, query.status.as_deref())
            .await?;

    let response: Vec<ReservationResponse> = reservations
        .into_iter()
        .map(ReservationResponse::from)
        .collect();
    Ok(Json(response))
}

/// List pending reservations for approval (for current user as approver).
#[utoipa::path(
    get,
    path = "/api/v1/reservations/pending",
    tag = "resources",
    security(("bearerAuth" = [])),
    responses(
        (status = 200, description = "Pending reservations awaiting approval", body = Vec<ReservationResponse>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list_pending_reservations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ReservationResponse>>> {
    let reservations =
        ReservationRepository::list_pending_for_approver(&state.pool, claims.sub).await?;

    let response: Vec<ReservationResponse> = reservations
        .into_iter()
        .map(ReservationResponse::from)
        .collect();
    Ok(Json(response))
}

/// List reservations for current user (my reservations).
#[utoipa::path(
    get,
    path = "/api/v1/reservations/mine",
    tag = "resources",
    security(("bearerAuth" = [])),
    params(
        ("status" = Option<String>, Query, description = "Filter by status"),
    ),
    responses(
        (status = 200, description = "Current user's reservations", body = Vec<ReservationResponse>),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn list_my_reservations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListReservationsQuery>,
) -> Result<Json<Vec<ReservationResponse>>> {
    let reservations =
        ReservationRepository::list_by_user(&state.pool, claims.sub, query.status.as_deref())
            .await?;

    let response: Vec<ReservationResponse> = reservations
        .into_iter()
        .map(ReservationResponse::from)
        .collect();
    Ok(Json(response))
}

/// Get reservation by ID.
#[utoipa::path(
    get,
    path = "/api/v1/reservations/{id}",
    tag = "resources",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Reservation UUID")),
    responses(
        (status = 200, description = "Reservation detail", body = ReservationResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Reservation not found"),
    )
)]
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn get_reservation(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ReservationResponse>> {
    let reservation = ReservationRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Reservation {}", id)))?;
    Ok(Json(ReservationResponse::from(reservation)))
}

/// Create a new reservation.
#[utoipa::path(
    post,
    path = "/api/v1/reservations",
    tag = "resources",
    security(("bearerAuth" = [])),
    request_body = CreateReservationRequest,
    responses(
        (status = 201, description = "Reservation created", body = ReservationResponse),
        (status = 400, description = "Resource not available"),
        (status = 401, description = "Not authenticated"),
    )
)]
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn create_reservation(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateReservationRequest>,
) -> Result<(StatusCode, Json<ReservationResponse>)> {
    // Verify resource exists and is available
    let resource = TenantResourceRepository::find_by_id(&state.pool, payload.resource_id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Resource {}", payload.resource_id)))?;

    if !resource.is_available {
        return Err(Error::BadRequest(
            "Resource is not available for booking".to_string(),
        ));
    }

    let create = CreateReservation {
        resource_id: payload.resource_id,
        event_id: payload.event_id,
        notes: payload.notes,
    };

    let reservation =
        ReservationRepository::create(&state.pool, ctx.tenant_id, claims.sub, create).await?;

    tracing::info!(
        reservation_id = %reservation.id,
        resource_id = %payload.resource_id,
        status = %reservation.status,
        "Created reservation"
    );

    Ok((
        StatusCode::CREATED,
        Json(ReservationResponse::from(reservation)),
    ))
}

/// Update reservation status (approve/reject/cancel).
#[utoipa::path(
    put,
    path = "/api/v1/reservations/{id}/status",
    tag = "resources",
    security(("bearerAuth" = [])),
    params(("id" = Uuid, Path, description = "Reservation UUID")),
    request_body = UpdateReservationStatusRequest,
    responses(
        (status = 200, description = "Reservation status updated", body = ReservationResponse),
        (status = 400, description = "Invalid status or reservation already processed"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Reservation not found"),
    )
)]
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn update_reservation_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateReservationStatusRequest>,
) -> Result<Json<ReservationResponse>> {
    // Validate status
    let valid_statuses = ["approved", "rejected", "cancelled"];
    if !valid_statuses.contains(&payload.status.as_str()) {
        return Err(Error::Validation(format!(
            "Invalid status. Must be one of: {:?}",
            valid_statuses
        )));
    }

    // Verify reservation exists
    let existing = ReservationRepository::find_by_id(&state.pool, id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Reservation {}", id)))?;

    // Check if already processed
    if existing.status != "pending" && payload.status != "cancelled" {
        return Err(Error::BadRequest(format!(
            "Reservation is already {}",
            existing.status
        )));
    }

    let update = UpdateReservationStatus {
        status: payload.status.clone(),
        rejection_reason: payload.rejection_reason,
    };

    let reservation =
        ReservationRepository::update_status(&state.pool, id, claims.sub, update).await?;

    tracing::info!(
        reservation_id = %id,
        new_status = %payload.status,
        approver_id = %claims.sub,
        "Updated reservation status"
    );

    Ok(Json(ReservationResponse::from(reservation)))
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
