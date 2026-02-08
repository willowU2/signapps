//! Configuration handlers.

use axum::{extract::State, Json};
use signapps_common::Result;
use signapps_db::repositories::RouteRepository;

use crate::traefik::TraefikConfig;
use crate::AppState;

/// Get current Traefik configuration.
#[tracing::instrument(skip(state))]
pub async fn get_traefik_config(State(state): State<AppState>) -> Result<Json<TraefikConfig>> {
    let repo = RouteRepository::new(&state.pool);
    let routes = repo.list_enabled().await?;

    let config = state.traefik.generate_config(&routes);

    Ok(Json(config))
}

/// Get Traefik overview from API.
#[tracing::instrument(skip(state))]
pub async fn get_traefik_overview(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>> {
    let overview = state.traefik.get_overview().await?;
    Ok(Json(overview))
}

/// Force config regeneration.
#[tracing::instrument(skip(state))]
pub async fn regenerate_config(State(state): State<AppState>) -> Result<Json<serde_json::Value>> {
    let repo = RouteRepository::new(&state.pool);
    let routes = repo.list_enabled().await?;

    let config = state.traefik.generate_config(&routes);

    // Write config to file
    let config_path = std::env::var("TRAEFIK_CONFIG_PATH")
        .unwrap_or_else(|_| "/etc/traefik/dynamic/signapps.yml".to_string());

    let yaml = serde_yaml::to_string(&config)
        .map_err(|e| signapps_common::Error::Internal(format!("Failed to serialize: {}", e)))?;

    tokio::fs::write(&config_path, yaml)
        .await
        .map_err(|e| signapps_common::Error::Internal(format!("Failed to write: {}", e)))?;

    tracing::info!(path = %config_path, routes = routes.len(), "Config regenerated");

    Ok(Json(serde_json::json!({
        "status": "regenerated",
        "routes_count": routes.len(),
        "path": config_path
    })))
}
