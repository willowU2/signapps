use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Extension, Json,
};
use signapps_common::auth::Claims;
use signapps_common::Result;
use signapps_db::models::drive::{CreateDriveNodeRequest, DriveNode, UpdateDriveNodeRequest};
use uuid::Uuid;

use crate::AppState;

/// Helper function to extract workspace_id from headers
fn get_workspace_id_from_headers(headers: &HeaderMap) -> Option<Uuid> {
    headers
        .get("x-workspace-id")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
}

/// List the contents of a specific folder (or the root if parent_id is missing/null)
#[tracing::instrument(skip_all)]
pub async fn list_nodes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    headers: HeaderMap,
    parent_id_opt: Option<Path<Uuid>>,
) -> Result<Json<Vec<DriveNode>>> {
    let user_id = claims.sub;
    let parent_id = parent_id_opt.map(|Path(id)| id);
    let workspace_id = get_workspace_id_from_headers(&headers);

    let nodes = if let Some(pid) = parent_id {
        // Query children of specific folder where user is owner or has permissions
        sqlx::query_as::<_, DriveNode>(
            r#"
            SELECT n.id, n.parent_id, n.name, n.node_type,
                   n.target_id, n.workspace_id, n.owner_id, n.size, n.mime_type,
                   n.created_at, n.updated_at, n.deleted_at
            FROM drive.nodes n
            LEFT JOIN drive.permissions p ON p.node_id = n.id AND p.user_id = $1
            WHERE n.parent_id = $2 AND n.deleted_at IS NULL
            AND (n.workspace_id = $3 OR (n.workspace_id IS NULL AND $3 IS NULL))
            AND (n.owner_id = $1 OR p.id IS NOT NULL)
            ORDER BY n.node_type, n.name ASC
            "#,
        )
        .bind(user_id)
        .bind(pid)
        .bind(workspace_id)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e: sqlx::Error| signapps_common::Error::Database(e.to_string()))?
    } else {
        // Query root nodes
        sqlx::query_as::<_, DriveNode>(
            r#"
            SELECT n.id, n.parent_id, n.name, n.node_type,
                   n.target_id, n.workspace_id, n.owner_id, n.size, n.mime_type,
                   n.created_at, n.updated_at, n.deleted_at
            FROM drive.nodes n
            LEFT JOIN drive.permissions p ON p.node_id = n.id AND p.user_id = $1
            WHERE n.parent_id IS NULL AND n.deleted_at IS NULL
            AND (n.workspace_id = $2 OR (n.workspace_id IS NULL AND $2 IS NULL))
            AND (n.owner_id = $1 OR p.id IS NOT NULL)
            ORDER BY n.node_type, n.name ASC
            "#,
        )
        .bind(user_id)
        .bind(workspace_id)
        .fetch_all(&*state.pool)
        .await
        .map_err(|e: sqlx::Error| signapps_common::Error::Database(e.to_string()))?
    };

    Ok(Json(nodes))
}

/// Create a new folder or link an existing file/document
#[tracing::instrument(skip_all)]
pub async fn create_node(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    headers: HeaderMap,
    Json(payload): Json<CreateDriveNodeRequest>,
) -> Result<Json<DriveNode>> {
    let user_id = claims.sub;
    let fallback_workspace_id = get_workspace_id_from_headers(&headers);
    let resolved_workspace_id = payload.workspace_id.or(fallback_workspace_id);

    // Validate node_type
    match payload.node_type.as_str() {
        "folder" | "file" | "document" | "spreadsheet" | "presentation" => (),
        _ => {
            return Err(signapps_common::Error::Validation(
                "Invalid node_type".into(),
            ))
        },
    };

    let node = sqlx::query_as::<_, DriveNode>(
        r#"
        INSERT INTO drive.nodes (parent_id, name, node_type, target_id, workspace_id, owner_id, size, mime_type)
        VALUES ($1, $2, $3::drive.node_type, $4, $5, $6, $7, $8)
        RETURNING id, parent_id, name, node_type, target_id, workspace_id, owner_id, size, mime_type, created_at, updated_at, deleted_at
        "#
    )
    .bind(payload.parent_id)
    .bind(&payload.name)
    .bind(&payload.node_type)
    .bind(payload.target_id)
    .bind(resolved_workspace_id)
    .bind(user_id)
    .bind(payload.size)
    .bind(&payload.mime_type)
    .fetch_one(&*state.pool)
    .await
    .map_err(|e: sqlx::Error| signapps_common::Error::Database(e.to_string()))?;

    Ok(Json(node))
}

/// Rename or move a node
#[tracing::instrument(skip_all)]
pub async fn update_node(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateDriveNodeRequest>,
) -> Result<Json<DriveNode>> {
    let user_id = claims.sub;

    let mut query = sqlx::QueryBuilder::new("UPDATE drive.nodes SET ");
    let mut needs_comma = false;

    if let Some(name) = payload.name {
        query.push("name = ");
        query.push_bind(name);
        needs_comma = true;
    }

    if let Some(parent_id) = payload.parent_id {
        if needs_comma {
            query.push(", ");
        }
        query.push("parent_id = ");
        query.push_bind(parent_id);
    }

    query.push(" WHERE id = ");
    query.push_bind(id);
    query.push(" AND owner_id = ");
    query.push_bind(user_id); // Basic ownership check
    query.push(" RETURNING id, parent_id, name, node_type, target_id, workspace_id, owner_id, size, mime_type, created_at, updated_at, deleted_at");

    let node = query
        .build_query_as::<DriveNode>()
        .fetch_one(&*state.pool)
        .await
        .map_err(|e: sqlx::Error| signapps_common::Error::Database(e.to_string()))?;

    Ok(Json(node))
}

/// Soft delete a node
#[tracing::instrument(skip_all)]
pub async fn delete_node(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<()>> {
    let user_id = claims.sub;

    sqlx::query("UPDATE drive.nodes SET deleted_at = NOW() WHERE id = $1 AND owner_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(&*state.pool)
        .await
        .map_err(|e: sqlx::Error| signapps_common::Error::Database(e.to_string()))?;

    Ok(Json(()))
}
