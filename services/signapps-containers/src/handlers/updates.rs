//! Container auto-update handlers.

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use signapps_db::repositories::ContainerRepository;
use uuid::Uuid;

use crate::AppState;

/// Check-update response.
#[derive(Debug, Serialize)]
pub struct CheckUpdateResponse {
    pub update_available: bool,
    pub current_digest: Option<String>,
    pub latest_digest: Option<String>,
}

/// Auto-update toggle request.
#[derive(Debug, Deserialize)]
pub struct SetAutoUpdateRequest {
    pub auto_update: bool,
}

/// Auto-update toggle response.
#[derive(Debug, Serialize)]
pub struct AutoUpdateResponse {
    pub auto_update: bool,
}

/// Update status for a single container.
#[derive(Debug, Serialize)]
pub struct ContainerUpdateStatus {
    pub id: Uuid,
    pub name: String,
    pub image: String,
    pub auto_update: bool,
    pub update_available: Option<bool>,
    pub last_checked: Option<String>,
}

/// Global update status response.
#[derive(Debug, Serialize)]
pub struct UpdatesStatusResponse {
    pub containers: Vec<ContainerUpdateStatus>,
}

/// Check if an update is available for a specific container.
#[tracing::instrument(skip_all)]
pub async fn check_update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<CheckUpdateResponse>> {
    let repo = ContainerRepository::new(&state.pool);

    let container = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Container {}", id)))?;

    let (update_available, current_digest, latest_digest) = state
        .docker
        .check_image_update(&container.image)
        .await
        .unwrap_or((false, None, None));

    Ok(Json(CheckUpdateResponse {
        update_available,
        current_digest,
        latest_digest,
    }))
}

/// Toggle auto-update for a container.
#[tracing::instrument(skip_all)]
pub async fn set_auto_update(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<SetAutoUpdateRequest>,
) -> Result<Json<AutoUpdateResponse>> {
    let repo = ContainerRepository::new(&state.pool);

    let container = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| Error::NotFound(format!("Container {}", id)))?;

    // Update auto_update flag in DB
    sqlx::query("UPDATE containers.managed SET auto_update = $2 WHERE id = $1")
        .bind(container.id)
        .bind(req.auto_update)
        .execute(&*state.pool)
        .await
        .map_err(|e| Error::Internal(format!("Failed to update auto_update: {}", e)))?;

    tracing::info!(
        container_id = %id,
        auto_update = req.auto_update,
        "Auto-update toggled"
    );

    Ok(Json(AutoUpdateResponse {
        auto_update: req.auto_update,
    }))
}

/// Get update status for all containers.
#[tracing::instrument(skip_all)]
pub async fn updates_status(State(state): State<AppState>) -> Result<Json<UpdatesStatusResponse>> {
    let repo = ContainerRepository::new(&state.pool);
    let containers = repo.list(100, 0).await?;

    let statuses: Vec<ContainerUpdateStatus> = containers
        .into_iter()
        .map(|c| ContainerUpdateStatus {
            id: c.id,
            name: c.name,
            image: c.image,
            auto_update: c.auto_update,
            update_available: None,
            last_checked: None,
        })
        .collect();

    Ok(Json(UpdatesStatusResponse {
        containers: statuses,
    }))
}

/// Background auto-update task. Checks all containers with auto_update=true
/// and updates them if a newer image is available.
#[tracing::instrument(skip_all)]
pub async fn run_auto_update_task(
    docker: crate::docker::DockerClient,
    pool: signapps_db::DatabasePool,
) {
    let interval = std::time::Duration::from_secs(6 * 3600); // 6 hours

    loop {
        tokio::time::sleep(interval).await;

        tracing::info!("Starting auto-update check");
        let repo = ContainerRepository::new(&pool);

        let containers = match repo.list(500, 0).await {
            Ok(c) => c,
            Err(e) => {
                tracing::error!("Auto-update: failed to list containers: {e}");
                continue;
            },
        };

        for container in containers {
            if !container.auto_update {
                continue;
            }

            let docker_id = match &container.docker_id {
                Some(id) => id.clone(),
                None => continue,
            };

            tracing::info!(
                container = %container.name,
                image = %container.image,
                "Checking for updates"
            );

            let (has_update, _, _) = match docker.check_image_update(&container.image).await {
                Ok(result) => result,
                Err(e) => {
                    tracing::warn!(
                        container = %container.name,
                        "Update check failed: {e}"
                    );
                    continue;
                },
            };

            if !has_update {
                tracing::debug!(container = %container.name, "No update available");
                continue;
            }

            tracing::info!(
                container = %container.name,
                "Update available, performing auto-update"
            );

            // Pull latest image
            if let Err(e) = docker.pull_image(&container.image).await {
                tracing::error!(
                    container = %container.name,
                    "Failed to pull image: {e}"
                );
                continue;
            }

            // Get the saved config
            let config: crate::docker::ContainerConfig = match container
                .config
                .as_ref()
                .and_then(|c| serde_json::from_value(c.clone()).ok())
            {
                Some(c) => c,
                None => {
                    tracing::warn!(
                        container = %container.name,
                        "No saved config, skipping update"
                    );
                    continue;
                },
            };

            // Stop old container
            let _ = docker.stop_container(&docker_id, Some(10)).await;

            // Remove old container
            if let Err(e) = docker.remove_container(&docker_id, true, false).await {
                tracing::error!(
                    container = %container.name,
                    "Failed to remove old container: {e}"
                );
                continue;
            }

            // Create new container with same config
            let new_docker_id = match docker.create_container(config).await {
                Ok(id) => id,
                Err(e) => {
                    tracing::error!(
                        container = %container.name,
                        "Failed to create updated container: {e}"
                    );
                    continue;
                },
            };

            // Update DB
            let _ = repo
                .update_docker_info(container.id, &new_docker_id, "created")
                .await;

            // Start
            if let Err(e) = docker.start_container(&new_docker_id).await {
                tracing::error!(
                    container = %container.name,
                    "Failed to start updated container: {e}"
                );
                continue;
            }

            let _ = repo.update_status(container.id, "running").await;

            tracing::info!(
                container = %container.name,
                new_docker_id = %new_docker_id,
                "Auto-update complete"
            );
        }

        tracing::info!("Auto-update check finished");
    }
}
