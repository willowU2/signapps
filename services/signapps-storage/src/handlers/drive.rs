use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::Response,
    Extension, Json,
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use signapps_common::auth::Claims;
use signapps_common::{Error, Result};
use signapps_db::models::drive::{CreateDriveNodeRequest, DriveNode, UpdateDriveNodeRequest};
use signapps_db::repositories::StorageTier3Repository;
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
            SELECT n.id, n.parent_id, n.name, n.node_type::text,
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
            SELECT n.id, n.parent_id, n.name, n.node_type::text,
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
#[utoipa::path(
    post,
    path = "/api/v1/drive/nodes",
    responses(
        (status = 200, description = "Created drive node"),
        (status = 400, description = "Invalid node_type"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "drive"
)]
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
        VALUES ($1, $2, $3::text::drive.node_type, $4, $5, $6, $7, $8)
        RETURNING id, parent_id, name, node_type::text, target_id, workspace_id, owner_id, size, mime_type, created_at, updated_at, deleted_at
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
#[utoipa::path(
    put,
    path = "/api/v1/drive/nodes/{id}",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 200, description = "Updated drive node"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Node not found"),
    ),
    security(("bearerAuth" = [])),
    tag = "drive"
)]
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
    query.push(" RETURNING id, parent_id, name, node_type::text, target_id, workspace_id, owner_id, size, mime_type, created_at, updated_at, deleted_at");

    let node = query
        .build_query_as::<DriveNode>()
        .fetch_one(&*state.pool)
        .await
        .map_err(|e: sqlx::Error| signapps_common::Error::Database(e.to_string()))?;

    Ok(Json(node))
}

/// Soft delete a node
#[utoipa::path(
    delete,
    path = "/api/v1/drive/nodes/{id}",
    params(("id" = uuid::Uuid, Path, description = "Node ID")),
    responses(
        (status = 200, description = "Node soft-deleted"),
        (status = 401, description = "Unauthorized"),
    ),
    security(("bearerAuth" = [])),
    tag = "drive"
)]
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

/// Download a file by its Drive node ID.
///
/// Resolves the storage bucket and key from the drive node's `target_id`,
/// then streams the file content back to the caller.
///
/// # Errors
///
/// - [`Error::NotFound`] if the node or its backing storage file do not exist.
/// - [`Error::Forbidden`] if the caller does not own the node.
#[utoipa::path(
    get,
    path = "/api/v1/drive/nodes/{id}/download",
    params(("id" = uuid::Uuid, Path, description = "Drive node ID")),
    responses(
        (status = 200, description = "File content (binary download)"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Node or storage file not found"),
    ),
    security(("bearerAuth" = [])),
    tag = "drive"
)]
#[tracing::instrument(skip_all)]
pub async fn download_node(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Response> {
    use sqlx::Row as _;

    let user_id = claims.sub;

    // Fetch the drive node — verify ownership
    let node_row = sqlx::query(
        r#"
        SELECT n.name, n.node_type::text, n.owner_id, n.target_id
        FROM drive.nodes n
        WHERE n.id = $1 AND n.deleted_at IS NULL
        "#,
    )
    .bind(id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::NotFound("Drive node not found".into()))?;

    let owner_id: Uuid = node_row.try_get("owner_id").map_err(|e| Error::Database(e.to_string()))?;
    if owner_id != user_id {
        return Err(Error::Forbidden("Accès refusé".into()));
    }

    let target_id: Option<Uuid> = node_row.try_get("target_id").map_err(|e| Error::Database(e.to_string()))?;
    let node_name: String = node_row.try_get("name").map_err(|e| Error::Database(e.to_string()))?;

    let target_id = target_id.ok_or_else(|| Error::NotFound("Ce nœud n'a pas de fichier associé".into()))?;

    // Look up the storage file record
    let file_row = sqlx::query(
        "SELECT bucket, key FROM storage.files WHERE id = $1 LIMIT 1",
    )
    .bind(target_id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::NotFound("Fichier de stockage introuvable".into()))?;

    let bucket: String = file_row.try_get("bucket").map_err(|e| Error::Database(e.to_string()))?;
    let key: String = file_row.try_get("key").map_err(|e| Error::Database(e.to_string()))?;

    // Stream file from storage backend
    let object = state.storage.get_object(&bucket, &key).await?;

    let content_type = object.content_type;
    let content_length = object.content_length;
    let filename = node_name;

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_LENGTH, content_length)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", filename),
        )
        .body(Body::from(object.data))
        .map_err(|e| Error::Internal(e.to_string()))?;

    Ok(response)
}

/// Request body for creating a share link from a Drive node.
#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct CreateNodeShareRequest {
    pub expires_in_hours: Option<i64>,
    pub password: Option<String>,
    pub max_downloads: Option<i32>,
    #[serde(default)]
    pub access_type: Option<String>,
}

/// Response returned after creating a share link for a Drive node.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct CreateNodeShareResponse {
    pub id: Uuid,
    pub token: String,
    pub url: String,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Create a public share link for a Drive node.
///
/// Resolves the node's underlying storage location then creates a share
/// row so the caller can expose a tokenised URL to external users.
#[utoipa::path(
    post,
    path = "/api/v1/drive/nodes/{id}/share",
    params(("id" = Uuid, Path, description = "Drive node ID")),
    request_body = CreateNodeShareRequest,
    responses(
        (status = 200, description = "Share link created", body = CreateNodeShareResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Node not found"),
    ),
    security(("bearerAuth" = [])),
    tag = "drive"
)]
#[tracing::instrument(skip(state, request))]
pub async fn create_node_share(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(request): Json<CreateNodeShareRequest>,
) -> Result<Json<CreateNodeShareResponse>> {
    use sqlx::Row as _;

    let user_id = claims.sub;

    let node_row = sqlx::query(
        r#"
        SELECT owner_id, target_id
        FROM drive.nodes
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .fetch_optional(&*state.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?
    .ok_or_else(|| Error::NotFound("Drive node not found".into()))?;

    let owner_id: Uuid = node_row
        .try_get("owner_id")
        .map_err(|e| Error::Database(e.to_string()))?;
    if owner_id != user_id {
        return Err(Error::Forbidden("Accès refusé".into()));
    }

    let target_id: Option<Uuid> = node_row
        .try_get("target_id")
        .map_err(|e| Error::Database(e.to_string()))?;
    let target_id = target_id
        .ok_or_else(|| Error::BadRequest("Ce nœud n'a pas de fichier partageable".into()))?;

    let file_row = sqlx::query("SELECT bucket, key FROM storage.files WHERE id = $1 LIMIT 1")
        .bind(target_id)
        .fetch_optional(&*state.pool)
        .await
        .map_err(|e| Error::Database(e.to_string()))?
        .ok_or_else(|| Error::NotFound("Fichier de stockage introuvable".into()))?;

    let bucket: String = file_row
        .try_get("bucket")
        .map_err(|e| Error::Database(e.to_string()))?;
    let key: String = file_row
        .try_get("key")
        .map_err(|e| Error::Database(e.to_string()))?;

    let token = uuid::Uuid::new_v4().to_string().replace('-', "");
    let expires_at = request
        .expires_in_hours
        .map(|hours| Utc::now() + Duration::hours(hours));
    let password_hash = match request.password.as_deref().filter(|s| !s.is_empty()) {
        Some(pwd) => Some(
            bcrypt::hash(pwd, bcrypt::DEFAULT_COST)
                .map_err(|_| Error::Internal("Failed to hash password".into()))?,
        ),
        None => None,
    };
    let access_type = request.access_type.as_deref().unwrap_or("download");

    let share = StorageTier3Repository::create_share(
        state.pool.inner(),
        user_id,
        &bucket,
        &key,
        &token,
        expires_at,
        password_hash,
        request.max_downloads,
        access_type,
    )
    .await
    .map_err(|e| Error::Internal(format!("Failed to create share: {}", e)))?;

    let base_url =
        std::env::var("NEXT_PUBLIC_STORAGE_URL").unwrap_or_else(|_| "http://localhost:3004".into());
    let base = base_url
        .trim_end_matches('/')
        .trim_end_matches("/api/v1")
        .trim_end_matches('/');
    let url = format!("{}/api/v1/shares/{}/access", base, token);

    tracing::info!(
        share_id = %share.id,
        node_id = %id,
        bucket = %bucket,
        "Drive node share link created"
    );

    Ok(Json(CreateNodeShareResponse {
        id: share.id,
        token,
        url,
        expires_at,
    }))
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
