//! CRUD handlers for `/api/v1/org/nodes` — canonical surface (S1 W2).
//!
//! Backed by [`NodeRepository`], the W1 repository that talks to the
//! canonical `org_nodes` LTREE table.
//!
//! Events emitted:
//! - `org.node.created` on successful create
//! - `org.node.updated` on successful update
//! - `org.node.archived` on successful archive (DELETE)

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::pg_events::NewEvent;
use signapps_common::{Error, Result};
use signapps_db::models::org::{NodeKind, OrgNode};
use signapps_db::repositories::org::{AuditRepository, NodeRepository};
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// Router
// ============================================================================

/// Build the node CRUD router nested at `/api/v1/org/nodes`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/:id", get(detail).patch(update).delete(archive))
        .route("/:id/subtree", get(subtree))
}

// ============================================================================
// Request / response DTOs
// ============================================================================

/// Query parameters for `GET /api/v1/org/nodes`.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Tenant UUID — required (every node is tenant-scoped).
    pub tenant_id: Uuid,
    /// **SO1 time-travel** — if present, renvoie l'état des nodes à cette
    /// date (reverse-apply de l'audit log). Absent → état courant.
    pub at: Option<DateTime<Utc>>,
}

/// Request body for `POST /api/v1/org/nodes`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateNodeBody {
    /// Tenant that will own the new node.
    pub tenant_id: Uuid,
    /// Kind (root, entity, unit, position, role).
    pub kind: NodeKind,
    /// Optional direct parent; `None` for a root node.
    pub parent_id: Option<Uuid>,
    /// LTREE-valid path (lowercase letters, digits, underscores, dot-separated).
    pub path: String,
    /// Display name.
    pub name: String,
    /// Optional slug (leaf segment of the LTREE path).
    pub slug: Option<String>,
}

/// Request body for `PATCH /api/v1/org/nodes/:id`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct UpdateNodeBody {
    /// New display name (optional).
    pub name: Option<String>,
    /// New slug (optional).
    pub slug: Option<String>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/org/nodes — list all active nodes for a tenant.
#[utoipa::path(
    get,
    path = "/api/v1/org/nodes",
    tag = "Org",
    params(ListQuery),
    responses(
        (status = 200, description = "All active nodes for tenant", body = Vec<OrgNode>),
        (status = 400, description = "Missing tenant_id"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<OrgNode>>> {
    // SO1 time-travel : si `?at=<iso8601>` fourni, on reconstruit
    // l'état passé via l'audit log plutôt que de lire l'état courant.
    if let Some(at) = q.at {
        let snapshots = AuditRepository::new(st.pool.inner())
            .snapshot_at("org_nodes", q.tenant_id, at)
            .await
            .map_err(|e| Error::Database(format!("snapshot_at nodes: {e}")))?;
        let nodes: Vec<OrgNode> = snapshots
            .into_iter()
            .filter_map(|v| serde_json::from_value::<OrgNode>(v).ok())
            .filter(|n| n.active)
            .collect();
        return Ok(Json(nodes));
    }

    let repo = NodeRepository::new(st.pool.inner());
    let nodes = repo
        .list_by_tenant(q.tenant_id)
        .await
        .map_err(|e| Error::Database(format!("list_by_tenant: {e}")))?;
    Ok(Json(nodes))
}

/// POST /api/v1/org/nodes — create a new node + emit `org.node.created`.
#[utoipa::path(
    post,
    path = "/api/v1/org/nodes",
    tag = "Org",
    request_body = CreateNodeBody,
    responses(
        (status = 201, description = "Node created", body = OrgNode),
        (status = 400, description = "Invalid body (LTREE, missing fields, ...)"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreateNodeBody>,
) -> Result<(StatusCode, Json<OrgNode>)> {
    let repo = NodeRepository::new(st.pool.inner());
    let node = repo
        .create(
            body.tenant_id,
            body.kind,
            body.parent_id,
            &body.path,
            &body.name,
            body.slug.as_deref(),
        )
        .await
        .map_err(|e| Error::Database(format!("create node: {e}")))?;

    // Publish domain event — failure to publish must not fail the request
    // (event bus is best-effort), so we only log on error.
    if let Ok(payload) = serde_json::to_value(&node) {
        if let Err(e) = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.node.created".to_string(),
                aggregate_id: Some(node.id),
                payload,
            })
            .await
        {
            tracing::error!(?e, "failed to publish org.node.created event");
        }
    }
    Ok((StatusCode::CREATED, Json(node)))
}

/// GET /api/v1/org/nodes/:id — fetch one node.
#[utoipa::path(
    get,
    path = "/api/v1/org/nodes/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Node UUID")),
    responses(
        (status = 200, description = "Node detail", body = OrgNode),
        (status = 404, description = "Node not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn detail(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<OrgNode>> {
    NodeRepository::new(st.pool.inner())
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get node: {e}")))?
        .map(Json)
        .ok_or_else(|| Error::NotFound(format!("org node {id}")))
}

/// PATCH /api/v1/org/nodes/:id — update mutable fields (name, slug).
#[utoipa::path(
    patch,
    path = "/api/v1/org/nodes/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Node UUID")),
    request_body = UpdateNodeBody,
    responses(
        (status = 200, description = "Node updated", body = OrgNode),
        (status = 404, description = "Node not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn update(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateNodeBody>,
) -> Result<Json<OrgNode>> {
    // Use the same column list as NodeRepository so the path LTREE is
    // decoded via `::text`.
    let sql = "UPDATE org_nodes SET
                name = COALESCE($2, name),
                slug = COALESCE($3, slug),
                updated_at = now()
             WHERE id = $1
             RETURNING id, tenant_id, kind, parent_id, path::text AS path,
                       name, slug, attributes, active, created_at, updated_at";
    let node = sqlx::query_as::<_, OrgNode>(sql)
        .bind(id)
        .bind(body.name)
        .bind(body.slug)
        .fetch_optional(st.pool.inner())
        .await
        .map_err(|e| Error::Database(format!("update node: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("org node {id}")))?;

    if let Ok(payload) = serde_json::to_value(&node) {
        let _ = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.node.updated".to_string(),
                aggregate_id: Some(node.id),
                payload,
            })
            .await;
    }
    Ok(Json(node))
}

/// DELETE /api/v1/org/nodes/:id — soft-archive.
#[utoipa::path(
    delete,
    path = "/api/v1/org/nodes/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Node UUID")),
    responses(
        (status = 204, description = "Node archived"),
        (status = 404, description = "Node not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn archive(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let repo = NodeRepository::new(st.pool.inner());
    // Archive the row; NodeRepository::archive does not surface 404, so
    // we pre-check existence for better error messages.
    if repo
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get node: {e}")))?
        .is_none()
    {
        return Err(Error::NotFound(format!("org node {id}")));
    }
    repo.archive(id)
        .await
        .map_err(|e| Error::Database(format!("archive node: {e}")))?;

    let _ = st
        .event_bus
        .publish(NewEvent {
            event_type: "org.node.archived".to_string(),
            aggregate_id: Some(id),
            payload: serde_json::json!({ "id": id }),
        })
        .await;
    Ok(StatusCode::NO_CONTENT)
}

/// Response body for `GET /api/v1/org/nodes/:id/subtree`.
///
/// Exposed as a JSON array of [`OrgNode`] — the helper type exists only
/// so that utoipa can inline the `Vec<OrgNode>` schema without hitting
/// the unsupported `Vec<T>` response type.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct SubtreeResponse {
    /// Flat list of the root and every active descendant.
    pub nodes: Vec<OrgNode>,
}

/// GET /api/v1/org/nodes/:id/subtree — root + every active descendant.
#[utoipa::path(
    get,
    path = "/api/v1/org/nodes/{id}/subtree",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Root node UUID")),
    responses(
        (status = 200, description = "Subtree (flat)", body = SubtreeResponse),
        (status = 404, description = "Root node not found"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn subtree(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<SubtreeResponse>> {
    let repo = NodeRepository::new(st.pool.inner());
    let root = repo
        .get(id)
        .await
        .map_err(|e| Error::Database(format!("get node: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("org node {id}")))?;
    let nodes = repo
        .subtree(&root.path)
        .await
        .map_err(|e| Error::Database(format!("subtree: {e}")))?;
    Ok(Json(SubtreeResponse { nodes }))
}
