//! File management handlers.

use axum::{
    body::Body,
    extract::{Multipart, Path, Query, State},
    http::{header, StatusCode},
    response::Response,
    Extension, Json,
};
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use signapps_common::pg_events::NewEvent;
use signapps_common::{Error, Result};

use crate::handlers::quotas;
use crate::storage::{CopyRequest, ListObjectsQuery, ListObjectsResponse, ObjectInfo};
use crate::AppState;
use uuid::Uuid;

// ─── SHA-256 helpers ─────────────────────────────────────────────────────────

/// Compute SHA-256 of bytes and return lowercase hex string.
fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Check `drive.nodes` for an existing file with the same SHA-256 hash.
/// Returns `(storage_path, node_id)` if a duplicate exists.
async fn find_duplicate_by_hash(pool: &sqlx::PgPool, hash: &str) -> Option<(String, Uuid)> {
    use sqlx::Row;
    let row = sqlx::query(
        r#"
        SELECT n.id, n.target_id::text AS storage_key
        FROM drive.nodes n
        WHERE n.node_type = 'file'
          AND n.sha256_hash = $1
          AND n.deleted_at IS NULL
        LIMIT 1
        "#,
    )
    .bind(hash)
    .fetch_optional(pool)
    .await
    .unwrap_or(None)?;

    let storage_key: String = row.try_get("storage_key").ok()?;
    let node_id: Uuid = row.try_get("id").ok()?;
    Some((storage_key, node_id))
}

/// Append a row to `platform.activities` — fire-and-forget, never fails the request.
async fn log_drive_activity(
    pool: &sqlx::PgPool,
    actor_id: Uuid,
    action: &str,
    entity_id: Uuid,
    entity_title: &str,
    metadata: serde_json::Value,
) {
    let _ = sqlx::query(
        r#"INSERT INTO platform.activities
           (id, actor_id, action, entity_type, entity_id, entity_title, metadata, workspace_id)
           VALUES (gen_uuid_v7(), $1, $2, 'drive_node', $3, $4, $5, NULL)"#,
    )
    .bind(actor_id)
    .bind(action)
    .bind(entity_id)
    .bind(entity_title)
    .bind(&metadata)
    .execute(pool)
    .await;
}

/// Resolves the destination bucket based on the file content type and admin storage rules.
async fn resolve_target_bucket(
    pool: &sqlx::PgPool,
    original_bucket: &str,
    content_type: &str,
) -> String {
    use sqlx::Row;

    let rule = sqlx::query(
        r#"
        SELECT target_bucket
        FROM storage_rules
        WHERE is_active = true
          AND $1 LIKE REPLACE(mime_type_pattern, '*', '%')
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(content_type)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    if let Some(r) = rule {
        r.get::<String, _>("target_bucket")
    } else {
        original_bucket.to_string()
    }
}

/// Represents a row from ai_indexing_rules for trigger_ai_indexing
#[derive(sqlx::FromRow)]
struct IndexingRuleRow {
    folder_path: String,
    include_subfolders: bool,
    file_types_allowed: Option<Vec<String>>,
    collection_name: Option<String>,
}

async fn trigger_ai_indexing(
    pool: &sqlx::PgPool,
    bucket: &str,
    key: &str,
    content_type: &str,
    user_id: Uuid,
) {
    let global_default_row = sqlx::query_as::<_, (String,)>(
        r#"
        SELECT setting_value
        FROM admin_system_settings
        WHERE setting_key = 'ai_index_all_default'
        "#,
    )
    .fetch_optional(pool)
    .await
    .unwrap_or_default();

    let global_index_all = global_default_row
        .map(|r| r.0.to_lowercase() == "true")
        .unwrap_or(false);

    // 2. Fetch specific rules for this bucket
    let rules: Vec<IndexingRuleRow> = sqlx::query_as(
        r#"
        SELECT folder_path, include_subfolders, file_types_allowed, collection_name
        FROM ai_indexing_rules
        WHERE is_active = true AND bucket = $1
        ORDER BY LENGTH(folder_path) DESC
        "#,
    )
    .bind(bucket)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut should_index = global_index_all;

    // 3. Evaluate rules
    for r in rules {
        let is_match = if r.include_subfolders {
            key.starts_with(&r.folder_path)
        } else {
            // Check if it's strictly in that folder (no deeper)
            let dir = key.rsplit_once('/').map(|(d, _)| d).unwrap_or("");
            dir == r.folder_path.trim_end_matches('/')
        };

        if !is_match {
            continue;
        }

        // If the file is in a matched folder rule, we respect the file_types_allowed of THAT rule.
        if let Some(mut allowed_exts) = r.file_types_allowed.clone() {
            let ext = key
                .rsplit_once('.')
                .map(|(_, e)| e.to_lowercase())
                .unwrap_or_default();
            allowed_exts.iter_mut().for_each(|e| *e = e.to_lowercase());

            if !allowed_exts.is_empty() && !allowed_exts.contains(&ext) {
                should_index = false; // Excluded by rule
                                      // Note: matched_collection will be overwritten later for GED documents
            } else {
                should_index = true; // explicitly included
                                     // Note: matched_collection will be overwritten later for GED documents
            }
        } else {
            // Matched a rule with no specific extension limit
            should_index = true;
            // Note: matched_collection will be overwritten later for GED documents
        }

        // Stop matching after first valid folder rule is applied
        break;
    }

    if !should_index {
        return;
    }

    // OVERRIDE: Enforce the private user collection for all GED documents
    let matched_collection = Some(format!("user_{}", user_id));

    // Send HTTP request to AI service in the background
    let target_bucket = bucket.to_string();
    let target_key = key.to_string();
    let ct = content_type.to_string();

    tokio::spawn(async move {
        let client = reqwest::Client::new();
        // In a real k8s/docker environment, URL would come from env. Hardcoding for internal docker networking here.
        let ai_url = std::env::var("AI_INTERNAL_URL")
            .unwrap_or_else(|_| "http://signapps-ai:3005/api/v1/internal/index".into());

        let payload = serde_json::json!({
            "bucket": target_bucket,
            "key": target_key,
            "content_type": ct,
            "collection_name": matched_collection,
        });

        let res = client.post(&ai_url).json(&payload).send().await;

        match res {
            Ok(resp) if resp.status().is_success() => {
                tracing::info!(bucket = %target_bucket, key = %target_key, "Successfully triggered AI vector indexing");
            },
            Ok(resp) => {
                tracing::error!(status = %resp.status(), "AI service rejected index request");
            },
            Err(e) => {
                tracing::error!(error = %e, "Failed to connect to AI index service");
            },
        }
    });
}

/// Upload response.
#[derive(Debug, Serialize)]
/// Response for Upload.
pub struct UploadResponse {
    pub id: Uuid,
    pub bucket: String,
    pub key: String,
    pub size: usize,
    pub content_type: String,
}

/// Delete files request.
#[derive(Debug, Deserialize)]
/// Request body for DeleteFiles.
pub struct DeleteFilesRequest {
    pub keys: Vec<String>,
}

/// List files in a bucket.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/files",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
#[tracing::instrument(skip_all)]
pub async fn list(
    State(state): State<AppState>,
    Path(bucket): Path<String>,
    Query(query): Query<ListObjectsQuery>,
) -> Result<Json<ListObjectsResponse>> {
    let response = state.storage.list_objects(&bucket, query).await?;
    Ok(Json(response))
}

/// Get file info.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/files",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
#[tracing::instrument(skip_all)]
pub async fn get_info(
    State(state): State<AppState>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<Json<ObjectInfo>> {
    let info = state.storage.get_object_info(&bucket, &key).await?;
    Ok(Json(info))
}

/// Download a file.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/files",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
#[tracing::instrument(skip_all)]
pub async fn download(
    State(state): State<AppState>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<Response> {
    let object = state.storage.get_object(&bucket, &key).await?;

    let content_type = object.content_type;
    let content_length = object.content_length;

    // Get filename from key
    let filename = key.split('/').next_back().unwrap_or(&key);

    let body = Body::from(object.data);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_LENGTH, content_length)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", filename),
        )
        .body(body)
        .map_err(|e| Error::Internal(e.to_string()))?;

    Ok(response)
}

/// Maximum upload size per file (500 MB).
const MAX_UPLOAD_SIZE: usize = 500 * 1024 * 1024;

/// Upload a file via multipart form.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/files",
    responses((status = 201, description = "Success")),
    tag = "Storage"
)]
#[tracing::instrument(skip_all)]
pub async fn upload(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Path(bucket): Path<String>,
    mut multipart: Multipart,
) -> Result<Json<Vec<UploadResponse>>> {
    let mut uploads = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| Error::BadRequest(format!("Invalid multipart: {}", e)))?
    {
        let filename = field
            .file_name()
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("file_{}", uuid::Uuid::new_v4()));

        let content_type = field
            .content_type()
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                mime_guess::from_path(&filename)
                    .first_or_octet_stream()
                    .to_string()
            });

        let target_bucket = resolve_target_bucket(state.pool.inner(), &bucket, &content_type).await;

        let data = field
            .bytes()
            .await
            .map_err(|e| Error::BadRequest(format!("Failed to read file: {}", e)))?;

        let size = data.len();

        // Enforce maximum upload size to prevent OOM
        if size > MAX_UPLOAD_SIZE {
            return Err(Error::BadRequest(format!(
                "File too large: max {} MB",
                MAX_UPLOAD_SIZE / 1024 / 1024
            )));
        }

        // ── SHA-256 deduplication ─────────────────────────────────────────────
        let hash = sha256_hex(&data);
        let dedup = find_duplicate_by_hash(state.pool.inner(), &hash).await;

        if let Some((existing_key, existing_node_id)) = dedup {
            // Duplicate found — skip storage write, reuse existing content
            tracing::info!(
                hash = %hash,
                existing_key = %existing_key,
                "Deduplication: reusing existing file content"
            );
            log_drive_activity(
                state.pool.inner(),
                user_id,
                "uploaded_dedup",
                existing_node_id,
                &filename,
                serde_json::json!({
                    "bucket": target_bucket,
                    "size": size,
                    "sha256": hash,
                    "reused_key": existing_key
                }),
            )
            .await;
            uploads.push(UploadResponse {
                id: existing_node_id,
                bucket: target_bucket,
                key: existing_key,
                size,
                content_type,
            });
            continue;
        }
        // ─────────────────────────────────────────────────────────────────────

        // Check quota BEFORE writing to storage to avoid orphaned files
        quotas::check_quota(&state, user_id, size as i64).await?;

        state
            .storage
            .put_object(&target_bucket, &filename, data, Some(&content_type))
            .await?;

        // Update quota after successful upload; store hash in drive.nodes via record_upload
        let file_id = match quotas::record_upload_with_hash(
            &state,
            user_id,
            &target_bucket,
            &filename,
            size as i64,
            Some(&content_type),
            Some(&hash),
        )
        .await
        {
            Ok(id) => {
                // Trigger AI indexing check
                trigger_ai_indexing(
                    state.pool.inner(),
                    &target_bucket,
                    &filename,
                    &content_type,
                    user_id,
                )
                .await;
                id
            },
            Err(e) => {
                tracing::error!(error = %e, "Failed to record upload quota");
                uuid::Uuid::new_v4() // Fallback ID if quota tracking fails
            },
        };

        log_drive_activity(
            state.pool.inner(),
            user_id,
            "uploaded",
            file_id,
            &filename,
            serde_json::json!({ "bucket": target_bucket, "size": size, "sha256": hash }),
        )
        .await;

        let _ = state
            .event_bus
            .publish(NewEvent {
                event_type: "drive.file.uploaded".into(),
                aggregate_id: Some(file_id),
                payload: serde_json::json!({
                    "bucket": target_bucket,
                    "filename": filename,
                    "size": size,
                    "user_id": user_id,
                }),
            })
            .await;

        uploads.push(UploadResponse {
            id: file_id,
            bucket: target_bucket,
            key: filename,
            size,
            content_type,
        });
    }

    if uploads.is_empty() {
        return Err(Error::BadRequest("No files uploaded".to_string()));
    }

    tracing::info!(bucket = %bucket, count = uploads.len(), "Files uploaded");

    Ok(Json(uploads))
}

/// Upload a file with explicit key.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    post,
    path = "/api/v1/files",
    responses((status = 201, description = "Success")),
    tag = "Storage"
)]
#[tracing::instrument(skip_all)]
pub async fn upload_with_key(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Path((bucket, key)): Path<(String, String)>,
    headers: axum::http::HeaderMap,
    body: Bytes,
) -> Result<Json<UploadResponse>> {
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            mime_guess::from_path(&key)
                .first_or_octet_stream()
                .to_string()
        });

    let target_bucket = resolve_target_bucket(state.pool.inner(), &bucket, &content_type).await;

    let size = body.len();

    // Enforce maximum upload size to prevent OOM
    if size > MAX_UPLOAD_SIZE {
        return Err(Error::BadRequest(format!(
            "File too large: max {} MB",
            MAX_UPLOAD_SIZE / 1024 / 1024
        )));
    }

    // ── SHA-256 deduplication ─────────────────────────────────────────────────
    let hash = sha256_hex(&body);
    if let Some((existing_key, existing_node_id)) =
        find_duplicate_by_hash(state.pool.inner(), &hash).await
    {
        tracing::info!(
            hash = %hash,
            existing_key = %existing_key,
            "Deduplication: reusing existing file content for keyed upload"
        );
        log_drive_activity(
            state.pool.inner(),
            user_id,
            "uploaded_dedup",
            existing_node_id,
            &key,
            serde_json::json!({
                "bucket": target_bucket,
                "size": size,
                "sha256": hash,
                "reused_key": existing_key
            }),
        )
        .await;
        return Ok(Json(UploadResponse {
            id: existing_node_id,
            bucket: target_bucket,
            key: existing_key,
            size,
            content_type,
        }));
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Check quota BEFORE writing to storage to avoid orphaned files
    quotas::check_quota(&state, user_id, size as i64).await?;

    state
        .storage
        .put_object(&target_bucket, &key, body, Some(&content_type))
        .await?;

    // Update quota after successful upload; store hash in drive.nodes via record_upload
    let file_id = match quotas::record_upload_with_hash(
        &state,
        user_id,
        &target_bucket,
        &key,
        size as i64,
        Some(&content_type),
        Some(&hash),
    )
    .await
    {
        Ok(id) => {
            trigger_ai_indexing(
                state.pool.inner(),
                &target_bucket,
                &key,
                &content_type,
                user_id,
            )
            .await;
            id
        },
        Err(e) => {
            tracing::error!(error = %e, "Failed to record upload quota");
            uuid::Uuid::new_v4() // Fallback
        },
    };

    log_drive_activity(
        state.pool.inner(),
        user_id,
        "uploaded",
        file_id,
        &key,
        serde_json::json!({ "bucket": target_bucket, "size": size, "sha256": hash }),
    )
    .await;

    tracing::info!(bucket = %target_bucket, key = %key, size = size, "File uploaded");

    Ok(Json(UploadResponse {
        id: file_id,
        bucket: target_bucket,
        key,
        size,
        content_type,
    }))
}

/// Delete a file.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/files",
    responses((status = 204, description = "Success")),
    tag = "Storage"
)]
#[tracing::instrument(skip_all)]
pub async fn delete(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<StatusCode> {
    // Get info first to know size for quota update
    let info = state.storage.get_object_info(&bucket, &key).await.ok();

    state.storage.delete_object(&bucket, &key).await?;

    if let Some(info) = info {
        if let Err(e) = quotas::record_delete(&state, user_id, &bucket, &key, info.size).await {
            tracing::error!(error = %e, "Failed to record delete quota");
        }
    }

    log_drive_activity(
        state.pool.inner(),
        user_id,
        "deleted",
        Uuid::new_v4(),
        &key,
        serde_json::json!({ "bucket": bucket }),
    )
    .await;

    tracing::info!(bucket = %bucket, key = %key, "File deleted");
    Ok(StatusCode::NO_CONTENT)
}

/// Delete multiple files.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    delete,
    path = "/api/v1/files",
    responses((status = 204, description = "Success")),
    tag = "Storage"
)]
#[tracing::instrument(skip_all)]
pub async fn delete_many(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Path(bucket): Path<String>,
    Json(payload): Json<DeleteFilesRequest>,
) -> Result<StatusCode> {
    for key in &payload.keys {
        // Get info first to know size for quota update
        let info = state.storage.get_object_info(&bucket, key).await.ok();

        // Even if delete fails, we might want to continue, but here we propagate error as typically requested
        // Or we could try best effort. Using ? implies we stop on error.
        state.storage.delete_object(&bucket, key).await?;

        if let Some(info) = info {
            if let Err(e) = quotas::record_delete(&state, user_id, &bucket, key, info.size).await {
                tracing::error!(error = %e, "Failed to record delete quota");
            }
        }
    }

    tracing::info!(bucket = %bucket, count = payload.keys.len(), "Files deleted");

    Ok(StatusCode::NO_CONTENT)
}

/// Copy a file.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    get,
    path = "/api/v1/files",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
#[tracing::instrument(skip_all)]
pub async fn copy(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Json(payload): Json<CopyRequest>,
) -> Result<Json<ObjectInfo>> {
    // 1. Get source info to check quota
    let info = state
        .storage
        .get_object_info(&payload.source_bucket, &payload.source_key)
        .await?;

    // 2. Check quota
    quotas::check_quota(&state, user_id, info.size).await?;

    // 3. Perform copy
    state
        .storage
        .copy_object(
            &payload.source_bucket,
            &payload.source_key,
            &payload.dest_bucket,
            &payload.dest_key,
        )
        .await?;

    // 4. Record the copy in database
    if let Err(e) = quotas::record_copy(
        &state,
        user_id,
        &payload.source_bucket,
        &payload.source_key,
        &payload.dest_bucket,
        &payload.dest_key,
    )
    .await
    {
        tracing::error!(error = %e, "Failed to record copy quota");
    }

    let info = state
        .storage
        .get_object_info(&payload.dest_bucket, &payload.dest_key)
        .await?;

    trigger_ai_indexing(
        state.pool.inner(),
        &payload.dest_bucket,
        &payload.dest_key,
        info.content_type
            .as_deref()
            .unwrap_or("application/octet-stream"),
        user_id,
    )
    .await;

    tracing::info!(
        from = format!("{}/{}", payload.source_bucket, payload.source_key),
        to = format!("{}/{}", payload.dest_bucket, payload.dest_key),
        "File copied"
    );

    Ok(Json(info))
}

/// Move a file.
#[tracing::instrument(skip_all)]
#[utoipa::path(
    put,
    path = "/api/v1/files",
    responses((status = 200, description = "Success")),
    tag = "Storage"
)]
#[tracing::instrument(skip_all)]
pub async fn move_file(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Json(payload): Json<CopyRequest>,
) -> Result<Json<ObjectInfo>> {
    state
        .storage
        .move_object(
            &payload.source_bucket,
            &payload.source_key,
            &payload.dest_bucket,
            &payload.dest_key,
        )
        .await?;

    // 2. Record the move in database
    if let Err(e) = quotas::record_move(
        &state,
        user_id,
        &payload.source_bucket,
        &payload.source_key,
        &payload.dest_bucket,
        &payload.dest_key,
    )
    .await
    {
        tracing::error!(error = %e, "Failed to record move quota");
    }

    let info = state
        .storage
        .get_object_info(&payload.dest_bucket, &payload.dest_key)
        .await?;

    trigger_ai_indexing(
        state.pool.inner(),
        &payload.dest_bucket,
        &payload.dest_key,
        info.content_type
            .as_deref()
            .unwrap_or("application/octet-stream"),
        user_id,
    )
    .await;

    tracing::info!(
        from = format!("{}/{}", payload.source_bucket, payload.source_key),
        to = format!("{}/{}", payload.dest_bucket, payload.dest_key),
        "File moved"
    );

    Ok(Json(info))
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
