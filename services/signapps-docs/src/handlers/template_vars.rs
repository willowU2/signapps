//! Template variable CRUD + variable resolution and batch export.
//!
//! Routes:
//! - `GET    /api/v1/templates/:id/variables`        -- list variables
//! - `POST   /api/v1/templates/:id/variables`        -- create variable
//! - `DELETE /api/v1/templates/:id/variables/:var_id` -- delete variable
//! - `POST   /api/v1/templates/:id/resolve`           -- resolve variables
//! - `POST   /api/v1/templates/:id/batch-export`      -- batch resolve N rows
//! - `GET    /api/v1/social-presets`                   -- list all social presets
//! - `GET    /api/v1/social-presets/:platform`         -- presets for a platform

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::AppState;
use signapps_common::middleware::TenantContext;
use signapps_db::models::{CreateTemplateVariable, SocialPreset, TemplateVariable};
use signapps_db::repositories::TemplateVariableRepository;

// ============================================================================
// Request / response types
// ============================================================================

/// Body for resolving template variables.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct ResolveBody {
    /// Map of variable name to value.
    pub values: HashMap<String, String>,
    /// Document JSON content to resolve variables in.
    /// If omitted, only validates that required variables are present.
    pub content: Option<serde_json::Value>,
}

/// Response from variable resolution.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ResolveResponse {
    /// The resolved document content with variables replaced.
    pub resolved: serde_json::Value,
}

/// Body for batch export (resolve N rows).
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct BatchExportBody {
    /// Output format (e.g. "json", "pdf", "png").
    pub format: String,
    /// Document JSON content (template) to resolve.
    pub content: serde_json::Value,
    /// Array of value maps, one per output file.
    pub rows: Vec<HashMap<String, String>>,
}

/// A single resolved document in the batch.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct BatchExportItem {
    /// Zero-based index of the row.
    pub index: usize,
    /// The resolved document content.
    pub resolved: serde_json::Value,
}

/// Response from batch export.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct BatchExportResponse {
    /// Number of resolved documents.
    pub count: usize,
    /// Resolved documents.
    pub items: Vec<BatchExportItem>,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/templates/:id/variables -- list variables for a template
#[utoipa::path(
    get,
    path = "/api/v1/templates/{id}/variables",
    params(("id" = Uuid, Path, description = "Template ID")),
    responses(
        (status = 200, description = "List of template variables", body = Vec<TemplateVariable>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Template Variables"
)]
#[tracing::instrument(skip_all)]
pub async fn list_variables(
    State(state): State<AppState>,
    Path(template_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rows = TemplateVariableRepository::list_variables(state.pool.inner(), template_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list template variables: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// POST /api/v1/templates/:id/variables -- create a variable for a template
#[utoipa::path(
    post,
    path = "/api/v1/templates/{id}/variables",
    params(("id" = Uuid, Path, description = "Template ID")),
    request_body = CreateTemplateVariable,
    responses(
        (status = 201, description = "Variable created", body = TemplateVariable),
        (status = 400, description = "Bad request"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden -- no tenant"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Template Variables"
)]
#[tracing::instrument(skip_all)]
pub async fn create_variable(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Path(template_id): Path<Uuid>,
    Json(payload): Json<CreateTemplateVariable>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    if payload.name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let valid_types = ["text", "image", "date", "list"];
    if !valid_types.contains(&payload.variable_type.as_str()) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row =
        TemplateVariableRepository::create_variable(state.pool.inner(), ctx.tenant_id, template_id, payload)
            .await
            .map_err(|e| {
                tracing::error!("Failed to create template variable: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": row })),
    ))
}

/// DELETE /api/v1/templates/:id/variables/:var_id -- delete a variable
#[utoipa::path(
    delete,
    path = "/api/v1/templates/{id}/variables/{var_id}",
    params(
        ("id" = Uuid, Path, description = "Template ID"),
        ("var_id" = Uuid, Path, description = "Variable ID"),
    ),
    responses(
        (status = 204, description = "Variable deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Variable not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Template Variables"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_variable(
    State(state): State<AppState>,
    Path((_template_id, var_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, StatusCode> {
    TemplateVariableRepository::delete_variable(state.pool.inner(), var_id)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("not found") || msg.contains("NotFound") {
                StatusCode::NOT_FOUND
            } else {
                tracing::error!("Failed to delete template variable: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/templates/:id/resolve -- resolve variables in document content
///
/// Scans the document JSON string for `{{variable}}` patterns and replaces
/// them with the provided values. Returns the resolved document JSON.
#[utoipa::path(
    post,
    path = "/api/v1/templates/{id}/resolve",
    params(("id" = Uuid, Path, description = "Template ID")),
    request_body = ResolveBody,
    responses(
        (status = 200, description = "Resolved document content", body = ResolveResponse),
        (status = 400, description = "Missing required variables"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Template Variables"
)]
#[tracing::instrument(skip_all)]
pub async fn resolve_variables(
    State(state): State<AppState>,
    Path(template_id): Path<Uuid>,
    Json(payload): Json<ResolveBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Fetch variable definitions to apply defaults and check required fields.
    let variables = TemplateVariableRepository::list_variables(state.pool.inner(), template_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list variables for resolve: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Build effective values: caller-supplied values + defaults.
    let mut effective = payload.values.clone();
    for var in &variables {
        if !effective.contains_key(&var.name) {
            if let Some(ref default) = var.default_value {
                effective.insert(var.name.clone(), default.clone());
            } else if var.required {
                tracing::warn!(variable = %var.name, "Missing required template variable");
                return Err(StatusCode::BAD_REQUEST);
            }
        }
    }

    let content = payload.content.unwrap_or(serde_json::Value::Object(
        serde_json::Map::new(),
    ));

    let resolved = resolve_template_content(&content, &effective);

    Ok(Json(serde_json::json!({ "data": { "resolved": resolved } })))
}

/// POST /api/v1/templates/:id/batch-export -- resolve N rows of variables
#[utoipa::path(
    post,
    path = "/api/v1/templates/{id}/batch-export",
    params(("id" = Uuid, Path, description = "Template ID")),
    request_body = BatchExportBody,
    responses(
        (status = 200, description = "Batch resolved documents", body = BatchExportResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Template Variables"
)]
#[tracing::instrument(skip_all)]
pub async fn batch_export(
    State(state): State<AppState>,
    Path(template_id): Path<Uuid>,
    Json(payload): Json<BatchExportBody>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Fetch variable definitions for defaults.
    let variables = TemplateVariableRepository::list_variables(state.pool.inner(), template_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list variables for batch export: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut items = Vec::with_capacity(payload.rows.len());

    for (index, row) in payload.rows.iter().enumerate() {
        // Build effective values per row.
        let mut effective = row.clone();
        for var in &variables {
            if !effective.contains_key(&var.name) {
                if let Some(ref default) = var.default_value {
                    effective.insert(var.name.clone(), default.clone());
                }
            }
        }

        let resolved = resolve_template_content(&payload.content, &effective);
        items.push(BatchExportItem { index, resolved });
    }

    let response = BatchExportResponse {
        count: items.len(),
        items,
    };

    Ok(Json(serde_json::json!({ "data": response })))
}

/// GET /api/v1/social-presets -- list all social media presets
#[utoipa::path(
    get,
    path = "/api/v1/social-presets",
    responses(
        (status = 200, description = "All social media presets", body = Vec<SocialPreset>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Social Presets"
)]
#[tracing::instrument(skip_all)]
pub async fn list_social_presets(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rows = TemplateVariableRepository::list_social_presets(state.pool.inner())
        .await
        .map_err(|e| {
            tracing::error!("Failed to list social presets: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// GET /api/v1/social-presets/:platform -- presets for a specific platform
#[utoipa::path(
    get,
    path = "/api/v1/social-presets/{platform}",
    params(("platform" = String, Path, description = "Social media platform name")),
    responses(
        (status = 200, description = "Presets for the platform", body = Vec<SocialPreset>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Social Presets"
)]
#[tracing::instrument(skip_all)]
pub async fn list_social_presets_by_platform(
    State(state): State<AppState>,
    Path(platform): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rows =
        TemplateVariableRepository::list_social_presets_by_platform(state.pool.inner(), &platform)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list social presets for platform: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

// ============================================================================
// Internal helpers
// ============================================================================

/// Replace `{{variable}}` placeholders in a JSON value with supplied values.
///
/// Walks the JSON tree and performs string replacement on all string values.
fn resolve_template_content(
    content: &serde_json::Value,
    values: &HashMap<String, String>,
) -> serde_json::Value {
    match content {
        serde_json::Value::String(s) => {
            let mut resolved = s.clone();
            for (name, value) in values {
                let placeholder = format!("{{{{{name}}}}}");
                resolved = resolved.replace(&placeholder, value);
            }
            serde_json::Value::String(resolved)
        },
        serde_json::Value::Object(map) => {
            let mut new_map = serde_json::Map::new();
            for (key, val) in map {
                new_map.insert(key.clone(), resolve_template_content(val, values));
            }
            serde_json::Value::Object(new_map)
        },
        serde_json::Value::Array(arr) => {
            let resolved_arr: Vec<serde_json::Value> = arr
                .iter()
                .map(|v| resolve_template_content(v, values))
                .collect();
            serde_json::Value::Array(resolved_arr)
        },
        other => other.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn module_compiles() {
        assert!(true, "{} handler module loaded", module_path!());
    }

    #[test]
    fn resolve_replaces_placeholders() {
        let content = serde_json::json!({
            "title": "Hello {{name}}",
            "body": "Welcome to {{company}}, {{name}}!",
            "nested": {
                "text": "Date: {{date}}"
            },
            "list": ["{{name}}", "static"],
            "number": 42
        });

        let mut values = HashMap::new();
        values.insert("name".to_string(), "Alice".to_string());
        values.insert("company".to_string(), "Acme".to_string());
        values.insert("date".to_string(), "2026-01-01".to_string());

        let resolved = resolve_template_content(&content, &values);

        assert_eq!(resolved["title"], "Hello Alice");
        assert_eq!(resolved["body"], "Welcome to Acme, Alice!");
        assert_eq!(resolved["nested"]["text"], "Date: 2026-01-01");
        assert_eq!(resolved["list"][0], "Alice");
        assert_eq!(resolved["list"][1], "static");
        assert_eq!(resolved["number"], 42);
    }

    #[test]
    fn resolve_preserves_unmatched_placeholders() {
        let content = serde_json::json!({ "text": "{{unknown}}" });
        let values = HashMap::new();
        let resolved = resolve_template_content(&content, &values);
        assert_eq!(resolved["text"], "{{unknown}}");
    }
}
