use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};
use signapps_common::{Claims, Error, Result};
use signapps_db::models::CreateContainer;
use signapps_db::repositories::ContainerRepository;
use uuid::Uuid;

use crate::docker::{ContainerConfig, PortMapping, VolumeMount, RestartPolicy};
use crate::store::types::*;
use crate::AppState;

use super::containers::ContainerResponse;

/// List all apps from the store catalog.
pub async fn list_apps(
    State(state): State<AppState>,
    Query(query): Query<ListAppsQuery>,
) -> Result<Json<Vec<StoreApp>>> {
    let apps = state
        .store
        .list_apps(query.search.as_deref(), query.category.as_deref())
        .await;
    Ok(Json(apps))
}

/// Get app details including parsed compose config.
pub async fn get_app_details(
    State(state): State<AppState>,
    Path((source_id, app_id)): Path<(Uuid, String)>,
) -> Result<Json<AppDetails>> {
    let app = state
        .store
        .get_app(source_id, &app_id)
        .await
        .ok_or_else(|| Error::NotFound(format!("App {app_id}")))?;

    let config = state
        .store
        .fetch_compose(&app.compose_url)
        .await
        .map_err(|e| Error::Internal(e.to_string()))?;

    Ok(Json(AppDetails { app, config }))
}

/// Install an app from the store.
pub async fn install_app(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<InstallRequest>,
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

    // Fetch compose config
    let app = state
        .store
        .get_app(req.source_id, &req.app_id)
        .await
        .ok_or_else(|| Error::NotFound(format!("App {}", req.app_id)))?;

    let parsed = state
        .store
        .fetch_compose(&app.compose_url)
        .await
        .map_err(|e| Error::Internal(e.to_string()))?;

    // Use the first service from the compose file
    let svc = parsed
        .services
        .first()
        .ok_or_else(|| Error::BadRequest("No services in compose file".to_string()))?;

    // Build environment variables
    let mut env_vars: Vec<String> = Vec::new();
    for ev in &svc.environment {
        let val = req
            .environment
            .as_ref()
            .and_then(|m| m.get(&ev.key))
            .or(ev.default.as_ref())
            .cloned()
            .unwrap_or_default();
        env_vars.push(format!("{}={}", ev.key, val));
    }

    // Build port mappings
    let ports: Vec<PortMapping> = if let Some(overrides) = &req.ports {
        overrides
            .iter()
            .map(|p| PortMapping {
                host: p.host,
                container: p.container,
                protocol: p.protocol.clone().unwrap_or_else(|| "tcp".into()),
                host_ip: None,
            })
            .collect()
    } else {
        svc.ports
            .iter()
            .map(|p| PortMapping {
                host: p.host,
                container: p.container,
                protocol: p.protocol.clone(),
                host_ip: None,
            })
            .collect()
    };

    // Build volume mounts
    let volumes: Vec<VolumeMount> = if let Some(overrides) = &req.volumes {
        overrides
            .iter()
            .map(|v| VolumeMount {
                source: v.source.replace("{ServiceName}", &req.container_name),
                target: v.target.clone(),
                read_only: false,
            })
            .collect()
    } else {
        svc.volumes
            .iter()
            .map(|v| VolumeMount {
                source: v.source.replace("{ServiceName}", &req.container_name),
                target: v.target.clone(),
                read_only: v.read_only,
            })
            .collect()
    };

    // Map restart policy
    let restart_policy = match svc.restart.as_str() {
        "always" => Some(RestartPolicy::Always),
        "on-failure" => Some(RestartPolicy::OnFailure),
        "unless-stopped" => Some(RestartPolicy::UnlessStopped),
        "no" => Some(RestartPolicy::No),
        _ => Some(RestartPolicy::UnlessStopped),
    };

    // Build container config (same type used by containers::create)
    let config = ContainerConfig {
        name: req.container_name.clone(),
        image: svc.image.clone(),
        cmd: svc.command.clone(),
        env: Some(env_vars),
        ports: if ports.is_empty() { None } else { Some(ports) },
        volumes: if volumes.is_empty() {
            None
        } else {
            Some(volumes)
        },
        labels: if svc.labels.is_empty() {
            None
        } else {
            Some(svc.labels.clone())
        },
        restart_policy,
        resources: None,
        network_mode: None,
        networks: None,
        hostname: svc.hostname.clone(),
        working_dir: None,
        user: None,
        auto_update: None,
    };

    // --- Reuse the same flow as containers::create ---

    // Pull image first
    tracing::info!(image = %config.image, "Pulling image for store install");
    if let Err(e) = state.docker.pull_image(&config.image).await {
        tracing::warn!(image = %config.image, "Image pull failed (may already exist): {e}");
    }

    // Create DB record
    let db_container = CreateContainer {
        name: config.name.clone(),
        image: config.image.clone(),
        config: serde_json::to_value(&config).ok(),
        labels: config
            .labels
            .as_ref()
            .map(|l| serde_json::to_value(l).unwrap()),
        auto_update: None,
    };

    let owner_id = if claims.role >= 2 {
        None
    } else {
        Some(claims.sub)
    };
    let container = repo.create(db_container, owner_id).await?;

    // Create Docker container
    let docker_id = state.docker.create_container(config).await?;

    // Link Docker to DB
    repo.update_docker_info(container.id, &docker_id, "created")
        .await?;

    // Start container if requested (default: true)
    let auto_start = req.auto_start.unwrap_or(true);
    let status = if auto_start {
        state.docker.start_container(&docker_id).await?;
        repo.update_status(container.id, "running").await?;
        "running".to_string()
    } else {
        "created".to_string()
    };

    // Update quota
    if let Some(owner) = owner_id {
        repo.increment_usage(owner, 1, 0.0, 0, 0).await?;
    }

    tracing::info!(
        container_id = %container.id,
        docker_id = %docker_id,
        app = %req.app_id,
        "Store app installed"
    );

    let docker_info = state.docker.get_container(&docker_id).await.ok();

    Ok(Json(ContainerResponse {
        id: container.id,
        docker_id: Some(docker_id),
        name: container.name,
        image: container.image,
        status: Some(status),
        owner_id,
        auto_update: container.auto_update,
        created_at: container.created_at.to_rfc3339(),
        docker_info,
        is_system: false,
        is_managed: true,
    }))
}

/// List all sources.
pub async fn list_sources(State(state): State<AppState>) -> Result<Json<Vec<AppSource>>> {
    let sources = state
        .store
        .list_sources()
        .await
        .map_err(|e| Error::Internal(e.to_string()))?;
    Ok(Json(sources))
}

/// Add a new source (admin only).
pub async fn add_source(
    State(state): State<AppState>,
    Json(req): Json<AddSourceRequest>,
) -> Result<Json<AppSource>> {
    let source = state
        .store
        .add_source(&req.name, &req.url)
        .await
        .map_err(|e| Error::Internal(e.to_string()))?;
    Ok(Json(source))
}

/// Delete a source (admin only).
pub async fn delete_source(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    state
        .store
        .delete_source(id)
        .await
        .map_err(|e| Error::Internal(e.to_string()))?;
    Ok(Json(serde_json::json!({ "success": true })))
}

/// Refresh a single source (admin only).
pub async fn refresh_source(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let count = state
        .store
        .refresh_source(id)
        .await
        .map_err(|e| Error::Internal(e.to_string()))?;
    Ok(Json(serde_json::json!({ "success": true, "app_count": count })))
}

/// Refresh all sources (admin only).
pub async fn refresh_all(State(state): State<AppState>) -> Result<Json<serde_json::Value>> {
    state.store.refresh_sources().await;
    Ok(Json(serde_json::json!({ "success": true })))
}
