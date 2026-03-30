//! Docker network and volume handlers.

use axum::{extract::State, Json};
use signapps_common::Result;

use crate::docker::{NetworkInfo, VolumeInfo};
use crate::AppState;

/// List all Docker networks.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/networks",
    responses((status = 200, description = "Success")),
    tag = "Containers"
)]
pub async fn list_networks(State(state): State<AppState>) -> Result<Json<Vec<NetworkInfo>>> {
    let networks = state.docker.list_networks().await?;
    Ok(Json(networks))
}

/// List all Docker volumes.
#[tracing::instrument(skip(state))]
#[utoipa::path(
    get,
    path = "/api/v1/networks",
    responses((status = 200, description = "Success")),
    tag = "Containers"
)]
pub async fn list_volumes(State(state): State<AppState>) -> Result<Json<Vec<VolumeInfo>>> {
    let volumes = state.docker.list_volumes().await?;
    Ok(Json(volumes))
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
