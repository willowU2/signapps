//! CRUD handlers for `/api/v1/org/assignments` — canonical surface (S1 W2).
//!
//! Backed by [`AssignmentRepository`] (the W1 canonical repository in
//! `signapps_db::repositories::org`), not the legacy workforce repo.
//!
//! The module is named `canonical_assignments` to avoid colliding with
//! the pre-existing `assignments` handler that powers the legacy
//! `/api/v1/assignments` endpoints.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use chrono::NaiveDate;
use serde::Deserialize;
use signapps_common::{Error, Result};
use signapps_db::models::org::{Assignment, Axis};
use signapps_db::repositories::org::AssignmentRepository;
use uuid::Uuid;

use crate::event_publisher::OrgEventPublisher;
use crate::AppState;

// ============================================================================
// Router
// ============================================================================

/// Build the canonical assignments router nested at `/api/v1/org/assignments`.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list).post(create))
        .route("/:id", axum::routing::delete(archive))
}

// ============================================================================
// Request DTOs
// ============================================================================

/// Query parameters for `GET /api/v1/org/assignments`.
///
/// One of `person_id` or `node_id` MUST be provided — tenant-wide
/// listing is deferred to the W4 RBAC-aware `/api/v1/org/nodes/:id/assignments`
/// endpoint.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListQuery {
    /// Optional tenant filter (informational, the real scoping comes
    /// from `person_id` / `node_id`).
    pub tenant_id: Option<Uuid>,
    /// Filter by person.
    pub person_id: Option<Uuid>,
    /// Filter by node.
    pub node_id: Option<Uuid>,
    /// Optional axis filter (used with `person_id`).
    pub axis: Option<Axis>,
}

/// Request body for `POST /api/v1/org/assignments`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateAssignmentBody {
    /// Tenant owner.
    pub tenant_id: Uuid,
    /// Person being assigned.
    pub person_id: Uuid,
    /// Target node.
    pub node_id: Uuid,
    /// Axis (structure | focus | group).
    pub axis: Axis,
    /// Role label (free text).
    pub role: Option<String>,
    /// Primary assignment? At most one `true` per axis per person.
    pub is_primary: Option<bool>,
    /// Optional start date.
    pub start_date: Option<NaiveDate>,
    /// Optional end date.
    pub end_date: Option<NaiveDate>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/org/assignments — list by person or by node.
#[utoipa::path(
    get,
    path = "/api/v1/org/assignments",
    tag = "Org",
    params(ListQuery),
    responses(
        (status = 200, description = "Assignments matching the query", body = Vec<Assignment>),
        (status = 400, description = "Neither person_id nor node_id provided"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<Assignment>>> {
    let repo = AssignmentRepository::new(st.pool.inner());
    let result = match (q.person_id, q.node_id) {
        (Some(pid), _) => repo
            .list_by_person(pid, q.axis)
            .await
            .map_err(|e| Error::Database(format!("list_by_person: {e}")))?,
        (_, Some(nid)) => repo
            .list_by_node(nid)
            .await
            .map_err(|e| Error::Database(format!("list_by_node: {e}")))?,
        (None, None) => {
            return Err(Error::Validation(
                "query requires person_id or node_id".to_string(),
            ));
        },
    };
    Ok(Json(result))
}

/// POST /api/v1/org/assignments — create a canonical assignment.
#[utoipa::path(
    post,
    path = "/api/v1/org/assignments",
    tag = "Org",
    request_body = CreateAssignmentBody,
    responses(
        (status = 201, description = "Assignment created", body = Assignment),
        (status = 400, description = "Invalid body"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn create(
    State(st): State<AppState>,
    Json(body): Json<CreateAssignmentBody>,
) -> Result<(StatusCode, Json<Assignment>)> {
    let repo = AssignmentRepository::new(st.pool.inner());
    let is_primary = body.is_primary.unwrap_or(false);
    let assignment = repo
        .create(
            body.tenant_id,
            body.person_id,
            body.node_id,
            body.axis,
            body.role.as_deref(),
            is_primary,
            body.start_date,
            body.end_date,
        )
        .await
        .map_err(|e| Error::Database(format!("create assignment: {e}")))?;

    if let Err(e) = OrgEventPublisher::new(&st.event_bus)
        .assignment_changed(assignment.person_id)
        .await
    {
        tracing::error!(?e, "failed to publish org.assignment.changed event");
    }
    Ok((StatusCode::CREATED, Json(assignment)))
}

/// DELETE /api/v1/org/assignments/:id — hard delete.
#[utoipa::path(
    delete,
    path = "/api/v1/org/assignments/{id}",
    tag = "Org",
    params(("id" = Uuid, Path, description = "Assignment UUID")),
    responses(
        (status = 204, description = "Assignment deleted"),
        (status = 401, description = "Not authenticated"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn archive(State(st): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    // Fetch person_id first so the post-delete event carries enough
    // context for targeted cache invalidation.
    let person_id: Option<Uuid> =
        sqlx::query_scalar("SELECT person_id FROM org_assignments WHERE id = $1")
            .bind(id)
            .fetch_optional(st.pool.inner())
            .await
            .map_err(|e| Error::Database(format!("fetch assignment person_id: {e}")))?;

    let repo = AssignmentRepository::new(st.pool.inner());
    repo.delete(id)
        .await
        .map_err(|e| Error::Database(format!("delete assignment: {e}")))?;

    if let Some(pid) = person_id {
        if let Err(e) = OrgEventPublisher::new(&st.event_bus)
            .assignment_changed(pid)
            .await
        {
            tracing::error!(?e, "failed to publish org.assignment.changed event");
        }
    }
    Ok(StatusCode::NO_CONTENT)
}
