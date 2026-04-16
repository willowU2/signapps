//! Organization node type CRUD handlers.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde_json::json;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

use super::types::{CreateNodeTypeRequest, OrgNodeType};

/// List all node types for tenant
#[utoipa::path(
    get,
    path = "/api/v1/workforce/org/node-types",
    responses(
        (status = 200, description = "List of organization node types"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org"
)]
#[tracing::instrument(skip_all)]
pub async fn list_node_types(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
) -> Result<impl IntoResponse, StatusCode> {
    let types: Vec<OrgNodeType> = sqlx::query_as(
        r#"
        SELECT * FROM workforce_org_node_types
        WHERE tenant_id = $1
        ORDER BY sort_order, name
        "#,
    )
    .bind(ctx.tenant_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list node types: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!(types)))
}

/// Create a new node type
#[utoipa::path(
    post,
    path = "/api/v1/workforce/org/node-types",
    request_body = CreateNodeTypeRequest,
    responses(
        (status = 201, description = "Node type created", body = OrgNodeType),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org"
)]
#[tracing::instrument(skip_all)]
pub async fn create_node_type(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<CreateNodeTypeRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    if let Err(e) = req.validate() {
        tracing::warn!("Validation error: {}", e);
        return Err(StatusCode::BAD_REQUEST);
    }

    let id = Uuid::new_v4();
    let now = Utc::now();

    let node_type: OrgNodeType = sqlx::query_as(
        r#"
        INSERT INTO workforce_org_node_types (
            id, tenant_id, code, name, icon, color,
            allowed_children, config_schema, sort_order, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(&req.code)
    .bind(&req.name)
    .bind(&req.icon)
    .bind(&req.color)
    .bind(serde_json::json!(&req.allowed_children.unwrap_or_default()))
    .bind(&req.config_schema)
    .bind(req.sort_order.unwrap_or(0))
    .bind(now)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create node type: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(json!(node_type))))
}

/// Delete a node type
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/org/node-types/{id}",
    params(("id" = uuid::Uuid, Path, description = "Node type ID")),
    responses(
        (status = 204, description = "Node type deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Node type not found"),
        (status = 409, description = "Node type is in use"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_node_type(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    // Check if type is in use
    let in_use: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM workforce_org_nodes n
            INNER JOIN workforce_org_node_types t ON t.code = n.node_type
            WHERE t.id = $1 AND n.tenant_id = $2
        )
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to check usage: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if in_use {
        return Err(StatusCode::CONFLICT);
    }

    let result =
        sqlx::query("DELETE FROM workforce_org_node_types WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(ctx.tenant_id)
            .execute(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to delete node type: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
