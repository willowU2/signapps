//! Delegation Handlers
//!
//! CRUD operations for scoped management delegations.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};
use signapps_db::models::org_audit::CreateAuditEntry;
use signapps_db::models::org_delegations::{CreateDelegation, UpdateDelegation};
use signapps_db::repositories::core_org_repository::{AuditRepository, DelegationRepository};

// ============================================================================
// Handlers
// ============================================================================

/// List all active delegations for the current tenant.
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
    path = "/api/v1/workforce/delegations",
    responses(
        (status = 200, description = "List of active delegations"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Delegations"
)]
#[tracing::instrument(skip_all)]
pub async fn list_delegations(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let delegations = DelegationRepository::list_delegations(&state.pool, ctx.tenant_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list delegations: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(json!(delegations)))
}

/// Create a new delegation.
///
/// # Errors
///
/// Returns `500` if the database insert fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/delegations",
    request_body = CreateDelegation,
    responses(
        (status = 201, description = "Delegation created"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Delegations"
)]
#[tracing::instrument(skip_all)]
pub async fn create_delegation(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<CreateDelegation>,
) -> Result<impl IntoResponse, StatusCode> {
    let delegation =
        DelegationRepository::create_delegation(&state.pool, ctx.tenant_id, input)
            .await
            .map_err(|e| {
                tracing::error!("Failed to create delegation: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let _ = AuditRepository::log_audit(
        &state.pool,
        CreateAuditEntry {
            tenant_id: ctx.tenant_id,
            actor_id: Some(claims.sub),
            actor_type: "user".to_string(),
            action: "create".to_string(),
            entity_type: "delegation".to_string(),
            entity_id: delegation.id,
            changes: json!({
                "delegator_id": delegation.delegator_id,
                "delegate_id": delegation.delegate_id,
            }),
            metadata: None,
        },
    )
    .await;

    Ok((StatusCode::CREATED, Json(json!(delegation))))
}

/// Revoke (soft-delete) a delegation.
///
/// # Errors
///
/// Returns `500` if the database update fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/delegations/{id}",
    params(("id" = Uuid, Path, description = "Delegation UUID")),
    responses(
        (status = 204, description = "Delegation revoked"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Delegations"
)]
#[tracing::instrument(skip_all)]
pub async fn revoke_delegation(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    DelegationRepository::revoke_delegation(&state.pool, ctx.tenant_id, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to revoke delegation: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let _ = AuditRepository::log_audit(
        &state.pool,
        CreateAuditEntry {
            tenant_id: ctx.tenant_id,
            actor_id: Some(claims.sub),
            actor_type: "user".to_string(),
            action: "revoke".to_string(),
            entity_type: "delegation".to_string(),
            entity_id: id,
            changes: json!({}),
            metadata: None,
        },
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

/// Update an existing delegation.
///
/// # Errors
///
/// Returns `500` if the database update fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    put,
    path = "/api/v1/workforce/delegations/{id}",
    params(("id" = Uuid, Path, description = "Delegation UUID")),
    request_body = UpdateDelegation,
    responses(
        (status = 200, description = "Delegation updated"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Delegations"
)]
#[tracing::instrument(skip_all)]
pub async fn update_delegation(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateDelegation>,
) -> Result<impl IntoResponse, StatusCode> {
    let delegation =
        DelegationRepository::update_delegation(&state.pool, ctx.tenant_id, id, input)
            .await
            .map_err(|e| {
                tracing::error!("Failed to update delegation: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let _ = AuditRepository::log_audit(
        &state.pool,
        CreateAuditEntry {
            tenant_id: ctx.tenant_id,
            actor_id: Some(claims.sub),
            actor_type: "user".to_string(),
            action: "update".to_string(),
            entity_type: "delegation".to_string(),
            entity_id: id,
            changes: json!({"delegate_id": delegation.delegate_id}),
            metadata: None,
        },
    )
    .await;

    Ok(Json(json!(delegation)))
}

/// Get delegations where the current user is the delegate.
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
    path = "/api/v1/workforce/delegations/my",
    responses(
        (status = 200, description = "Delegations received by the current user"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Delegations"
)]
#[tracing::instrument(skip_all)]
pub async fn my_delegations(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let delegations =
        DelegationRepository::get_delegations_for_person(&state.pool, claims.sub)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get my delegations: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    Ok(Json(json!(delegations)))
}

/// Get delegations granted by the current user.
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
    path = "/api/v1/workforce/delegations/granted",
    responses(
        (status = 200, description = "Delegations granted by the current user"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Delegations"
)]
#[tracing::instrument(skip_all)]
pub async fn granted_delegations(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let delegations =
        DelegationRepository::get_delegations_granted_by(&state.pool, claims.sub)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get granted delegations: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    Ok(Json(json!(delegations)))
}
