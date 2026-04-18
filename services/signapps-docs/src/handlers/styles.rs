//! Style CRUD endpoints -- cascade inheritance for docs, sheets, slides.
//!
//! Routes:
//! - `GET    /api/v1/styles`                      -- list styles (query: `?type=paragraph&scope=global`)
//! - `GET    /api/v1/styles/:id`                  -- get style by ID
//! - `GET    /api/v1/styles/:id/resolved`         -- get resolved style (cascade merged)
//! - `POST   /api/v1/styles`                      -- create style
//! - `PUT    /api/v1/styles/:id`                  -- update style
//! - `DELETE /api/v1/styles/:id`                  -- delete style (non-builtin only)
//! - `GET    /api/v1/styles/templates/:template_id` -- list styles for template

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::AppState;
use signapps_common::middleware::TenantContext;
use signapps_db::models::{CreateStyle, ResolvedStyle, StyleDefinition, UpdateStyle};
use signapps_db::repositories::StyleRepository;

// ============================================================================
// Query params
// ============================================================================

/// Query parameters for listing styles.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListStylesQuery {
    /// Filter by style type (paragraph, character, cell, slide).
    #[serde(rename = "type")]
    pub style_type: Option<String>,
    /// Filter by scope (global, template, document).
    pub scope: Option<String>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/styles -- list styles for the current tenant
#[utoipa::path(
    get,
    path = "/api/v1/styles",
    params(ListStylesQuery),
    responses(
        (status = 200, description = "List of style definitions", body = Vec<StyleDefinition>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — no tenant"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Styles"
)]
#[tracing::instrument(skip_all)]
pub async fn list_styles(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Query(params): Query<ListStylesQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rows = StyleRepository::list(
        state.pool.inner(),
        ctx.tenant_id,
        params.style_type.as_deref(),
        params.scope.as_deref(),
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to list styles: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// GET /api/v1/styles/:id -- get a style by ID
#[utoipa::path(
    get,
    path = "/api/v1/styles/{id}",
    params(("id" = Uuid, Path, description = "Style ID")),
    responses(
        (status = 200, description = "Style found", body = StyleDefinition),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Style not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Styles"
)]
#[tracing::instrument(skip_all)]
pub async fn get_style(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let row = StyleRepository::find_by_id(state.pool.inner(), id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get style: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({ "data": row })))
}

/// GET /api/v1/styles/:id/resolved -- get resolved style with merged cascade properties
#[utoipa::path(
    get,
    path = "/api/v1/styles/{id}/resolved",
    params(("id" = Uuid, Path, description = "Style ID")),
    responses(
        (status = 200, description = "Resolved style with merged properties", body = ResolvedStyle),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Style not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Styles"
)]
#[tracing::instrument(skip_all)]
pub async fn get_resolved_style(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let resolved = StyleRepository::resolve(state.pool.inner(), id)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("not found") || msg.contains("NotFound") {
                StatusCode::NOT_FOUND
            } else {
                tracing::error!("Failed to resolve style: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })?;

    Ok(Json(serde_json::json!({ "data": resolved })))
}

/// POST /api/v1/styles -- create a new style definition
#[utoipa::path(
    post,
    path = "/api/v1/styles",
    request_body = CreateStyle,
    responses(
        (status = 201, description = "Style created", body = StyleDefinition),
        (status = 400, description = "Bad request"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — no tenant"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Styles"
)]
#[tracing::instrument(skip_all)]
pub async fn create_style(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Json(payload): Json<CreateStyle>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    if payload.name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row = StyleRepository::create(state.pool.inner(), ctx.tenant_id, payload)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create style: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": row })),
    ))
}

/// PUT /api/v1/styles/:id -- update a style (non-builtin only)
#[utoipa::path(
    put,
    path = "/api/v1/styles/{id}",
    params(("id" = Uuid, Path, description = "Style ID")),
    request_body = UpdateStyle,
    responses(
        (status = 200, description = "Style updated", body = StyleDefinition),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Style not found or is builtin"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Styles"
)]
#[tracing::instrument(skip_all)]
pub async fn update_style(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateStyle>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let row = StyleRepository::update(state.pool.inner(), id, payload)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("not found") || msg.contains("NotFound") || msg.contains("builtin") {
                StatusCode::NOT_FOUND
            } else {
                tracing::error!("Failed to update style: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })?;

    Ok(Json(serde_json::json!({ "data": row })))
}

/// DELETE /api/v1/styles/:id -- delete a style (non-builtin only)
#[utoipa::path(
    delete,
    path = "/api/v1/styles/{id}",
    params(("id" = Uuid, Path, description = "Style ID")),
    responses(
        (status = 204, description = "Style deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Style not found or is builtin"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Styles"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_style(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    StyleRepository::delete(state.pool.inner(), id)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("not found") || msg.contains("NotFound") || msg.contains("builtin") {
                StatusCode::NOT_FOUND
            } else {
                tracing::error!("Failed to delete style: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/styles/templates/:template_id -- list styles for a template
#[utoipa::path(
    get,
    path = "/api/v1/styles/templates/{template_id}",
    params(("template_id" = Uuid, Path, description = "Template ID")),
    responses(
        (status = 200, description = "Styles for the template", body = Vec<StyleDefinition>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Styles"
)]
#[tracing::instrument(skip_all)]
pub async fn list_template_styles(
    State(state): State<AppState>,
    Path(template_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rows = StyleRepository::list_for_template(state.pool.inner(), template_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list template styles: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({ "data": rows })))
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
