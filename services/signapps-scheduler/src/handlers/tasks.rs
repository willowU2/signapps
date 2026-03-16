use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use signapps_common::{Claims, TenantContext};
use signapps_db::repositories::calendar_repository::TaskRepository;
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// Request/Response types
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct AddAttachmentRequest {
    pub file_url: String,
    pub file_name: Option<String>,
    pub file_size_bytes: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct TaskAttachmentResponse {
    pub id: Uuid,
    pub task_id: Uuid,
    pub file_url: String,
    pub file_name: Option<String>,
    pub file_size_bytes: Option<i32>,
    pub created_at: String,
}

// ============================================================================
// Task handlers (placeholder - TODO: implement fully)
// ============================================================================

pub async fn list_tasks(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<impl IntoResponse, StatusCode> {
    Ok(Json(json!({
        "data": [],
        "tenant_id": ctx.tenant_id
    })))
}

pub async fn get_task(
    State(_state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    Ok(Json(json!({
        "id": id,
        "tenant_id": ctx.tenant_id,
        "title": "Placeholder Task"
    })))
}

// ============================================================================
// Task Attachment handlers
// ============================================================================

/// Add an attachment to a task.
pub async fn add_attachment(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(task_id): Path<Uuid>,
    Json(payload): Json<AddAttachmentRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TaskRepository::new(&state.pool);

    let attachment = repo
        .add_attachment(
            task_id,
            &payload.file_url,
            payload.file_name.as_deref(),
            payload.file_size_bytes,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to add attachment: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let response = TaskAttachmentResponse {
        id: attachment.id,
        task_id: attachment.task_id,
        file_url: attachment.file_url,
        file_name: attachment.file_name,
        file_size_bytes: attachment.file_size_bytes,
        created_at: attachment.created_at.to_rfc3339(),
    };

    Ok((StatusCode::CREATED, Json(response)))
}

/// List all attachments for a task.
pub async fn list_attachments(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(task_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TaskRepository::new(&state.pool);

    let attachments = repo.list_attachments(task_id).await.map_err(|e| {
        tracing::error!("Failed to list attachments: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response: Vec<TaskAttachmentResponse> = attachments
        .into_iter()
        .map(|a| TaskAttachmentResponse {
            id: a.id,
            task_id: a.task_id,
            file_url: a.file_url,
            file_name: a.file_name,
            file_size_bytes: a.file_size_bytes,
            created_at: a.created_at.to_rfc3339(),
        })
        .collect();

    Ok(Json(response))
}

/// Delete an attachment.
pub async fn delete_attachment(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path((_task_id, attachment_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TaskRepository::new(&state.pool);

    let rows_affected = repo.delete_attachment(attachment_id).await.map_err(|e| {
        tracing::error!("Failed to delete attachment: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if rows_affected == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
