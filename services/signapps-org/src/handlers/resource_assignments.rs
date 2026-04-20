//! SO9 — CRUD handlers for `/api/v1/org/resources/:id/assignments`.
//!
//! Exposes :
//! - `GET    /org/resources/:id/assignments` → active assignments
//! - `GET    /org/resources/:id/assignments/history` → full history
//! - `POST   /org/resources/:id/assignments` → add
//! - `DELETE /org/resources/:id/assignments/:assignment_id` → end (close)
//!
//! Publie les events `org.resource.assigned` et `org.resource.unassigned`
//! sur le PgEventBus pour invalider le cache ACL.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get},
    Extension, Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::auth::Claims;
use signapps_common::pg_events::NewEvent;
use signapps_common::{Error, Result};
use signapps_db::models::org::{AssignmentRole, AssignmentSubjectType, ResourceAssignment};
use signapps_db::repositories::org::{NewResourceAssignment, ResourceAssignmentRepository};
use uuid::Uuid;

use crate::AppState;

/// Build the resource_assignments router.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/:id/assignments", get(list).post(create))
        .route("/:id/assignments/history", get(history))
        .route("/:id/assignments/:assignment_id", delete(end_assignment))
}

// ─── DTOs ─────────────────────────────────────────────────────────────

/// Body for `POST /org/resources/:id/assignments`.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateAssignmentBody {
    /// Tenant (redundant but safer).
    pub tenant_id: Uuid,
    /// Type de sujet (`person` / `node` / `group` / `site`).
    pub subject_type: String,
    /// UUID du sujet.
    pub subject_id: Uuid,
    /// Rôle (`owner` / `primary_user` / ...).
    pub role: String,
    /// `true` si primaire (UX).
    #[serde(default)]
    pub is_primary: bool,
    /// Début de validité.
    pub start_at: Option<DateTime<Utc>>,
    /// Fin de validité.
    pub end_at: Option<DateTime<Utc>>,
    /// Raison libre.
    pub reason: Option<String>,
}

/// Response wrapping active assignments for a resource.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct AssignmentListResponse {
    /// Rows.
    pub assignments: Vec<ResourceAssignment>,
}

// ─── Handlers ─────────────────────────────────────────────────────────

/// GET /org/resources/:id/assignments — active assignments.
#[utoipa::path(
    get,
    path = "/api/v1/org/resources/{id}/assignments",
    tag = "Org Resource Assignments",
    params(("id" = Uuid, Path, description = "Resource UUID")),
    responses((status = 200, description = "Active assignments", body = AssignmentListResponse)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn list(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<AssignmentListResponse>> {
    let rows = ResourceAssignmentRepository::new(st.pool.inner())
        .list_active_for_resource(id)
        .await
        .map_err(|e| Error::Database(format!("list assignments: {e}")))?;
    Ok(Json(AssignmentListResponse { assignments: rows }))
}

/// GET /org/resources/:id/assignments/history — full history.
#[utoipa::path(
    get,
    path = "/api/v1/org/resources/{id}/assignments/history",
    tag = "Org Resource Assignments",
    params(("id" = Uuid, Path, description = "Resource UUID")),
    responses((status = 200, description = "History", body = AssignmentListResponse)),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn history(
    State(st): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<AssignmentListResponse>> {
    let rows = ResourceAssignmentRepository::new(st.pool.inner())
        .list_history_for_resource(id)
        .await
        .map_err(|e| Error::Database(format!("history assignments: {e}")))?;
    Ok(Json(AssignmentListResponse { assignments: rows }))
}

/// POST /org/resources/:id/assignments — add a new assignment row.
#[utoipa::path(
    post,
    path = "/api/v1/org/resources/{id}/assignments",
    tag = "Org Resource Assignments",
    params(("id" = Uuid, Path, description = "Resource UUID")),
    request_body = CreateAssignmentBody,
    responses(
        (status = 201, description = "Created", body = ResourceAssignment),
        (status = 400, description = "Invalid role/subject"),
        (status = 409, description = "Conflict (duplicate owner/primary)"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st, claims, body))]
pub async fn create(
    State(st): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateAssignmentBody>,
) -> Result<(StatusCode, Json<ResourceAssignment>)> {
    let subject_type =
        AssignmentSubjectType::parse(&body.subject_type).map_err(Error::BadRequest)?;
    let role = AssignmentRole::parse(&body.role).map_err(Error::BadRequest)?;

    let repo = ResourceAssignmentRepository::new(st.pool.inner());

    // If creating a new owner, close any existing active owner first.
    if role == AssignmentRole::Owner {
        if let Err(e) = repo.end_active_owner(id).await {
            tracing::warn!(?e, "end_active_owner failed before new owner insert");
        }
    }

    let created = repo
        .create(NewResourceAssignment {
            tenant_id: body.tenant_id,
            resource_id: id,
            subject_type,
            subject_id: body.subject_id,
            role,
            is_primary: body.is_primary,
            start_at: body.start_at,
            end_at: body.end_at,
            reason: body.reason,
            created_by_user_id: Some(claims.sub),
        })
        .await
        .map_err(|e| {
            if format!("{e}").contains("duplicate key") {
                Error::Conflict(format!("assignment conflict: {e}"))
            } else {
                Error::Database(format!("create assignment: {e}"))
            }
        })?;

    if let Ok(payload) = serde_json::to_value(&created) {
        let _ = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.resource.assigned".to_string(),
                aggregate_id: Some(created.resource_id),
                payload,
            })
            .await;
    }

    Ok((StatusCode::CREATED, Json(created)))
}

/// DELETE /org/resources/:id/assignments/:assignment_id — end an assignment.
#[utoipa::path(
    delete,
    path = "/api/v1/org/resources/{id}/assignments/{assignment_id}",
    tag = "Org Resource Assignments",
    params(
        ("id" = Uuid, Path, description = "Resource UUID"),
        ("assignment_id" = Uuid, Path, description = "Assignment UUID"),
    ),
    responses(
        (status = 200, description = "Ended", body = ResourceAssignment),
        (status = 404, description = "Not found / already closed"),
    ),
    security(("bearerAuth" = []))
)]
#[tracing::instrument(skip(st))]
pub async fn end_assignment(
    State(st): State<AppState>,
    Path((id, assignment_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<ResourceAssignment>> {
    let row = ResourceAssignmentRepository::new(st.pool.inner())
        .end(assignment_id)
        .await
        .map_err(|e| Error::Database(format!("end assignment: {e}")))?
        .ok_or_else(|| Error::NotFound(format!("assignment {assignment_id}")))?;

    if row.resource_id != id {
        return Err(Error::BadRequest(format!(
            "assignment {assignment_id} does not belong to resource {id}"
        )));
    }

    if let Ok(payload) = serde_json::to_value(&row) {
        let _ = st
            .event_bus
            .publish(NewEvent {
                event_type: "org.resource.unassigned".to_string(),
                aggregate_id: Some(row.resource_id),
                payload,
            })
            .await;
    }

    Ok(Json(row))
}
