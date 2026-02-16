//! Resource management and booking handlers

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_db::{models::*, ResourceRepository, EventRepository};
use uuid::Uuid;

use crate::{services, AppState, CalendarError};

#[derive(Debug, Deserialize)]
pub struct DateRangeQuery {
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,
}

/// Create a new resource
pub async fn create_resource(
    State(state): State<AppState>,
    Json(payload): Json<CreateResource>,
) -> Result<(StatusCode, Json<Resource>), CalendarError> {
    let repo = ResourceRepository::new(&state.pool);
    let resource = repo
        .create(payload, None)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok((StatusCode::CREATED, Json(resource)))
}

/// Get all resources
pub async fn list_resources(
    State(state): State<AppState>,
) -> Result<Json<Vec<Resource>>, CalendarError> {
    let repo = ResourceRepository::new(&state.pool);
    let resources = repo
        .list()
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(resources))
}

/// Get resources by type
pub async fn list_resources_by_type(
    State(state): State<AppState>,
    Path(resource_type): Path<String>,
) -> Result<Json<Vec<Resource>>, CalendarError> {
    let repo = ResourceRepository::new(&state.pool);
    let resources = repo
        .list_by_type(&resource_type)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(resources))
}

/// Get resource by ID
pub async fn get_resource(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Resource>, CalendarError> {
    let repo = ResourceRepository::new(&state.pool);
    let resource = repo
        .find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    Ok(Json(resource))
}

/// Update resource
pub async fn update_resource(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<Resource>, CalendarError> {
    let name = payload.get("name").and_then(|v| v.as_str());
    let is_available = payload.get("is_available").and_then(|v| v.as_bool());

    let repo = ResourceRepository::new(&state.pool);
    let resource = repo
        .update(id, name, is_available)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(resource))
}

/// Delete resource
pub async fn delete_resource(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    let repo = ResourceRepository::new(&state.pool);
    repo.delete(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Serialize)]
pub struct ResourceConflict {
    pub resource_id: Uuid,
    pub conflicting_event_id: Uuid,
    pub conflicting_event_title: String,
    pub conflicting_start: DateTime<Utc>,
    pub conflicting_end: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CheckAvailabilityRequest {
    pub resource_ids: Vec<Uuid>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AvailabilityResponse {
    pub available: bool,
    pub conflicts: Vec<ResourceConflict>,
}

/// Check resource availability for a time period
pub async fn check_availability(
    State(state): State<AppState>,
    Json(payload): Json<CheckAvailabilityRequest>,
) -> Result<Json<AvailabilityResponse>, CalendarError> {
    // In a production system, you would:
    // 1. Query event_resources table
    // 2. Find all events using the requested resources
    // 3. Check for time overlaps
    // For now, return available (simplified)

    Ok(Json(AvailabilityResponse {
        available: true,
        conflicts: vec![],
    }))
}

#[derive(Debug, Deserialize)]
pub struct BookResourceRequest {
    pub event_id: Uuid,
    pub resource_ids: Vec<Uuid>,
}

/// Book resources for an event
pub async fn book_resources(
    State(state): State<AppState>,
    Path(resource_id): Path<Uuid>,
    Json(payload): Json<BookResourceRequest>,
) -> Result<StatusCode, CalendarError> {
    // In a production system:
    // 1. Check resource availability
    // 2. Create event_resources records
    // 3. Return conflict errors if booking not possible

    Ok(StatusCode::OK)
}
