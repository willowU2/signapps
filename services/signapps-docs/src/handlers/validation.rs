//! Design validation endpoints — configurable per-tenant rules for design compliance.
//!
//! Routes:
//! - `GET    /api/v1/validation/rules`       — list rules (query: `?active_only=true`)
//! - `POST   /api/v1/validation/rules`       — create rule
//! - `PUT    /api/v1/validation/rules/:id`   — update rule
//! - `DELETE /api/v1/validation/rules/:id`   — delete rule
//! - `POST   /api/v1/validation/check`       — validate document against active rules

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::AppState;
use signapps_common::middleware::TenantContext;
use signapps_db::models::{
    CreateValidationRule, UpdateValidationRule, ValidationIssue, ValidationRule,
};
use signapps_db::repositories::ValidationRepository;

// ============================================================================
// Query params
// ============================================================================

/// Query parameters for listing validation rules.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListRulesQuery {
    /// When true, only return active rules.
    pub active_only: Option<bool>,
}

/// Request body for document validation.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CheckDocumentRequest {
    /// Raw document JSON to validate.
    pub document: serde_json::Value,
    /// Document type (e.g. `document`, `spreadsheet`, `presentation`).
    pub doc_type: String,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/v1/validation/rules -- list validation rules for the current tenant
#[utoipa::path(
    get,
    path = "/api/v1/validation/rules",
    params(ListRulesQuery),
    responses(
        (status = 200, description = "List of validation rules", body = Vec<ValidationRule>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — no tenant"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Validation"
)]
#[tracing::instrument(skip_all)]
pub async fn list_rules(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Query(params): Query<ListRulesQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let rows = ValidationRepository::list(
        state.pool.inner(),
        ctx.tenant_id,
        params.active_only.unwrap_or(false),
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to list validation rules: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(serde_json::json!({ "data": rows })))
}

/// POST /api/v1/validation/rules -- create a new validation rule
#[utoipa::path(
    post,
    path = "/api/v1/validation/rules",
    request_body = CreateValidationRule,
    responses(
        (status = 201, description = "Rule created", body = ValidationRule),
        (status = 400, description = "Bad request"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — no tenant"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Validation"
)]
#[tracing::instrument(skip_all)]
pub async fn create_rule(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Json(payload): Json<CreateValidationRule>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    if payload.name.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let row = ValidationRepository::create(state.pool.inner(), ctx.tenant_id, payload)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create validation rule: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": row })),
    ))
}

/// PUT /api/v1/validation/rules/:id -- update a validation rule
#[utoipa::path(
    put,
    path = "/api/v1/validation/rules/{id}",
    params(("id" = Uuid, Path, description = "Validation rule ID")),
    request_body = UpdateValidationRule,
    responses(
        (status = 200, description = "Rule updated", body = ValidationRule),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Rule not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Validation"
)]
#[tracing::instrument(skip_all)]
pub async fn update_rule(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateValidationRule>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let row = ValidationRepository::update(state.pool.inner(), id, payload)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("not found") || msg.contains("NotFound") {
                StatusCode::NOT_FOUND
            } else {
                tracing::error!("Failed to update validation rule: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })?;

    Ok(Json(serde_json::json!({ "data": row })))
}

/// DELETE /api/v1/validation/rules/:id -- delete a validation rule
#[utoipa::path(
    delete,
    path = "/api/v1/validation/rules/{id}",
    params(("id" = Uuid, Path, description = "Validation rule ID")),
    responses(
        (status = 204, description = "Rule deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Rule not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Validation"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_rule(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    ValidationRepository::delete(state.pool.inner(), id)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("not found") || msg.contains("NotFound") {
                StatusCode::NOT_FOUND
            } else {
                tracing::error!("Failed to delete validation rule: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })?;

    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/validation/check -- validate a document against active tenant rules
#[utoipa::path(
    post,
    path = "/api/v1/validation/check",
    request_body = CheckDocumentRequest,
    responses(
        (status = 200, description = "Validation results", body = Vec<ValidationIssue>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden — no tenant"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Validation"
)]
#[tracing::instrument(skip_all)]
pub async fn check_document(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Json(payload): Json<CheckDocumentRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Load all active rules for the tenant
    let rules = ValidationRepository::list(state.pool.inner(), ctx.tenant_id, true)
        .await
        .map_err(|e| {
            tracing::error!("Failed to load validation rules: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Filter rules that apply to this document type
    let applicable: Vec<&ValidationRule> = rules
        .iter()
        .filter(|r| r.applies_to.contains(&payload.doc_type))
        .collect();

    let issues = validate_document(&payload.document, &applicable);

    Ok(Json(serde_json::json!({ "data": issues, "count": issues.len() })))
}

// ============================================================================
// Validation engine
// ============================================================================

/// Validate a document JSON against a set of active rules.
fn validate_document(doc_json: &serde_json::Value, rules: &[&ValidationRule]) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();

    for rule in rules {
        if !rule.is_active {
            continue;
        }
        match rule.rule_type.as_str() {
            "min_font_size" => {
                let min = rule
                    .config
                    .get("min")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(10.0);
                scan_json_for_key(doc_json, "fontSize", &mut |path, val| {
                    if let Some(size) = val.as_f64() {
                        if size < min {
                            issues.push(ValidationIssue {
                                rule_name: rule.name.clone(),
                                rule_type: rule.rule_type.clone(),
                                severity: rule.severity.clone(),
                                message: format!(
                                    "Font size {size}px is below minimum {min}px"
                                ),
                                element_path: Some(path),
                            });
                        }
                    }
                });
            }
            "max_font_size" => {
                let max = rule
                    .config
                    .get("max")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(200.0);
                scan_json_for_key(doc_json, "fontSize", &mut |path, val| {
                    if let Some(size) = val.as_f64() {
                        if size > max {
                            issues.push(ValidationIssue {
                                rule_name: rule.name.clone(),
                                rule_type: rule.rule_type.clone(),
                                severity: rule.severity.clone(),
                                message: format!(
                                    "Font size {size}px exceeds maximum {max}px"
                                ),
                                element_path: Some(path),
                            });
                        }
                    }
                });
            }
            "max_text_length" => {
                let max_len = rule
                    .config
                    .get("max")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(5000) as usize;
                scan_json_for_key(doc_json, "text", &mut |path, val| {
                    if let Some(text) = val.as_str() {
                        if text.len() > max_len {
                            issues.push(ValidationIssue {
                                rule_name: rule.name.clone(),
                                rule_type: rule.rule_type.clone(),
                                severity: rule.severity.clone(),
                                message: format!(
                                    "Text length {} exceeds maximum {max_len}",
                                    text.len()
                                ),
                                element_path: Some(path),
                            });
                        }
                    }
                });
            }
            "allowed_fonts" => {
                let allowed: Vec<String> = rule
                    .config
                    .get("fonts")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();
                if allowed.is_empty() {
                    continue;
                }
                scan_json_for_key(doc_json, "fontFamily", &mut |path, val| {
                    if let Some(font) = val.as_str() {
                        if !allowed.iter().any(|a| a.eq_ignore_ascii_case(font)) {
                            issues.push(ValidationIssue {
                                rule_name: rule.name.clone(),
                                rule_type: rule.rule_type.clone(),
                                severity: rule.severity.clone(),
                                message: format!(
                                    "Font \"{font}\" is not in the allowed list"
                                ),
                                element_path: Some(path),
                            });
                        }
                    }
                });
            }
            "allowed_colors" => {
                let allowed: Vec<String> = rule
                    .config
                    .get("colors")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_lowercase()))
                            .collect()
                    })
                    .unwrap_or_default();
                if allowed.is_empty() {
                    continue;
                }
                for key in &["color", "fill", "backgroundColor"] {
                    scan_json_for_key(doc_json, key, &mut |path, val| {
                        if let Some(color) = val.as_str() {
                            if !allowed.contains(&color.to_lowercase()) {
                                issues.push(ValidationIssue {
                                    rule_name: rule.name.clone(),
                                    rule_type: rule.rule_type.clone(),
                                    severity: rule.severity.clone(),
                                    message: format!(
                                        "Color \"{color}\" (key: {key}) is not in the allowed palette"
                                    ),
                                    element_path: Some(path),
                                });
                            }
                        }
                    });
                }
            }
            "min_image_dpi" => {
                let min_dpi = rule
                    .config
                    .get("min_dpi")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(150.0);
                scan_json_for_key(doc_json, "dpi", &mut |path, val| {
                    if let Some(dpi) = val.as_f64() {
                        if dpi < min_dpi {
                            issues.push(ValidationIssue {
                                rule_name: rule.name.clone(),
                                rule_type: rule.rule_type.clone(),
                                severity: rule.severity.clone(),
                                message: format!(
                                    "Image DPI {dpi} is below minimum {min_dpi}"
                                ),
                                element_path: Some(path),
                            });
                        }
                    }
                });
            }
            // Unknown / custom rules are silently skipped
            _ => {}
        }
    }

    issues
}

/// Recursively walk a JSON value, calling `callback` for every occurrence of `key`.
///
/// The callback receives the dot-separated path and the value at that key.
fn scan_json_for_key(
    value: &serde_json::Value,
    key: &str,
    callback: &mut impl FnMut(String, &serde_json::Value),
) {
    scan_json_for_key_inner(value, key, String::new(), callback);
}

fn scan_json_for_key_inner(
    value: &serde_json::Value,
    key: &str,
    path: String,
    callback: &mut impl FnMut(String, &serde_json::Value),
) {
    match value {
        serde_json::Value::Object(map) => {
            for (k, v) in map {
                let child_path = if path.is_empty() {
                    k.clone()
                } else {
                    format!("{path}.{k}")
                };
                if k == key {
                    callback(child_path.clone(), v);
                }
                scan_json_for_key_inner(v, key, child_path, callback);
            }
        }
        serde_json::Value::Array(arr) => {
            for (i, v) in arr.iter().enumerate() {
                let child_path = if path.is_empty() {
                    format!("[{i}]")
                } else {
                    format!("{path}[{i}]")
                };
                scan_json_for_key_inner(v, key, child_path, callback);
            }
        }
        _ => {}
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
    fn scan_json_finds_nested_keys() {
        let doc = serde_json::json!({
            "elements": [
                { "type": "text", "fontSize": 8, "text": "Hello" },
                { "type": "text", "fontSize": 14, "text": "World" },
                { "nested": { "fontSize": 6 } }
            ]
        });
        let mut found = Vec::new();
        scan_json_for_key(&doc, "fontSize", &mut |path, val| {
            found.push((path, val.clone()));
        });
        assert_eq!(found.len(), 3);
        assert_eq!(found[0].1, serde_json::json!(8));
        assert_eq!(found[1].1, serde_json::json!(14));
        assert_eq!(found[2].1, serde_json::json!(6));
    }

    #[test]
    fn validate_min_font_size() {
        let doc = serde_json::json!({
            "elements": [
                { "fontSize": 8 },
                { "fontSize": 12 }
            ]
        });
        let rule = ValidationRule {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            name: "Min font".into(),
            rule_type: "min_font_size".into(),
            config: serde_json::json!({"min": 10}),
            severity: "warning".into(),
            is_active: true,
            applies_to: vec!["document".into()],
            created_at: chrono::Utc::now(),
        };
        let issues = validate_document(&doc, &[&rule]);
        assert_eq!(issues.len(), 1);
        assert!(issues[0].message.contains("8px"));
    }

    #[test]
    fn validate_max_text_length() {
        let long_text = "a".repeat(6000);
        let doc = serde_json::json!({
            "elements": [{ "text": long_text }]
        });
        let rule = ValidationRule {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            name: "Max text".into(),
            rule_type: "max_text_length".into(),
            config: serde_json::json!({"max": 5000}),
            severity: "info".into(),
            is_active: true,
            applies_to: vec!["document".into()],
            created_at: chrono::Utc::now(),
        };
        let issues = validate_document(&doc, &[&rule]);
        assert_eq!(issues.len(), 1);
        assert!(issues[0].message.contains("6000"));
    }

    #[test]
    fn validate_allowed_fonts() {
        let doc = serde_json::json!({
            "elements": [
                { "fontFamily": "Arial" },
                { "fontFamily": "Comic Sans" }
            ]
        });
        let rule = ValidationRule {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            name: "Allowed fonts".into(),
            rule_type: "allowed_fonts".into(),
            config: serde_json::json!({"fonts": ["Arial", "Helvetica"]}),
            severity: "error".into(),
            is_active: true,
            applies_to: vec!["document".into()],
            created_at: chrono::Utc::now(),
        };
        let issues = validate_document(&doc, &[&rule]);
        assert_eq!(issues.len(), 1);
        assert!(issues[0].message.contains("Comic Sans"));
    }

    #[test]
    fn validate_allowed_colors() {
        let doc = serde_json::json!({
            "elements": [
                { "color": "#FF0000" },
                { "fill": "#00FF00" },
                { "backgroundColor": "#0000FF" }
            ]
        });
        let rule = ValidationRule {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            name: "Brand colors".into(),
            rule_type: "allowed_colors".into(),
            config: serde_json::json!({"colors": ["#ff0000", "#0000ff"]}),
            severity: "warning".into(),
            is_active: true,
            applies_to: vec!["document".into()],
            created_at: chrono::Utc::now(),
        };
        let issues = validate_document(&doc, &[&rule]);
        // Only #00FF00 (fill) should be flagged
        assert_eq!(issues.len(), 1);
        assert!(issues[0].message.contains("#00FF00"));
    }

    #[test]
    fn inactive_rules_are_skipped() {
        let doc = serde_json::json!({"fontSize": 5});
        let rule = ValidationRule {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            name: "Min font".into(),
            rule_type: "min_font_size".into(),
            config: serde_json::json!({"min": 10}),
            severity: "warning".into(),
            is_active: false,
            applies_to: vec!["document".into()],
            created_at: chrono::Utc::now(),
        };
        let issues = validate_document(&doc, &[&rule]);
        assert!(issues.is_empty());
    }
}
