//! Coverage Handlers
//!
//! CRUD operations for coverage templates and rules (trames).
//! Manages staffing requirements per organizational node.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

// ============================================================================
// Types
// ============================================================================

/// Coverage template (reusable weekly pattern)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
/// CoverageTemplate data transfer object.
pub struct CoverageTemplate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub weekly_pattern: serde_json::Value,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Coverage rule (applied to an org node)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
/// CoverageRule data transfer object.
pub struct CoverageRule {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub org_node_id: Uuid,
    pub template_id: Option<Uuid>,
    pub name: String,
    pub valid_from: NaiveDate,
    pub valid_to: Option<NaiveDate>,
    pub custom_slots: Option<serde_json::Value>,
    pub inherit_from_parent: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Coverage rule with ancestor info (for queries with inheritance)
#[derive(Debug, Clone, FromRow)]
struct CoverageRuleWithAncestor {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub org_node_id: Uuid,
    pub template_id: Option<Uuid>,
    pub name: String,
    pub valid_from: NaiveDate,
    pub valid_to: Option<NaiveDate>,
    pub custom_slots: Option<serde_json::Value>,
    pub inherit_from_parent: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub inherited_from: Uuid,
}

impl CoverageRuleWithAncestor {
    fn into_rule(self) -> CoverageRule {
        CoverageRule {
            id: self.id,
            tenant_id: self.tenant_id,
            org_node_id: self.org_node_id,
            template_id: self.template_id,
            name: self.name,
            valid_from: self.valid_from,
            valid_to: self.valid_to,
            custom_slots: self.custom_slots,
            inherit_from_parent: self.inherit_from_parent,
            is_active: self.is_active,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

/// Coverage slot definition
#[derive(Debug, Clone, Serialize, Deserialize)]
/// CoverageSlot data transfer object.
pub struct CoverageSlot {
    pub day_of_week: i32,   // 0=Sunday, 6=Saturday
    pub start_time: String, // "HH:MM"
    pub end_time: String,
    pub min_employees: i32,
    pub max_employees: Option<i32>,
    pub required_functions: Vec<String>,
    pub label: Option<String>,
}

/// Weekly pattern structure
#[derive(Debug, Clone, Serialize, Deserialize)]
/// WeeklyPattern data transfer object.
pub struct WeeklyPattern {
    pub monday: Vec<CoverageSlot>,
    pub tuesday: Vec<CoverageSlot>,
    pub wednesday: Vec<CoverageSlot>,
    pub thursday: Vec<CoverageSlot>,
    pub friday: Vec<CoverageSlot>,
    pub saturday: Vec<CoverageSlot>,
    pub sunday: Vec<CoverageSlot>,
}

/// Effective coverage for a node (computed)
#[derive(Debug, Clone, Serialize, Deserialize)]
/// EffectiveCoverage data transfer object.
pub struct EffectiveCoverage {
    pub org_node_id: Uuid,
    pub org_node_name: String,
    pub rule: Option<CoverageRule>,
    pub template: Option<CoverageTemplate>,
    pub effective_slots: Vec<CoverageSlot>,
    pub inherited_from: Option<Uuid>,
}

/// Create template request
#[derive(Debug, Deserialize, Validate)]
/// Request body for CreateTemplate.
pub struct CreateTemplateRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub description: Option<String>,
    pub weekly_pattern: WeeklyPattern,
    pub is_default: Option<bool>,
}

/// Update template request
#[derive(Debug, Deserialize, Validate)]
/// Request body for UpdateTemplate.
pub struct UpdateTemplateRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    pub description: Option<String>,
    pub weekly_pattern: Option<WeeklyPattern>,
    pub is_default: Option<bool>,
}

/// Create rule request
#[derive(Debug, Deserialize, Validate)]
/// Request body for CreateRule.
pub struct CreateRuleRequest {
    pub org_node_id: Uuid,
    pub template_id: Option<Uuid>,
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub valid_from: NaiveDate,
    pub valid_to: Option<NaiveDate>,
    pub custom_slots: Option<Vec<CoverageSlot>>,
    pub inherit_from_parent: Option<bool>,
}

/// Update rule request
#[derive(Debug, Deserialize, Validate)]
/// Request body for UpdateRule.
pub struct UpdateRuleRequest {
    pub template_id: Option<Uuid>,
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    pub valid_from: Option<NaiveDate>,
    pub valid_to: Option<NaiveDate>,
    pub custom_slots: Option<Vec<CoverageSlot>>,
    pub inherit_from_parent: Option<bool>,
    pub is_active: Option<bool>,
}

/// Query params for coverage rules
#[derive(Debug, Deserialize, Default)]
/// Query parameters for filtering results.
pub struct RuleQueryParams {
    #[allow(dead_code)] // Scaffolded — will be wired when handler is implemented
    pub org_node_id: Option<Uuid>,
    pub include_inactive: Option<bool>,
    pub effective_date: Option<NaiveDate>,
}

// ============================================================================
// Template Handlers
// ============================================================================

/// List all coverage templates
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/coverage",
    responses((status = 200, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn list_templates(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let templates: Vec<CoverageTemplate> = sqlx::query_as(
        r#"
        SELECT * FROM workforce_coverage_templates
        WHERE tenant_id = $1
        ORDER BY is_default DESC, name
        "#,
    )
    .bind(ctx.tenant_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list templates: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(templates))
}

/// Create a coverage template
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/coverage",
    responses((status = 201, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn create_template(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    req.validate().map_err(|e| {
        tracing::warn!("Validation error: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    let id = Uuid::new_v4();
    let now = Utc::now();

    // If this is marked as default, unset other defaults
    if req.is_default.unwrap_or(false) {
        sqlx::query(
            "UPDATE workforce_coverage_templates SET is_default = false WHERE tenant_id = $1",
        )
        .bind(ctx.tenant_id)
        .execute(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to unset defaults: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    let weekly_pattern_json = serde_json::to_value(&req.weekly_pattern).map_err(|e| {
        tracing::error!("Failed to serialize weekly pattern: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let template: CoverageTemplate = sqlx::query_as(
        r#"
        INSERT INTO workforce_coverage_templates (
            id, tenant_id, name, description, weekly_pattern, is_default, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(weekly_pattern_json)
    .bind(req.is_default.unwrap_or(false))
    .bind(now)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create template: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(template)))
}

/// Get a single template
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/coverage",
    responses((status = 200, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn get_template(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let template: CoverageTemplate = sqlx::query_as(
        "SELECT * FROM workforce_coverage_templates WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get template: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(template))
}

/// Update a template
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/coverage",
    responses((status = 200, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn update_template(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTemplateRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    req.validate().map_err(|e| {
        tracing::warn!("Validation error: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    let now = Utc::now();

    // If this is marked as default, unset other defaults
    if req.is_default == Some(true) {
        sqlx::query(
            "UPDATE workforce_coverage_templates SET is_default = false WHERE tenant_id = $1 AND id != $2",
        )
        .bind(ctx.tenant_id)
        .bind(id)
        .execute(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to unset defaults: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    let weekly_pattern_json = req
        .weekly_pattern
        .as_ref()
        .map(serde_json::to_value)
        .transpose()
        .map_err(|e| {
            tracing::error!("Failed to serialize weekly pattern: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let template: CoverageTemplate = sqlx::query_as(
        r#"
        UPDATE workforce_coverage_templates
        SET
            name = COALESCE($3, name),
            description = COALESCE($4, description),
            weekly_pattern = COALESCE($5, weekly_pattern),
            is_default = COALESCE($6, is_default),
            updated_at = $7
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(weekly_pattern_json)
    .bind(req.is_default)
    .bind(now)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update template: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(template))
}

/// Delete a template
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/coverage",
    responses((status = 204, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_template(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    // Check if template is in use
    let in_use: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM workforce_coverage_rules WHERE template_id = $1)",
    )
    .bind(id)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to check template usage: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if in_use {
        tracing::warn!("Cannot delete template in use");
        return Err(StatusCode::CONFLICT);
    }

    let result =
        sqlx::query("DELETE FROM workforce_coverage_templates WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(ctx.tenant_id)
            .execute(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to delete template: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Duplicate a template
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/coverage",
    responses((status = 201, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn duplicate_template(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let original: CoverageTemplate = sqlx::query_as(
        "SELECT * FROM workforce_coverage_templates WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get template: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    let new_id = Uuid::new_v4();
    let now = Utc::now();
    let new_name = format!("{} (copie)", original.name);

    let template: CoverageTemplate = sqlx::query_as(
        r#"
        INSERT INTO workforce_coverage_templates (
            id, tenant_id, name, description, weekly_pattern, is_default, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, false, $6, $6)
        RETURNING *
        "#,
    )
    .bind(new_id)
    .bind(ctx.tenant_id)
    .bind(new_name)
    .bind(&original.description)
    .bind(&original.weekly_pattern)
    .bind(now)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to duplicate template: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(template)))
}

// ============================================================================
// Rule Handlers
// ============================================================================

/// List all coverage rules
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/coverage",
    responses((status = 200, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn list_rules(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<RuleQueryParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let include_inactive = params.include_inactive.unwrap_or(false);

    let rules: Vec<CoverageRule> = if include_inactive {
        sqlx::query_as(
            r#"
            SELECT * FROM workforce_coverage_rules
            WHERE tenant_id = $1
            ORDER BY valid_from DESC
            "#,
        )
        .bind(ctx.tenant_id)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list rules: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        sqlx::query_as(
            r#"
            SELECT * FROM workforce_coverage_rules
            WHERE tenant_id = $1 AND is_active = true
            ORDER BY valid_from DESC
            "#,
        )
        .bind(ctx.tenant_id)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list rules: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    };

    Ok(Json(rules))
}

/// Create a coverage rule
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/coverage",
    responses((status = 201, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn create_rule(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<CreateRuleRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    req.validate().map_err(|e| {
        tracing::warn!("Validation error: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    // Verify org node exists
    let node_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM workforce_org_nodes WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(req.org_node_id)
    .bind(ctx.tenant_id)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to check org node: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !node_exists {
        return Err(StatusCode::NOT_FOUND);
    }

    // Verify template exists if specified
    if let Some(template_id) = req.template_id {
        let template_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM workforce_coverage_templates WHERE id = $1 AND tenant_id = $2)",
        )
        .bind(template_id)
        .bind(ctx.tenant_id)
        .fetch_one(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check template: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if !template_exists {
            return Err(StatusCode::NOT_FOUND);
        }
    }

    let id = Uuid::new_v4();
    let now = Utc::now();

    let custom_slots_json = req
        .custom_slots
        .as_ref()
        .map(serde_json::to_value)
        .transpose()
        .map_err(|e| {
            tracing::error!("Failed to serialize custom slots: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let rule: CoverageRule = sqlx::query_as(
        r#"
        INSERT INTO workforce_coverage_rules (
            id, tenant_id, org_node_id, template_id, name,
            valid_from, valid_to, custom_slots, inherit_from_parent,
            is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $10)
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(req.org_node_id)
    .bind(req.template_id)
    .bind(&req.name)
    .bind(req.valid_from)
    .bind(req.valid_to)
    .bind(custom_slots_json)
    .bind(req.inherit_from_parent.unwrap_or(false))
    .bind(now)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create rule: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(rule)))
}

/// Get a single rule
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/coverage",
    responses((status = 200, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn get_rule(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let rule: CoverageRule =
        sqlx::query_as("SELECT * FROM workforce_coverage_rules WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(ctx.tenant_id)
            .fetch_optional(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get rule: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(rule))
}

/// Update a rule
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/coverage",
    responses((status = 200, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn update_rule(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateRuleRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    req.validate().map_err(|e| {
        tracing::warn!("Validation error: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    let now = Utc::now();

    let custom_slots_json = req
        .custom_slots
        .as_ref()
        .map(serde_json::to_value)
        .transpose()
        .map_err(|e| {
            tracing::error!("Failed to serialize custom slots: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let rule: CoverageRule = sqlx::query_as(
        r#"
        UPDATE workforce_coverage_rules
        SET
            template_id = COALESCE($3, template_id),
            name = COALESCE($4, name),
            valid_from = COALESCE($5, valid_from),
            valid_to = COALESCE($6, valid_to),
            custom_slots = COALESCE($7, custom_slots),
            inherit_from_parent = COALESCE($8, inherit_from_parent),
            is_active = COALESCE($9, is_active),
            updated_at = $10
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(req.template_id)
    .bind(&req.name)
    .bind(req.valid_from)
    .bind(req.valid_to)
    .bind(custom_slots_json)
    .bind(req.inherit_from_parent)
    .bind(req.is_active)
    .bind(now)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update rule: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(rule))
}

/// Delete a rule
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/coverage",
    responses((status = 204, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_rule(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let result =
        sqlx::query("DELETE FROM workforce_coverage_rules WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(ctx.tenant_id)
            .execute(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to delete rule: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Get rules by org node
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/coverage",
    responses((status = 200, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn get_rules_by_node(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
    Query(params): Query<RuleQueryParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let effective_date = params
        .effective_date
        .unwrap_or_else(|| Utc::now().date_naive());

    let rules: Vec<CoverageRule> = sqlx::query_as(
        r#"
        SELECT * FROM workforce_coverage_rules
        WHERE tenant_id = $1
        AND org_node_id = $2
        AND is_active = true
        AND valid_from <= $3
        AND (valid_to IS NULL OR valid_to >= $3)
        ORDER BY valid_from DESC
        "#,
    )
    .bind(ctx.tenant_id)
    .bind(node_id)
    .bind(effective_date)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get rules by node: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(rules))
}

/// Get effective coverage for a node (with inheritance)
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/coverage",
    responses((status = 200, description = "Success")),
    tag = "Workforce"
)]
#[tracing::instrument(skip_all)]
pub async fn get_effective_coverage(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(node_id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let today = Utc::now().date_naive();

    // Get org node name
    let node_name: String =
        sqlx::query_scalar("SELECT name FROM workforce_org_nodes WHERE id = $1 AND tenant_id = $2")
            .bind(node_id)
            .bind(ctx.tenant_id)
            .fetch_optional(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get org node: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .ok_or(StatusCode::NOT_FOUND)?;

    // Try to find rule for this node or ancestors
    let rule_with_ancestor: Option<CoverageRuleWithAncestor> = sqlx::query_as(
        r#"
        SELECT
            r.id, r.tenant_id, r.org_node_id, r.template_id, r.name,
            r.valid_from, r.valid_to, r.custom_slots, r.inherit_from_parent,
            r.is_active, r.created_at, r.updated_at,
            c.ancestor_id as inherited_from
        FROM workforce_coverage_rules r
        INNER JOIN workforce_org_closure c ON c.ancestor_id = r.org_node_id
        WHERE c.descendant_id = $1
        AND r.tenant_id = $2
        AND r.is_active = true
        AND r.valid_from <= $3
        AND (r.valid_to IS NULL OR r.valid_to >= $3)
        ORDER BY c.depth ASC, r.valid_from DESC
        LIMIT 1
        "#,
    )
    .bind(node_id)
    .bind(ctx.tenant_id)
    .bind(today)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to find effective rule: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let (rule, inherited_from) = match rule_with_ancestor {
        Some(rwa) => {
            let from = rwa.inherited_from;
            (
                Some(rwa.into_rule()),
                if from != node_id { Some(from) } else { None },
            )
        },
        None => (None, None),
    };

    // Get template if rule uses one
    let template: Option<CoverageTemplate> = if let Some(ref r) = rule {
        if let Some(template_id) = r.template_id {
            sqlx::query_as("SELECT * FROM workforce_coverage_templates WHERE id = $1")
                .bind(template_id)
                .fetch_optional(&*state.pool)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to get template: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?
        } else {
            None
        }
    } else {
        None
    };

    // Compute effective slots
    let effective_slots: Vec<CoverageSlot> = if let Some(ref r) = rule {
        if let Some(ref custom) = r.custom_slots {
            serde_json::from_value(custom.clone()).unwrap_or_default()
        } else if let Some(ref t) = template {
            let pattern: WeeklyPattern = serde_json::from_value(t.weekly_pattern.clone())
                .unwrap_or(WeeklyPattern {
                    monday: vec![],
                    tuesday: vec![],
                    wednesday: vec![],
                    thursday: vec![],
                    friday: vec![],
                    saturday: vec![],
                    sunday: vec![],
                });
            flatten_weekly_pattern(&pattern)
        } else {
            vec![]
        }
    } else {
        vec![]
    };

    Ok(Json(EffectiveCoverage {
        org_node_id: node_id,
        org_node_name: node_name,
        rule,
        template,
        effective_slots,
        inherited_from,
    }))
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Flatten weekly pattern into a list of slots with day indices
pub fn flatten_weekly_pattern(pattern: &WeeklyPattern) -> Vec<CoverageSlot> {
    let mut slots = Vec::new();

    for (day_index, day_slots) in [
        (0, &pattern.sunday),
        (1, &pattern.monday),
        (2, &pattern.tuesday),
        (3, &pattern.wednesday),
        (4, &pattern.thursday),
        (5, &pattern.friday),
        (6, &pattern.saturday),
    ] {
        for slot in day_slots {
            let mut s = slot.clone();
            s.day_of_week = day_index;
            slots.push(s);
        }
    }

    slots
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
