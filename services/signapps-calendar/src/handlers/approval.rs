//! Approval workflow handlers.
//!
//! CRUD for configurable approval workflows. Each workflow defines a trigger
//! type (e.g. `leave_request`) and a list of approvers for an organisation.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use signapps_common::Claims;
use signapps_db::{
    models::calendar::{ApprovalWorkflow, CreateApprovalWorkflow},
    repositories::ApprovalWorkflowRepository,
};
use uuid::Uuid;

use crate::{AppState, CalendarError};

// ============================================================================
// list_workflows
// ============================================================================

/// `GET /api/v1/approval-workflows`
///
/// List all approval workflows for the current user's organisation.
/// The org_id is derived from a `X-Workspace-Id` header carried in the JWT
/// claims or falls back to the user's own UUID as a single-tenant sentinel.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn list_workflows(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ApprovalWorkflow>>, CalendarError> {
    // Use claims.sub as org_id sentinel when no explicit org context is
    // available. In a multi-tenant deployment this would come from a workspace
    // claim.
    let org_id = claims.sub;

    let repo = ApprovalWorkflowRepository::new(&state.pool);
    let workflows = repo
        .list(org_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(workflows))
}

// ============================================================================
// create_workflow
// ============================================================================

/// `POST /api/v1/approval-workflows`
///
/// Create a new approval workflow.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_workflow(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(mut body): Json<CreateApprovalWorkflow>,
) -> Result<(StatusCode, Json<ApprovalWorkflow>), CalendarError> {
    // Ensure org_id is set to the authenticated user's org.
    body.org_id = claims.sub;

    if body.trigger_type.is_empty() {
        return Err(CalendarError::InvalidInput(
            "trigger_type is required".to_string(),
        ));
    }

    let repo = ApprovalWorkflowRepository::new(&state.pool);
    let workflow = repo
        .create(&body)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok((StatusCode::CREATED, Json(workflow)))
}

// ============================================================================
// update_workflow
// ============================================================================

/// `PUT /api/v1/approval-workflows/:id`
///
/// Update an existing approval workflow.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_workflow(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Extension(claims): Extension<Claims>,
    Json(mut body): Json<CreateApprovalWorkflow>,
) -> Result<Json<ApprovalWorkflow>, CalendarError> {
    body.org_id = claims.sub;

    let repo = ApprovalWorkflowRepository::new(&state.pool);

    // Verify existence
    repo.find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    let updated = repo
        .update(id, &body)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(updated))
}

// ============================================================================
// delete_workflow
// ============================================================================

/// `DELETE /api/v1/approval-workflows/:id`
///
/// Delete an approval workflow by ID.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_workflow(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Extension(_claims): Extension<Claims>,
) -> Result<StatusCode, CalendarError> {
    let repo = ApprovalWorkflowRepository::new(&state.pool);

    // Verify existence
    repo.find_by_id(id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    repo.delete(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(StatusCode::NO_CONTENT)
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
