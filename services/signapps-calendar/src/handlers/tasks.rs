//! Task CRUD and tree operation handlers

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::pg_events::NewEvent;
use signapps_common::Claims;
use signapps_db::{models::*, TaskRepository};
use std::collections::HashMap;
use uuid::Uuid;

use crate::{services, AppState, CalendarError};

/// Create a new task
#[tracing::instrument(skip_all)]
pub async fn create_task(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateTask>,
) -> Result<(StatusCode, Json<Task>), CalendarError> {
    let tenant_id = claims.tenant_id.ok_or(CalendarError::Unauthorized)?;
    let repo = TaskRepository::new(&state.pool);

    // Validate parent if provided
    if let Some(parent_id) = payload.parent_task_id {
        // Check if parent exists and belongs to the same tenant
        repo.find_by_id(parent_id, tenant_id)
            .await
            .map_err(|_| CalendarError::InternalError)?
            .ok_or(CalendarError::InvalidInput(
                "Parent task not found".to_string(),
            ))?;
    }

    let task = repo
        .create(calendar_id, payload, claims.sub)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Index task in AI RAG
    let ai_client = state.ai_client.clone();
    let task_id = task.id;
    let title = task.title.clone();
    let desc = task.description.clone();
    tokio::spawn(async move {
        if let Err(e) = ai_client
            .index_entity(task_id, calendar_id, "tasks", &title, desc.as_deref())
            .await
        {
            tracing::error!("Failed to index new task in AI: {}", e);
        }
    });

    Ok((StatusCode::CREATED, Json(task)))
}

/// Get task by ID
#[tracing::instrument(skip_all)]
pub async fn get_task(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Task>, CalendarError> {
    let tenant_id = claims.tenant_id.ok_or(CalendarError::Unauthorized)?;
    let repo = TaskRepository::new(&state.pool);
    let task = repo
        .find_by_id(id, tenant_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    Ok(Json(task))
}

/// List all tasks in a calendar (root only)
#[tracing::instrument(skip_all)]
pub async fn list_root_tasks(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
) -> Result<Json<Vec<Task>>, CalendarError> {
    let repo = TaskRepository::new(&state.pool);
    let tasks = repo
        .list_root_tasks(calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(tasks))
}

/// Get all child tasks for a parent
#[tracing::instrument(skip_all)]
pub async fn list_children(
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<Task>>, CalendarError> {
    let repo = TaskRepository::new(&state.pool);
    let tasks = repo
        .list_children(task_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(tasks))
}

/// Update a task
#[tracing::instrument(skip_all)]
pub async fn update_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTask>,
) -> Result<Json<Task>, CalendarError> {
    let repo = TaskRepository::new(&state.pool);
    let task = repo
        .update(id, payload)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Update task in AI RAG
    let ai_client = state.ai_client.clone();
    let task_id = task.id;
    let calendar_id = task.calendar_id;
    let title = task.title.clone();
    let desc = task.description.clone();
    tokio::spawn(async move {
        if let Err(e) = ai_client
            .index_entity(task_id, calendar_id, "tasks", &title, desc.as_deref())
            .await
        {
            tracing::error!("Failed to update task in AI index: {}", e);
        }
    });

    Ok(Json(task))
}

#[derive(Debug, Deserialize)]
/// Request body for MoveTask.
pub struct MoveTaskRequest {
    pub new_parent_id: Option<Uuid>,
    pub position: Option<i32>,
}

/// Move task to new parent (change position in tree)
#[tracing::instrument(skip_all)]
pub async fn move_task(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<MoveTaskRequest>,
) -> Result<Json<Task>, CalendarError> {
    let tenant_id = claims.tenant_id.ok_or(CalendarError::Unauthorized)?;
    let repo = TaskRepository::new(&state.pool);

    // Get current task (scoped to tenant)
    let task = repo
        .find_by_id(id, tenant_id)
        .await
        .map_err(|_| CalendarError::InternalError)?
        .ok_or(CalendarError::NotFound)?;

    // Get all tasks in calendar to build parent map for cycle detection
    let all_tasks = repo
        .list_by_calendar(task.calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let mut parent_map = HashMap::new();
    for t in &all_tasks {
        parent_map.insert(t.id, t.parent_task_id);
    }

    // Validate the move
    services::task_tree::validate_parent_change(id, payload.new_parent_id, &parent_map)
        .map_err(CalendarError::InvalidInput)?;

    // Perform the move
    let updated = repo
        .move_task(id, payload.new_parent_id, payload.position)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    Ok(Json(updated))
}

/// Mark task as completed
#[tracing::instrument(skip_all)]
pub async fn complete_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    let repo = TaskRepository::new(&state.pool);
    repo.complete(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let _ = state
        .event_bus
        .publish(NewEvent {
            event_type: "calendar.task.completed".into(),
            aggregate_id: Some(id),
            payload: serde_json::json!({ "task_id": id }),
        })
        .await;

    Ok(StatusCode::OK)
}

/// Delete task (cascade to children)
#[tracing::instrument(skip_all)]
pub async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, CalendarError> {
    let repo = TaskRepository::new(&state.pool);
    repo.delete(id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Remove task from AI RAG
    let ai_client = state.ai_client.clone();
    tokio::spawn(async move {
        if let Err(e) = ai_client.remove_indexed_entity(id).await {
            tracing::error!("Failed to delete task from AI index: {}", e);
        }
    });

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Serialize)]
/// TaskTreeNode data transfer object.
pub struct TaskTreeNode {
    pub task: Task,
    pub children: Vec<TaskTreeNode>,
}

/// Get full task tree for a calendar
#[tracing::instrument(skip_all)]
pub async fn get_task_tree(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
) -> Result<Json<Vec<TaskTreeNode>>, CalendarError> {
    let repo = TaskRepository::new(&state.pool);

    // Get all tasks
    let all_tasks = repo
        .list_by_calendar(calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    // Build parent->children map
    let mut children_map: HashMap<Option<Uuid>, Vec<Task>> = HashMap::new();
    for task in &all_tasks {
        children_map
            .entry(task.parent_task_id)
            .or_default()
            .push(task.clone());
    }

    // Build tree recursively
    fn build_tree(
        parent_id: Option<Uuid>,
        children_map: &HashMap<Option<Uuid>, Vec<Task>>,
    ) -> Vec<TaskTreeNode> {
        let children = children_map.get(&parent_id).cloned().unwrap_or_default();

        children
            .into_iter()
            .map(|task| TaskTreeNode {
                children: build_tree(Some(task.id), children_map),
                task,
            })
            .collect()
    }

    let tree = build_tree(None, &children_map);
    Ok(Json(tree))
}

#[derive(Debug, Serialize)]
/// TaskTreeInfo data transfer object.
pub struct TaskTreeInfo {
    pub total_tasks: usize,
    pub max_depth: usize,
    pub root_count: usize,
}

/// Get task tree statistics
#[tracing::instrument(skip_all)]
pub async fn get_task_tree_info(
    State(state): State<AppState>,
    Path(calendar_id): Path<Uuid>,
) -> Result<Json<TaskTreeInfo>, CalendarError> {
    let repo = TaskRepository::new(&state.pool);

    let all_tasks = repo
        .list_by_calendar(calendar_id)
        .await
        .map_err(|_| CalendarError::InternalError)?;

    let root_count = all_tasks
        .iter()
        .filter(|t| t.parent_task_id.is_none())
        .count();

    let mut parent_map = HashMap::new();
    for task in &all_tasks {
        parent_map.insert(task.id, task.parent_task_id);
    }

    let max_depth = all_tasks
        .iter()
        .map(|t| services::task_tree::get_tree_depth(Some(t.id), &parent_map))
        .max()
        .unwrap_or(0);

    Ok(Json(TaskTreeInfo {
        total_tasks: all_tasks.len(),
        max_depth,
        root_count,
    }))
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
