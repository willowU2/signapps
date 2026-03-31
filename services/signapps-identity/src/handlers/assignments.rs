//! Assignment handlers: create, update, end, and list history.

use crate::AppState;
use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::NaiveDate;
use serde::Deserialize;
use signapps_common::{Claims, Error, Result};
use signapps_db::models::core_org::{
    Assignment, AssignmentHistory, CreateAssignment, CreateAssignmentHistory, UpdateAssignment,
};
use signapps_db::repositories::AssignmentRepository;
use uuid::Uuid;

// ============================================================================
// Request DTOs
// ============================================================================

/// Request body for creating an assignment.
#[derive(Debug, Deserialize)]
pub struct CreateAssignmentRequest {
    pub person_id: Uuid,
    pub node_id: Uuid,
    pub assignment_type: Option<String>,
    pub responsibility_type: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub fte_ratio: Option<f64>,
    pub is_primary: Option<bool>,
}

/// Request body for updating an assignment.
#[derive(Debug, Deserialize)]
pub struct UpdateAssignmentRequest {
    pub assignment_type: Option<String>,
    pub responsibility_type: Option<String>,
    pub end_date: Option<NaiveDate>,
    pub fte_ratio: Option<f64>,
    pub is_primary: Option<bool>,
}

/// Request body for ending an assignment (soft-delete via end_date).
#[derive(Debug, Deserialize)]
pub struct EndAssignmentRequest {
    pub reason: Option<String>,
    pub end_date: Option<NaiveDate>,
}

/// Query parameters for listing assignment history.
#[derive(Debug, Deserialize)]
pub struct ListHistoryQuery {
    pub person_id: Option<Uuid>,
    pub node_id: Option<Uuid>,
    pub date_from: Option<NaiveDate>,
    pub date_to: Option<NaiveDate>,
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /api/v1/assignments — Create a new person-to-node assignment and log history.
#[tracing::instrument(skip_all)]
pub async fn create_assignment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateAssignmentRequest>,
) -> Result<(StatusCode, Json<Assignment>)> {
    let input = CreateAssignment {
        person_id: payload.person_id,
        node_id: payload.node_id,
        assignment_type: payload.assignment_type,
        responsibility_type: payload.responsibility_type,
        start_date: payload.start_date,
        end_date: None,
        fte_ratio: payload.fte_ratio,
        is_primary: payload.is_primary,
    };
    let assignment = AssignmentRepository::create(&state.pool, input).await?;

    // Log audit history
    let history_input = CreateAssignmentHistory {
        assignment_id: assignment.id,
        action: "created".to_string(),
        changed_by: Some(claims.sub),
        changes: Some(serde_json::json!({
            "person_id": assignment.person_id,
            "node_id": assignment.node_id,
            "assignment_type": assignment.assignment_type,
            "responsibility_type": assignment.responsibility_type,
            "start_date": assignment.start_date,
            "fte_ratio": assignment.fte_ratio,
            "is_primary": assignment.is_primary,
        })),
        reason: None,
        effective_date: assignment.start_date,
    };
    AssignmentRepository::log_history(&state.pool, history_input).await?;

    Ok((StatusCode::CREATED, Json(assignment)))
}

/// PUT /api/v1/assignments/:id — Update an existing assignment and log history.
#[tracing::instrument(skip_all)]
pub async fn update_assignment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAssignmentRequest>,
) -> Result<Json<Assignment>> {
    let input = UpdateAssignment {
        assignment_type: payload.assignment_type.clone(),
        responsibility_type: payload.responsibility_type.clone(),
        end_date: payload.end_date,
        fte_ratio: payload.fte_ratio,
        is_primary: payload.is_primary,
    };
    let assignment = AssignmentRepository::update(&state.pool, id, input).await?;

    // Log audit history
    let history_input = CreateAssignmentHistory {
        assignment_id: assignment.id,
        action: "modified".to_string(),
        changed_by: Some(claims.sub),
        changes: Some(serde_json::json!({
            "assignment_type": payload.assignment_type,
            "responsibility_type": payload.responsibility_type,
            "end_date": payload.end_date,
            "fte_ratio": payload.fte_ratio,
            "is_primary": payload.is_primary,
        })),
        reason: None,
        effective_date: chrono::Utc::now().date_naive(),
    };
    AssignmentRepository::log_history(&state.pool, history_input).await?;

    Ok(Json(assignment))
}

/// DELETE /api/v1/assignments/:id — End an assignment (sets end_date = today) and log history.
///
/// Accepts an optional JSON body `{"reason": "...", "end_date": "YYYY-MM-DD"}`.
#[tracing::instrument(skip_all)]
pub async fn end_assignment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    payload: Option<Json<EndAssignmentRequest>>,
) -> Result<Json<Assignment>> {
    let (end_date, reason) = payload
        .map(|Json(p)| (p.end_date, p.reason))
        .unwrap_or((None, None));

    let assignment = AssignmentRepository::end(&state.pool, id, end_date).await?;

    // Log audit history
    let history_input = CreateAssignmentHistory {
        assignment_id: assignment.id,
        action: "ended".to_string(),
        changed_by: Some(claims.sub),
        changes: Some(serde_json::json!({
            "end_date": assignment.end_date,
        })),
        reason: reason.clone(),
        effective_date: assignment.end_date.unwrap_or_else(|| chrono::Utc::now().date_naive()),
    };
    AssignmentRepository::log_history(&state.pool, history_input).await?;

    Ok(Json(assignment))
}

/// GET /api/v1/assignments/history — List assignment history entries with optional filtering.
///
/// Filters: person_id, node_id, date_from, date_to.
#[tracing::instrument(skip_all)]
pub async fn list_history(
    State(state): State<AppState>,
    Query(query): Query<ListHistoryQuery>,
) -> Result<Json<Vec<AssignmentHistory>>> {
    // Collect candidate assignment IDs
    let mut all_history: Vec<AssignmentHistory> = Vec::new();

    if let Some(person_id) = query.person_id {
        let assignments = AssignmentRepository::list_by_person(&state.pool, person_id).await?;
        for a in &assignments {
            let h = AssignmentRepository::get_history(&state.pool, a.id).await?;
            all_history.extend(h);
        }
    } else if let Some(node_id) = query.node_id {
        let assignments = AssignmentRepository::list_by_node(&state.pool, node_id).await?;
        for a in &assignments {
            let h = AssignmentRepository::get_history(&state.pool, a.id).await?;
            all_history.extend(h);
        }
    } else {
        return Err(Error::Validation(
            "Either person_id or node_id query parameter is required".into(),
        ));
    }

    // Apply date filters
    if let Some(date_from) = query.date_from {
        all_history.retain(|h| h.effective_date >= date_from);
    }
    if let Some(date_to) = query.date_to {
        all_history.retain(|h| h.effective_date <= date_to);
    }

    // Sort newest first
    all_history.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(Json(all_history))
}
