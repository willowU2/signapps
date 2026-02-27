use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{
    CreateHardwareRequest, CreateNetworkInterfaceRequest, HardwareAsset, NetworkInterface,
};
use crate::AppState;

pub async fn list_hardware(
    State(state): State<AppState>,
) -> Result<Json<Vec<HardwareAsset>>, (StatusCode, String)> {
    let assets = sqlx::query_as!(
        HardwareAsset,
        r#"
        SELECT id, name, type, manufacturer, model, serial_number, 
               purchase_date, warranty_expires, status, location, 
               assigned_user_id, notes, created_at, updated_at
        FROM it.hardware
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch hardware assets: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database error".to_string(),
        )
    })?;

    Ok(Json(assets))
}

pub async fn create_hardware(
    State(state): State<AppState>,
    Json(payload): Json<CreateHardwareRequest>,
) -> Result<(StatusCode, Json<HardwareAsset>), (StatusCode, String)> {
    let asset = sqlx::query_as!(
        HardwareAsset,
        r#"
        INSERT INTO it.hardware (name, type, manufacturer, model, serial_number, purchase_date, warranty_expires, location, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, name, type, manufacturer, model, serial_number, purchase_date, warranty_expires, status, location, assigned_user_id, notes, created_at, updated_at
        "#,
        payload.name,
        payload.r#type,
        payload.manufacturer,
        payload.model,
        payload.serial_number,
        payload.purchase_date,
        payload.warranty_expires,
        payload.location,
        payload.notes,
    )
    .fetch_one(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to create hardware asset: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
    })?;

    Ok((StatusCode::CREATED, Json(asset)))
}

pub async fn list_network_interfaces(
    State(state): State<AppState>,
    Path(hardware_id): Path<Uuid>,
) -> Result<Json<Vec<NetworkInterface>>, (StatusCode, String)> {
    let interfaces = sqlx::query_as!(
        NetworkInterface,
        r#"
        SELECT id, hardware_id, mac_address, ip_address, is_primary, created_at
        FROM it.network_interfaces
        WHERE hardware_id = $1
        ORDER BY created_at ASC
        "#,
        hardware_id
    )
    .fetch_all(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch network interfaces: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database error".to_string(),
        )
    })?;

    Ok(Json(interfaces))
}

pub async fn add_network_interface(
    State(state): State<AppState>,
    Json(payload): Json<CreateNetworkInterfaceRequest>,
) -> Result<(StatusCode, Json<NetworkInterface>), (StatusCode, String)> {
    let ip_parsed = if let Some(ip_str) = payload.ip_address {
        Some(ip_str.parse::<ipnetwork::IpNetwork>().map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                "Invalid IP address format".to_string(),
            )
        })?)
    } else {
        None
    };

    let interface = sqlx::query_as!(
        NetworkInterface,
        r#"
        INSERT INTO it.network_interfaces (hardware_id, mac_address, ip_address, is_primary)
        VALUES ($1, $2, $3, $4)
        RETURNING id, hardware_id, mac_address, ip_address, is_primary, created_at
        "#,
        payload.hardware_id,
        payload.mac_address,
        ip_parsed,
        payload.is_primary.unwrap_or(false)
    )
    .fetch_one(state.db.inner())
    .await
    .map_err(|e| {
        tracing::error!("Failed to create network interface: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database error".to_string(),
        )
    })?;

    Ok((StatusCode::CREATED, Json(interface)))
}
