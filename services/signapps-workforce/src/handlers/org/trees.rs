//! Organizational tree retrieval handlers.

use axum::{
    extract::{Extension, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

use super::types::{OrgNode, OrgTreeNode, TreeQueryParams};

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

/// Build tree structure from flat list
pub fn build_tree(
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
