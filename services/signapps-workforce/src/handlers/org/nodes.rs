//! Organizational node CRUD and move handlers.

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

use super::types::{CreateNodeRequest, MoveNodeRequest, OrgNode, UpdateNodeRequest};

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

        // Enforce allowed_children: query the parent's node type config
        let allowed: Option<(serde_json::Value,)> = sqlx::query_as(
            "SELECT allowed_children FROM workforce_org_node_types WHERE code = $1 AND tenant_id = $2",
        )
        .bind(&parent_node_type)
        .bind(ctx.tenant_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to query node type: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if let Some((allowed_json,)) = allowed {
            if let Some(arr) = allowed_json.as_array() {
                let allowed_types: Vec<&str> = arr.iter().filter_map(|v| v.as_str()).collect();
                if !allowed_types.is_empty() && !allowed_types.contains(&req.node_type.as_str()) {
                    tracing::warn!(
                        parent_type = %parent_node_type,
                        child_type = %req.node_type,
                        allowed = ?allowed_types,
                        "Child type not in allowed_children"
                    );
                    return Err(StatusCode::BAD_REQUEST);
                }
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
    let subtree_ids: Vec<(Uuid,)> =
        sqlx::query_as("SELECT descendant_id FROM workforce_org_closure WHERE ancestor_id = $1")
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
