//! IP Allowlist per Tenant handlers.
//!
//! Manage the list of allowed IP addresses/CIDRs for a tenant.
//! The middleware checks client IP against this list.

use axum::{
    extract::{Extension, State},
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Claims, Error, Result};

use crate::AppState;

/// A single IP allowlist entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpAllowlistEntry {
    pub address: String,
    pub cidr: String,
    pub label: Option<String>,
    pub enabled: bool,
}

/// GET /api/v1/admin/security/ip-allowlist — Get tenant's IP allowlist.
#[tracing::instrument(skip(state))]
pub async fn get(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<IpAllowlistEntry>>> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("Tenant required".to_string()))?;

    let row: Option<(serde_json::Value,)> =
        sqlx::query_as("SELECT ip_allowlist FROM identity.tenants WHERE id = $1")
            .bind(tenant_id)
            .fetch_optional(&*state.pool)
            .await?;

    let entries: Vec<IpAllowlistEntry> = match row {
        Some((json_val,)) => serde_json::from_value(json_val).unwrap_or_default(),
        None => Vec::new(),
    };

    Ok(Json(entries))
}

/// PUT /api/v1/admin/security/ip-allowlist — Replace tenant's IP allowlist.
#[tracing::instrument(skip(state, payload))]
pub async fn update(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<Vec<IpAllowlistEntry>>,
) -> Result<Json<Vec<IpAllowlistEntry>>> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Forbidden("Tenant required".to_string()))?;

    // Validate IP addresses
    for entry in &payload {
        if entry.address.is_empty() {
            return Err(Error::Validation("IP address cannot be empty".to_string()));
        }
        // Basic CIDR validation
        if !entry.cidr.starts_with('/') {
            return Err(Error::Validation(format!(
                "Invalid CIDR notation: {}",
                entry.cidr
            )));
        }
    }

    let json_val = serde_json::to_value(&payload)
        .map_err(|e| Error::Internal(format!("JSON serialization error: {}", e)))?;

    sqlx::query("UPDATE identity.tenants SET ip_allowlist = $2 WHERE id = $1")
        .bind(tenant_id)
        .bind(&json_val)
        .execute(&*state.pool)
        .await?;

    tracing::info!(tenant_id = %tenant_id, count = payload.len(), "IP allowlist updated");

    Ok(Json(payload))
}
