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

use crate::minio::{CopyRequest, ListObjectsQuery, ListObjectsResponse, ObjectInfo};
use crate::AppState;

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
    let response = state.minio.list_objects(&bucket, query).await?;
    Ok(Json(response))
}

/// Get file info.
#[tracing::instrument(skip(state))]
pub async fn get_info(
    State(state): State<AppState>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<Json<ObjectInfo>> {
    let info = state.minio.get_object_info(&bucket, &key).await?;
    Ok(Json(info))
}

/// Download a file.
#[tracing::instrument(skip(state))]
pub async fn download(
    State(state): State<AppState>,
    Path((bucket, key)): Path<(String, String)>,
) -> Result<Response> {
    let object = state.minio.get_object(&bucket, &key).await?;

    let content_type = object
        .content_type()
        .map(|s| s.to_string())
        .unwrap_or_else(|| "application/octet-stream".to_string());

    let content_length = object.content_length().unwrap_or(0);

    // Get filename from key
    let filename = key.split('/').next_back().unwrap_or(&key);

    // Collect body bytes from ByteStream
    let bytes = object
        .body
        .collect()
        .await
        .map_err(|e| Error::Internal(format!("Failed to read object body: {}", e)))?
        .into_bytes();
    let body = Body::from(bytes);

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

        state
            .minio
            .put_object(&bucket, &filename, data, Some(&content_type))
            .await?;

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

    state
        .minio
        .put_object(&bucket, &key, body, Some(&content_type))
        .await?;

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
    Path((bucket, key)): Path<(String, String)>,
) -> Result<StatusCode> {
    state.minio.delete_object(&bucket, &key).await?;
    tracing::info!(bucket = %bucket, key = %key, "File deleted");
    Ok(StatusCode::NO_CONTENT)
}

/// Delete multiple files.
#[tracing::instrument(skip(state, payload))]
pub async fn delete_many(
    State(state): State<AppState>,
    Path(bucket): Path<String>,
    Json(payload): Json<DeleteFilesRequest>,
) -> Result<StatusCode> {
    for key in &payload.keys {
        state.minio.delete_object(&bucket, key).await?;
    }

    tracing::info!(bucket = %bucket, count = payload.keys.len(), "Files deleted");

    Ok(StatusCode::NO_CONTENT)
}

/// Copy a file.
#[tracing::instrument(skip(state))]
pub async fn copy(
    State(state): State<AppState>,
    Json(payload): Json<CopyRequest>,
) -> Result<Json<ObjectInfo>> {
    state
        .minio
        .copy_object(
            &payload.source_bucket,
            &payload.source_key,
            &payload.dest_bucket,
            &payload.dest_key,
        )
        .await?;

    let info = state
        .minio
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
    Json(payload): Json<CopyRequest>,
) -> Result<Json<ObjectInfo>> {
    state
        .minio
        .move_object(
            &payload.source_bucket,
            &payload.source_key,
            &payload.dest_bucket,
            &payload.dest_key,
        )
        .await?;

    let info = state
        .minio
        .get_object_info(&payload.dest_bucket, &payload.dest_key)
        .await?;

    tracing::info!(
        from = format!("{}/{}", payload.source_bucket, payload.source_key),
        to = format!("{}/{}", payload.dest_bucket, payload.dest_key),
        "File moved"
    );

    Ok(Json(info))
}
