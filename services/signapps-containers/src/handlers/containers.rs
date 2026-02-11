//! Container management handlers.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};
use signapps_db::models::CreateContainer;
use signapps_db::repositories::ContainerRepository;
use uuid::Uuid;

use crate::docker::{ContainerConfig, ContainerInfo, ContainerStats};
use crate::AppState;

/// Query parameters for listing containers.
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub all: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Container response with DB and Docker info.
#[derive(Debug, Serialize)]
pub struct ContainerResponse {
    pub id: Uuid,
    pub docker_id: Option<String>,
    pub name: String,
    pub image: String,
    pub status: Option<String>,
    pub owner_id: Option<Uuid>,
    pub auto_update: bool,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub docker_info: Option<ContainerInfo>,
}

/// Container action response.
#[derive(Debug, Serialize)]
pub struct ActionResponse {
    pub success: bool,
    pub message: String,
}

/// Stop container request.
#[derive(Debug, Deserialize)]
pub struct StopRequest {
    pub timeout_secs: Option<i64>,
}

/// Logs query parameters.
#[derive(Debug, Deserialize)]
pub struct LogsQuery {
    pub tail: Option<usize>,
}

/// List all containers from database with Docker info enrichment.
#[tracing::instrument(skip(state))]
pub async fn list(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<ContainerResponse>>> {
    let repo = ContainerRepository::new(&state.pool);
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    // Get containers from database
    let db_containers = repo.list(limit, offset).await?;

    // Get Docker containers
    let docker_containers = state
        .docker
        .list_containers(query.all.unwrap_or(true))
        .await
        .unwrap_or_default();

    // Create lookup map by docker_id
    let docker_map: std::collections::HashMap<_, _> = docker_containers
        .into_iter()
        .map(|c| (c.id.clone(), c))
        .collect();

    // Merge data
    let response: Vec<ContainerResponse> = db_containers
        .into_iter()
        .map(|c| {
            let docker_info = c
                .docker_id
                .as_ref()
                .and_then(|did| docker_map.get(did).cloned());

            ContainerResponse {
                id: c.id,
                docker_id: c.docker_id,
                name: c.name,
                image: c.image,
                status: docker_info.as_ref().map(|d| d.status.clone()).or(c.status),
                owner_id: c.owner_id,
                auto_update: c.auto_update,
                created_at: c.created_at.to_rfc3339(),
                docker_info,
            }
        })
        .collect();

    Ok(Json(response))
}

/// List all Docker containers directly (including system containers).
#[allow(dead_code)]
#[tracing::instrument(skip(state))]
pub async fn list_docker(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<ContainerInfo>>> {
    let containers = state
        .docker
        .list_containers(query.all.unwrap_or(true))
        .await?;

    Ok(Json(containers))
}

/// Get container by ID.
#[tracing::instrument(skip(state))]
pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ContainerResponse>> {
    let repo = ContainerRepository::new(&state.pool);

    let container = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Container {}", id)))?;

    // Get Docker info if available
    let docker_info = if let Some(ref docker_id) = container.docker_id {
        state.docker.get_container(docker_id).await.ok()
    } else {
        None
    };

    Ok(Json(ContainerResponse {
        id: container.id,
        docker_id: container.docker_id,
        name: container.name,
        image: container.image,
        status: docker_info
            .as_ref()
            .map(|d| d.status.clone())
            .or(container.status),
        owner_id: container.owner_id,
        auto_update: container.auto_update,
        created_at: container.created_at.to_rfc3339(),
        docker_info,
    }))
}

/// Create a new container.
#[tracing::instrument(skip(state, payload))]
pub async fn create(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<ContainerConfig>,
) -> Result<Json<ContainerResponse>> {
    let repo = ContainerRepository::new(&state.pool);

    // Check user quota if not admin
    if claims.role < 2 {
        if let Some(quota) = repo.get_quota(claims.sub).await? {
            if quota.current_containers >= quota.max_containers {
                return Err(Error::Forbidden("Container quota exceeded".to_string()));
            }
        }
    }

    // Create record in database
    let db_container = CreateContainer {
        name: payload.name.clone(),
        image: payload.image.clone(),
        config: serde_json::to_value(&payload).ok(),
        labels: payload
            .labels
            .as_ref()
            .map(|l| serde_json::to_value(l).unwrap()),
        auto_update: payload.auto_update,
    };

    let owner_id = if claims.role >= 2 {
        None
    } else {
        Some(claims.sub)
    };
    let container = repo.create(db_container, owner_id).await?;

    // Create Docker container
    let docker_id = state.docker.create_container(payload).await?;

    // Update database with Docker ID
    repo.update_docker_info(container.id, &docker_id, "created")
        .await?;

    // Start the container
    state.docker.start_container(&docker_id).await?;

    // Update status
    repo.update_status(container.id, "running").await?;

    // Update quota
    if let Some(owner) = owner_id {
        repo.increment_usage(owner, 1, 0.0, 0, 0).await?;
    }

    tracing::info!(container_id = %container.id, docker_id = %docker_id, "Container created and started");

    // Get final info
    let docker_info = state.docker.get_container(&docker_id).await.ok();

    Ok(Json(ContainerResponse {
        id: container.id,
        docker_id: Some(docker_id),
        name: container.name,
        image: container.image,
        status: Some("running".to_string()),
        owner_id,
        auto_update: container.auto_update,
        created_at: container.created_at.to_rfc3339(),
        docker_info,
    }))
}

/// Start a container.
#[tracing::instrument(skip(state))]
pub async fn start(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ActionResponse>> {
    let repo = ContainerRepository::new(&state.pool);

    let container = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Container {}", id)))?;

    let docker_id = container
        .docker_id
        .ok_or_else(|| Error::BadRequest("Container not linked to Docker".to_string()))?;

    state.docker.start_container(&docker_id).await?;
    repo.update_status(id, "running").await?;

    Ok(Json(ActionResponse {
        success: true,
        message: "Container started".to_string(),
    }))
}

/// Stop a container.
#[tracing::instrument(skip(state))]
pub async fn stop(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<Option<StopRequest>>,
) -> Result<Json<ActionResponse>> {
    let repo = ContainerRepository::new(&state.pool);

    let container = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Container {}", id)))?;

    let docker_id = container
        .docker_id
        .ok_or_else(|| Error::BadRequest("Container not linked to Docker".to_string()))?;

    let timeout = payload.and_then(|p| p.timeout_secs);
    state.docker.stop_container(&docker_id, timeout).await?;
    repo.update_status(id, "exited").await?;

    Ok(Json(ActionResponse {
        success: true,
        message: "Container stopped".to_string(),
    }))
}

/// Restart a container.
#[tracing::instrument(skip(state))]
pub async fn restart(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ActionResponse>> {
    let repo = ContainerRepository::new(&state.pool);

    let container = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Container {}", id)))?;

    let docker_id = container
        .docker_id
        .ok_or_else(|| Error::BadRequest("Container not linked to Docker".to_string()))?;

    state.docker.restart_container(&docker_id, None).await?;
    repo.update_status(id, "running").await?;

    Ok(Json(ActionResponse {
        success: true,
        message: "Container restarted".to_string(),
    }))
}

/// Delete a container.
#[tracing::instrument(skip(state))]
pub async fn delete(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let repo = ContainerRepository::new(&state.pool);

    let container = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Container {}", id)))?;

    // Check ownership if not admin
    if claims.role < 2 && container.owner_id != Some(claims.sub) {
        return Err(Error::ContainerNotOwned(id.to_string()));
    }

    // Remove Docker container if exists
    if let Some(docker_id) = &container.docker_id {
        // Try to stop first, ignore errors
        let _ = state.docker.stop_container(docker_id, Some(5)).await;
        state
            .docker
            .remove_container(docker_id, true, false)
            .await?;
    }

    // Delete from database
    repo.delete(id).await?;

    // Update quota
    if let Some(owner) = container.owner_id {
        repo.increment_usage(owner, -1, 0.0, 0, 0).await?;
    }

    tracing::info!(container_id = %id, "Container deleted");

    Ok(StatusCode::NO_CONTENT)
}

/// Get container logs.
#[tracing::instrument(skip(state))]
pub async fn logs(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<LogsQuery>,
) -> Result<Json<Vec<String>>> {
    let repo = ContainerRepository::new(&state.pool);

    let container = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Container {}", id)))?;

    let docker_id = container
        .docker_id
        .ok_or_else(|| Error::BadRequest("Container not linked to Docker".to_string()))?;

    let logs = state.docker.get_logs(&docker_id, query.tail).await?;

    Ok(Json(logs))
}

/// Get container stats.
#[tracing::instrument(skip(state))]
pub async fn stats(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ContainerStats>> {
    let repo = ContainerRepository::new(&state.pool);

    let container = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Container {}", id)))?;

    let docker_id = container
        .docker_id
        .ok_or_else(|| Error::BadRequest("Container not linked to Docker".to_string()))?;

    let stats = state.docker.get_stats(&docker_id).await?;

    Ok(Json(stats))
}

/// List containers for current user.
#[tracing::instrument(skip(state))]
pub async fn my_containers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ContainerResponse>>> {
    let repo = ContainerRepository::new(&state.pool);

    let containers = repo.list_by_owner(claims.sub).await?;

    let docker_containers = state.docker.list_containers(true).await.unwrap_or_default();

    let docker_map: std::collections::HashMap<_, _> = docker_containers
        .into_iter()
        .map(|c| (c.id.clone(), c))
        .collect();

    let response: Vec<ContainerResponse> = containers
        .into_iter()
        .map(|c| {
            let docker_info = c
                .docker_id
                .as_ref()
                .and_then(|did| docker_map.get(did).cloned());

            ContainerResponse {
                id: c.id,
                docker_id: c.docker_id,
                name: c.name,
                image: c.image,
                status: docker_info.as_ref().map(|d| d.status.clone()).or(c.status),
                owner_id: c.owner_id,
                auto_update: c.auto_update,
                created_at: c.created_at.to_rfc3339(),
                docker_info,
            }
        })
        .collect();

    Ok(Json(response))
}
