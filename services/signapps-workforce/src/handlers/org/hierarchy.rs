//! Hierarchy traversal handlers (descendants and ancestors).

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};

use super::types::OrgNode;

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
