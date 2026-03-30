//! Bucket management handlers.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use signapps_common::{Error, Result};

use crate::storage::{BucketInfo, StorageStats};
use crate::AppState;

/// Create bucket request.
#[derive(Debug, Deserialize)]
/// Request body for CreateBucket.
pub struct CreateBucketRequest {
    pub name: String,
}

/// Bucket response with stats.
#[derive(Debug, Serialize)]
/// Response for Bucket.
pub struct BucketResponse {
    pub name: String,
    pub creation_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stats: Option<StorageStats>,
}

/// List all buckets.
#[tracing::instrument(skip_all)]
pub async fn list(State(state): State<AppState>) -> Result<Json<Vec<BucketInfo>>> {
    let buckets = state.storage.list_buckets().await?;
    Ok(Json(buckets))
}

/// Get bucket info with stats.
#[tracing::instrument(skip_all)]
pub async fn get(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<BucketResponse>> {
    // Check bucket exists
    if !state.storage.bucket_exists(&name).await? {
        return Err(Error::NotFound(format!("Bucket {}", name)));
    }

    let stats = state.storage.get_bucket_stats(&name).await.ok();

    Ok(Json(BucketResponse {
        name,
        creation_date: None,
        stats,
    }))
}

/// Create a new bucket.
#[tracing::instrument(skip_all)]
pub async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreateBucketRequest>,
) -> Result<Json<BucketResponse>> {
    // Validate bucket name
    if payload.name.is_empty() || payload.name.len() > 63 {
        return Err(Error::Validation(
            "Bucket name must be 1-63 characters".to_string(),
        ));
    }

    if !payload
        .name
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        return Err(Error::Validation(
            "Bucket name can only contain lowercase letters, numbers, and hyphens".to_string(),
        ));
    }

    // Check if already exists
    if state.storage.bucket_exists(&payload.name).await? {
        return Err(Error::AlreadyExists(format!("Bucket {}", payload.name)));
    }

    state.storage.create_bucket(&payload.name).await?;

    tracing::info!(bucket = %payload.name, "Bucket created");

    Ok(Json(BucketResponse {
        name: payload.name,
        creation_date: Some(chrono::Utc::now().to_rfc3339()),
        stats: None,
    }))
}

/// Delete a bucket.
#[tracing::instrument(skip_all)]
pub async fn delete(State(state): State<AppState>, Path(name): Path<String>) -> Result<StatusCode> {
    // Check bucket exists
    if !state.storage.bucket_exists(&name).await? {
        return Err(Error::NotFound(format!("Bucket {}", name)));
    }

    // Check if empty
    let query = crate::storage::ListObjectsQuery {
        prefix: None,
        delimiter: None,
        max_keys: Some(1),
        continuation_token: None,
    };

    let objects = state.storage.list_objects(&name, query).await?;
    if !objects.objects.is_empty() {
        return Err(Error::BadRequest(
            "Bucket is not empty. Delete all objects first.".to_string(),
        ));
    }

    state.storage.delete_bucket(&name).await?;

    tracing::info!(bucket = %name, "Bucket deleted");

    Ok(StatusCode::NO_CONTENT)
}
