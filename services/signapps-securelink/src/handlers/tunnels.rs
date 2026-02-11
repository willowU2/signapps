//! Tunnel management handlers.
//!
//! These handlers manage web tunnels for exposing local services
//! through relay servers without opening ports.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::tunnel::{CreateTunnel, Tunnel, TunnelStatus, UpdateTunnel};
use crate::AppState;
use signapps_common::Result;

/// List all configured tunnels.
pub async fn list_tunnels(State(state): State<AppState>) -> Result<Json<Vec<Tunnel>>> {
    let tunnels = state.tunnel_client.list_tunnels().await;
    Ok(Json(tunnels))
}

/// Get a specific tunnel by ID.
pub async fn get_tunnel(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Tunnel>> {
    let tunnel = state
        .tunnel_client
        .get_tunnel(id)
        .await
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Tunnel {}", id)))?;
    Ok(Json(tunnel))
}

/// Create a new tunnel.
pub async fn create_tunnel(
    State(state): State<AppState>,
    Json(request): Json<CreateTunnel>,
) -> Result<(StatusCode, Json<Tunnel>)> {
    // Validate that the relay exists
    let relay = state
        .tunnel_client
        .get_relay(request.relay_id)
        .await
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Relay {}", request.relay_id)))?;

    // Create the tunnel
    let now = chrono::Utc::now();
    let tunnel = Tunnel {
        id: Uuid::new_v4(),
        name: request.name,
        local_addr: request.local_addr,
        subdomain: request.subdomain,
        status: TunnelStatus::Disconnected,
        relay_id: request.relay_id,
        protocol: request.protocol,
        enabled: true,
        last_error: None,
        last_connected: None,
        created_at: now,
        updated_at: now,
    };

    // Store the tunnel
    state.tunnel_client.add_tunnel(tunnel.clone()).await?;

    tracing::info!(
        "Created tunnel '{}' ({}) -> {} via relay '{}'",
        tunnel.name,
        tunnel.subdomain,
        tunnel.local_addr,
        relay.name
    );

    Ok((StatusCode::CREATED, Json(tunnel)))
}

/// Update an existing tunnel.
#[allow(dead_code)]
pub async fn update_tunnel(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateTunnel>,
) -> Result<Json<Tunnel>> {
    let mut tunnel = state
        .tunnel_client
        .get_tunnel(id)
        .await
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Tunnel {}", id)))?;

    // Apply updates
    if let Some(name) = request.name {
        tunnel.name = name;
    }
    if let Some(local_addr) = request.local_addr {
        tunnel.local_addr = local_addr;
    }
    if let Some(enabled) = request.enabled {
        tunnel.enabled = enabled;
    }
    tunnel.updated_at = chrono::Utc::now();

    // Update the tunnel in storage
    state.tunnel_client.add_tunnel(tunnel.clone()).await?;

    Ok(Json(tunnel))
}

/// Delete a tunnel.
pub async fn delete_tunnel(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    // Check if tunnel exists
    let _ = state
        .tunnel_client
        .get_tunnel(id)
        .await
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Tunnel {}", id)))?;

    // Remove the tunnel
    state.tunnel_client.remove_tunnel(id).await?;

    tracing::info!("Deleted tunnel {}", id);

    Ok(StatusCode::NO_CONTENT)
}

/// Get the status of a specific tunnel.
pub async fn get_tunnel_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TunnelStatusResponse>> {
    let tunnel = state
        .tunnel_client
        .get_tunnel(id)
        .await
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Tunnel {}", id)))?;

    Ok(Json(TunnelStatusResponse {
        id: tunnel.id,
        name: tunnel.name,
        status: tunnel.status,
        last_error: tunnel.last_error,
        last_connected: tunnel.last_connected,
    }))
}

/// Reconnect a tunnel.
pub async fn reconnect_tunnel(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ReconnectResponse>> {
    // Verify tunnel exists
    let tunnel = state
        .tunnel_client
        .get_tunnel(id)
        .await
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Tunnel {}", id)))?;

    // Trigger reconnection
    state.tunnel_client.reconnect_tunnel(id).await?;

    tracing::info!(
        "Triggered reconnection for tunnel '{}' ({})",
        tunnel.name,
        id
    );

    Ok(Json(ReconnectResponse {
        message: format!("Reconnection initiated for tunnel '{}'", tunnel.name),
        tunnel_id: id,
    }))
}

/// Response for tunnel status.
#[derive(Debug, Serialize)]
pub struct TunnelStatusResponse {
    pub id: Uuid,
    pub name: String,
    pub status: TunnelStatus,
    pub last_error: Option<String>,
    pub last_connected: Option<chrono::DateTime<chrono::Utc>>,
}

/// Response for reconnect request.
#[derive(Debug, Serialize)]
pub struct ReconnectResponse {
    pub message: String,
    pub tunnel_id: Uuid,
}

/// Bulk action on tunnels.
#[derive(Debug, Deserialize)]
pub struct BulkTunnelAction {
    /// List of tunnel IDs to act on.
    pub tunnel_ids: Vec<Uuid>,
    /// Action to perform (enable, disable, reconnect).
    pub action: String,
}

/// Perform bulk action on tunnels.
pub async fn bulk_tunnel_action(
    State(state): State<AppState>,
    Json(request): Json<BulkTunnelAction>,
) -> Result<Json<BulkActionResponse>> {
    let mut success_count = 0;
    let mut failed_ids = Vec::new();

    for tunnel_id in request.tunnel_ids {
        let result = match request.action.as_str() {
            "enable" => {
                if let Some(mut tunnel) = state.tunnel_client.get_tunnel(tunnel_id).await {
                    tunnel.enabled = true;
                    tunnel.updated_at = chrono::Utc::now();
                    state.tunnel_client.add_tunnel(tunnel).await
                } else {
                    Err(signapps_common::Error::NotFound(format!(
                        "Tunnel {}",
                        tunnel_id
                    )))
                }
            },
            "disable" => {
                if let Some(mut tunnel) = state.tunnel_client.get_tunnel(tunnel_id).await {
                    tunnel.enabled = false;
                    tunnel.updated_at = chrono::Utc::now();
                    state.tunnel_client.add_tunnel(tunnel).await
                } else {
                    Err(signapps_common::Error::NotFound(format!(
                        "Tunnel {}",
                        tunnel_id
                    )))
                }
            },
            "reconnect" => state.tunnel_client.reconnect_tunnel(tunnel_id).await,
            _ => Err(signapps_common::Error::Validation(format!(
                "Unknown action: {}",
                request.action
            ))),
        };

        match result {
            Ok(_) => success_count += 1,
            Err(_) => failed_ids.push(tunnel_id),
        }
    }

    Ok(Json(BulkActionResponse {
        success_count,
        failed_ids,
    }))
}

/// Response for bulk action.
#[derive(Debug, Serialize)]
pub struct BulkActionResponse {
    pub success_count: usize,
    pub failed_ids: Vec<Uuid>,
}
