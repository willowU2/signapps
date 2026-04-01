use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use signapps_db::DatabasePool;
use std::net::UdpSocket;
use uuid::Uuid;

// ─── Wake-on-LAN (RM2) ───────────────────────────────────────────────────────

#[derive(Debug, Serialize, utoipa::ToSchema)]
/// Response payload for Wol operation.
pub struct WolResponse {
    pub ok: bool,
    pub message: String,
    pub mac_address: Option<String>,
}

/// Build a WoL magic packet for a given MAC address.
/// Format: 6x 0xFF + 16x MAC (102 bytes total).
fn build_magic_packet(mac: &str) -> Result<Vec<u8>, String> {
    // Parse MAC address in various formats: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
    let clean = mac.replace([':', '-'], "");
    if clean.len() != 12 {
        return Err(format!("Invalid MAC address: {}", mac));
    }
    let mac_bytes: Vec<u8> = (0..6)
        .map(|i| u8::from_str_radix(&clean[i * 2..i * 2 + 2], 16))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("MAC parse error: {}", e))?;

    let mut packet = vec![0xFF_u8; 6];
    for _ in 0..16 {
        packet.extend_from_slice(&mac_bytes);
    }
    Ok(packet)
}

/// POST /api/v1/it-assets/hardware/:id/wake
/// Looks up the primary MAC address and sends a WoL magic packet via UDP broadcast.
#[utoipa::path(
    post,
    path = "/api/v1/it-assets/hardware/{id}/wake",
    params(("id" = uuid::Uuid, Path, description = "Hardware UUID")),
    responses(
        (status = 200, description = "WoL packet sent", body = WolResponse),
        (status = 404, description = "Hardware not found"),
        (status = 422, description = "No MAC address registered"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Remote"
)]
#[tracing::instrument(skip_all)]
pub async fn wake_on_lan(
    State(pool): State<DatabasePool>,
    Path(hardware_id): Path<Uuid>,
) -> Result<Json<WolResponse>, (StatusCode, String)> {
    // Check hardware exists
    let _ = sqlx::query("SELECT id FROM it.hardware WHERE id = $1")
        .bind(hardware_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Hardware not found".to_string()))?;

    // Fetch primary (or first) MAC address from network_interfaces
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT mac_address FROM it.network_interfaces WHERE hardware_id = $1 ORDER BY is_primary DESC, created_at ASC LIMIT 1"
    )
    .bind(hardware_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mac = match row {
        Some((mac,)) => mac,
        None => {
            return Err((
                StatusCode::UNPROCESSABLE_ENTITY,
                "No MAC address registered for this hardware. Add a network interface first."
                    .to_string(),
            ))
        },
    };

    // Build magic packet
    let packet = build_magic_packet(&mac).map_err(|e| (StatusCode::UNPROCESSABLE_ENTITY, e))?;

    // Send via UDP broadcast on port 9
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let socket = UdpSocket::bind("0.0.0.0:0")
            .map_err(|e| format!("Failed to bind UDP socket: {}", e))?;
        socket
            .set_broadcast(true)
            .map_err(|e| format!("Failed to set broadcast: {}", e))?;
        socket
            .send_to(&packet, "255.255.255.255:9")
            .map_err(|e| format!("Failed to send WoL packet: {}", e))?;
        // Also send to port 7 (alternative WoL port)
        let _ = socket.send_to(&packet, "255.255.255.255:7");
        Ok(())
    })
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    tracing::info!(
        "Sent WoL magic packet to MAC {} for hardware {}",
        mac,
        hardware_id
    );

    Ok(Json(WolResponse {
        ok: true,
        message: format!("Magic packet envoy a {}", mac),
        mac_address: Some(mac),
    }))
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
