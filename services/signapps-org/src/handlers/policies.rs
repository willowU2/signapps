//! CRUD handlers for `/api/v1/org/policies` — canonical surface (S1 W2).
//!
//! Backed by [`PolicyRepository`]. Supports policy lifecycle +
//! `policy_bindings` attach/detach, plus a subtree query used by the
//! W4 RBAC resolver.
//!
//! Events emitted:
//! - `org.policy.created`
//! - `org.policy.updated`
//! - `org.policy.deleted`
//! - `org.policy.binding_changed` (on bind + unbind)

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use signapps_common::{Error, Result};
use signapps_db::models::org::{Policy, PolicyBinding};
use signapps_db::repositories::org::PolicyRepository;
use uuid::Uuid;

use crate::event_publisher::OrgEventPublisher;
use crate::AppState;

// ============================================================================
// Router
// ============================================================================

/// Build the policy router nested at `/api/v1/org/policies`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/:id", get(detail).patch(update).delete(delete_policy))
        .route("/:id/bindings", axum::routing::post(bind))
        .route("/bindings/:id", axum::routing::delete(unbind))
        .route("/bindings/subtree", get(bindings_subtree))
}

// ============================================================================
// Request DTOs
// ============================================================================

/// Query parameters for `GET /api/v1/org/policies`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Tenant UUID — required.
    pub tenant_id: Uuid,
}

/// Request body for `POST /api/v1/org/policies`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreatePolicyBody {
    /// Tenant owner.
    pub tenant_id: Uuid,
    /// Unique short name inside the tenant.
    pub name: String,
    /// Optional description.
    pub description: Option<String>,
    /// JSONB permissions spec: `[{"resource": "...", "actions": [...]}, ...]`.
    pub permissions: serde_json::Value,
}

/// Request body for `PATCH /api/v1/org/policies/:id`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdatePolicyBody {
    /// New name (optional).
    pub name: Option<String>,
    /// New description (optional).
    pub description: Option<String>,
    /// New permissions spec (optional).
    pub permissions: Option<serde_json::Value>,
}

/// Request body for `POST /api/v1/org/policies/:id/bindings`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateBindingBody {
    /// Node to bind the policy to.
    pub node_id: Uuid,
    /// Propagate to every LTREE descendant? Defaults to `true`.
    pub inherit: Option<bool>,
}

/// Query parameters for `GET /api/v1/org/policies/bindings/subtree`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct SubtreeQuery {
    /// LTREE path identifying the root of the subtree (e.g. `acme.rd`).
    pub path: String,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/org/policies — list all policies for a tenant.
#[utoipa::path(
    get,
    path = "/api/v1/org/policies",
    tag = "Org",
    params(ListQuery),
    responses(
        (status = 200, description = "Policies for tenant", body = Vec<Policy>),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Policy>>> {
    let rows = sqlx::query_as::<_, Policy>(
        "SELECT * FROM org_policies WHERE tenant_id = $1 ORDER BY name",
    )
    .bind(q.tenant_id)
    .fetch_all(st.pool.inner())
    .await
    .map_err(|e| Error::Database(format!("list policies: {e}")))?;
    Ok(Json(rows))
}

/// POST /api/v1/org/policies — create a policy.
#[utoipa::path(
    post,
    path = "/api/v1/org/policies",
    tag = "Org",
    request_body = CreatePolicyBody,
    responses(
        (status = 201, description = "Policy created", body = Policy),
        (status = 400, description = "Invalid body"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreatePolicyBody>,
) -> Result<(StatusCode, Json<Policy>)> {
    let repo = PolicyRepository::new(st.pool.inner());
    let policy = repo
        .create(
            body.tenant_id,
            &body.name,
            body.description.as_deref(),
            body.permissions,
        )
        .await
        .map_err(|e| Error::Database(format!("create policy: {e}")))?;

    if let Err(e) = OrgEventPublisher::new(&st.event_bus)
        .policy_updated(policy.id)
        .await
    {
        tracing::error!(?e, "failed to publish org.policy.updated event");
    }
    Ok((StatusCode::CREATED, Json(policy)))
}

/// GET /api/v1/org/policies/:id — fetch one policy.
#[utoipa::path(
    get,
    path = "/api/v1/org/policies/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Policy UUID")),
    responses(
        (status = 200, description = "Policy detail", body = Policy),
        (status = 404, description = "Policy not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn detail(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<Policy>> {
    PolicyRepository::new(st.pool.inner())
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get policy: {e}")))?
        .map(Json)
        .ok_or_else(|| Error::NotFound(format!("org policy {id}")))
}

/// PATCH /api/v1/org/policies/:id — update mutable fields.
#[utoipa::path(
    patch,
    path = "/api/v1/org/policies/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Policy UUID")),
    request_body = UpdatePolicyBody,
    responses(
        (status = 200, description = "Policy updated", body = Policy),
        (status = 404, description = "Policy not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn update(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePolicyBody>,
) -> Result<Json<Policy>> {
    let policy = sqlx::query_as::<_, Policy>(
        "UPDATE org_policies SET
            name        = COALESCE($2, name),
            description = COALESCE($3, description),
            permissions = COALESCE($4, permissions),
            updated_at  = now()
         WHERE id = $1
         RETURNING *",
    )
    .bind(id)
    .bind(body.name)
    .bind(body.description)
    .bind(body.permissions)
    .fetch_optional(st.pool.inner())
    .await
    .map_err(|e| Error::Database(format!("update policy: {e}")))?
    .ok_or_else(|| Error::NotFound(format!("org policy {id}")))?;

    if let Err(e) = OrgEventPublisher::new(&st.event_bus)
        .policy_updated(policy.id)
        .await
    {
        tracing::error!(?e, "failed to publish org.policy.updated event");
    }
    Ok(Json(policy))
}

/// DELETE /api/v1/org/policies/:id — delete policy + its bindings
/// (via ON DELETE CASCADE in the schema).
#[utoipa::path(
    delete,
    path = "/api/v1/org/policies/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Policy UUID")),
    responses(
        (status = 204, description = "Policy deleted"),
        (status = 404, description = "Policy not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn delete_policy(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let res = sqlx::query("DELETE FROM org_policies WHERE id = $1")
        .bind(id)
        .execute(st.pool.inner())
        .await
        .map_err(|e| Error::Database(format!("delete policy: {e}")))?;
    if res.rows_affected() == 0 {
        return Err(Error::NotFound(format!("org policy {id}")));
    }

    if let Err(e) = OrgEventPublisher::new(&st.event_bus)
        .policy_updated(id)
        .await
    {
        tracing::error!(?e, "failed to publish org.policy.updated (delete) event");
    }
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/org/policies/:id/bindings — attach a policy to a node.
#[utoipa::path(
    post,
    path = "/api/v1/org/policies/{id}/bindings",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Policy UUID")),
    request_body = CreateBindingBody,
    responses(
        (status = 201, description = "Binding created", body = PolicyBinding),
        (status = 400, description = "Invalid body"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn bind(
    State(st): State<AppState>,
    Path(policy_id): Path<Uuid>,
    Json(body): Json<CreateBindingBody>,
) -> Result<(StatusCode, Json<PolicyBinding>)> {
    let repo = PolicyRepository::new(st.pool.inner());
    let binding = repo
        .bind_to_node(policy_id, body.node_id, body.inherit.unwrap_or(true))
        .await
        .map_err(|e| Error::Database(format!("bind policy: {e}")))?;

    if let Err(e) = OrgEventPublisher::new(&st.event_bus)
        .policy_updated(policy_id)
        .await
    {
        tracing::error!(?e, "failed to publish org.policy.updated (bind) event");
    }
    Ok((StatusCode::CREATED, Json(binding)))
}

/// DELETE /api/v1/org/policies/bindings/:id — detach a binding by id.
#[utoipa::path(
    delete,
    path = "/api/v1/org/policies/bindings/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Binding UUID")),
    responses(
        (status = 204, description = "Binding removed"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn unbind(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let repo = PolicyRepository::new(st.pool.inner());
    repo.unbind(id)
        .await
        .map_err(|e| Error::Database(format!("unbind: {e}")))?;
    if let Err(e) = OrgEventPublisher::new(&st.event_bus)
        .policy_updated(id)
        .await
    {
        tracing::error!(?e, "failed to publish org.policy.updated (unbind) event");
    }
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/org/policies/bindings/subtree?path=acme.rd — return
/// every binding that applies to the subtree rooted at `path`.
#[utoipa::path(
    get,
    path = "/api/v1/org/policies/bindings/subtree",
    tag = "Org",
    params(SubtreeQuery),
    responses(
        (status = 200, description = "Bindings applicable to the subtree", body = Vec<PolicyBinding>),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn bindings_subtree(
    State(st): State<AppState>,
    Query(q): Query<SubtreeQuery>,
) -> Result<Json<Vec<PolicyBinding>>> {
    let repo = PolicyRepository::new(st.pool.inner());
    let rows = repo
        .list_bindings_for_subtree(&q.path)
        .await
        .map_err(|e| Error::Database(format!("bindings_subtree: {e}")))?;
    Ok(Json(rows))
}
