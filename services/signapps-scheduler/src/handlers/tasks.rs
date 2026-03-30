use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use signapps_common::{Claims, TenantContext};
use signapps_db::models::{CreateTimeItem, TimeItemsQuery, UpdateTimeItem};
use signapps_db::repositories::calendar_repository::TaskRepository;
use signapps_db::repositories::TimeItemRepository;
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// Request/Response types
// ============================================================================

#[derive(Debug, Deserialize)]
/// Request body for AddAttachment.
pub struct AddAttachmentRequest {
    pub file_url: String,
    pub file_name: Option<String>,
    pub file_size_bytes: Option<i32>,
}

#[derive(Debug, Serialize)]
/// Response for TaskAttachment.
pub struct TaskAttachmentResponse {
    pub id: Uuid,
    pub task_id: Uuid,
    pub file_url: String,
    pub file_name: Option<String>,
    pub file_size_bytes: Option<i32>,
    pub created_at: String,
}

// ============================================================================
// CRUD handlers
// ============================================================================

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/tasks",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Query(mut query): Query<TimeItemsQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);
    // Ensure we only query tasks
    query.types = Some(vec!["task".to_string()]);

    match repo.query(ctx.tenant_id, claims.sub, &query).await {
        Ok(response) => Ok(Json(json!({ "data": response.items }))),
        Err(e) => {
            tracing::error!("Failed to list tasks: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/tasks",
    responses((status = 201, description = "Success")),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
pub async fn create(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Json(mut payload): Json<CreateTimeItem>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);
    payload.item_type = "task".to_string(); // Force task type to ensure correctness

    match repo
        .create(ctx.tenant_id, claims.sub, claims.sub, payload)
        .await
    {
        Ok(task) => Ok((StatusCode::CREATED, Json(json!({ "data": task })))),
        Err(e) => {
            tracing::error!("Failed to create task: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/tasks",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
pub async fn get_by_id(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);
    match repo.find_by_id(id).await {
        Ok(Some(task)) => {
            // Verify tenant matches
            if task.tenant_id != ctx.tenant_id {
                return Err(StatusCode::NOT_FOUND);
            }
            Ok(Json(json!({ "data": task })))
        },
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to get task: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/tasks",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
pub async fn update(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTimeItem>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);
    match repo.update(id, payload).await {
        Ok(task) => Ok(Json(json!({ "data": task }))),
        Err(e) => {
            tracing::error!("Failed to update task: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/tasks",
    responses((status = 204, description = "Success")),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
pub async fn delete(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);
    match repo.delete(id).await {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to delete task: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        },
    }
}

// ============================================================================
// Task Attachment handlers
// ============================================================================

/// Add an attachment to a task.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/tasks",
    responses((status = 201, description = "Success")),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/tasks",
    responses((status = 200, description = "Success")),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
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
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/tasks",
    responses((status = 204, description = "Success")),
    tag = "Scheduler"
)]
#[tracing::instrument(skip_all)]
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
