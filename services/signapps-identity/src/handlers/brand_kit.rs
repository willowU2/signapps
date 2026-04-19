//! Brand Kit handlers -- per-tenant visual identity management.
//!
//! Provides GET/PUT endpoints for retrieving and updating the tenant's
//! brand kit (colors, fonts, logos, guidelines).
//!
//! # Endpoints
//!
//! - `GET  /api/v1/brand-kit` -- Get the current tenant's brand kit
//! - `PUT  /api/v1/brand-kit` -- Update the current tenant's brand kit

use axum::{extract::State, Extension, Json};
use signapps_common::{Claims, Error, Result};
use signapps_db::models::brand_kit::{BrandKit, UpdateBrandKit};
use signapps_db::repositories::BrandKitRepository;

use crate::AppState;

/// GET /api/v1/brand-kit -- Retrieve the brand kit for the authenticated user's tenant.
///
/// If no brand kit exists yet for the tenant, a default one is created automatically.
///
/// # Errors
///
/// Returns `Error::Unauthorized` if claims are missing.
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip_all, fields(tenant_id))]
pub async fn get_brand_kit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<BrandKit>> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Unauthorized)?;

    tracing::Span::current().record("tenant_id", tracing::field::display(tenant_id));

    let kit = BrandKitRepository::get(&state.pool, tenant_id).await?;
    Ok(Json(kit))
}

/// PUT /api/v1/brand-kit -- Update the brand kit for the authenticated user's tenant.
///
/// Only the fields provided in the request body are updated; all other fields
/// retain their current values (COALESCE pattern).
///
/// # Errors
///
/// Returns `Error::Unauthorized` if claims are missing.
/// Returns `Error::Validation` if a color field has invalid hex format.
/// Returns `Error::Database` on query failure.
///
/// # Panics
///
/// No panics possible -- all errors are propagated via `Result`.
#[tracing::instrument(skip_all, fields(tenant_id))]
pub async fn update_brand_kit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<UpdateBrandKit>,
) -> Result<Json<BrandKit>> {
    let tenant_id = claims
        .tenant_id
        .ok_or_else(|| Error::Unauthorized)?;

    tracing::Span::current().record("tenant_id", tracing::field::display(tenant_id));

    // Validate hex color fields if provided
    for (name, value) in [
        ("primary_color", &input.primary_color),
        ("secondary_color", &input.secondary_color),
        ("accent_color", &input.accent_color),
        ("danger_color", &input.danger_color),
        ("success_color", &input.success_color),
    ] {
        if let Some(ref color) = value {
            validate_hex_color(name, color)?;
        }
    }

    let kit = BrandKitRepository::update(&state.pool, tenant_id, input).await?;

    tracing::info!(tenant_id = %tenant_id, "Updated brand kit");

    Ok(Json(kit))
}

/// Validate that a string is a valid CSS hex color (`#RGB` or `#RRGGBB`).
fn validate_hex_color(field_name: &str, color: &str) -> Result<()> {
    if !color.starts_with('#') || (color.len() != 4 && color.len() != 7) {
        return Err(Error::Validation(format!(
            "{field_name} must be a valid hex color (e.g. #fff or #3b82f6)"
        )));
    }
    if !color[1..].chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(Error::Validation(format!(
            "{field_name} must contain only hex digits after '#'"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_compiles() {
        // Placeholder: ensures the module compiles.
        let _ = module_path!();
    }

    #[test]
    fn valid_hex_colors() {
        assert!(validate_hex_color("test", "#fff").is_ok());
        assert!(validate_hex_color("test", "#3b82f6").is_ok());
        assert!(validate_hex_color("test", "#000000").is_ok());
        assert!(validate_hex_color("test", "#ABC").is_ok());
    }

    #[test]
    fn invalid_hex_colors() {
        assert!(validate_hex_color("test", "3b82f6").is_err());
        assert!(validate_hex_color("test", "#3b82f").is_err());
        assert!(validate_hex_color("test", "#xyz").is_err());
        assert!(validate_hex_color("test", "").is_err());
        assert!(validate_hex_color("test", "#12345678").is_err());
    }
}
