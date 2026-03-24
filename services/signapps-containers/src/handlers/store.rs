use axum::{
    extract::{Extension, Path, Query, State},
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use futures::Stream;
use signapps_common::{Claims, Error, Result};
use signapps_db::models::CreateContainer;
use signapps_db::repositories::ContainerRepository;
use std::convert::Infallible;
use uuid::Uuid;

use crate::docker::{ContainerConfig, PortMapping, RestartPolicy, VolumeMount};
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

/// Install an app (single-service, backwards-compatible).
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

    // Analyze environment for DB dynamic creation
    let mut needs_db = false;
    for ev in &svc.environment {
        let val = req
            .environment
            .as_ref()
            .and_then(|m| m.get(&ev.key))
            .or(ev.default.as_ref())
            .cloned()
            .unwrap_or_default();

        if val.contains("{SignApps.Database.Name}") || val.contains("{SignApps.Database.Url}") {
            needs_db = true;
            break;
        }
    }

    let db_name_opt = if needs_db {
        match provision_app_database(&state.pool, &req.app_id).await {
            Ok(name) => Some(name),
            Err(e) => {
                let msg = format!("Failed to provision database: {:?}", e);
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
        let mut val = req
            .environment
            .as_ref()
            .and_then(|m| m.get(&ev.key))
            .or(ev.default.as_ref())
            .cloned()
            .unwrap_or_default();

        // Resolve any remaining store template variables
        val = crate::store::parser::resolve_store_templates(&val, &req.container_name);

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

    // Build port mappings
    let mut ports: Vec<PortMapping> = if let Some(overrides) = &req.ports {
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
        // No user ports: will auto-assign host ports below
        Vec::new()
    };

    // Auto-assign host ports when user didn't provide explicit port mappings.
    // Merges compose ports with image EXPOSE to catch ports like WebUI that
    // may only be declared in the Dockerfile but not in the compose file.
    let image_pulled = if req.ports.is_none() {
        tracing::info!(image = %svc.image, "Pulling image for store install");
        if let Err(e) = state.docker.pull_image(&svc.image).await {
            tracing::warn!(image = %svc.image, "Image pull failed (may already exist): {e}");
        }

        let mut target_ports: Vec<(u16, String)> = svc
            .ports
            .iter()
            .map(|p| (p.container, p.protocol.clone()))
            .collect();

        // Merge in image EXPOSE ports not already covered by compose
        if let Ok(exposed) = state.docker.get_image_exposed_ports(&svc.image).await {
            for (port, proto) in exposed {
                if !target_ports
                    .iter()
                    .any(|(p, pr)| *p == port && *pr == proto)
                {
                    target_ports.push((port, proto));
                }
            }
        }

        if !target_ports.is_empty() {
            let used_ports = state.docker.get_used_host_ports().await.unwrap_or_default();
            const APP_PORT_BASE: u16 = 10300;
            let mut next_port = APP_PORT_BASE;
            for (container_port, protocol) in &target_ports {
                while used_ports.contains(&next_port) || (3000..=4000).contains(&next_port) {
                    next_port += 1;
                }
                ports.push(PortMapping {
                    host: next_port,
                    container: *container_port,
                    protocol: protocol.clone(),
                    host_ip: None,
                });
                tracing::info!(
                    host_port = next_port,
                    container_port = container_port,
                    "Auto-assigned port for store app"
                );
                next_port += 1;
            }
        }
        true
    } else {
        false
    };

    // Build volume mounts
    let volumes: Vec<VolumeMount> = if let Some(overrides) = &req.volumes {
        overrides
            .iter()
            .map(|v| VolumeMount {
                source: crate::store::parser::resolve_volume_for_install(
                    &v.source,
                    &req.container_name,
                    &state.app_data_path,
                ),
                target: v.target.clone(),
                read_only: false,
            })
            .collect()
    } else {
        svc.volumes
            .iter()
            .map(|v| VolumeMount {
                source: crate::store::parser::resolve_volume_for_install(
                    &v.source,
                    &req.container_name,
                    &state.app_data_path,
                ),
                target: v.target.clone(),
                read_only: v.read_only,
            })
            .collect()
    };

    // Attempt to physically create the host directories for Bind mounts
    for v in &volumes {
        if v.source.starts_with('/') || v.source.contains(":/") || v.source.contains(":\\") {
            if let Err(e) = std::fs::create_dir_all(&v.source) {
                tracing::warn!(
                    directory = %v.source,
                    "Failed to create bind mount directory on host: {e}"
                );
            }
        }
    }

    // Map restart policy
    let restart_policy = match svc.restart.as_str() {
        "always" => Some(RestartPolicy::Always),
        "on-failure" => Some(RestartPolicy::OnFailure),
        "unless-stopped" => Some(RestartPolicy::UnlessStopped),
        "no" => Some(RestartPolicy::No),
        _ => Some(RestartPolicy::UnlessStopped),
    };

    // Build labels: start with compose labels, merge user labels, then inject store metadata
    let mut labels = svc.labels.clone();
    if let Some(user_labels) = &req.labels {
        for (k, v) in user_labels {
            if !k.starts_with("signapps.app.") {
                labels.insert(k.clone(), v.clone());
            }
        }
    }
    labels.insert("signapps.app.id".to_string(), req.app_id.clone());
    labels.insert("signapps.app.name".to_string(), app.name.clone());
    if !app.tags.is_empty() {
        labels.insert("signapps.app.tags".to_string(), app.tags.join(","));
        labels.insert("signapps.app.category".to_string(), app.tags[0].clone());
    }

    // Build container config
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
        labels: Some(labels),
        restart_policy,
        resources: None,
        network_mode: None,
        networks: None,
        hostname: svc.hostname.clone(),
        working_dir: None,
        user: None,
        auto_update: None,
    };

    // Pull image (skip if already pulled during port detection)
    if !image_pulled {
        tracing::info!(image = %config.image, "Pulling image for store install");
        if let Err(e) = state.docker.pull_image(&config.image).await {
            tracing::warn!(image = %config.image, "Image pull failed (may already exist): {e}");
        }
    }

    // Create DB record
    let db_container = CreateContainer {
        name: config.name.clone(),
        image: config.image.clone(),
        config: serde_json::to_value(&config).ok(),
        labels: config
            .labels
            .as_ref()
            .map(|l| serde_json::to_value(l).unwrap_or_default()),
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

    let category = app.tags.first().cloned();
    let tags = app.tags.clone();
    let store_app_name = Some(app.name.clone());

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
        category,
        tags,
        app_name: store_app_name,
    }))
}

/// Install a multi-service app.
/// Creates an install group, spawns background install, returns install_id.
pub async fn install_multi(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<MultiServiceInstallRequest>,
) -> Result<Json<InstallStarted>> {
    let repo = ContainerRepository::new(&state.pool);

    // Check user quota if not admin
    let service_count = req.services.len();
    if claims.role < 2 {
        if let Some(quota) = repo.get_quota(claims.sub).await? {
            if quota.current_containers + service_count as i32 > quota.max_containers {
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

    if parsed.services.is_empty() {
        return Err(Error::BadRequest("No services in compose file".to_string()));
    }

    // Create install group in DB
    let install_id = Uuid::new_v4();
    let short_id = &install_id.to_string()[..8];
    let network_name = format!("signapps-{}-{}", req.group_name, short_id);
    let owner_id = if claims.role >= 2 {
        None
    } else {
        Some(claims.sub)
    };

    let _ = sqlx::query(
        "INSERT INTO containers.app_install_groups \
         (id, app_id, app_name, source_id, network_name, owner_id, status, service_count) \
         VALUES ($1, $2, $3, $4, $5, $6, 'installing', $7)",
    )
    .bind(install_id)
    .bind(&req.app_id)
    .bind(&app.name)
    .bind(req.source_id)
    .bind(&network_name)
    .bind(owner_id)
    .bind(service_count as i32)
    .execute(&*state.pool)
    .await
    .map_err(|e| Error::Internal(e.to_string()))?;

    // Create broadcast channel for SSE progress
    let (tx, _) = tokio::sync::broadcast::channel::<InstallEvent>(64);
    state.install_channels.insert(install_id, tx.clone());

    // Spawn background install task
    let docker = state.docker.clone();
    let pool = state.pool.clone();
    let channels = state.install_channels.clone();

    let store_meta = StoreAppMeta {
        app_id: req.app_id.clone(),
        app_name: app.name.clone(),
        app_tags: app.tags.clone(),
    };

    tokio::spawn(async move {
        let result = run_multi_install(
            &docker,
            &pool,
            &tx,
            install_id,
            &network_name,
            owner_id,
            &req,
            &parsed,
            &store_meta,
            &state.app_data_path,
        )
        .await;

        // Update group status
        let status = if result.is_ok() { "complete" } else { "failed" };
        let _ = sqlx::query(
            "UPDATE containers.app_install_groups \
             SET status = $2, updated_at = NOW() WHERE id = $1",
        )
        .bind(install_id)
        .bind(status)
        .execute(&*pool)
        .await;

        // Keep channel alive briefly for late SSE subscribers, then clean up
        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
        channels.remove(&install_id);
    });

    Ok(Json(InstallStarted { install_id }))
}

/// Store app metadata passed to multi-install for label injection.
struct StoreAppMeta {
    app_id: String,
    app_name: String,
    app_tags: Vec<String>,
}

/// Validate a database name to prevent SQL injection.
fn validate_db_name(name: &str) -> Result<()> {
    if !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err(Error::Validation(
            "Invalid database name: must contain only alphanumeric characters and underscores"
                .to_string(),
        ));
    }
    if name.len() > 63 {
        return Err(Error::Validation(
            "Database name too long: maximum 63 characters".to_string(),
        ));
    }
    Ok(())
}

/// Provision a dedicated PostgreSQL database for an app, including the vector extension.
pub async fn provision_app_database(
    pool: &signapps_db::DatabasePool,
    app_id: &str,
) -> Result<String> {
    // Sanitize app_id to create a safe database name
    let sanitized_id = app_id.replace('-', "_").to_lowercase();
    let db_name = format!("app_{}", sanitized_id);
    validate_db_name(&db_name)?;

    // We cannot use prepared statements for CREATE DATABASE
    // Also, we need to check if it exists first
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)")
            .bind(&db_name)
            .fetch_one(&**pool)
            .await
            .map_err(|e| {
                signapps_common::Error::Internal(format!(
                    "Error checking database existence: {}",
                    e
                ))
            })?;

    if !exists {
        tracing::info!(db_name = %db_name, "Provisioning new dedicated database for app");
        // Cannot execute CREATE DATABASE in a transaction/bind block, must form string manually
        let create_query = format!("CREATE DATABASE {}", db_name);

        let mut conn = pool.acquire().await.map_err(|e| {
            signapps_common::Error::Internal(format!("Failed to acquire connection: {}", e))
        })?;

        let _ = sqlx::query(&create_query)
            .execute(&mut *conn)
            .await
            .map_err(|e| {
                signapps_common::Error::Internal(format!(
                    "Failed to create database {}: {}",
                    db_name, e
                ))
            })?;
    } else {
        tracing::debug!(db_name = %db_name, "Dedicated database already exists");
    }

    // Now we must connect sequentially to the *newly created database* to install the extension
    // Because Pg connection strings lock to a specific DB.
    let base_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/signapps".to_string());

    // Create connection to the new database by replacing the db name at the end
    let mut parts: Vec<&str> = base_url.split('/').collect();
    if parts.len() > 3 {
        parts.pop(); // Remove the original db name (e.g. signapps)
    }
    let new_url = format!("{}/{}", parts.join("/"), db_name);

    match sqlx::PgPool::connect(&new_url).await {
        Ok(app_pool) => {
            // Install pgvector
            let _ = sqlx::query("CREATE EXTENSION IF NOT EXISTS vector")
                .execute(&app_pool)
                .await
                .map_err(|e| {
                    Error::Internal(format!(
                        "Failed to create vector extension in {}: {}",
                        db_name, e
                    ))
                })?;

            app_pool.close().await;
        },
        Err(e) => {
            return Err(Error::Internal(format!(
                "Failed to connect to newly created database {} to install extensions: {}",
                db_name, e
            )));
        },
    }

    Ok(db_name)
}

/// Background multi-service install logic.
#[allow(clippy::too_many_arguments)]
async fn run_multi_install(
    docker: &crate::docker::DockerClient,
    pool: &signapps_db::DatabasePool,
    tx: &tokio::sync::broadcast::Sender<InstallEvent>,
    install_id: Uuid,
    network_name: &str,
    owner_id: Option<Uuid>,
    req: &MultiServiceInstallRequest,
    parsed: &ParsedAppConfig,
    store_meta: &StoreAppMeta,
    app_data_path: &str,
) -> std::result::Result<(), String> {
    let service_count = req.services.len();
    let _ = tx.send(InstallEvent::Started {
        install_id,
        service_count,
    });

    // Create Docker network
    if let Err(e) = docker.create_network(network_name).await {
        let msg = format!("Failed to create network: {e}");
        let _ = tx.send(InstallEvent::Error {
            message: msg.clone(),
        });
        return Err(msg);
    }

    // Build a name mapping: service_name -> container_name
    let name_map: std::collections::HashMap<&str, &str> = req
        .services
        .iter()
        .map(|s| (s.service_name.as_str(), s.container_name.as_str()))
        .collect();

    // Topological sort by depends_on
    let ordered = topo_sort_services(&parsed.services);

    // Track created containers for rollback
    let mut created_docker_ids: Vec<String> = Vec::new();

    // Track ports assigned within this batch to avoid collisions between services
    let mut batch_assigned_ports: std::collections::HashSet<u16> = std::collections::HashSet::new();

    for svc_name in &ordered {
        // Find the parsed service definition
        let svc = match parsed.services.iter().find(|s| &s.service_name == svc_name) {
            Some(s) => s,
            None => continue,
        };

        // Find user overrides for this service
        let overrides = req.services.iter().find(|s| s.service_name == *svc_name);
        let container_name = overrides
            .map(|o| o.container_name.as_str())
            .unwrap_or(svc_name);

        // Pull image
        let _ = tx.send(InstallEvent::PullingImage {
            service_name: svc_name.clone(),
            image: svc.image.clone(),
        });

        if let Err(e) = docker.pull_image(&svc.image).await {
            tracing::warn!(image = %svc.image, "Pull failed (may exist): {e}");
        }
        let _ = tx.send(InstallEvent::ImagePulled {
            service_name: svc_name.clone(),
        });

        // Build env vars – resolve inter-service references
        let _ = tx.send(InstallEvent::CreatingContainer {
            service_name: svc_name.clone(),
        });

        let mut env_vars: Vec<String> = Vec::new();

        // Scan to see if this service needs the signapps database
        let mut needs_db = false;

        for ev in &svc.environment {
            let val = if let Some(ovr) = overrides {
                ovr.environment
                    .as_ref()
                    .and_then(|m| m.get(&ev.key))
                    .cloned()
            } else {
                None
            }
            .or_else(|| ev.default.clone())
            .unwrap_or_default();

            if val.contains("{SignApps.Database.Name}") || val.contains("{SignApps.Database.Url}") {
                needs_db = true;
                break;
            }
        }

        // Provision DB if needed
        let db_name_opt = if needs_db {
            match provision_app_database(pool, &store_meta.app_id).await {
                Ok(name) => Some(name),
                Err(e) => {
                    let msg = format!("Failed to provision app database: {e}");
                    let _ = tx.send(InstallEvent::Error {
                        message: msg.clone(),
                    });
                    return Err(msg);
                },
            }
        } else {
            None
        };

        for ev in &svc.environment {
            let mut val = if let Some(ovr) = overrides {
                ovr.environment
                    .as_ref()
                    .and_then(|m| m.get(&ev.key))
                    .cloned()
            } else {
                None
            }
            .or_else(|| ev.default.clone())
            .unwrap_or_default();

            // Resolve store template variables
            val = crate::store::parser::resolve_store_templates(&val, container_name);

            // Resolve DB specific variables if DB was provisioned
            if let Some(ref db_name) = db_name_opt {
                val = val.replace("{SignApps.Database.Name}", db_name);

                // Construct the final URL using the BaseUrl resolved in parser + db_name
                // It relies on parser.rs having swapped out the host/user/pass into UrlBase first
                if val.contains("{SignApps.Database.Url}") {
                    // Since parser resolved {SignApps.Database.UrlBase} earlier, we might not have it here
                    // if it was inside {SignApps.Database.Url}. So we have to re-evaluate it if it's a direct template.
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

            // Replace service name references in env values
            for (sname, cname) in &name_map {
                val = val.replace(sname, cname);
            }
            env_vars.push(format!("{}={}", ev.key, val));
        }

        // Build port mappings
        let has_user_ports = overrides.is_some_and(|o| o.ports.is_some());
        let mut ports: Vec<PortMapping> = if let Some(ovr) = overrides {
            if let Some(port_ovr) = &ovr.ports {
                port_ovr
                    .iter()
                    .map(|p| PortMapping {
                        host: p.host,
                        container: p.container,
                        protocol: p.protocol.clone().unwrap_or_else(|| "tcp".into()),
                        host_ip: None,
                    })
                    .collect()
            } else {
                // No user ports for this service: will auto-assign below
                Vec::new()
            }
        } else {
            Vec::new()
        };

        // Auto-assign host ports when user didn't provide explicit port mappings.
        // Merges compose ports with image EXPOSE to catch all exposed ports.
        if !has_user_ports {
            let mut target_ports: Vec<(u16, String)> = svc
                .ports
                .iter()
                .map(|p| (p.container, p.protocol.clone()))
                .collect();

            // Merge in image EXPOSE ports not already covered by compose
            if let Ok(exposed) = docker.get_image_exposed_ports(&svc.image).await {
                for (port, proto) in exposed {
                    if !target_ports
                        .iter()
                        .any(|(p, pr)| *p == port && *pr == proto)
                    {
                        target_ports.push((port, proto));
                    }
                }
            }

            if !target_ports.is_empty() {
                let used_ports = docker.get_used_host_ports().await.unwrap_or_default();
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
                    tracing::info!(
                        host_port = next_port,
                        container_port = container_port,
                        "Auto-assigned port for multi-install service"
                    );
                    next_port += 1;
                }
            }
        }

        // Build volume mounts
        let volumes: Vec<VolumeMount> = if let Some(ovr) = overrides {
            if let Some(vol_ovr) = &ovr.volumes {
                vol_ovr
                    .iter()
                    .map(|v| VolumeMount {
                        source: crate::store::parser::resolve_volume_for_install(
                            &v.source,
                            container_name,
                            app_data_path,
                        ),
                        target: v.target.clone(),
                        read_only: false,
                    })
                    .collect()
            } else {
                svc.volumes
                    .iter()
                    .map(|v| VolumeMount {
                        source: crate::store::parser::resolve_volume_for_install(
                            &v.source,
                            container_name,
                            app_data_path,
                        ),
                        target: v.target.clone(),
                        read_only: v.read_only,
                    })
                    .collect()
            }
        } else {
            svc.volumes
                .iter()
                .map(|v| VolumeMount {
                    source: crate::store::parser::resolve_volume_for_install(
                        &v.source,
                        container_name,
                        app_data_path,
                    ),
                    target: v.target.clone(),
                    read_only: v.read_only,
                })
                .collect()
        };

        // Attempt to physically create the host directories for Bind mounts
        for v in &volumes {
            if v.source.starts_with('/') || v.source.contains(":/") || v.source.contains(":\\") {
                if let Err(e) = std::fs::create_dir_all(&v.source) {
                    tracing::warn!(
                        directory = %v.source,
                        "Failed to create bind mount directory on host: {e}"
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

        // Build labels: start with compose labels, merge user labels, then inject store metadata
        let mut labels = svc.labels.clone();
        if let Some(ovr) = overrides {
            if let Some(user_labels) = &ovr.labels {
                for (k, v) in user_labels {
                    if !k.starts_with("signapps.app.") {
                        labels.insert(k.clone(), v.clone());
                    }
                }
            }
        }
        labels.insert("signapps.app.id".to_string(), store_meta.app_id.clone());
        labels.insert("signapps.app.name".to_string(), store_meta.app_name.clone());
        if !store_meta.app_tags.is_empty() {
            labels.insert(
                "signapps.app.tags".to_string(),
                store_meta.app_tags.join(","),
            );
            labels.insert(
                "signapps.app.category".to_string(),
                store_meta.app_tags[0].clone(),
            );
        }

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
            labels: Some(labels),
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
        let repo = ContainerRepository::new(pool);
        let db_container = CreateContainer {
            name: config.name.clone(),
            image: config.image.clone(),
            config: serde_json::to_value(&config).ok(),
            labels: config
                .labels
                .as_ref()
                .map(|l| serde_json::to_value(l).unwrap_or_default()),
            auto_update: None,
        };

        let container = match repo.create(db_container, owner_id).await {
            Ok(c) => c,
            Err(e) => {
                let msg = format!("DB error creating {container_name}: {e}");
                let _ = tx.send(InstallEvent::Error {
                    message: msg.clone(),
                });
                rollback(docker, &created_docker_ids, network_name).await;
                return Err(msg);
            },
        };

        // Link to install group
        let _ = sqlx::query("UPDATE containers.managed SET install_group_id = $2 WHERE id = $1")
            .bind(container.id)
            .bind(install_id)
            .execute(&**pool)
            .await;

        // Create Docker container
        let docker_id = match docker.create_container(config).await {
            Ok(id) => id,
            Err(e) => {
                let msg = format!("Docker error creating {container_name}: {e}");
                let _ = tx.send(InstallEvent::Error {
                    message: msg.clone(),
                });
                rollback(docker, &created_docker_ids, network_name).await;
                return Err(msg);
            },
        };

        created_docker_ids.push(docker_id.clone());

        // Link Docker to DB
        let _ = repo
            .update_docker_info(container.id, &docker_id, "created")
            .await;

        // Connect to network
        if let Err(e) = docker.connect_network(&docker_id, network_name).await {
            tracing::warn!("Failed to connect to network: {e}");
        }

        let _ = tx.send(InstallEvent::ContainerCreated {
            service_name: svc_name.clone(),
            container_name: container_name.to_string(),
        });

        // Start container
        let auto_start = req.auto_start.unwrap_or(true);
        if auto_start {
            let _ = tx.send(InstallEvent::Starting {
                service_name: svc_name.clone(),
            });
            match docker.start_container(&docker_id).await {
                Ok(()) => {
                    let _ = repo.update_status(container.id, "running").await;
                },
                Err(e) => {
                    let msg = format!("Failed to start {container_name}: {e}");
                    let _ = tx.send(InstallEvent::Error {
                        message: msg.clone(),
                    });
                    rollback(docker, &created_docker_ids, network_name).await;
                    return Err(msg);
                },
            }
        }

        // Update quota
        if let Some(owner) = owner_id {
            let _ = repo.increment_usage(owner, 1, 0.0, 0, 0).await;
        }

        let _ = tx.send(InstallEvent::ServiceReady {
            service_name: svc_name.clone(),
        });
    }

    let _ = tx.send(InstallEvent::Complete { install_id });
    tracing::info!(install_id = %install_id, "Multi-service install complete");
    Ok(())
}

/// Topological sort of services by depends_on.
fn topo_sort_services(services: &[ParsedService]) -> Vec<String> {
    let mut result: Vec<String> = Vec::new();
    let mut visited: std::collections::HashSet<String> = std::collections::HashSet::new();
    let svc_map: std::collections::HashMap<&str, &ParsedService> = services
        .iter()
        .map(|s| (s.service_name.as_str(), s))
        .collect();

    fn visit(
        name: &str,
        svc_map: &std::collections::HashMap<&str, &ParsedService>,
        visited: &mut std::collections::HashSet<String>,
        result: &mut Vec<String>,
    ) {
        if visited.contains(name) {
            return;
        }
        visited.insert(name.to_string());
        if let Some(svc) = svc_map.get(name) {
            for dep in &svc.depends_on {
                visit(dep, svc_map, visited, result);
            }
        }
        result.push(name.to_string());
    }

    for svc in services {
        visit(&svc.service_name, &svc_map, &mut visited, &mut result);
    }
    result
}

/// Rollback: remove created containers and network.
async fn rollback(docker: &crate::docker::DockerClient, docker_ids: &[String], network_name: &str) {
    for id in docker_ids {
        let _ = docker.remove_container(id, true, false).await;
    }
    let _ = docker.remove_network(network_name).await;
}

/// SSE endpoint for install progress.
pub async fn install_progress(
    State(state): State<AppState>,
    Path(install_id): Path<Uuid>,
    Query(query): Query<ProgressQuery>,
) -> Result<Sse<impl Stream<Item = std::result::Result<Event, Infallible>>>> {
    // Validate JWT from query parameter (EventSource doesn't support headers)
    if let Some(token) = &query.token {
        use jsonwebtoken::{decode, DecodingKey, Validation};
        let mut validation = Validation::default();
        validation.validate_aud = false;
        validation.set_required_spec_claims(&["exp", "sub"]);
        let key = DecodingKey::from_secret(state.jwt_config.secret.as_bytes());
        decode::<signapps_common::Claims>(token, &key, &validation)
            .map_err(|_| Error::Unauthorized)?;
    } else {
        return Err(Error::Unauthorized);
    }

    let rx = state
        .install_channels
        .get(&install_id)
        .map(|entry| entry.value().subscribe())
        .ok_or_else(|| Error::NotFound(format!("Install session {install_id} not found")))?;

    let stream = async_stream::stream! {
        let mut rx = rx;
        loop {
            match rx.recv().await {
                Ok(event) => {
                    let data = serde_json::to_string(&event).unwrap_or_default();
                    yield Ok(Event::default().data(data));
                    // Stop after Complete or Error
                    match &event {
                        InstallEvent::Complete { .. } | InstallEvent::Error { .. } => break,
                        _ => {}
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

/// Check port conflicts with running containers.
pub async fn check_ports(
    State(state): State<AppState>,
    Query(query): Query<CheckPortsQuery>,
) -> Result<Json<Vec<PortConflict>>> {
    let requested: Vec<u16> = query
        .ports
        .split(',')
        .filter_map(|p| p.trim().parse().ok())
        .collect();

    let containers = state.docker.list_containers(true).await?;

    let mut conflicts = Vec::new();
    for port in &requested {
        let mut conflict = PortConflict {
            port: *port,
            in_use: false,
            used_by: None,
        };
        for c in &containers {
            for p in &c.ports {
                if p.host_port == Some(*port) {
                    conflict.in_use = true;
                    conflict.used_by = Some(c.name.clone());
                    break;
                }
            }
            if conflict.in_use {
                break;
            }
        }
        conflicts.push(conflict);
    }

    Ok(Json(conflicts))
}

/// Validate a source URL.
pub async fn validate_source(
    State(state): State<AppState>,
    Json(req): Json<AddSourceRequest>,
) -> Result<Json<SourceValidation>> {
    let validation = state.store.validate_source(&req.url).await;
    Ok(Json(validation))
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
    // Validate URL format
    if !req.url.starts_with("http://") && !req.url.starts_with("https://") {
        return Err(Error::BadRequest(
            "URL must start with http:// or https://".to_string(),
        ));
    }
    if reqwest::Url::parse(&req.url).is_err() {
        return Err(Error::BadRequest("Invalid URL format".to_string()));
    }

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
    Ok(Json(
        serde_json::json!({ "success": true, "app_count": count }),
    ))
}

/// Refresh all sources (admin only).
pub async fn refresh_all(State(state): State<AppState>) -> Result<Json<serde_json::Value>> {
    state.store.refresh_sources().await;
    Ok(Json(serde_json::json!({ "success": true })))
}
