//! Relay/beacon management handlers.
//!
//! These handlers manage relay servers that act as public entry points
//! for tunneled connections.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use uuid::Uuid;

use crate::AppState;
use crate::tunnel::{CreateRelay, Relay, RelayStatus, RelayTestResult, UpdateRelay};
use signapps_common::Result;

/// List all configured relays.
pub async fn list_relays(
    State(state): State<AppState>,
) -> Result<Json<Vec<Relay>>> {
    let relays = state.tunnel_client.list_relays().await;
    Ok(Json(relays))
}

/// Get a specific relay by ID.
pub async fn get_relay(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Relay>> {
    let relay = state.tunnel_client.get_relay(id).await
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Relay {}", id)))?;
    Ok(Json(relay))
}

/// Create a new relay.
pub async fn create_relay(
    State(state): State<AppState>,
    Json(request): Json<CreateRelay>,
) -> Result<(StatusCode, Json<Relay>)> {
    // Validate URL format
    if !request.url.starts_with("ws://") && !request.url.starts_with("wss://") {
        return Err(signapps_common::Error::Validation(
            "Relay URL must start with ws:// or wss://".to_string()
        ));
    }

    // If this is set as primary, unset other primary relays
    if request.is_primary {
        let relays = state.tunnel_client.list_relays().await;
        for mut relay in relays {
            if relay.is_primary {
                relay.is_primary = false;
                state.tunnel_client.add_relay(relay).await?;
            }
        }
    }

    // Create the relay
    let relay = Relay {
        id: Uuid::new_v4(),
        name: request.name,
        url: request.url,
        token: request.token,
        is_primary: request.is_primary,
        status: RelayStatus::Offline,
        region: request.region,
        latency_ms: None,
        last_tested: None,
        created_at: chrono::Utc::now(),
    };

    // Store the relay
    state.tunnel_client.add_relay(relay.clone()).await?;

    tracing::info!(
        "Created relay '{}' at {} (primary: {})",
        relay.name,
        relay.url,
        relay.is_primary
    );

    Ok((StatusCode::CREATED, Json(relay)))
}

/// Update an existing relay.
#[allow(dead_code)]
pub async fn update_relay(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateRelay>,
) -> Result<Json<Relay>> {
    let mut relay = state.tunnel_client.get_relay(id).await
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Relay {}", id)))?;

    // Apply updates
    if let Some(name) = request.name {
        relay.name = name;
    }
    if let Some(url) = request.url {
        if !url.starts_with("ws://") && !url.starts_with("wss://") {
            return Err(signapps_common::Error::Validation(
                "Relay URL must start with ws:// or wss://".to_string()
            ));
        }
        relay.url = url;
    }
    if let Some(token) = request.token {
        relay.token = Some(token);
    }
    if let Some(is_primary) = request.is_primary {
        // If setting as primary, unset other primary relays
        if is_primary && !relay.is_primary {
            let relays = state.tunnel_client.list_relays().await;
            for mut other in relays {
                if other.is_primary && other.id != id {
                    other.is_primary = false;
                    state.tunnel_client.add_relay(other).await?;
                }
            }
        }
        relay.is_primary = is_primary;
    }

    // Update the relay in storage
    state.tunnel_client.add_relay(relay.clone()).await?;

    Ok(Json(relay))
}

/// Delete a relay.
pub async fn delete_relay(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    // Check if relay exists
    let relay = state.tunnel_client.get_relay(id).await
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Relay {}", id)))?;

    // Check if any tunnels are using this relay
    let tunnels = state.tunnel_client.list_tunnels().await;
    let dependent_tunnels: Vec<_> = tunnels.iter()
        .filter(|t| t.relay_id == id)
        .collect();

    if !dependent_tunnels.is_empty() {
        return Err(signapps_common::Error::Validation(format!(
            "Cannot delete relay '{}': {} tunnel(s) depend on it",
            relay.name,
            dependent_tunnels.len()
        )));
    }

    // Remove the relay
    state.tunnel_client.remove_relay(id).await?;

    tracing::info!("Deleted relay '{}' ({})", relay.name, id);

    Ok(StatusCode::NO_CONTENT)
}

/// Test connection to a relay.
pub async fn test_relay(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RelayTestResponse>> {
    let mut relay = state.tunnel_client.get_relay(id).await
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Relay {}", id)))?;

    tracing::info!("Testing relay '{}' at {}", relay.name, relay.url);

    // Test the connection
    let result = state.tunnel_client.test_relay(&relay).await;

    // Update relay status based on test result
    relay.status = if result.success {
        RelayStatus::Online
    } else {
        RelayStatus::Offline
    };
    relay.latency_ms = result.latency_ms;
    relay.last_tested = Some(chrono::Utc::now());

    // Save updated relay
    state.tunnel_client.add_relay(relay.clone()).await?;

    Ok(Json(RelayTestResponse {
        relay_id: id,
        relay_name: relay.name,
        result,
    }))
}

/// Connect to a relay and start all tunnels.
pub async fn connect_relay(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ConnectResponse>> {
    let relay = state.tunnel_client.get_relay(id).await
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Relay {}", id)))?;

    // Start connection
    state.tunnel_client.connect_relay(id).await?;

    tracing::info!("Started connection to relay '{}' ({})", relay.name, id);

    Ok(Json(ConnectResponse {
        message: format!("Connection initiated to relay '{}'", relay.name),
        relay_id: id,
    }))
}

/// Disconnect from a relay.
pub async fn disconnect_relay(
    State(_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<DisconnectResponse>> {
    // Note: In a full implementation, we would track active connections
    // and close them here. For now, we just acknowledge the request.

    tracing::info!("Disconnect requested for relay {}", id);

    Ok(Json(DisconnectResponse {
        message: "Disconnect signal sent".to_string(),
        relay_id: id,
    }))
}

/// Response for relay test.
#[derive(Debug, Serialize)]
pub struct RelayTestResponse {
    pub relay_id: Uuid,
    pub relay_name: String,
    pub result: RelayTestResult,
}

/// Response for connect request.
#[derive(Debug, Serialize)]
pub struct ConnectResponse {
    pub message: String,
    pub relay_id: Uuid,
}

/// Response for disconnect request.
#[derive(Debug, Serialize)]
pub struct DisconnectResponse {
    pub message: String,
    pub relay_id: Uuid,
}

/// Get relay statistics.
pub async fn get_relay_stats(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<RelayStats>> {
    let relay = state.tunnel_client.get_relay(id).await
        .ok_or_else(|| signapps_common::Error::NotFound(format!("Relay {}", id)))?;

    // Get tunnels for this relay
    let tunnels = state.tunnel_client.list_tunnels().await;
    let relay_tunnels: Vec<_> = tunnels.iter()
        .filter(|t| t.relay_id == id)
        .collect();

    let connected_count = relay_tunnels.iter()
        .filter(|t| t.status == crate::tunnel::TunnelStatus::Connected)
        .count();

    Ok(Json(RelayStats {
        relay_id: id,
        relay_name: relay.name,
        status: relay.status,
        total_tunnels: relay_tunnels.len(),
        connected_tunnels: connected_count,
        latency_ms: relay.latency_ms,
        last_tested: relay.last_tested,
    }))
}

/// Statistics for a relay.
#[derive(Debug, Serialize)]
pub struct RelayStats {
    pub relay_id: Uuid,
    pub relay_name: String,
    pub status: RelayStatus,
    pub total_tunnels: usize,
    pub connected_tunnels: usize,
    pub latency_ms: Option<u32>,
    pub last_tested: Option<chrono::DateTime<chrono::Utc>>,
}
