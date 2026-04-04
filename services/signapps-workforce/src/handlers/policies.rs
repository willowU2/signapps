//! Policy Handlers
//!
//! CRUD operations for GPO-style org policies, link management, and policy resolution.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};
use signapps_db::models::org_audit::CreateAuditEntry;
use signapps_db::models::org_policies::{CreateOrgPolicy, CreatePolicyLink, UpdateOrgPolicy};
use signapps_db::repositories::core_org_repository::{
    AuditRepository, PolicyRepository, PolicyResolver,
};

// ============================================================================
// Query params
// ============================================================================

/// Query parameters for listing policies.
#[derive(Debug, Deserialize, Default)]
pub struct PolicyListParams {
    /// Optional domain filter (e.g. "security", "modules").
    pub domain: Option<String>,
}

// ============================================================================
// Handlers
// ============================================================================

/// List all policies for the current tenant, optionally filtered by domain.
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
    path = "/api/v1/workforce/policies",
    params(("domain" = Option<String>, Query, description = "Filter by policy domain")),
    responses(
        (status = 200, description = "List of policies"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Policies"
)]
#[tracing::instrument(skip_all)]
pub async fn list_policies(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<PolicyListParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let policies =
        PolicyRepository::list_policies(&state.pool, ctx.tenant_id, params.domain.as_deref())
            .await
            .map_err(|e| {
                tracing::error!("Failed to list policies: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    Ok(Json(json!(policies)))
}

/// Create a new org policy.
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
    path = "/api/v1/workforce/policies",
    request_body = CreateOrgPolicy,
    responses(
        (status = 201, description = "Policy created"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Policies"
)]
#[tracing::instrument(skip_all)]
pub async fn create_policy(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<CreateOrgPolicy>,
) -> Result<impl IntoResponse, StatusCode> {
    let policy = PolicyRepository::create_policy(&state.pool, ctx.tenant_id, input)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create policy: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let _ = AuditRepository::log_audit(
        &state.pool,
        CreateAuditEntry {
            tenant_id: ctx.tenant_id,
            actor_id: Some(claims.sub),
            actor_type: "user".to_string(),
            action: "create".to_string(),
            entity_type: "policy".to_string(),
            entity_id: policy.id,
            changes: json!({"name": policy.name, "domain": policy.domain}),
            metadata: None,
        },
    )
    .await;

    Ok((StatusCode::CREATED, Json(json!(policy))))
}

/// Get a single policy by ID.
///
/// # Errors
///
/// Returns `404` if not found, `500` on database error.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/policies/{id}",
    params(("id" = Uuid, Path, description = "Policy UUID")),
    responses(
        (status = 200, description = "Policy found"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Policy not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Policies"
)]
#[tracing::instrument(skip_all)]
pub async fn get_policy(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let policy = PolicyRepository::get_policy(&state.pool, ctx.tenant_id, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get policy: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(json!(policy)))
}

/// Update an existing policy.
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
    path = "/api/v1/workforce/policies/{id}",
    params(("id" = Uuid, Path, description = "Policy UUID")),
    request_body = UpdateOrgPolicy,
    responses(
        (status = 200, description = "Policy updated"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Policies"
)]
#[tracing::instrument(skip_all)]
pub async fn update_policy(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateOrgPolicy>,
) -> Result<impl IntoResponse, StatusCode> {
    let policy = PolicyRepository::update_policy(&state.pool, ctx.tenant_id, id, input)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update policy: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let _ = AuditRepository::log_audit(
        &state.pool,
        CreateAuditEntry {
            tenant_id: ctx.tenant_id,
            actor_id: Some(claims.sub),
            actor_type: "user".to_string(),
            action: "update".to_string(),
            entity_type: "policy".to_string(),
            entity_id: id,
            changes: json!({"name": policy.name}),
            metadata: None,
        },
    )
    .await;

    Ok(Json(json!(policy)))
}

/// Delete a policy by ID.
///
/// # Errors
///
/// Returns `500` if the database delete fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/policies/{id}",
    params(("id" = Uuid, Path, description = "Policy UUID")),
    responses(
        (status = 204, description = "Policy deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Policies"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_policy(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    PolicyRepository::delete_policy(&state.pool, ctx.tenant_id, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete policy: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let _ = AuditRepository::log_audit(
        &state.pool,
        CreateAuditEntry {
            tenant_id: ctx.tenant_id,
            actor_id: Some(claims.sub),
            actor_type: "user".to_string(),
            action: "delete".to_string(),
            entity_type: "policy".to_string(),
            entity_id: id,
            changes: json!({}),
            metadata: None,
        },
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

/// Attach a policy link to a scope (node, group, site, country, global).
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
    path = "/api/v1/workforce/policies/{id}/links",
    params(("id" = Uuid, Path, description = "Policy UUID")),
    request_body = CreatePolicyLink,
    responses(
        (status = 201, description = "Policy link created"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Policies"
)]
#[tracing::instrument(skip_all)]
pub async fn add_link(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path(policy_id): Path<Uuid>,
    Json(input): Json<CreatePolicyLink>,
) -> Result<impl IntoResponse, StatusCode> {
    let link = PolicyRepository::add_policy_link(&state.pool, policy_id, input)
        .await
        .map_err(|e| {
            tracing::error!("Failed to add policy link: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let _ = AuditRepository::log_audit(
        &state.pool,
        CreateAuditEntry {
            tenant_id: ctx.tenant_id,
            actor_id: Some(claims.sub),
            actor_type: "user".to_string(),
            action: "add_link".to_string(),
            entity_type: "policy".to_string(),
            entity_id: policy_id,
            changes: json!({"link_id": link.id, "link_type": link.link_type}),
            metadata: None,
        },
    )
    .await;

    Ok((StatusCode::CREATED, Json(json!(link))))
}

/// Remove a policy link by its link ID.
///
/// # Errors
///
/// Returns `500` if the database delete fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/policies/{id}/links/{link_id}",
    params(
        ("id" = Uuid, Path, description = "Policy UUID"),
        ("link_id" = Uuid, Path, description = "Policy link UUID"),
    ),
    responses(
        (status = 204, description = "Policy link removed"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Policies"
)]
#[tracing::instrument(skip_all)]
pub async fn remove_link(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(claims): Extension<Claims>,
    Path((policy_id, link_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, StatusCode> {
    PolicyRepository::remove_policy_link(&state.pool, link_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to remove policy link: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let _ = AuditRepository::log_audit(
        &state.pool,
        CreateAuditEntry {
            tenant_id: ctx.tenant_id,
            actor_id: Some(claims.sub),
            actor_type: "user".to_string(),
            action: "remove_link".to_string(),
            entity_type: "policy".to_string(),
            entity_id: policy_id,
            changes: json!({"link_id": link_id}),
            metadata: None,
        },
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

/// Resolve the effective policy for a person (5-step GPO algorithm).
///
/// # Errors
///
/// Returns `500` if the policy resolution fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/policies/resolve/{person_id}",
    params(("person_id" = Uuid, Path, description = "Person UUID")),
    responses(
        (status = 200, description = "Resolved effective policy"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Policies"
)]
#[tracing::instrument(skip_all)]
pub async fn resolve_person(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(person_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let effective = PolicyResolver::resolve_person_policy(&state.pool, person_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to resolve person policy: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(json!(effective)))
}

/// Resolve the effective policy for an org node.
///
/// # Errors
///
/// Returns `500` if the policy resolution fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    get,
    path = "/api/v1/workforce/policies/resolve/node/{node_id}",
    params(("node_id" = Uuid, Path, description = "Org node UUID")),
    responses(
        (status = 200, description = "Resolved effective policy for node"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Policies"
)]
#[tracing::instrument(skip_all)]
pub async fn resolve_node(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let effective = PolicyResolver::resolve_node_policy(&state.pool, node_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to resolve node policy: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(json!(effective)))
}

// ============================================================================
// Policy Simulation
// ============================================================================

/// Request payload for simulating a hypothetical policy change.
#[derive(Debug, Deserialize, Serialize, utoipa::ToSchema)]
pub struct SimulateRequest {
    /// Person UUID to resolve the effective policy for.
    pub person_id: Uuid,
    /// Optional policy to add/overlay for the simulation.
    pub add_policy: Option<CreateOrgPolicy>,
    /// Optional policy ID to exclude from the simulation.
    pub remove_policy_id: Option<Uuid>,
}

/// Simulate a hypothetical policy change and return the effective policy.
///
/// Resolves the current effective policy for a person, then applies the
/// requested overlay (add/remove) to show what WOULD change.
///
/// # Errors
///
/// Returns `500` if the policy resolution fails.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    post,
    path = "/api/v1/workforce/policies/simulate",
    request_body = SimulateRequest,
    responses(
        (status = 200, description = "Simulated effective policy"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Policies"
)]
#[tracing::instrument(skip_all)]
pub async fn simulate_policy(
    State(state): State<AppState>,
    Extension(_ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<SimulateRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    // Step 1: Resolve current effective policy for the person.
    let mut effective = PolicyResolver::resolve_person_policy(&state.pool, req.person_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to resolve person policy for simulation: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Step 2: Remove the excluded policy's contributions from sources and settings.
    if let Some(remove_id) = req.remove_policy_id {
        effective.sources.retain(|s| s.policy_id != remove_id);
        // Rebuild settings from remaining sources.
        let mut rebuilt = serde_json::Map::new();
        for src in &effective.sources {
            rebuilt.insert(src.key.clone(), src.value.clone());
        }
        effective.settings = serde_json::Value::Object(rebuilt);
    }

    // Step 3: Overlay the added policy's settings (high priority, applied last).
    if let Some(add) = req.add_policy {
        if let serde_json::Value::Object(add_settings) = &add.settings {
            if let Some(settings) = effective.settings.as_object_mut() {
                for (key, value) in add_settings {
                    let full_key = format!("{}.{}", add.domain, key);
                    settings.insert(full_key, value.clone());
                }
            }
        }
    }

    Ok(Json(json!(effective)))
}
