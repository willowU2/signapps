//! Audit Handlers
//!
//! Query endpoints for the org structure audit log.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};
use signapps_db::models::org_audit::AuditQuery;
use signapps_db::repositories::core_org_repository::AuditRepository;

// ============================================================================
// Query params
// ============================================================================

/// Query parameters for the audit log endpoint.
#[derive(Debug, Deserialize, Default)]
pub struct AuditQueryParams {
    /// Optional filter by entity type.
    pub entity_type: Option<String>,
    /// Optional filter by entity UUID.
    pub entity_id: Option<Uuid>,
    /// Optional filter by actor UUID.
    pub actor_id: Option<Uuid>,
    /// Optional filter by action name.
    pub action: Option<String>,
    /// Optional lower bound on created_at.
    pub from_date: Option<DateTime<Utc>>,
    /// Optional upper bound on created_at.
    pub to_date: Option<DateTime<Utc>>,
    /// Maximum number of results (default 50).
    pub limit: Option<i64>,
    /// Number of results to skip for pagination.
    pub offset: Option<i64>,
}

// ============================================================================
// Handlers
// ============================================================================

/// Query the org audit log with flexible filters.
///
/// # Errors
///
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/audit",
    params(
        ("entity_type" = Option<String>, Query, description = "Filter by entity type"),
        ("entity_id" = Option<Uuid>, Query, description = "Filter by entity UUID"),
        ("actor_id" = Option<Uuid>, Query, description = "Filter by actor UUID"),
        ("action" = Option<String>, Query, description = "Filter by action name"),
        ("from_date" = Option<String>, Query, description = "Lower bound on created_at (ISO 8601)"),
        ("to_date" = Option<String>, Query, description = "Upper bound on created_at (ISO 8601)"),
        ("limit" = Option<i64>, Query, description = "Max results (default 50)"),
        ("offset" = Option<i64>, Query, description = "Offset for pagination"),
    ),
    responses(
        (status = 200, description = "Audit log entries"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Audit"
)]
#[tracing::instrument(skip_all)]
pub async fn query_audit(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<AuditQueryParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let query = AuditQuery {
        tenant_id: ctx.tenant_id,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        actor_id: params.actor_id,
        action: params.action,
        from_date: params.from_date,
        to_date: params.to_date,
        limit: params.limit,
        offset: params.offset,
    };

    let entries = AuditRepository::query_audit(&state.pool, query)
        .await
        .map_err(|e| {
            tracing::error!("Failed to query audit log: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(json!(entries)))
}

/// Get the full change history for a specific entity.
///
/// # Errors
///
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/audit/entity/{entity_type}/{entity_id}",
    params(
        ("entity_type" = String, Path, description = "Entity type (e.g. org_node, group)"),
        ("entity_id" = Uuid, Path, description = "Entity UUID"),
    ),
    responses(
        (status = 200, description = "Entity change history"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Audit"
)]
#[tracing::instrument(skip_all)]
pub async fn entity_history(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
) -> Result<impl IntoResponse, StatusCode> {
    let entries =
        AuditRepository::get_entity_history(&state.pool, ctx.tenant_id, &entity_type, entity_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get entity history: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    Ok(Json(json!(entries)))
}

/// Get audit log entries for a specific actor.
///
/// # Errors
///
/// Returns `500` if the database query fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/audit/actor/{actor_id}",
    params(("actor_id" = Uuid, Path, description = "Actor UUID")),
    responses(
        (status = 200, description = "Actor audit history"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Audit"
)]
#[tracing::instrument(skip_all)]
pub async fn actor_history(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(actor_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let query = AuditQuery {
        tenant_id: ctx.tenant_id,
        entity_type: None,
        entity_id: None,
        actor_id: Some(actor_id),
        action: None,
        from_date: None,
        to_date: None,
        limit: Some(100),
        offset: None,
    };

    let entries = AuditRepository::query_audit(&state.pool, query)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get actor history: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(json!(entries)))
}
