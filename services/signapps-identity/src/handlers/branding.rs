//! WL1: Tenant Branding handlers.
//!
//! Manages per-tenant white-label settings: logo URL, primary color,
//! favicon URL, and app name override.
//!
//! Endpoints:
//!   GET  /api/v1/tenants/:id/branding   — Get branding config for a tenant
//!   PUT  /api/v1/tenants/:id/branding   — Set branding config for a tenant
//!   GET  /api/v1/tenants/me/branding    — Get branding for the current tenant
//!
//! The branding config is stored as a JSONB column `branding` on the
//! `identity.tenants` table. If the column does not exist yet, the handler
//! gracefully returns an empty config.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result, TenantContext};
use uuid::Uuid;
use validator::Validate;

use crate::AppState;

// ============================================================================
// Domain types
// ============================================================================

/// Tenant branding configuration.
///
/// All fields are optional — a tenant may choose to override only a subset.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TenantBranding {
    /// URL to the tenant's logo image (PNG/SVG recommended, max 2 MB).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo_url: Option<String>,

    /// Primary brand color as a CSS hex string (e.g. `"#1a73e8"`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_color: Option<String>,

    /// URL to the tenant's favicon (ICO/PNG, 32x32 or 64x64).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub favicon_url: Option<String>,

    /// Custom app name to display instead of "SignApps" (max 64 chars).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_name: Option<String>,
}

/// Response wrapper that includes metadata.
#[derive(Debug, Serialize)]
pub struct BrandingResponse {
    pub tenant_id: Uuid,
    pub branding: TenantBranding,
    pub updated_at: DateTime<Utc>,
}

/// Request body for updating branding.
#[derive(Debug, Deserialize, Validate)]
pub struct UpdateBrandingRequest {
    #[validate(url)]
    pub logo_url: Option<String>,

    /// Must be a valid 3 or 6-character hex color prefixed with `#`.
    #[validate(length(min = 4, max = 7))]
    pub primary_color: Option<String>,

    #[validate(url)]
    pub favicon_url: Option<String>,

    #[validate(length(max = 64))]
    pub app_name: Option<String>,
}

// ============================================================================
// Helpers
// ============================================================================

/// Fetch the branding JSONB for a tenant, returning a default if null/missing.
async fn fetch_branding(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
) -> Result<(TenantBranding, DateTime<Utc>)> {
    // We store branding in the `settings` JSONB column under the "branding" key,
    // falling back to the existing `logo_url` column for backwards compatibility.
    let row: Option<(Option<serde_json::Value>, Option<String>, DateTime<Utc>)> = sqlx::query_as(
        r#"SELECT settings, logo_url, updated_at
               FROM identity.tenants
               WHERE id = $1"#,
    )
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?;

    let (settings, legacy_logo, updated_at) =
        row.ok_or_else(|| Error::NotFound(format!("Tenant {}", tenant_id)))?;

    // Extract branding from settings JSONB, merging with legacy logo_url
    let mut branding = settings
        .as_ref()
        .and_then(|s| s.get("branding"))
        .and_then(|b| serde_json::from_value::<TenantBranding>(b.clone()).ok())
        .unwrap_or_default();

    // Backwards compat: if logo_url column is set but branding doesn't have one, use it
    if branding.logo_url.is_none() {
        branding.logo_url = legacy_logo;
    }

    Ok((branding, updated_at))
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/tenants/:id/branding — Get branding config for a specific tenant (admin).
#[tracing::instrument(skip(state))]
pub async fn get_branding(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<BrandingResponse>> {
    let (branding, updated_at) = fetch_branding(&state.pool, id).await?;

    Ok(Json(BrandingResponse {
        tenant_id: id,
        branding,
        updated_at,
    }))
}

/// GET /api/v1/tenants/me/branding — Get branding for the current user's tenant (public-ish).
///
/// This endpoint is intentionally accessible without admin privileges so the
/// frontend can load branding on the login page.
#[tracing::instrument(skip(state))]
pub async fn get_my_branding(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
) -> Result<Json<BrandingResponse>> {
    let (branding, updated_at) = fetch_branding(&state.pool, ctx.tenant_id).await?;

    Ok(Json(BrandingResponse {
        tenant_id: ctx.tenant_id,
        branding,
        updated_at,
    }))
}

/// PUT /api/v1/tenants/:id/branding — Set branding config for a tenant (admin only).
#[tracing::instrument(skip(state, payload))]
pub async fn update_branding(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateBrandingRequest>,
) -> Result<Json<BrandingResponse>> {
    payload
        .validate()
        .map_err(|e| Error::Validation(e.to_string()))?;

    // Validate hex color format if provided
    if let Some(ref color) = payload.primary_color {
        if !color.starts_with('#') || (color.len() != 4 && color.len() != 7) {
            return Err(Error::Validation(
                "primary_color must be a valid hex color (e.g. #fff or #1a73e8)".to_string(),
            ));
        }
        // Check all chars after '#' are hex digits
        if !color[1..].chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(Error::Validation(
                "primary_color must be a valid hex color".to_string(),
            ));
        }
    }

    // Build the branding object from the request
    let branding = TenantBranding {
        logo_url: payload.logo_url,
        primary_color: payload.primary_color,
        favicon_url: payload.favicon_url,
        app_name: payload.app_name,
    };

    let branding_json = serde_json::to_value(&branding)
        .map_err(|e| Error::Internal(format!("Failed to serialize branding: {}", e)))?;

    // Merge into the settings JSONB column using || operator (PostgreSQL JSONB merge)
    let row: Option<(DateTime<Utc>,)> = sqlx::query_as(
        r#"UPDATE identity.tenants
           SET settings   = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('branding', $2),
               logo_url   = COALESCE($3, logo_url),
               updated_at = NOW()
           WHERE id = $1
           RETURNING updated_at"#,
    )
    .bind(id)
    .bind(&branding_json)
    .bind(&branding.logo_url)
    .fetch_optional(&*state.pool)
    .await?;

    let (updated_at,) = row.ok_or_else(|| Error::NotFound(format!("Tenant {}", id)))?;

    tracing::info!(tenant_id = %id, "Updated tenant branding");

    Ok(Json(BrandingResponse {
        tenant_id: id,
        branding,
        updated_at,
    }))
}

/// DELETE /api/v1/tenants/:id/branding — Reset branding to defaults (admin only).
#[tracing::instrument(skip(state))]
pub async fn reset_branding(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode> {
    let result = sqlx::query(
        r#"UPDATE identity.tenants
           SET settings   = settings - 'branding',
               logo_url   = NULL,
               updated_at = NOW()
           WHERE id = $1"#,
    )
    .bind(id)
    .execute(&*state.pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(Error::NotFound(format!("Tenant {}", id)));
    }

    tracing::info!(tenant_id = %id, "Reset tenant branding to defaults");
    Ok(StatusCode::NO_CONTENT)
}
