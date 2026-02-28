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
    pub is_system: bool,
    pub is_managed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_name: Option<String>,
}

/// Extract store metadata from container labels JSONB.
fn extract_store_meta(
    labels: &Option<serde_json::Value>,
) -> (Option<String>, Vec<String>, Option<String>) {
    let Some(val) = labels else {
        return (None, vec![], None);
    };
    let category = val
        .get("signapps.app.category")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let tags = val
        .get("signapps.app.tags")
        .and_then(|v| v.as_str())
        .map(|s| {
            s.split(',')
                .map(|t| t.trim().to_string())
                .filter(|t| !t.is_empty())
                .collect()
        })
        .unwrap_or_default();
    let app_name = val
        .get("signapps.app.name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    (category, tags, app_name)
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

/// List containers from database with Docker info enrichment.
/// Admin (role >= 2) sees all containers, regular users see only their own.
#[tracing::instrument(skip(state))]
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<ContainerResponse>>> {
    let repo = ContainerRepository::new(&state.pool);
    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    // Admin (role >= 2) sees all, otherwise filter by owner_id
    let db_containers = if claims.role >= 2 {
        repo.list(limit, offset).await?
    } else {
        repo.list_by_owner(claims.sub).await?
    };

    // Get Docker containers
    let docker_containers = state
        .docker
        .list_containers(query.all.unwrap_or(true))
        .await
        .unwrap_or_default();

    // Create lookup map by docker_id
    let docker_map: std::collections::HashMap<_, _> = docker_containers
        .iter()
        .map(|c| (c.id.clone(), c.clone()))
        .collect();

    // Track which docker IDs have been matched to DB records
    let mut matched_docker_ids: std::collections::HashSet<String> =
        std::collections::HashSet::new();

    // Merge DB containers with Docker info
    let mut response: Vec<ContainerResponse> = db_containers
        .into_iter()
        .map(|c| {
            let docker_info = c.docker_id.as_ref().and_then(|did| {
                matched_docker_ids.insert(did.clone());
                docker_map.get(did).cloned()
            });
            let (category, tags, app_name) = extract_store_meta(&c.labels);

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
                is_system: false,
                is_managed: true,
                category,
                tags,
                app_name,
            }
        })
        .collect();

    // For admin users, also include Docker-only containers (not in DB)
    if claims.role >= 2 {
        for docker_container in docker_containers.iter() {
            if matched_docker_ids.contains(&docker_container.id) {
                continue;
            }

            let is_system = docker_container.name.starts_with("signapps-")
                || docker_container.name.starts_with("signapps_")
                || docker_container
                    .labels
                    .get("com.docker.compose.project")
                    .map(|p| p.contains("signapps"))
                    .unwrap_or(false);

            // Generate deterministic UUID from docker ID
            let id = Uuid::new_v5(&Uuid::NAMESPACE_DNS, docker_container.id.as_bytes());

            response.push(ContainerResponse {
                id,
                docker_id: Some(docker_container.id.clone()),
                name: docker_container.name.clone(),
                image: docker_container.image.clone(),
                status: Some(docker_container.status.clone()),
                owner_id: None,
                auto_update: false,
                created_at: docker_container.created.clone(),
                docker_info: Some(docker_container.clone()),
                is_system,
                is_managed: false,
                category: None,
                tags: vec![],
                app_name: None,
            });
        }
    }

    // Sort: user/managed containers first, system containers last
    response.sort_by(|a, b| a.is_system.cmp(&b.is_system).then(a.name.cmp(&b.name)));

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

    let (category, tags, app_name) = extract_store_meta(&container.labels);

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
        is_system: false,
        is_managed: true,
        category,
        tags,
        app_name,
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

    let (category, tags, app_name) = extract_store_meta(&container.labels);

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
        is_system: false,
        is_managed: true,
        category,
        tags,
        app_name,
    }))
}

/// Start a container.
/// If the container has no docker_id but has a saved config, create it first.
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

    let docker_id = match container.docker_id {
        Some(did) => did,
        None => {
            // No Docker container yet — try to create from saved config
            let config: crate::docker::ContainerConfig = container
                .config
                .as_ref()
                .and_then(|c| serde_json::from_value(c.clone()).ok())
                .ok_or_else(|| {
                    Error::BadRequest(
                        "Container not linked to Docker and no saved config".to_string(),
                    )
                })?;

            tracing::info!(
                container_id = %id,
                image = %config.image,
                "Creating Docker container from saved config"
            );

            // Pull image first
            let _ = state.docker.pull_image(&config.image).await;

            let new_id = state.docker.create_container(config).await?;
            repo.update_docker_info(id, &new_id, "created").await?;
            new_id
        },
    };

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

/// Update a container (pull latest image and recreate).
#[tracing::instrument(skip(state))]
pub async fn update(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ContainerResponse>> {
    let repo = ContainerRepository::new(&state.pool);

    let container = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Container {}", id)))?;

    // Check ownership if not admin
    if claims.role < 2 && container.owner_id != Some(claims.sub) {
        return Err(Error::ContainerNotOwned(id.to_string()));
    }

    let docker_id = container
        .docker_id
        .as_ref()
        .ok_or_else(|| Error::BadRequest("Container not linked to Docker".to_string()))?;

    // Get the saved container config from DB
    let config: crate::docker::ContainerConfig = container
        .config
        .as_ref()
        .and_then(|c| serde_json::from_value(c.clone()).ok())
        .ok_or_else(|| Error::BadRequest("No saved config for this container".to_string()))?;

    // Pull latest image
    tracing::info!(image = %config.image, "Pulling latest image for update");
    state.docker.pull_image(&config.image).await?;

    // Stop the old container
    let _ = state.docker.stop_container(docker_id, Some(10)).await;

    // Remove the old container
    state
        .docker
        .remove_container(docker_id, true, false)
        .await?;

    // Create new container with same config
    let new_docker_id = state.docker.create_container(config).await?;

    // Update DB with new docker ID
    repo.update_docker_info(id, &new_docker_id, "created")
        .await?;

    // Start the new container
    state.docker.start_container(&new_docker_id).await?;
    repo.update_status(id, "running").await?;

    tracing::info!(
        container_id = %id,
        new_docker_id = %new_docker_id,
        "Container updated with latest image"
    );

    let docker_info = state.docker.get_container(&new_docker_id).await.ok();

    let (category, tags, app_name) = extract_store_meta(&container.labels);

    Ok(Json(ContainerResponse {
        id: container.id,
        docker_id: Some(new_docker_id),
        name: container.name,
        image: container.image,
        status: Some("running".to_string()),
        owner_id: container.owner_id,
        auto_update: container.auto_update,
        created_at: container.created_at.to_rfc3339(),
        docker_info,
        is_system: false,
        is_managed: true,
        category,
        tags,
        app_name,
    }))
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

/// Start a Docker container directly by docker_id.
#[tracing::instrument(skip(state))]
pub async fn start_docker(
    State(state): State<AppState>,
    Path(docker_id): Path<String>,
) -> Result<Json<ActionResponse>> {
    // Check if this is a system container - block if so
    let info = state.docker.get_container(&docker_id).await?;
    let is_system = info.name.starts_with("signapps-")
        || info.name.starts_with("signapps_")
        || info
            .labels
            .get("com.docker.compose.project")
            .map(|p| p.contains("signapps"))
            .unwrap_or(false);

    if is_system {
        return Err(Error::Forbidden(
            "Cannot modify system containers".to_string(),
        ));
    }

    state.docker.start_container(&docker_id).await?;

    Ok(Json(ActionResponse {
        success: true,
        message: "Docker container started".to_string(),
    }))
}

/// Restart a Docker container directly by docker_id.
#[tracing::instrument(skip(state))]
pub async fn restart_docker(
    State(state): State<AppState>,
    Path(docker_id): Path<String>,
) -> Result<Json<ActionResponse>> {
    state.docker.restart_container(&docker_id, None).await?;

    Ok(Json(ActionResponse {
        success: true,
        message: "Docker container restarted".to_string(),
    }))
}

/// Get logs from a Docker container directly by docker_id.
#[tracing::instrument(skip(state))]
pub async fn logs_docker(
    State(state): State<AppState>,
    Path(docker_id): Path<String>,
    Query(query): Query<LogsQuery>,
) -> Result<Json<Vec<String>>> {
    let logs = state.docker.get_logs(&docker_id, query.tail).await?;
    Ok(Json(logs))
}

/// Get stats from a Docker container directly by docker_id.
#[tracing::instrument(skip(state))]
pub async fn stats_docker(
    State(state): State<AppState>,
    Path(docker_id): Path<String>,
) -> Result<Json<ContainerStats>> {
    let stats = state.docker.get_stats(&docker_id).await?;
    Ok(Json(stats))
}

/// Inspect a Docker container directly by docker_id (for unmanaged containers).
#[tracing::instrument(skip(state))]
pub async fn inspect_docker(
    State(state): State<AppState>,
    Path(docker_id): Path<String>,
) -> Result<Json<ContainerInfo>> {
    let info = state.docker.get_container(&docker_id).await?;
    Ok(Json(info))
}

/// Stop a Docker container directly by docker_id.
#[tracing::instrument(skip(state))]
pub async fn stop_docker(
    State(state): State<AppState>,
    Path(docker_id): Path<String>,
    Json(payload): Json<Option<StopRequest>>,
) -> Result<Json<ActionResponse>> {
    let timeout = payload.and_then(|p| p.timeout_secs);
    state.docker.stop_container(&docker_id, timeout).await?;

    Ok(Json(ActionResponse {
        success: true,
        message: "Docker container stopped".to_string(),
    }))
}

/// Remove a Docker container directly by docker_id.
#[tracing::instrument(skip(state))]
pub async fn remove_docker(
    State(state): State<AppState>,
    Path(docker_id): Path<String>,
) -> Result<StatusCode> {
    // Try to stop first, ignore errors
    let _ = state.docker.stop_container(&docker_id, Some(5)).await;
    state
        .docker
        .remove_container(&docker_id, true, false)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
