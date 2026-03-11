//! Docker Compose import handler.
//!
//! Allows importing raw YAML/JSON compose files to create containers
//! without going through the App Store.

use axum::{extract::Extension, extract::State, Json};
use signapps_common::{Claims, Error, Result};
use signapps_db::models::CreateContainer;
use signapps_db::repositories::ContainerRepository;

use crate::docker::{ContainerConfig, PortMapping, RestartPolicy, VolumeMount};
use crate::store::parser::{parse_compose, resolve_store_templates};
use crate::store::types::ParsedAppConfig;
use crate::AppState;

use super::containers::ContainerResponse;

/// Import compose request body.
#[derive(Debug, serde::Deserialize)]
pub struct ImportComposeRequest {
    /// Raw YAML or JSON content of the compose file.
    pub yaml: String,
    /// Whether to auto-start containers after creation.
    pub auto_start: Option<bool>,
}

/// Preview response showing parsed services before install.
#[derive(Debug, serde::Serialize)]
pub struct ComposePreview {
    pub services: Vec<ServicePreview>,
}

/// Preview of a single service parsed from compose.
#[derive(Debug, serde::Serialize)]
pub struct ServicePreview {
    pub service_name: String,
    pub image: String,
    pub ports: Vec<PortPreview>,
    pub environment: Vec<EnvPreview>,
    pub volumes: Vec<VolumePreview>,
}

#[derive(Debug, serde::Serialize)]
pub struct PortPreview {
    pub host: u16,
    pub container: u16,
    pub protocol: String,
}

#[derive(Debug, serde::Serialize)]
pub struct EnvPreview {
    pub key: String,
    pub default: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct VolumePreview {
    pub source: String,
    pub target: String,
}

/// Preview a compose file without installing.
pub async fn preview_compose(
    Json(req): Json<ImportComposeRequest>,
) -> Result<Json<ComposePreview>> {
    let parsed = parse_compose(&req.yaml, true)
        .map_err(|e| Error::BadRequest(format!("Failed to parse compose: {e}")))?;

    let preview = build_preview(&parsed);
    Ok(Json(preview))
}

/// Import and install containers from a raw compose file.
pub async fn import_compose(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<ImportComposeRequest>,
) -> Result<Json<Vec<ContainerResponse>>> {
    let repo = ContainerRepository::new(&state.pool);

    // Check user quota if not admin
    let parsed = parse_compose(&req.yaml, true)
        .map_err(|e| Error::BadRequest(format!("Failed to parse compose: {e}")))?;

    let service_count = parsed.services.len();
    if claims.role < 2 {
        if let Some(quota) = repo.get_quota(claims.sub).await? {
            if quota.current_containers + service_count as i32 > quota.max_containers {
                return Err(Error::Forbidden("Container quota exceeded".to_string()));
            }
        }
    }

    let owner_id = if claims.role >= 2 {
        None
    } else {
        Some(claims.sub)
    };

    let auto_start = req.auto_start.unwrap_or(true);
    let mut results = Vec::new();

    // Track ports assigned within this batch
    let mut batch_assigned_ports: std::collections::HashSet<u16> = std::collections::HashSet::new();

    for svc in &parsed.services {
        let container_name = svc.container_name.as_deref().unwrap_or(&svc.service_name);

        // Analyze environment for DB dynamic creation
        let mut needs_db = false;
        let app_id_for_db = container_name.to_string(); // In raw compose, we use the container name as app_id for isolating

        for ev in &svc.environment {
            let val = ev.default.as_deref().unwrap_or("");
            if val.contains("{SignApps.Database.Name}") || val.contains("{SignApps.Database.Url}") {
                needs_db = true;
                break;
            }
        }

        let db_name_opt = if needs_db {
            match crate::handlers::store::provision_app_database(&state.pool, &app_id_for_db).await
            {
                Ok(name) => Some(name),
                Err(e) => {
                    let msg = format!(
                        "Failed to provision database for {}: {:?}",
                        app_id_for_db, e
                    );
                    tracing::error!(msg);
                    return Err(Error::Internal(msg));
                },
            }
        } else {
            None
        };

        // Build environment variables
        let mut env_vars: Vec<String> = Vec::new();
        for ev in &svc.environment {
            let mut val = ev.default.clone().unwrap_or_default();
            val = resolve_store_templates(&val, container_name);

            if let Some(ref db_name) = db_name_opt {
                val = val.replace("{SignApps.Database.Name}", db_name);

                if val.contains("{SignApps.Database.Url}") {
                    let base_urlv = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
                        "postgres://postgres:postgres@localhost:5432/signapps".to_string()
                    });
                    if let Ok(parsed_url) = reqwest::Url::parse(&base_urlv) {
                        let host = parsed_url.host_str().unwrap_or("signapps-db");
                        let user = parsed_url.username();
                        let password = parsed_url.password().unwrap_or("");
                        let port = parsed_url.port().unwrap_or(5432);
                        let full_url = format!(
                            "postgres://{}:{}@{}:{}/{}",
                            user, password, host, port, db_name
                        );
                        val = val.replace("{SignApps.Database.Url}", &full_url);
                    }
                }
            }

            env_vars.push(format!("{}={}", ev.key, val));
        }

        // Pull image
        tracing::info!(image = %svc.image, "Pulling image for compose import");
        if let Err(e) = state.docker.pull_image(&svc.image).await {
            tracing::warn!(image = %svc.image, "Pull failed (may exist): {e}");
        }

        // Auto-assign host ports
        let mut ports: Vec<PortMapping> = Vec::new();
        let target_ports: Vec<(u16, String)> = if !svc.ports.is_empty() {
            svc.ports
                .iter()
                .map(|p| (p.container, p.protocol.clone()))
                .collect()
        } else {
            state
                .docker
                .get_image_exposed_ports(&svc.image)
                .await
                .unwrap_or_default()
        };

        if !target_ports.is_empty() {
            let used_ports = state.docker.get_used_host_ports().await.unwrap_or_default();
            const APP_PORT_BASE: u16 = 10300;
            let mut next_port = APP_PORT_BASE;
            for (container_port, protocol) in &target_ports {
                while used_ports.contains(&next_port)
                    || batch_assigned_ports.contains(&next_port)
                    || (3000..=4000).contains(&next_port)
                {
                    next_port += 1;
                }
                ports.push(PortMapping {
                    host: next_port,
                    container: *container_port,
                    protocol: protocol.clone(),
                    host_ip: None,
                });
                batch_assigned_ports.insert(next_port);
                next_port += 1;
            }
        }

        // Build volumes with Absolute Path replacement if requested
        let volumes: Vec<VolumeMount> = svc
            .volumes
            .iter()
            .map(|v| VolumeMount {
                source: crate::store::parser::resolve_volume_for_install(
                    &v.source,
                    container_name,
                    &state.app_data_path,
                ),
                target: v.target.clone(),
                read_only: v.read_only,
            })
            .collect();

        // Attempt to physically create the host directories for Bind mounts
        for v in &volumes {
            if v.source.starts_with('/') || v.source.contains(":/") || v.source.contains(":\\") {
                if let Err(e) = std::fs::create_dir_all(&v.source) {
                    tracing::warn!(
                        directory = %v.source,
                        "Failed to create bind mount directory on host for compose import: {e}"
                    );
                }
            }
        }

        let restart_policy = match svc.restart.as_str() {
            "always" => Some(RestartPolicy::Always),
            "on-failure" => Some(RestartPolicy::OnFailure),
            "unless-stopped" => Some(RestartPolicy::UnlessStopped),
            "no" => Some(RestartPolicy::No),
            _ => Some(RestartPolicy::UnlessStopped),
        };

        let config = ContainerConfig {
            name: container_name.to_string(),
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

        let container = repo.create(db_container, owner_id).await?;

        // Create Docker container
        let docker_id = state.docker.create_container(config).await?;

        // Link Docker to DB
        repo.update_docker_info(container.id, &docker_id, "created")
            .await?;

        // Start if requested
        let status = if auto_start {
            state.docker.start_container(&docker_id).await?;
            repo.update_status(container.id, "running").await?;
            "running".to_string()
        } else {
            "created".to_string()
        };

        // Update quota
        if let Some(owner) = owner_id {
            let _ = repo.increment_usage(owner, 1, 0.0, 0, 0).await;
        }

        let docker_info = state.docker.get_container(&docker_id).await.ok();

        results.push(ContainerResponse {
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
            category: None,
            tags: vec![],
            app_name: None,
        });

        tracing::info!(
            container = %container_name,
            "Compose import: container created"
        );
    }

    Ok(Json(results))
}

fn build_preview(parsed: &ParsedAppConfig) -> ComposePreview {
    ComposePreview {
        services: parsed
            .services
            .iter()
            .map(|svc| ServicePreview {
                service_name: svc.service_name.clone(),
                image: svc.image.clone(),
                ports: svc
                    .ports
                    .iter()
                    .map(|p| PortPreview {
                        host: p.host,
                        container: p.container,
                        protocol: p.protocol.clone(),
                    })
                    .collect(),
                environment: svc
                    .environment
                    .iter()
                    .map(|e| EnvPreview {
                        key: e.key.clone(),
                        default: e.default.clone(),
                    })
                    .collect(),
                volumes: svc
                    .volumes
                    .iter()
                    .map(|v| VolumePreview {
                        source: v.source.clone(),
                        target: v.target.clone(),
                    })
                    .collect(),
            })
            .collect(),
    }
}
