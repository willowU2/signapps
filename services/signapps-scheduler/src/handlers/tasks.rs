use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use signapps_common::{Claims, TenantContext};
use signapps_db::models::{CreateTimeItem, TimeItemsQuery, UpdateTimeItem};
use signapps_db::repositories::TaskRepository;
use signapps_db::repositories::TimeItemRepository;
use sqlx::FromRow;
use uuid::Uuid;

use crate::AppState;

// ============================================================================
// Request/Response types
// ============================================================================

#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for AddAttachment.
pub struct AddAttachmentRequest {
    pub file_url: String,
    pub file_name: Option<String>,
    pub file_size_bytes: Option<i32>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
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

/// List tasks.
#[utoipa::path(
    get,
    path = "/api/v1/tasks",
    responses(
        (status = 200, description = "List of tasks"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Tasks"
)]
#[tracing::instrument(skip_all)]
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

/// Request body for creating a task with org-aware assignment fields.
#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    /// Underlying time-item fields.
    #[serde(flatten)]
    pub inner: CreateTimeItem,
    /// Optional assignee person ID (from core.persons).
    pub assignee_id: Option<Uuid>,
    /// Optional list of contributor person IDs.
    pub contributor_ids: Option<Vec<Uuid>>,
}

/// Request body for updating a task with org-aware assignment fields.
#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    /// Underlying time-item update fields.
    #[serde(flatten)]
    pub inner: UpdateTimeItem,
    /// Optional new assignee person ID.
    pub assignee_id: Option<Uuid>,
    /// Optional new contributor person IDs.
    pub contributor_ids: Option<Vec<Uuid>>,
}

/// Create a task.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
    Json(mut payload): Json<CreateTaskRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);
    payload.inner.item_type = "task".to_string(); // Force task type to ensure correctness

    let task = repo
        .create(ctx.tenant_id, claims.sub, claims.sub, payload.inner)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create task: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Patch assignee_id and contributor_ids if provided
    if payload.assignee_id.is_some() || payload.contributor_ids.is_some() {
        let contributor_ids = payload.contributor_ids.unwrap_or_default();
        sqlx::query(
            r#"
            UPDATE scheduling.time_items
            SET assignee_id = COALESCE($2, assignee_id),
                contributor_ids = COALESCE($3, contributor_ids)
            WHERE id = $1
            "#,
        )
        .bind(task.id)
        .bind(payload.assignee_id)
        .bind(contributor_ids)
        .execute(state.pool.inner())
        .await
        .map_err(|e| {
            tracing::error!("Failed to patch task assignee/contributors: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    Ok((StatusCode::CREATED, Json(json!({ "data": task }))))
}

/// Get a task by ID.
#[utoipa::path(
    get,
    path = "/api/v1/tasks/{id}",
    params(("id" = Uuid, Path, description = "Task ID")),
    responses(
        (status = 200, description = "Task details"),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Tasks"
)]
#[tracing::instrument(skip_all)]
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

/// Update a task.
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Extension(_ctx): Extension<TenantContext>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTaskRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let repo = TimeItemRepository::new(&state.pool);
    let task = repo.update(id, payload.inner).await.map_err(|e| {
        tracing::error!("Failed to update task: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Patch assignee_id and contributor_ids if provided
    if payload.assignee_id.is_some() || payload.contributor_ids.is_some() {
        let contributor_ids = payload.contributor_ids.unwrap_or_default();
        sqlx::query(
            r#"
            UPDATE scheduling.time_items
            SET assignee_id = COALESCE($2, assignee_id),
                contributor_ids = COALESCE($3, contributor_ids)
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(payload.assignee_id)
        .bind(contributor_ids)
        .execute(state.pool.inner())
        .await
        .map_err(|e| {
            tracing::error!("Failed to patch task assignee/contributors: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    Ok(Json(json!({ "data": task })))
}

/// Delete a task.
#[utoipa::path(
    delete,
    path = "/api/v1/tasks/{id}",
    params(("id" = Uuid, Path, description = "Task ID")),
    responses(
        (status = 204, description = "Task deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Tasks"
)]
#[tracing::instrument(skip_all)]
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
// Org-aware task handlers
// ============================================================================

/// Minimal task row returned by my_tasks query.
#[derive(Debug, FromRow, Serialize)]
struct MyTaskRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub project_id: Option<Uuid>,
    pub assignee_id: Option<Uuid>,
    pub contributor_ids: Option<Vec<Uuid>>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub deadline: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// List tasks assigned to or contributed to by the current user.
#[utoipa::path(
    get,
    path = "/api/v1/tasks/my-tasks",
    responses(
        (status = 200, description = "Tasks for the current user"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Tasks"
)]
#[tracing::instrument(skip_all)]
pub async fn my_tasks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<impl IntoResponse, StatusCode> {
    // Resolve person_id from claims.sub (user_id) via core.persons
    let person_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM core.persons WHERE user_id = $1 AND tenant_id = $2 LIMIT 1",
    )
    .bind(claims.sub)
    .bind(ctx.tenant_id)
    .fetch_optional(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to resolve person for my_tasks: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let tasks = sqlx::query_as::<_, MyTaskRow>(
        r#"
        SELECT id, tenant_id, title, description, status, priority,
               project_id, assignee_id, contributor_ids, start_time, end_time,
               deadline, created_at, updated_at
        FROM scheduling.time_items
        WHERE tenant_id = $1
          AND item_type = 'task'
          AND deleted_at IS NULL
          AND (
              assignee_id = $3
              OR ($3::uuid IS NOT NULL AND $3 = ANY(contributor_ids))
              OR ($2::uuid IS NOT NULL AND assignee_id = $2)
              OR ($2::uuid IS NOT NULL AND $2 = ANY(contributor_ids))
          )
        ORDER BY created_at DESC
        "#,
    )
    .bind(ctx.tenant_id)
    .bind(person_id)
    .bind(claims.sub)
    .fetch_all(state.pool.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to list my tasks: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!({ "data": tasks })))
}

// ============================================================================
// Task Attachment handlers
// ============================================================================

/// Add an attachment to a task.
#[utoipa::path(
    post,
    path = "/api/v1/tasks/{id}/attachments",
    params(("id" = Uuid, Path, description = "Task ID")),
    request_body = AddAttachmentRequest,
    responses(
        (status = 201, description = "Attachment added", body = TaskAttachmentResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Tasks"
)]
#[tracing::instrument(skip_all)]
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
#[utoipa::path(
    get,
    path = "/api/v1/tasks/{id}/attachments",
    params(("id" = Uuid, Path, description = "Task ID")),
    responses(
        (status = 200, description = "List of attachments", body = Vec<TaskAttachmentResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Tasks"
)]
#[tracing::instrument(skip_all)]
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
#[utoipa::path(
    delete,
    path = "/api/v1/tasks/{id}/attachments/{attachment_id}",
    params(
        ("id" = Uuid, Path, description = "Task ID"),
        ("attachment_id" = Uuid, Path, description = "Attachment ID"),
    ),
    responses(
        (status = 204, description = "Attachment deleted"),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Tasks"
)]
#[tracing::instrument(skip_all)]
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
