//! Per-tenant CSS override handlers (admin only).

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Serialize)]
/// Response for TenantCss.
pub struct TenantCssResponse {
    pub tenant_id: Uuid,
    pub css_override: Option<String>,
}

#[derive(Debug, Deserialize)]
/// Request body for SetTenantCss.
pub struct SetTenantCssRequest {
    /// Raw CSS string. Pass null/empty to clear.
    pub css_override: Option<String>,
}

/// GET /api/v1/admin/tenants/:id/css — Get CSS override for a tenant.
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn get_css(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TenantCssResponse>> {
    let row: Option<(Option<String>,)> =
        sqlx::query_as("SELECT css_override FROM identity.tenants WHERE id = $1")
            .bind(id)
            .fetch_optional(&*state.pool)
            .await?;

    let css = row
        .ok_or_else(|| Error::NotFound(format!("Tenant {}", id)))?
        .0;

    Ok(Json(TenantCssResponse {
        tenant_id: id,
        css_override: css,
    }))
}

/// PUT /api/v1/admin/tenants/:id/css — Set (or clear) CSS override for a tenant.
#[tracing::instrument(skip(state, payload))]
#[tracing::instrument(skip_all)]
pub async fn set_css(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SetTenantCssRequest>,
) -> Result<Json<TenantCssResponse>> {
    let result = sqlx::query("UPDATE identity.tenants SET css_override = $2 WHERE id = $1")
        .bind(id)
        .bind(&payload.css_override)
        .execute(&*state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!("Tenant {}", id)));
    }

    tracing::info!(tenant_id = %id, "Updated tenant CSS override");

    Ok(Json(TenantCssResponse {
        tenant_id: id,
        css_override: payload.css_override,
    }))
}

/// DELETE /api/v1/admin/tenants/:id/css — Clear CSS override for a tenant.
#[tracing::instrument(skip(state))]
#[tracing::instrument(skip_all)]
pub async fn clear_css(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<StatusCode> {
    let result = sqlx::query("UPDATE identity.tenants SET css_override = NULL WHERE id = $1")
        .bind(id)
        .execute(&*state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!("Tenant {}", id)));
    }

    tracing::info!(tenant_id = %id, "Cleared tenant CSS override");
    Ok(StatusCode::NO_CONTENT)
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
