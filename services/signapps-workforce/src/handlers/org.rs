//! Organizational Tree Handlers
//!
//! CRUD operations for the organizational hierarchy using closure table pattern.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

// ============================================================================
// Types
// ============================================================================

/// Organization node in the hierarchy
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, utoipa::ToSchema)]
/// OrgNode data transfer object.
pub struct OrgNode {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub node_type: String,
    pub name: String,
    pub code: Option<String>,
    pub description: Option<String>,
    pub config: serde_json::Value,
    pub sort_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Entry lifecycle state: live, recycled, or tombstone.
    pub lifecycle_state: Option<String>,
    /// Extensible attributes (JSONB).
    pub attributes: Option<serde_json::Value>,
}

/// Node type definition (customizable per tenant)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, utoipa::ToSchema)]
/// OrgNodeType data transfer object.
pub struct OrgNodeType {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub allowed_children: serde_json::Value,
    pub config_schema: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
    pub created_at: DateTime<Utc>,
    /// Tree type (internal/clients/suppliers).
    pub tree_type: Option<String>,
    /// Display label.
    pub label: Option<String>,
    /// Whether this node type is active.
    pub is_active: Option<bool>,
    /// Last update timestamp.
    pub updated_at: Option<DateTime<Utc>>,
    /// Schema definition for attributes.
    pub schema: Option<serde_json::Value>,
}

/// Tree node with children (recursive structure)
#[derive(Debug, Clone, Serialize, Deserialize)]
/// OrgTreeNode data transfer object.
pub struct OrgTreeNode {
    #[serde(flatten)]
    pub node: OrgNode,
    pub children: Vec<OrgTreeNode>,
    pub depth: i32,
    pub employee_count: i64,
}

/// Create node request
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for CreateNode.
pub struct CreateNodeRequest {
    pub parent_id: Option<Uuid>,
    #[validate(length(min = 1, max = 50))]
    pub node_type: String,
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub code: Option<String>,
    pub description: Option<String>,
    pub config: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

/// Update node request
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for UpdateNode.
pub struct UpdateNodeRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    pub code: Option<String>,
    pub description: Option<String>,
    pub config: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
    pub is_active: Option<bool>,
}

/// Move node request
#[derive(Debug, Deserialize, utoipa::ToSchema)]
/// Request body for MoveNode.
pub struct MoveNodeRequest {
    pub new_parent_id: Option<Uuid>,
}

/// Create node type request
#[derive(Debug, Deserialize, Validate, utoipa::ToSchema)]
/// Request body for CreateNodeType.
pub struct CreateNodeTypeRequest {
    #[validate(length(min = 1, max = 50))]
    pub code: String,
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub allowed_children: Option<Vec<String>>,
    pub config_schema: Option<serde_json::Value>,
    pub sort_order: Option<i32>,
}

/// Query params for tree retrieval
#[derive(Debug, Deserialize, Default)]
/// Query parameters for filtering results.
pub struct TreeQueryParams {
    pub include_inactive: Option<bool>,
    pub root_id: Option<Uuid>,
    pub max_depth: Option<i32>,
}

// ============================================================================
// Handlers
// ============================================================================

/// Get the full organizational tree
#[utoipa::path(
    get,
    path = "/api/v1/workforce/org/tree",
    responses(
        (status = 200, description = "Full organizational tree"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_tree(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Query(params): Query<TreeQueryParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let include_inactive = params.include_inactive.unwrap_or(false);
    let max_depth = params.max_depth.unwrap_or(10);

    // Get all nodes for tenant
    let nodes: Vec<OrgNode> = if include_inactive {
        sqlx::query_as(
            r#"
            SELECT * FROM workforce_org_nodes
            WHERE tenant_id = $1
            ORDER BY sort_order, name
            "#,
        )
        .bind(ctx.tenant_id)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get tree: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    } else {
        sqlx::query_as(
            r#"
            SELECT * FROM workforce_org_nodes
            WHERE tenant_id = $1 AND is_active = true
            ORDER BY sort_order, name
            "#,
        )
        .bind(ctx.tenant_id)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get tree: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    };

    // Get employee counts per node
    let employee_counts: Vec<(Uuid, i64)> = sqlx::query_as(
        r#"
        SELECT org_node_id, COUNT(*) as count
        FROM workforce_employees
        WHERE tenant_id = $1 AND status = 'active'
        GROUP BY org_node_id
        "#,
    )
    .bind(ctx.tenant_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get employee counts: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let count_map: std::collections::HashMap<Uuid, i64> = employee_counts.into_iter().collect();

    // Build tree structure
    let tree = build_tree(nodes, &count_map, params.root_id, 0, max_depth);

    Ok(Json(json!(tree)))
}

/// Create a new organization node
#[utoipa::path(
    post,
    path = "/api/v1/workforce/org/nodes",
    request_body = CreateNodeRequest,
    responses(
        (status = 201, description = "Organization node created", body = OrgNode),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Parent node not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn create_node(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Json(req): Json<CreateNodeRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    if let Err(e) = req.validate() {
        tracing::warn!("Validation error: {}", e);
        return Err(StatusCode::BAD_REQUEST);
    }

    let id = Uuid::new_v4();
    let now = Utc::now();

    // Begin transaction
    let mut tx = state.pool.begin().await.map_err(|e| {
        tracing::error!("Failed to begin transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Verify parent exists if specified, and enforce allowed_children
    if let Some(parent_id) = req.parent_id {
        let parent_node: Option<(String,)> = sqlx::query_as(
            "SELECT node_type FROM workforce_org_nodes WHERE id = $1 AND tenant_id = $2",
        )
        .bind(parent_id)
        .bind(ctx.tenant_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check parent: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        let parent_node_type = match parent_node {
            Some((nt,)) => nt,
            None => return Err(StatusCode::NOT_FOUND),
        };

        // Check allowed_children constraint from node type definition
        let allowed: Option<(Vec<String>,)> = sqlx::query_as(
            r#"
            SELECT allowed_children_arr
            FROM workforce_org_node_types
            WHERE (tenant_id = $1 OR tenant_id = '00000000-0000-0000-0000-000000000000')
              AND name = $2
            ORDER BY CASE WHEN tenant_id = $1 THEN 0 ELSE 1 END
            LIMIT 1
            "#,
        )
        .bind(ctx.tenant_id)
        .bind(&parent_node_type)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check allowed_children: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if let Some((allowed_children,)) = allowed {
            if !allowed_children.is_empty() && !allowed_children.contains(&req.node_type) {
                tracing::warn!(
                    parent_type = %parent_node_type,
                    child_type = %req.node_type,
                    "Child type not allowed under parent type"
                );
                return Ok((
                    StatusCode::BAD_REQUEST,
                    Json(json!({
                        "error": format!(
                            "Node type '{}' is not allowed under parent type '{}'. Allowed: {:?}",
                            req.node_type, parent_node_type, allowed_children
                        )
                    })),
                ));
            }
        }
    }

    // Insert the node
    let node: OrgNode = sqlx::query_as(
        r#"
        INSERT INTO workforce_org_nodes (
            id, tenant_id, parent_id, node_type, name, code, description,
            config, sort_order, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $10)
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(req.parent_id)
    .bind(&req.node_type)
    .bind(&req.name)
    .bind(&req.code)
    .bind(&req.description)
    .bind(req.config.unwrap_or(serde_json::json!({})))
    .bind(req.sort_order.unwrap_or(0))
    .bind(now)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to insert node: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(json!(node))))
}

/// Get a single organization node
#[utoipa::path(
    get,
    path = "/api/v1/workforce/org/nodes/{id}",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 200, description = "Organization node found", body = OrgNode),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Node not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_node(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    tracing::info!(%id, tenant_id = %ctx.tenant_id, "get_node called");
    let node: Option<OrgNode> =
        sqlx::query_as("SELECT id, tenant_id, parent_id, node_type, name, code, description, config, sort_order, is_active, created_at, updated_at, lifecycle_state, attributes FROM workforce_org_nodes WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(ctx.tenant_id)
            .fetch_optional(&*state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get node: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    match node {
        Some(n) => Ok(Json(json!(n))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Update an organization node
#[utoipa::path(
    put,
    path = "/api/v1/workforce/org/nodes/{id}",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    request_body = UpdateNodeRequest,
    responses(
        (status = 200, description = "Organization node updated", body = OrgNode),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Node not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn update_node(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateNodeRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    if let Err(e) = req.validate() {
        tracing::warn!("Validation error: {}", e);
        return Err(StatusCode::BAD_REQUEST);
    }

    let now = Utc::now();

    let node: Option<OrgNode> = sqlx::query_as(
        r#"
        UPDATE workforce_org_nodes
        SET
            name = COALESCE($3, name),
            code = COALESCE($4, code),
            description = COALESCE($5, description),
            config = COALESCE($6, config),
            sort_order = COALESCE($7, sort_order),
            is_active = COALESCE($8, is_active),
            updated_at = $9
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(&req.name)
    .bind(&req.code)
    .bind(&req.description)
    .bind(&req.config)
    .bind(req.sort_order)
    .bind(req.is_active)
    .bind(now)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update node: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match node {
        Some(n) => Ok(Json(json!(n))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Delete an organization node
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/org/nodes/{id}",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 204, description = "Organization node deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Node not found"),
        (status = 409, description = "Node has children or employees"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn delete_node(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut tx = state.pool.begin().await.map_err(|e| {
        tracing::error!("Failed to begin transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Check if node has children
    let has_children: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM workforce_org_nodes
            WHERE parent_id = $1 AND tenant_id = $2
        )
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to check children: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if has_children {
        return Err(StatusCode::CONFLICT);
    }

    // Check if node has employees
    let has_employees: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM workforce_employees
            WHERE org_node_id = $1 AND tenant_id = $2 AND status = 'active'
        )
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to check employees: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if has_employees {
        return Err(StatusCode::CONFLICT);
    }

    // Delete closure table entries
    sqlx::query("DELETE FROM workforce_org_closure WHERE descendant_id = $1 OR ancestor_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete closure entries: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Delete the node
    let result = sqlx::query("DELETE FROM workforce_org_nodes WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(ctx.tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete node: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::NO_CONTENT)
}

/// Recursively delete a node and all its descendants
///
/// Deletes the target node plus every node beneath it in the hierarchy.
/// Closure-table entries are cleaned up in the same transaction.
///
/// # Errors
///
/// Returns `404` if the node does not exist, `500` on database errors.
///
/// # Panics
///
/// No panics — all errors are propagated via `Result`.
#[utoipa::path(
    delete,
    path = "/api/v1/workforce/org/nodes/{id}/recursive",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 204, description = "Node and all descendants deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Node not found"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_node_recursive(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut tx = state.pool.begin().await.map_err(|e| {
        tracing::error!("Failed to begin transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Verify the target node exists
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM workforce_org_nodes WHERE id = $1 AND tenant_id = $2)",
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to check node existence: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !exists {
        return Err(StatusCode::NOT_FOUND);
    }

    // Collect all descendant IDs via recursive CTE on parent_id
    let descendant_rows: Vec<(Uuid,)> = sqlx::query_as(
        r#"
        WITH RECURSIVE descendants AS (
            SELECT id FROM workforce_org_nodes WHERE id = $1 AND tenant_id = $2
            UNION ALL
            SELECT n.id FROM workforce_org_nodes n
            INNER JOIN descendants d ON n.parent_id = d.id
            WHERE n.tenant_id = $2
        )
        SELECT id FROM descendants
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to collect descendants: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let all_ids: Vec<Uuid> = descendant_rows.into_iter().map(|(did,)| did).collect();

    if all_ids.is_empty() {
        return Err(StatusCode::NOT_FOUND);
    }

    // Delete closure table entries for all collected nodes
    sqlx::query(
        "DELETE FROM workforce_org_closure WHERE descendant_id = ANY($1) OR ancestor_id = ANY($1)",
    )
    .bind(&all_ids)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to delete closure entries: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Unlink employees from nodes about to be deleted (set org_node_id to null)
    sqlx::query(
        "UPDATE workforce_employees SET org_node_id = NULL WHERE org_node_id = ANY($1) AND tenant_id = $2",
    )
    .bind(&all_ids)
    .bind(ctx.tenant_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to unlink employees: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Delete all collected nodes
    sqlx::query("DELETE FROM workforce_org_nodes WHERE id = ANY($1) AND tenant_id = $2")
        .bind(&all_ids)
        .bind(ctx.tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete nodes: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(node_id = %id, count = all_ids.len(), "Recursively deleted node and descendants");

    Ok(StatusCode::NO_CONTENT)
}

/// Move a node to a new parent
#[utoipa::path(
    post,
    path = "/api/v1/workforce/org/nodes/{id}/move",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    request_body = MoveNodeRequest,
    responses(
        (status = 200, description = "Node moved"),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Node not found"),
        (status = 409, description = "Circular reference detected"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn move_node(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<MoveNodeRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let mut tx = state.pool.begin().await.map_err(|e| {
        tracing::error!("Failed to begin transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Verify node exists
    let node: Option<OrgNode> =
        sqlx::query_as("SELECT * FROM workforce_org_nodes WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(ctx.tenant_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("Failed to get node: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    if node.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    // Verify new parent exists and is not a descendant
    if let Some(new_parent_id) = req.new_parent_id {
        let is_descendant: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM workforce_org_closure
                WHERE ancestor_id = $1 AND descendant_id = $2
            )
            "#,
        )
        .bind(id)
        .bind(new_parent_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check descendant: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if is_descendant {
            return Err(StatusCode::CONFLICT);
        }
    }

    // 1. Collect all descendants of the node being moved (via closure table)
    let subtree_ids: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT descendant_id FROM workforce_org_closure WHERE ancestor_id = $1",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get subtree: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let subtree: Vec<Uuid> = std::iter::once(id)
        .chain(subtree_ids.into_iter().map(|(d,)| d))
        .collect();

    // 2. Remove old closure entries: all links from ancestors-of-node to subtree nodes
    //    (but keep internal subtree links intact)
    sqlx::query(
        r#"
        DELETE FROM workforce_org_closure
        WHERE descendant_id = ANY($1)
          AND ancestor_id != ALL($1)
        "#,
    )
    .bind(&subtree)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to clean closure entries: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 3. Update parent_id
    let updated_node: OrgNode = sqlx::query_as(
        r#"
        UPDATE workforce_org_nodes
        SET parent_id = $3, updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .bind(req.new_parent_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update node: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 4. Rebuild closure entries: connect new ancestors to all subtree nodes
    if let Some(new_parent_id) = req.new_parent_id {
        // Get all ancestors of the new parent (including itself)
        let new_ancestors: Vec<(Uuid, i32)> = sqlx::query_as(
            r#"
            SELECT ancestor_id, depth FROM workforce_org_closure WHERE descendant_id = $1
            UNION ALL
            SELECT $1::uuid, 0
            "#,
        )
        .bind(new_parent_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get new ancestors: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        // Get internal subtree closure (relative depths)
        let subtree_closure: Vec<(Uuid, Uuid, i32)> = sqlx::query_as(
            r#"
            SELECT ancestor_id, descendant_id, depth FROM workforce_org_closure
            WHERE ancestor_id = ANY($1) AND descendant_id = ANY($1)
            "#,
        )
        .bind(&subtree)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get subtree closure: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        // Insert cross-product: each new ancestor × each subtree node
        // For the moved node itself: depth = ancestor_depth + 1
        // For subtree nodes: depth = ancestor_depth + 1 + internal_depth
        for (anc_id, anc_depth) in &new_ancestors {
            // Direct link: ancestor → moved node
            let _ = sqlx::query(
                "INSERT INTO workforce_org_closure (ancestor_id, descendant_id, depth) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            )
            .bind(anc_id)
            .bind(id)
            .bind(anc_depth + 1)
            .execute(&mut *tx)
            .await;

            // Links: ancestor → each subtree descendant
            for (_, desc_id, int_depth) in &subtree_closure {
                if *desc_id != id {
                    let _ = sqlx::query(
                        "INSERT INTO workforce_org_closure (ancestor_id, descendant_id, depth) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
                    )
                    .bind(anc_id)
                    .bind(desc_id)
                    .bind(anc_depth + 1 + int_depth)
                    .execute(&mut *tx)
                    .await;
                }
            }
        }
    }

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit transaction: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(%id, new_parent = ?req.new_parent_id, "Node moved successfully");
    Ok(Json(json!(updated_node)))
}

/// Get direct children of a node
#[utoipa::path(
    get,
    path = "/api/v1/workforce/org/nodes/{id}/children",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 200, description = "Direct children of the node"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_children(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let children: Vec<OrgNode> = sqlx::query_as(
        r#"
        SELECT * FROM workforce_org_nodes
        WHERE parent_id = $1 AND tenant_id = $2 AND is_active = true
        ORDER BY sort_order, name
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get children: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!(children)))
}

/// Get all descendants of a node (using closure table)
#[utoipa::path(
    get,
    path = "/api/v1/workforce/org/nodes/{id}/descendants",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 200, description = "All descendants of the node"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_descendants(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let descendants: Vec<OrgNode> = sqlx::query_as(
        r#"
        SELECT n.* FROM workforce_org_nodes n
        INNER JOIN workforce_org_closure c ON c.descendant_id = n.id
        WHERE c.ancestor_id = $1 AND c.depth > 0 AND n.tenant_id = $2 AND n.is_active = true
        ORDER BY c.depth, n.sort_order, n.name
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get descendants: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!(descendants)))
}

/// Get all ancestors of a node (path to root)
#[utoipa::path(
    get,
    path = "/api/v1/workforce/org/nodes/{id}/ancestors",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 200, description = "Ancestor path to root"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error"),
    ),
    security(("bearer" = [])),
    tag = "Workforce Org"
)]
#[tracing::instrument(skip_all)]
#[tracing::instrument(skip_all)]
pub async fn get_ancestors(
    State(state): State<AppState>,
    Extension(ctx): Extension<TenantContext>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, StatusCode> {
    let ancestors: Vec<OrgNode> = sqlx::query_as(
        r#"
        SELECT n.* FROM workforce_org_nodes n
        INNER JOIN workforce_org_closure c ON c.ancestor_id = n.id
        WHERE c.descendant_id = $1 AND c.depth > 0 AND n.tenant_id = $2
        ORDER BY c.depth DESC
        "#,
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .fetch_all(&*state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get ancestors: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!(ancestors)))
}

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

// ============================================================================
// Helper Functions
// ============================================================================

/// Build tree structure from flat list
fn build_tree(
    nodes: Vec<OrgNode>,
    employee_counts: &std::collections::HashMap<Uuid, i64>,
    parent_id: Option<Uuid>,
    current_depth: i32,
    max_depth: i32,
) -> Vec<OrgTreeNode> {
    if current_depth >= max_depth {
        return vec![];
    }

    nodes
        .iter()
        .filter(|n| n.parent_id == parent_id)
        .map(|node| {
            let children = build_tree(
                nodes.clone(),
                employee_counts,
                Some(node.id),
                current_depth + 1,
                max_depth,
            );

            OrgTreeNode {
                node: node.clone(),
                children,
                depth: current_depth,
                employee_count: *employee_counts.get(&node.id).unwrap_or(&0),
            }
        })
        .collect()
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
