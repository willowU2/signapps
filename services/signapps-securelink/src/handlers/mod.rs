//! HTTP handlers for SecureLink service (Standalone Mode).

pub mod dns;
pub mod relays;
pub mod tunnels;

pub use dns::*;
pub use relays::*;
pub use tunnels::*;

use axum::Json;
use serde::Serialize;

/// Health check response for standalone mode.
#[derive(Debug, Serialize)]
/// Response for Health.
pub struct HealthResponse {
    pub status: String,
    pub mode: String,
    pub tunnels: TunnelHealth,
    pub dns: DnsHealth,
}

#[derive(Debug, Serialize)]
/// TunnelHealth data transfer object.
pub struct TunnelHealth {
    pub total: usize,
    pub connected: usize,
}

#[derive(Debug, Serialize)]
/// DnsHealth data transfer object.
pub struct DnsHealth {
    pub adblock_enabled: bool,
    pub blocklists_count: usize,
}

/// Health check endpoint (standalone mode - no database).
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn health_check_standalone(
    axum::extract::State(state): axum::extract::State<crate::AppState>,
) -> Json<HealthResponse> {
    let tunnels = state.tunnel_client.list_tunnels().await;
    let connected = tunnels
        .iter()
        .filter(|t| t.status == crate::tunnel::TunnelStatus::Connected)
        .count();

    let dns_config = state.dns_config.read().await;
    let blocklists = state.blocklists.read().await;

    Json(HealthResponse {
        status: "ok".to_string(),
        mode: "standalone".to_string(),
        tunnels: TunnelHealth {
            total: tunnels.len(),
            connected,
        },
        dns: DnsHealth {
            adblock_enabled: dns_config.adblock_enabled,
            blocklists_count: blocklists.len(),
        },
    })
}
