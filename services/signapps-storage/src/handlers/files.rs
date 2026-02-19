//! File management handlers.

use axum::{
    body::Body,
    extract::{Multipart, Path, Query, State},
    http::{header, StatusCode},
    response::Response,
    Json,
};
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};

use crate::handlers::quotas;
use crate::storage::{CopyRequest, ListObjectsQuery, ListObjectsResponse, ObjectInfo};
use crate::AppState;
use uuid::Uuid;

/// Upload response.
#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub bucket: String,
    pub key: String,
    pub size: usize,
    pub content_type: String,
}

/// Delete files request.
#[derive(Debug, Deserialize)]
pub struct DeleteFilesRequest {
    pub keys: Vec<String>,
}

/// List files in a bucket.
#[tracing::instrument(skip(state))]
pub async fn list(
    State(state): State<AppState>,
    Path(bucket): Path<String>,
    Query(query): Query<ListObjectsQuery>,
) -> Result<Json<ListObjectsResponse>> {
    let response = state.storage.list_objects(&bucket, query).await?;
    Ok(Json(response))
}

/// Get file info.
#[tracing::instrument(skip(state))]
pub async fn get_info(
    State(state): State<AppState>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<Json<ObjectInfo>> {
    let info = state.storage.get_object_info(&bucket, &key).await?;
    Ok(Json(info))
}

/// Download a file.
#[tracing::instrument(skip(state))]
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

/// Upload a file via multipart form.
#[tracing::instrument(skip(state, multipart))]
pub async fn upload(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
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

        let data = field
            .bytes()
            .await
            .map_err(|e| Error::BadRequest(format!("Failed to read file: {}", e)))?;

        let size = data.len();

        // Check quota before upload
        quotas::check_quota(&state, user_id, size as i64).await?;

        state
            .storage
            .put_object(&bucket, &filename, data, Some(&content_type))
            .await?;

        // Update quota after successful upload
        if let Err(e) = quotas::record_upload(
            &state,
            user_id,
            &bucket,
            &filename,
            size as i64,
            Some(&content_type),
        )
        .await
        {
            tracing::error!(error = %e, "Failed to record upload quota");
        }

        uploads.push(UploadResponse {
            bucket: bucket.clone(),
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
#[tracing::instrument(skip(state, body))]
pub async fn upload_with_key(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
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

    let size = body.len();

    // Check quota before upload
    quotas::check_quota(&state, user_id, size as i64).await?;

    state
        .storage
        .put_object(&bucket, &key, body, Some(&content_type))
        .await?;

    // Update quota after successful upload
    if let Err(e) = quotas::record_upload(
        &state,
        user_id,
        &bucket,
        &key,
        size as i64,
        Some(&content_type),
    )
    .await
    {
        tracing::error!(error = %e, "Failed to record upload quota");
    }

    tracing::info!(bucket = %bucket, key = %key, size = size, "File uploaded");

    Ok(Json(UploadResponse {
        bucket,
        key,
        size,
        content_type,
    }))
}

/// Delete a file.
#[tracing::instrument(skip(state))]
pub async fn delete(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<StatusCode> {
    // Get info first to know size for quota update
    let info = state.storage.get_object_info(&bucket, &key).await.ok();

    state.storage.delete_object(&bucket, &key).await?;

    if let Some(info) = info {
        if let Err(e) =
            quotas::record_delete(&state, user_id, &bucket, &key, info.size as i64).await
        {
            tracing::error!(error = %e, "Failed to record delete quota");
        }
    }
    tracing::info!(bucket = %bucket, key = %key, "File deleted");
    Ok(StatusCode::NO_CONTENT)
}

/// Delete multiple files.
#[tracing::instrument(skip(state, payload))]
pub async fn delete_many(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
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
            if let Err(e) =
                quotas::record_delete(&state, user_id, &bucket, key, info.size as i64).await
            {
                tracing::error!(error = %e, "Failed to record delete quota");
            }
        }
    }

    tracing::info!(bucket = %bucket, count = payload.keys.len(), "Files deleted");

    Ok(StatusCode::NO_CONTENT)
}

/// Copy a file.
#[tracing::instrument(skip(state))]
pub async fn copy(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
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

    tracing::info!(
        from = format!("{}/{}", payload.source_bucket, payload.source_key),
        to = format!("{}/{}", payload.dest_bucket, payload.dest_key),
        "File copied"
    );

    Ok(Json(info))
}

/// Move a file.
#[tracing::instrument(skip(state))]
pub async fn move_file(
    State(state): State<AppState>,
    axum::Extension(user_id): axum::Extension<Uuid>,
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

    tracing::info!(
        from = format!("{}/{}", payload.source_bucket, payload.source_key),
        to = format!("{}/{}", payload.dest_bucket, payload.dest_key),
        "File moved"
    );

    Ok(Json(info))
}
